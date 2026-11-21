/**
 * DỊCH VỤ ĐỒNG BỘ GOOGLE CALENDAR & XUẤT TỆP .ICS (FR-09)
 * Kiến trúc Direct PostgreSQL Query.
 */

const https = require('node:https');
const crypto = require('node:crypto');
const { db: defaultDb, createDbAdapter } = require('../config/db');
const { StudentRepository } = require('../db/student.repository');
const { DeadlineRepository } = require('../db/deadline.repository');
const { encryptSecret, decryptSecret } = require('../config/secrets');
const { AppError, ValidationError } = require('../utils/errors');

class GoogleCalendarService {
  constructor({ pool = null, db = null, studentRepo = null, deadlineRepo = null } = {}) {
    this.db = db || (pool ? createDbAdapter(pool) : defaultDb);
    this.studentRepo = studentRepo || new StudentRepository(this.db);
    this.deadlineRepo = deadlineRepo || new DeadlineRepository(this.db);
  }

  _loadCredentialsFromFileIfAvailable() {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return;
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const candidateDirs = [path.join(__dirname, '../../'), process.cwd()];
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

  hasGoogleCredentials() {
    this._loadCredentialsFromFileIfAvailable();
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

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

  async getGoogleCalendarStatus(studentIdentifier) {
    const isConfigured = this.hasGoogleCredentials();
    const student = studentIdentifier
      ? await this.studentRepo.resolveStudent(studentIdentifier)
      : null;
    const hasRealToken = Boolean(student?.google_refresh_token?.startsWith('v1:'));
    const isMock = Boolean(student?.google_refresh_token?.startsWith('mock_'));

    return {
      configured: isConfigured,
      client_id_preview: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.slice(0, 15)}...` : null,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
      is_connected: hasRealToken,
      mode: hasRealToken ? 'REAL_GOOGLE_API' : (isMock ? 'MOCK_SIMULATION' : 'NOT_CONNECTED'),
      student_id: student?.id || studentIdentifier,
      student_code: student?.student_code || studentIdentifier,
      google_calendar_id: student?.google_calendar_id || 'primary',
      is_calendar_sync_enabled: Boolean(student?.is_calendar_sync_enabled),
    };
  }

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

  async connectGoogleAccount(studentIdentifier, authData = {}) {
    const student = await this.studentRepo.requireStudent(studentIdentifier);
    const isRealToken = Boolean(authData.refresh_token && !authData.refresh_token.startsWith('mock_'));
    const isConfigured = this.hasGoogleCredentials();
    if (!isRealToken) throw new ValidationError('Google chưa cấp refresh token. Vui lòng liên kết lại tài khoản');

    await this.studentRepo.updateGoogleTokens(student.id, {
      refreshToken: encryptSecret(authData.refresh_token),
      calendarId: authData.calendar_id || 'primary',
      enabled: true,
    });

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

  async disconnectGoogleAccount(studentIdentifier) {
    const student = await this.studentRepo.requireStudent(studentIdentifier);
    await this.studentRepo.updateGoogleTokens(student.id, {
      refreshToken: null,
      calendarId: 'primary',
      enabled: false,
    });
    return {
      success: true,
      is_connected: false,
      message: 'Đã ngắt kết nối Google Calendar thành công',
    };
  }

  generateGoogleCalendarUrl(deadline) {
    const startDate = new Date(deadline.due_date || Date.now());
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const formatGCal = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const startStr = formatGCal(startDate);
    const endStr = formatGCal(endDate);

    const title = encodeURIComponent(deadline.title || 'Hạn chót học tập');
    const details = encodeURIComponent(
      `${deadline.description || ''}\n\nMã học phần: ${deadline.course_code || 'Chung'}\nNguồn: Cổng thông tin DUT (sv.dut.udn.vn)`
    );

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`;
  }

  async syncDeadlinesToCalendar(studentIdentifier, deadlineId = null) {
    const student = await this.studentRepo.requireStudent(studentIdentifier);
    const targetStudentId = student.id;

    let studentDeadlines = [];
    if (deadlineId) {
      const single = await this.deadlineRepo.getDeadlineById(deadlineId);
      if (single && single.student_id !== targetStudentId) {
        throw new AppError('Không có quyền truy cập nhắc việc này', {httpStatus:403, code:'FORBIDDEN'});
      }
      if (single) {
        studentDeadlines = [single];
      }
    } else {
      studentDeadlines = await this.deadlineRepo.getDeadlinesByStudent(targetStudentId, {
      });
      studentDeadlines = studentDeadlines.filter(
        (d) => d.status !== 'COMPLETED' && (d.item_type === 'REMINDER' || (d.title && d.title.startsWith('[Nhắc nhở]')))
      );
    }

    const isConfigured = this.hasGoogleCredentials();
    const refreshToken = student.google_refresh_token?.startsWith('v1:')
      ? decryptSecret(student.google_refresh_token) : null;
    const canCallRealGoogle = isConfigured && refreshToken && !refreshToken.startsWith('mock_');

    if (!canCallRealGoogle) {
      return {
        synced_count: 0,
        mode: 'NOT_CONNECTED',
        is_connected: false,
        configured: isConfigured,
        message: 'Tài khoản chưa liên kết Google Calendar',
        events: [],
      };
    }

    let accessToken = null;
    if (canCallRealGoogle) {
      accessToken = await this.refreshAccessToken(refreshToken);
    }

    if (!accessToken) {
      return {
        synced_count: 0,
        mode: 'AUTH_EXPIRED',
        is_connected: false,
        configured: isConfigured,
        message: 'Phiên ủy quyền Google đã hết hạn. Vui lòng kết nối lại tài khoản Google trong Cài đặt.',
        events: [],
      };
    }

    const syncedEvents = [];
    const errors = [];

    for (const d of studentDeadlines) {
      const gcalUrl = this.generateGoogleCalendarUrl(d);

      try {
        const googleEvent = await this._createRealGoogleCalendarEvent(accessToken, student.google_calendar_id, d);
        d.google_event_id = googleEvent.id;
        d.last_synced_at = new Date().toISOString();
        await this.deadlineRepo.saveDeadline(d);
        syncedEvents.push({
          deadline_id: d.deadline_id,
          google_event_id: d.google_event_id,
          title: d.title,
          due_date: d.due_date,
          google_calendar_url: gcalUrl,
          mode: 'REAL_API',
        });
      } catch (err) {
        errors.push({deadline_id:d.deadline_id, message:'Không thể đồng bộ sự kiện Google Calendar'});
        console.warn(`Lỗi khi đẩy event lên Google Calendar thật (${d.title}):`, err.message);
      }
    }

    return {
      synced_count: syncedEvents.length,
      mode: 'REAL_GOOGLE_API',
      is_connected: true,
      configured: isConfigured,
      note: 'Đã đồng bộ với Google Calendar API',
      events: syncedEvents,
      errors,
    };
  }

  async _createRealGoogleCalendarEvent(accessToken, calendarId, deadline) {
    const startDate = new Date(deadline.due_date);
    const endDate = new Date(startDate.getTime() + 3600000);

    const eventId = deadline.google_event_id && !deadline.google_event_id.startsWith('mock_')
      ? deadline.google_event_id
      : crypto.createHash('sha256').update(`dut:${deadline.student_id}:${deadline.deadline_id}`).digest('hex');
    const event = {
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
    };
    const eventsPath = `/calendar/v3/calendars/${encodeURIComponent(calendarId || 'primary')}/events`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    if (deadline.google_event_id && !deadline.google_event_id.startsWith('mock_')) {
      try { return await this._postHttps('www.googleapis.com', `${eventsPath}/${encodeURIComponent(eventId)}`, JSON.stringify(event), headers, 'PUT'); }
      catch (error) { if (error.httpStatus !== 404) throw error; }
    }
    try { return await this._postHttps('www.googleapis.com', eventsPath, JSON.stringify({...event, id:eventId}), headers); }
    catch (error) {
      if (error.httpStatus !== 409) throw error;
      return this._postHttps('www.googleapis.com', `${eventsPath}/${encodeURIComponent(eventId)}`, JSON.stringify(event), headers, 'PUT');
    }
  }

  _deleteHttps(hostname, path, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname,
          path,
          method: 'DELETE',
          headers: { ...extraHeaders },
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
      req.setTimeout(15000, () => req.destroy(new Error('Google API timeout')));
      req.end();
    });
  }

