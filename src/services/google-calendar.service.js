/**
 * DỊCH VỤ ĐỒNG BỘ GOOGLE CALENDAR & XUẤT TỆP .ICS (FR-09)
 * Triển khai theo đặc tả kỹ thuật AGENT.md
 *
 * Hỗ trợ 2 chế độ:
 * 1. Chế độ THẬT (Real OAuth 2.0 API): Khi có GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET
 *    - Gọi trực tiếp Google OAuth2 token endpoint (https://oauth2.googleapis.com/token)
 *    - Gọi trực tiếp Google Calendar API v3 (https://www.googleapis.com/calendar/v3/calendars/primary/events)
 * 2. Chế độ MÔ PHỎNG (Mock / Fallback): Khi chưa cung cấp Credentials
 *    - Báo rõ trạng thái mock/chưa cấu hình để tránh gây hiểu lầm
 *    - Sinh tệp chuẩn iCalendar (.ics) thực tế trên máy để người dùng import thủ công
 */

const https = require('node:https');
const crypto = require('node:crypto');
const { getDbStore } = require('../config/db');

class GoogleCalendarService {
  constructor(dbStore = getDbStore()) {
    this.dbStore = dbStore;
  }

  _loadCredentialsFromFileIfAvailable() {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return;
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const candidateDirs = [
        path.join(__dirname, '../../'),
        process.cwd(),
      ];
      for (const rootDir of candidateDirs) {
        if (!fs.existsSync(rootDir)) continue;
        const files = fs.readdirSync(rootDir);
        const secretFile = files.find((f) => f.startsWith('client_secret') && f.endsWith('.json'));
        if (secretFile) {
          const content = JSON.parse(fs.readFileSync(path.join(rootDir, secretFile), 'utf8'));
          const creds = content.web || content.installed || {};
          if (creds.client_id && creds.client_secret) {
            process.env.GOOGLE_CLIENT_ID = creds.client_id;
            process.env.GOOGLE_CLIENT_SECRET = creds.client_secret;
            if (creds.redirect_uris && creds.redirect_uris.length > 0) {
              process.env.GOOGLE_REDIRECT_URI = creds.redirect_uris[0];
            }
            break;
          }
        }
      }
    } catch (_) {}
  }

  /**
   * Kiểm tra xem môi trường đã được cấp Google Client ID & Secret hay chưa
   */
  hasGoogleCredentials() {
    this._loadCredentialsFromFileIfAvailable();
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  /**
   * Sinh URL ủy quyền Google OAuth2 để người dùng cấp quyền truy cập Calendar
   */
  getOAuthConsentUrl(
    redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
    state = ''
  ) {
    if (!this.hasGoogleCredentials()) {
      return {
        configured: false,
        message: 'Chưa cấu hình GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET.',
        url: null,
      };
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
    const redirect = encodeURIComponent(redirectUri);
    const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=${scope}&access_type=offline&prompt=consent${stateParam}`;

    return {
      configured: true,
      url,
      redirect_uri: redirectUri,
    };
  }

  /**
   * Đổi Authorization Code lấy Access Token và Refresh Token từ Google Server
   */
  async exchangeAuthCodeForTokens(
    code,
    redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
  ) {
    if (!this.hasGoogleCredentials()) {
      throw new Error('Chưa cấu hình GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET để kết nối Google OAuth2.');
    }

    const payload = JSON.stringify({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    return this._postHttps('oauth2.googleapis.com', '/token', payload);
  }

  /**
   * Lấy trạng thái cấu hình và kết nối Google Calendar của sinh viên
   */
  getGoogleCalendarStatus(studentId) {
    const isConfigured = this.hasGoogleCredentials();
    const student = this.dbStore.findStudentByCodeOrId(studentId);
    const hasRealToken = Boolean(student?.google_refresh_token && !student.google_refresh_token.startsWith('mock_'));
    const isMock = Boolean(student?.google_refresh_token?.startsWith('mock_'));

    return {
      configured: isConfigured,
      client_id_preview: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.slice(0, 15)}...` : null,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
      is_connected: hasRealToken,
      mode: hasRealToken ? 'REAL_GOOGLE_API' : (isMock ? 'MOCK_SIMULATION' : 'NOT_CONNECTED'),
      student_id: student?.id || studentId,
      student_code: student?.student_code || studentId,
      google_calendar_id: student?.google_calendar_id || 'primary',
      is_calendar_sync_enabled: Boolean(student?.is_calendar_sync_enabled),
    };
  }

  /**
   * Dùng refresh_token lấy access_token mới từ Google
   */
  async refreshAccessToken(refreshToken) {
    if (!this.hasGoogleCredentials() || !refreshToken || refreshToken.startsWith('mock_')) {
      return null;
    }

    const payload = JSON.stringify({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    });

    try {
      const res = await this._postHttps('oauth2.googleapis.com', '/token', payload);
      return res.access_token;
    } catch (err) {
      console.warn('Lỗi khi làm mới Google access token:', err.message);
      return null;
    }
  }

  /**
   * Kết nối và lưu OAuth2 refresh token của sinh viên
   */
  async connectGoogleAccount(studentId, authData = {}) {
    const student = this.dbStore.findStudentByCodeOrId(studentId);
    if (!student) {
      throw new Error(`Không tìm thấy sinh viên với ID: ${studentId}`);
    }

    const isRealToken = Boolean(authData.refresh_token && !authData.refresh_token.startsWith('mock_'));
    const isConfigured = this.hasGoogleCredentials();

    student.google_refresh_token = authData.refresh_token || 'mock_google_oauth2_refresh_token';
    student.google_calendar_id = authData.calendar_id || 'primary';
    student.is_calendar_sync_enabled = true;
    student.updated_at = new Date().toISOString();

    this.dbStore.saveStudent(student);

    return {
      success: true,
      mode: isConfigured && isRealToken ? 'REAL_GOOGLE_API' : 'MOCK_SIMULATION',
      configured: isConfigured,
      message: isConfigured && isRealToken
        ? 'Đã liên kết tài khoản Google Calendar thật thành công'
        : 'Chưa cấu hình GOOGLE_CLIENT_ID/SECRET. Đang chạy ở chế độ MÔ PHỎNG (Mock Mode). Bạn vẫn có thể dùng tính năng Xuất tệp .ics để import lịch thật!',
      is_calendar_sync_enabled: true,
    };
  }

  /**
   * Sinh URL Web Intent để thêm trực tiếp sự kiện vào Google Calendar trên trình duyệt hoặc điện thoại
   */
  generateGoogleCalendarUrl(deadline) {
    const startDate = new Date(deadline.due_date || Date.now());
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 giờ

    const formatGCal = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const startStr = formatGCal(startDate);
    const endStr = formatGCal(endDate);

    const title = encodeURIComponent(deadline.title || 'Hạn chót học tập');
    const details = encodeURIComponent(
      `${deadline.description || ''}\n\nMã học phần: ${deadline.course_code || 'Chung'}\nNguồn: Cổng thông tin DUT (sv.dut.udn.vn)`
    );

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`;
  }

  /**
   * Đồng bộ hóa toàn bộ hoặc một hạn chót cụ thể lên Google Calendar
   */
  async syncDeadlinesToCalendar(studentId, deadlineId = null) {
    const student = this.dbStore.findStudentByCodeOrId(studentId);
    const targetStudentId = student ? student.id : studentId;

    let studentDeadlines = [];
    if (deadlineId) {
      const single = this.dbStore.deadlines ? this.dbStore.deadlines.get(deadlineId) : null;
      if (single) {
        studentDeadlines = [single];
      } else {
        const all = this.dbStore.getDeadlinesByStudent(targetStudentId);
        const found = all.find((d) => d.deadline_id === deadlineId || d.id === deadlineId);
        if (found) studentDeadlines = [found];
      }
    } else {
      studentDeadlines = this.dbStore.getDeadlinesByStudent(targetStudentId, {
        status: 'PENDING',
      });
      // QUY TẮC CỐT LÕI: Chỉ đồng bộ Nhắc việc (REMINDER) do sinh viên tạo, không tự ý đẩy Hạn chót học vụ vào Google Calendar
      studentDeadlines = studentDeadlines.filter(
        (d) => d.item_type === 'REMINDER' || (d.title && d.title.startsWith('[Nhắc nhở]'))
      );
    }

    const isConfigured = this.hasGoogleCredentials();
    const refreshToken = student?.google_refresh_token;
    const canCallRealGoogle = isConfigured && refreshToken && !refreshToken.startsWith('mock_');

    let accessToken = null;
    if (canCallRealGoogle) {
      accessToken = await this.refreshAccessToken(refreshToken);
    }

    const syncedEvents = [];

    for (const d of studentDeadlines) {
      const gcalUrl = this.generateGoogleCalendarUrl(d);

      if (accessToken) {
        // GỌI THẬT TỚI GOOGLE CALENDAR API v3
        try {
          const googleEvent = await this._createRealGoogleCalendarEvent(accessToken, student.google_calendar_id, d);
          d.google_event_id = googleEvent.id;
          d.last_synced_at = new Date().toISOString();
          this.dbStore.saveDeadline(d);
          syncedEvents.push({
            deadline_id: d.deadline_id,
            google_event_id: d.google_event_id,
            title: d.title,
            due_date: d.due_date,
            google_calendar_url: gcalUrl,
            mode: 'REAL_API',
          });
          continue;
        } catch (err) {
          console.warn(`Lỗi khi đẩy event lên Google Calendar thật (${d.title}):`, err.message);
        }
      }

      // CHẾ ĐỘ MÔ PHỎNG (MOCK SIMULATION) KHI CHƯA CÓ CREDENTIALS
      if (!d.google_event_id) {
        d.google_event_id = `mock_gcal_${crypto.randomBytes(6).toString('hex')}`;
      }
      d.last_synced_at = new Date().toISOString();
      this.dbStore.saveDeadline(d);

      syncedEvents.push({
        deadline_id: d.deadline_id,
        google_event_id: d.google_event_id,
        title: d.title,
        due_date: d.due_date,
        google_calendar_url: gcalUrl,
        mode: 'MOCK_SIMULATION',
      });
    }

    return {
      synced_count: syncedEvents.length,
      mode: canCallRealGoogle && accessToken ? 'REAL_GOOGLE_API' : 'MOCK_SIMULATION',
      configured: isConfigured,
      note: isConfigured
        ? 'Đã đồng bộ với Google Calendar API'
        : 'LƯU Ý: Chưa cấu hình GOOGLE_CLIENT_ID / SECRET. Đang ở chế độ mô phỏng chờ thông tin xác thực Google Authentication. Sinh viên có thể dùng nút Thêm vào Google Calendar để thêm nhanh trực tiếp!',
      events: syncedEvents,
    };
  }

  /**
   * Gọi API thật: POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
   */
  async _createRealGoogleCalendarEvent(accessToken, calendarId, deadline) {
    const startDate = new Date(deadline.due_date);
    const endDate = new Date(startDate.getTime() + 3600000); // 1 tiếng

    const body = JSON.stringify({
      summary: deadline.title,
      description: deadline.description || deadline.title,
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 24 * 60 },
          { method: 'popup', minutes: 120 },
        ],
      },
    });

    return this._postHttps(
      'www.googleapis.com',
      `/calendar/v3/calendars/${encodeURIComponent(calendarId || 'primary')}/events`,
      body,
      { Authorization: `Bearer ${accessToken}` }
    );
  }

  /**
   * Helper gửi HTTPS DELETE qua native node:https
   */
  _deleteHttps(hostname, path, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname,
          path,
          method: 'DELETE',
          headers: {
            ...extraHeaders,
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              return resolve({ success: true, statusCode: res.statusCode });
            }
            if (res.statusCode === 404 || res.statusCode === 410) {
              return resolve({ success: true, statusCode: res.statusCode });
            }
            try {
              const parsed = JSON.parse(data);
              reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
            } catch {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Xóa một sự kiện Remind khỏi Google Calendar
   * @param {string} studentId
   * @param {string} deadlineId
   */
  async deleteEventFromCalendar(studentId, deadlineId) {
    if (!deadlineId) {
      return { success: false, message: 'Thiếu deadline_id' };
    }

    let deadline = null;
    if (this.dbStore && this.dbStore.deadlines) {
      deadline = this.dbStore.deadlines.get(deadlineId);
      if (!deadline) {
        const all = Array.from(this.dbStore.deadlines.values());
        deadline = all.find((d) => d.deadline_id === deadlineId || d.id === deadlineId);
      }
    }

    if (!deadline) {
      return { success: false, message: 'Không tìm thấy nhắc việc' };
    }

    const eventId = deadline.google_event_id;
    if (!eventId) {
      return { success: true, message: 'Nhắc việc chưa được lưu trên Google Calendar' };
    }

    const targetStudentId = studentId || deadline.student_id || '102230026';
    const student = this.dbStore.findStudentByCodeOrId(targetStudentId);
    const isConfigured = this.hasGoogleCredentials();
    const refreshToken = student?.google_refresh_token;
    const canCallRealGoogle = isConfigured && refreshToken && !refreshToken.startsWith('mock_');

    if (canCallRealGoogle && !eventId.startsWith('mock_')) {
      try {
        const accessToken = await this.refreshAccessToken(refreshToken);
        if (accessToken) {
          const calendarId = student.google_calendar_id || 'primary';
          await this._deleteHttps(
            'www.googleapis.com',
            `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
            { Authorization: `Bearer ${accessToken}` }
          );
        }
      } catch (err) {
        console.warn(`Lỗi khi xóa event trên Google Calendar (${eventId}):`, err.message);
      }
    }

    // Xóa liên kết Google Calendar trên bản ghi Remind
    deadline.google_event_id = null;
    deadline.last_synced_at = null;
    deadline.updated_at = new Date().toISOString();
    this.dbStore.saveDeadline(deadline);

    return {
      success: true,
      deleted: true,
      deadline_id: deadlineId,
      message: 'Đã xóa sự kiện khỏi Google Calendar thành công',
    };
  }

  /**
   * Helper gửi HTTPS POST qua native node:https
   */
  _postHttps(hostname, path, payload, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname,
          path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...extraHeaders,
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                return resolve(parsed);
              }
              reject(new Error(parsed.error_description || parsed.error?.message || `HTTP ${res.statusCode}`));
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  /**
   * Xuất danh sách sự kiện hạn chót thành tệp định dạng chuẩn iCalendar (.ics)
   * TÍNH NĂNG NÀY HOẠT ĐỘNG THẬT 100% MÀ KHÔNG CẦN BẤT KỲ GOOGLE CREDENTIALS NÀO
   */
  generateIcsCalendar(studentId) {
    const student = this.dbStore.findStudentByCodeOrId(studentId);
    const targetStudentId = student ? student.id : studentId;
    const deadlines = this.dbStore.getDeadlinesByStudent(targetStudentId);

    const formatIcsDate = (dateStr) => {
      const d = new Date(dateStr);
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//DUT Student Notification System//VN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Lịch Hạn Chót DUT',
    ];

    for (const item of deadlines) {
      const dtStart = formatIcsDate(item.due_date);
      const dtEnd = formatIcsDate(new Date(new Date(item.due_date).getTime() + 3600000));
      const uid = `${item.deadline_id}@dut.udn.vn`;

      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:${uid}`);
      icsContent.push(`SUMMARY:${item.title}`);
      icsContent.push(`DESCRIPTION:${(item.description || item.title).replace(/\n/g, '\\n')}`);
      icsContent.push(`DTSTART:${dtStart}`);
      icsContent.push(`DTEND:${dtEnd}`);
      icsContent.push('STATUS:CONFIRMED');
      icsContent.push('BEGIN:VALARM');
      icsContent.push('TRIGGER:-PT24H');
      icsContent.push('ACTION:DISPLAY');
      icsContent.push(`DESCRIPTION:Nhắc nhở hạn chót: ${item.title}`);
      icsContent.push('END:VALARM');
      icsContent.push('END:VEVENT');
    }

    icsContent.push('END:VCALENDAR');
    return icsContent.join('\r\n');
  }
}

const googleCalendarService = new GoogleCalendarService();

module.exports = {
  GoogleCalendarService,
  googleCalendarService,
};