  async deleteEventFromCalendar(studentIdentifier, deadlineId) {
    if (!deadlineId) {
      return { success: false, message: 'Thiếu deadline_id' };
    }

    const deadline = await this.deadlineRepo.getDeadlineById(deadlineId);
    if (!deadline) {
      return { success: false, message: 'Không tìm thấy nhắc việc' };
    }

    const owner = await this.studentRepo.requireStudent(studentIdentifier);
    if (owner.id !== deadline.student_id) {
      throw new AppError('Không có quyền truy cập nhắc việc này', {httpStatus:403, code:'FORBIDDEN'});
    }

    const eventId = deadline.google_event_id;
    if (!eventId) {
      return { success: true, message: 'Nhắc việc chưa được lưu trên Google Calendar' };
    }

    const targetStudentRef = studentIdentifier || deadline.student_id;
    const student = targetStudentRef ? await this.studentRepo.resolveStudent(targetStudentRef) : null;
    const isConfigured = this.hasGoogleCredentials();
    const refreshToken = student?.google_refresh_token?.startsWith('v1:')
      ? decryptSecret(student.google_refresh_token) : null;
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
        } else { throw new AppError('Phiên Google đã hết hạn. Vui lòng liên kết lại', {httpStatus:502, code:'GOOGLE_AUTH_EXPIRED'}); }
      } catch (err) {
        throw new AppError('Không thể xóa sự kiện trên Google Calendar; vui lòng thử lại', {httpStatus:502, code:'GOOGLE_DELETE_FAILED'});
      }
    } else if (!eventId.startsWith('mock_')) {
      throw new AppError('Vui lòng liên kết Google để xóa sự kiện đã đồng bộ', {httpStatus:400, code:'GOOGLE_NOT_CONNECTED'});
    }

    deadline.google_event_id = null;
    deadline.last_synced_at = null;
    deadline.updated_at = new Date().toISOString();
    await this.deadlineRepo.saveDeadline(deadline);

    return {
      success: true,
      deleted: true,
      deadline_id: deadlineId,
      message: 'Đã xóa sự kiện khỏi Google Calendar thành công',
    };
  }

  _postHttps(hostname, path, payload, extraHeaders = {}, method = 'POST') {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname,
          path,
          method,
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
              const error = new Error(parsed.error_description || parsed.error?.message || `HTTP ${res.statusCode}`);
              error.httpStatus = res.statusCode;
              reject(error);
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.on('error', reject);
      req.setTimeout(15000, () => req.destroy(new Error('Google API timeout')));
      req.write(payload);
      req.end();
    });
  }

  async generateIcsCalendar(studentIdentifier) {
    const student = await this.studentRepo.requireStudent(studentIdentifier);
    const deadlines = await this.deadlineRepo.getDeadlinesByStudent(student.id);

    const formatIcsDate = (dateStr) => {
      const d = new Date(dateStr);
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
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
