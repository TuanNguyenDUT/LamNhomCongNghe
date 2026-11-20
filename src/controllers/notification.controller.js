/**
 * CONTROLLER XỬ LÝ CÁC ENDPOINT REST API HỆ THỐNG THÔNG BÁO DUT
 * Triển khai theo đặc tả AGENT.md (TSD Mục 3.3)
 */

const {
  classifyNotification,
  classifySmartNotification,
  SOURCE_BASE_WEIGHTS,
  SCOPE_WEIGHTS,
  PRIORITY_RULES,
  URGENCY_TIME_KEYWORDS,
  DEFAULT_COURSES,
} = require('../services/classifier.service');
const { courseService } = require('../services/course.service');
const { deadlineService } = require('../services/deadline.service');
const { googleCalendarService } = require('../services/google-calendar.service');
const { notificationService } = require('../services/notification.service');
const { crawlerManagerService } = require('../services/crawler-manager.service');

const VALID_SOURCE_TYPES = [
  'DUT_GENERAL',
  'DUT_TRAINING',
  'DUT_COURSE_CLASS',
  'DUT_STUDENT_AFFAIRS',
  'DUT_TESTING_QA',
  'DUT_TUITION_FEE',
  'DUT_REGULATIONS',
  'FB_CTSV',
  'FB_TUVAN_SV',
  // Tương thích ngược
  'TRAINING_DEPT',
  'FACULTY',
  'CLASS_SECTION',
  'STUDENT_EMAIL',
  'EXTRACURRICULAR',
];

function validateNotificationPayload(payload = {}) {
  const errors = [];
  if (!payload.title || String(payload.title).trim().length === 0) {
    errors.push('Trường "title" (tiêu đề thông báo) là bắt buộc');
  }
  if (!payload.content || String(payload.content).trim().length === 0) {
    errors.push('Trường "content" (nội dung thông báo) là bắt buộc');
  }
  const source = payload.source_channel || payload.source_type;
  if (source && !VALID_SOURCE_TYPES.includes(source)) {
    errors.push(`Trường nguồn thông báo không hợp lệ. Giá trị hợp lệ: ${VALID_SOURCE_TYPES.join(', ')}`);
  }
  return errors;
}

class NotificationController {
  constructor(repository = null) {
    this.repository = repository;
  }

  // ==========================================
  // 0. XÁC THỰC & ĐỊNH DANH SINH VIÊN QUA SV.DUT.UDN.VN
  // ==========================================
  async login(payload = {}) {
    const studentCode = payload.student_code || payload.username || payload.student_id;
    const password = payload.password;

    if (!studentCode || !password) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Vui lòng cung cấp mã sinh viên (student_code) và mật khẩu (password)' },
      };
    }

    try {
      const result = await courseService.login(studentCode, password);
      return {
        statusCode: 200,
        body: {
          status: 'success',
          message: 'Đăng nhập và định danh sinh viên sv.dut.udn.vn thành công',
          data: result,
        },
      };
    } catch (err) {
      return {
        statusCode: 401,
        body: { status: 'error', message: err.message },
      };
    }
  }

  async getCurrentUser(queryParams = {}) {
    const studentId = queryParams.student_id || queryParams.student_code || '102200001';
    const student = courseService.dbStore.findStudentByCodeOrId(studentId);
    if (!student) {
      return {
        statusCode: 404,
        body: { status: 'error', message: 'Không tìm thấy hồ sơ sinh viên' },
      };
    }
    const courses = await courseService.getEnrolledCoursesWithStats(student.id);
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          student: {
            id: student.id,
            student_code: student.student_code,
            full_name: student.full_name,
            faculty: student.faculty,
            cohort: student.cohort,
            class_name: student.class_name,
            dut_last_synced_at: student.dut_last_synced_at,
          },
          courses,
        },
      },
    };
  }

  async logout() {
    return {
      statusCode: 200,
      body: { status: 'success', message: 'Đăng xuất thành công' },
    };
  }

  // ==========================================
  // 0.1 CÁ NHÂN HÓA & TÙY CHỌN CHỦ ĐỀ QUAN TÂM
  // ==========================================
  async getStudentPreferences(queryParams = {}) {
    const studentId = queryParams.student_id || queryParams.student_code || '102230026';
    let student = courseService.dbStore.findStudentByCodeOrId(studentId);
    if (!student) {
      student = courseService.dbStore.findStudentByCodeOrId('102200001');
    }
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          student_id: student ? student.id : null,
          student_code: student ? student.student_code : studentId,
          is_personalized_enabled: student ? student.is_personalized_enabled !== false : true,
          interested_topics: (student && student.interested_topics) ? student.interested_topics : ['hoc_vu', 'hoc_bong', 'tuyen_dung'],
          is_calendar_sync_enabled: student ? Boolean(student.is_calendar_sync_enabled) : true,
          quick_reminder_options: (student && Array.isArray(student.quick_reminder_options))
            ? student.quick_reminder_options
            : ['1_hour', 'tonight', 'tomorrow_morning', '1_day', '3_days', '1_week'],
        },
      },
    };
  }

  async updateStudentPreferences(payload = {}) {
    const studentId = payload.student_id || payload.student_code || '102230026';
    let student = courseService.dbStore.findStudentByCodeOrId(studentId);
    if (!student) {
      student = courseService.dbStore.findStudentByCodeOrId('102200001');
    }
    if (!student) {
      return {
        statusCode: 404,
        body: { status: 'error', message: 'Không tìm thấy hồ sơ sinh viên' },
      };
    }

    if (payload.is_personalized_enabled !== undefined) {
      student.is_personalized_enabled = Boolean(payload.is_personalized_enabled);
    }
    if (Array.isArray(payload.interested_topics)) {
      student.interested_topics = payload.interested_topics;
    }
    if (payload.is_calendar_sync_enabled !== undefined) {
      student.is_calendar_sync_enabled = Boolean(payload.is_calendar_sync_enabled);
    }
    if (Array.isArray(payload.quick_reminder_options)) {
      student.quick_reminder_options = payload.quick_reminder_options;
    }
    courseService.dbStore.saveStudent(student);

    return {
      statusCode: 200,
      body: {
        status: 'success',
        message: 'Cập nhật cấu hình nhắc nhở và tùy chọn thành công',
        data: {
          student_id: student.id,
          student_code: student.student_code,
          is_personalized_enabled: student.is_personalized_enabled,
          interested_topics: student.interested_topics,
          is_calendar_sync_enabled: student.is_calendar_sync_enabled,
          quick_reminder_options: student.quick_reminder_options,
        },
      },
    };
  }

  // ==========================================
  // 1. ĐỒNG BỘ DUT & HỌC PHẦN (FR-01, FR-04)
  // ==========================================
  async syncCourses(payload = {}) {
    const studentCode = payload.student_code || payload.student_id || '102200001';
    const password = payload.password || '';
    const studentId = payload.student_id || studentCode;
    const result = await courseService.syncCoursesFromDut(studentId, studentCode, password);
    return {
      statusCode: 200,
      body: { status: 'success', message: 'Đồng bộ danh sách học phần từ sv.dut.udn.vn thành công', data: result },
    };
  }

  async getEnrolledCourses(queryParams = {}) {
    const studentId = queryParams.student_id || '102200001';
    const courses = await courseService.getEnrolledCoursesWithStats(studentId);
    return {
      statusCode: 200,
      body: { status: 'success', data: courses },
    };
  }

  async getCourseNotifications(courseCode, queryParams = {}) {
    const studentId = queryParams.student_id || null;
    const notifications = await courseService.getCourseNotifications(courseCode, studentId);
    return {
      statusCode: 200,
      body: { status: 'success', course_code: courseCode, total: notifications.length, data: notifications },
    };
  }

  // ==========================================
  // 2. BẢNG TIN & TIẾP NHẬN THÔNG BÁO (FR-02, FR-03, FR-05, FR-08)
  // ==========================================
  async listNotifications(queryParams = {}) {
    const result = await notificationService.getFeedNotifications(queryParams);
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          ...result,
          pagination: {
            page: 1,
            limit: result.limit,
            total: result.total,
            total_pages: Math.ceil((result.total || 1) / (result.limit || 10)),
          },
        },
      },
    };
  }

  async ingestNotification(payload = {}) {
    const errors = validateNotificationPayload(payload);
    if (errors.length > 0) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Dữ liệu thông báo thu thập không hợp lệ', errors },
      };
    }
    const result = await notificationService.ingestNotification(payload);
    return {
      statusCode: result.status === 'INSERTED' ? 201 : 200,
      body: { status: 'success', message: result.message, data: result.notification },
    };
  }

  async acknowledgeNotification(id, payload = {}) {
    const studentId = payload.student_id || '102200001';
    const result = await notificationService.acknowledgeEmergencyNotification(id, studentId);
    return {
      statusCode: 200,
      body: { status: 'success', data: result },
    };
  }

  // ==========================================
  // 3. QUẢN LÝ HẠN CHÓT (DEADLINES) (FR-06, FR-07)
  // ==========================================
  async listDeadlines(queryParams = {}) {
    const studentId = queryParams.student_id || '102200001';
    const list = await deadlineService.getDeadlines(studentId, queryParams);
    // Nhắc nhở/hạn chót luôn phải gắn liền với một thông báo cụ thể từ bản tin
    const validList = list.filter((d) => Boolean(d.notification_id));
    return {
      statusCode: 200,
      body: { status: 'success', total: validList.length, data: validList },
    };
  }

  async createDeadline(payload = {}) {
    if (!payload.title || !payload.due_date) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Trường "title" và "due_date" là bắt buộc' },
      };
    }
    if (!payload.notification_id) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Nhắc nhở/hạn chót phải đi kèm với mã thông báo từ bản tin (notification_id)' },
      };
    }
    const deadline = await deadlineService.createDeadline(payload);

    // Tự động đồng bộ lên Google Calendar nếu có tích chọn
    if (payload.sync_google_calendar || payload.auto_sync_google_calendar) {
      try {
        const studentId = payload.student_id || payload.student_code || '102230026';
        await googleCalendarService.syncDeadlinesToGoogleCalendar(studentId, deadline.deadline_id);
      } catch (gErr) {
        console.warn('Lỗi tự động đồng bộ Google Calendar khi tạo nhắc việc:', gErr.message);
      }
    }

    return {
      statusCode: 201,
      body: { status: 'success', message: 'Đã tạo mốc hạn chót thành công', data: deadline },
    };
  }

  async updateDeadline(id, payload = {}) {
    try {
      if (payload.status === 'COMPLETED') {
        // Tự động xóa khỏi Google Calendar nếu nhắc việc này được đánh dấu đã xong
        try {
          const dl = deadlineService.dbStore?.deadlines?.get(id);
          if (dl && dl.google_event_id) {
            await googleCalendarService.deleteEventFromCalendar(dl.student_id, id);
          }
        } catch (err) {
          console.warn('Lỗi tự động xóa khỏi Google Calendar khi hoàn thành nhắc việc:', err.message);
        }
      }

      const updated = await deadlineService.updateDeadline(id, payload);
      return {
        statusCode: 200,
        body: { status: 'success', message: 'Đã cập nhật hạn chót thành công', data: updated },
      };
    } catch (e) {
      return { statusCode: 404, body: { status: 'error', message: e.message } };
    }
  }

  async deleteDeadline(id) {
    try {
      // Tự động xóa khỏi Google Calendar nếu nhắc việc này bị xóa
      try {
        const dl = deadlineService.dbStore?.deadlines?.get(id);
        if (dl && dl.google_event_id) {
          await googleCalendarService.deleteEventFromCalendar(dl.student_id, id);
        }
      } catch (err) {
        console.warn('Lỗi tự động xóa khỏi Google Calendar khi xóa nhắc việc:', err.message);
      }

      const res = await deadlineService.deleteDeadline(id);
      return { statusCode: 200, body: { status: 'success', message: res.message } };
    } catch (e) {
      return { statusCode: 404, body: { status: 'error', message: e.message } };
    }
  }

  // ==========================================
  // 4. GOOGLE CALENDAR SYNC & ICS (FR-09)
  // ==========================================
  async getGoogleAuthUrl(queryParams = {}) {
    const studentId = queryParams.student_id || queryParams.student_code || '102230026';
    const redirectUri = queryParams.redirect_uri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
    const authData = googleCalendarService.getOAuthConsentUrl(redirectUri, studentId);
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          ...authData,
          student_id: studentId,
          redirect_uri: redirectUri,
        },
      },
    };
  }

  async getGoogleCalendarStatus(queryParams = {}) {
    const studentId = queryParams.student_id || queryParams.student_code || '102230026';
    const statusData = googleCalendarService.getGoogleCalendarStatus(studentId);
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: statusData,
      },
    };
  }

  async handleGoogleCallback(queryParams = {}) {
    const code = queryParams.code;
    const error = queryParams.error;
    const studentId = queryParams.state || '102230026';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

    if (error) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        rawBody: `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><title>Lỗi ủy quyền Google Calendar</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}.card{background:#fff;padding:32px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.08);max-width:440px;text-align:center;}.btn{display:inline-block;margin-top:20px;padding:10px 20px;background:#007AFF;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;}</style></head>
<body><div class="card"><div style="font-size:48px;margin-bottom:12px;">⚠️</div><h2>Cấp quyền không thành công</h2><p style="color:#64748b;font-size:14px;">Google từ chối hoặc bạn đã hủy ủy quyền: <strong>${error}</strong></p><a href="/" class="btn">Quay lại ứng dụng</a></div></body></html>`,
      };
    }

    if (!code) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Thiếu Authorization Code từ Google Callback' },
      };
    }

    try {
      const tokens = await googleCalendarService.exchangeAuthCodeForTokens(code, redirectUri);
      await googleCalendarService.connectGoogleAccount(studentId, {
        refresh_token: tokens.refresh_token || tokens.access_token || 'real_google_oauth2_authorized',
        calendar_id: 'primary',
      });
      const syncResult = await googleCalendarService.syncDeadlinesToCalendar(studentId);

      const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="4;url=/deadlines">
  <title>Ủy quyền Google Calendar thành công</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: linear-gradient(135deg, #eef2ff, #f8fafc); display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #ffffff; padding: 36px 32px; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); max-width: 460px; text-align: center; border: 1px solid rgba(0,0,0,0.05); }
    .icon { width: 72px; height: 72px; background: #e8f5e9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; font-size: 36px; color: #2e7d32; }
    h2 { margin: 0 0 10px; color: #0f172a; font-size: 22px; font-weight: 700; }
    p { color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; padding: 12px 24px; background: #1a73e8; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px; transition: background 0.2s; }
    .btn:hover { background: #1557b0; }
    .hint { font-size: 12px; color: #94a3b8; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h2>Kết nối Google Calendar thành công!</h2>
    <div class="badge">Sinh viên: ${studentId} • Đã đồng bộ ${syncResult.synced_count} hạn chót</div>
    <p>Tài khoản Google Calendar của bạn đã được liên kết chính thức. Tất cả hạn chót và thông báo học tập quan trọng sẽ được cập nhật tự động vào Lịch Google của bạn.</p>
    <a href="/deadlines" class="btn">Quay lại ứng dụng DUT ngay</a>
    <div class="hint">Hệ thống sẽ tự động chuyển trang sau vài giây...</div>
  </div>
</body>
</html>`;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        rawBody: html,
      };
    } catch (err) {
      console.error('Lỗi khi đổi token Google OAuth2:', err);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        rawBody: `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8"><title>Lỗi kết nối</title><style>body{font-family:sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}.card{background:#fff;padding:32px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.08);max-width:440px;text-align:center;}</style></head>
<body><div class="card"><div style="font-size:48px;margin-bottom:12px;">❌</div><h2>Đổi mã Token thất bại</h2><p style="color:#64748b;font-size:14px;">${err.message}</p><a href="/" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#007AFF;color:#fff;text-decoration:none;border-radius:10px;">Quay lại</a></div></body></html>`,
      };
    }
  }

  async connectGoogleCalendar(payload = {}) {
    const studentId = payload.student_id || '102200001';
    const result = await googleCalendarService.connectGoogleAccount(studentId, payload);
    return { statusCode: 200, body: { status: 'success', data: result } };
  }

  async syncGoogleCalendar(payload = {}) {
    const studentId = payload.student_id || payload.student_code || '102200001';
    const deadlineId = payload.deadline_id || null;
    const result = await googleCalendarService.syncDeadlinesToCalendar(studentId, deadlineId);
    return {
      statusCode: 200,
      body: { status: 'success', message: `Đã đồng bộ ${result.synced_count} sự kiện lên Google Calendar`, data: result },
    };
  }

  async deleteGoogleCalendarEvent(payload = {}) {
    const studentId = payload.student_id || payload.student_code || '102200001';
    const deadlineId = payload.deadline_id || null;
    const result = await googleCalendarService.deleteEventFromCalendar(studentId, deadlineId);
    return {
      statusCode: 200,
      body: { status: 'success', message: result.message || 'Đã xóa sự kiện khỏi Google Calendar', data: result },
    };
  }

  async exportIcsCalendar(queryParams = {}) {
    const studentId = queryParams.student_id || '102200001';
    const icsContent = googleCalendarService.generateIcsCalendar(studentId);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="dut_deadlines.ics"',
      },
      rawBody: icsContent,
    };
  }

  // ==========================================
  // 5. CRAWLER & CẬP NHẬT TỰ ĐỘNG ĐỊNH KỲ (FR-02)
  // ==========================================
  async triggerCrawler() {
    const stats = await crawlerManagerService.crawlAllSources();
    return {
      statusCode: 200,
      body: {
        status: 'success',
        message: `Đã hoàn thành cào thông báo từ sv.dut.udn.vn và 2 Fanpage FB (Lưu mới: ${stats.inserted_count}, Trùng lặp: ${stats.duplicate_count}, Cũ > 2 tháng: ${stats.skipped_old_count})`,
        data: stats,
      },
    };
  }

  async getCrawlerStatus() {
    const status = crawlerManagerService.getStatus();
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: status,
      },
    };
  }

  // ==========================================
  // 6. CÁC API LEGACY / TƯƠNG THÍCH TEST
  // ==========================================
  async getSources() {
    if (this.repository && this.repository.getSources) {
      const sources = await this.repository.getSources();
      return { statusCode: 200, body: { status: 'success', data: sources } };
    }
    const defaultSources = [
      { source_id: 1, source_code: 'PORTAL_PDT', source_name: 'Phòng Đào tạo Đại học (Portal)', source_type: 'TRAINING_DEPT' },
      { source_id: 2, source_code: 'FACULTY_IT', source_name: 'Khoa Công nghệ Thông tin', source_type: 'FACULTY' },
      { source_id: 3, source_code: 'LMS_CLASS', source_name: 'Kênh Lớp học phần / Giảng viên', source_type: 'CLASS_SECTION' },
      { source_id: 4, source_code: 'EMAIL_SV', source_name: 'Email Sinh viên (@sv.dut.udn.vn)', source_type: 'STUDENT_EMAIL' },
      { source_id: 5, source_code: 'CLUB_EXTRA', source_name: 'Đoàn Thanh niên & Kênh Ngoại khóa', source_type: 'EXTRACURRICULAR' },
    ];
    return { statusCode: 200, body: { status: 'success', data: defaultSources } };
  }

  async collectSingle(payload) {
    if (this.repository && this.repository.createCollectedNotification) {
      const errors = validateNotificationPayload(payload);
      if (errors.length > 0) {
        return { statusCode: 400, body: { status: 'error', message: 'Dữ liệu không hợp lệ', errors } };
      }
      const result = await this.repository.createCollectedNotification(payload);
      return {
        statusCode: result.inserted ? 201 : 200,
        body: {
          status: 'success',
          message: result.inserted ? 'Đã thu thập và lưu thông báo mới thành công' : 'Thông báo đã tồn tại',
          data: result,
        },
      };
    }
    return this.ingestNotification(payload);
  }

  async collectBatch(payload = {}) {
    if (this.repository && this.repository.createCollectedBatch) {
      const items = Array.isArray(payload.notifications) ? payload.notifications : [];
      const result = await this.repository.createCollectedBatch(items);
      return { statusCode: 201, body: { status: 'success', data: result } };
    }
    const items = Array.isArray(payload.notifications) ? payload.notifications : [];
    const results = [];
    for (const item of items) {
      results.push(await this.ingestNotification(item));
    }
    return { statusCode: 201, body: { status: 'success', data: results } };
  }

  async getNotificationDetail(id, studentId = null) {
    if (this.repository && this.repository.getNotificationById && !isNaN(Number(id))) {
      const item = await this.repository.getNotificationById(id, studentId);
      if (item) return { statusCode: 200, body: { status: 'success', data: item } };
    }
    const notifs = await notificationService.getFeedNotifications({ student_id: studentId, limit: 1000 });
    const item = notifs.notifications.find((n) => String(n.id) === String(id) || String(n.notification_id) === String(id));
    if (!item) return { statusCode: 404, body: { status: 'error', message: 'Không tìm thấy thông báo' } };
    return { statusCode: 200, body: { status: 'success', data: item } };
  }

  async setReadStatus(id, payload = {}) {
    const studentId = String(payload.student_id || '').trim();
    if (this.repository && this.repository.setReadStatus && !isNaN(Number(id))) {
      const result = await this.repository.setReadStatus(id, studentId, payload.is_read !== undefined ? Boolean(payload.is_read) : true);
      if (result) return { statusCode: 200, body: { status: 'success', data: result } };
    }
    const store = notificationService.dbStore;
    const student = store.findStudentByCodeOrId(studentId);
    const sId = student ? student.id : studentId;
    const record = store.student_notifications.find(
      (sn) => (sn.notification_id === id || String(sn.notification_id) === String(id)) && sn.student_id === sId
    );
    const isRead = payload.is_read !== undefined ? Boolean(payload.is_read) : true;
    if (record) {
      record.is_read = isRead;
      record.read_at = isRead ? new Date().toISOString() : null;
    } else {
      store.student_notifications.push({
        student_id: sId,
        notification_id: id,
        is_read: isRead,
        read_at: isRead ? new Date().toISOString() : null,
        is_acknowledged: false,
        acknowledged_at: null,
        created_at: new Date().toISOString(),
      });
    }
    return { statusCode: 200, body: { status: 'success', data: { notification_id: id, student_id: sId, is_read: isRead } } };
  }

  async classifyPreview(payload = {}) {
    if (!payload.title && !payload.content) {
      return { statusCode: 400, body: { status: 'error', message: 'Vui lòng cung cấp ít nhất "title" hoặc "content"' } };
    }
    const result = classifyNotification(payload);
    return { statusCode: 200, body: { status: 'success', data: result } };
  }

  async getCategories() {
    const { NOTIFICATION_CATEGORIES } = require('../services/classifier.service');
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: Object.values(NOTIFICATION_CATEGORIES).map((cat) => ({
          category: cat.code,
          category_code: cat.slug,
          category_name: cat.name,
          category_tag: cat.tag,
          description: cat.description,
          keywords: cat.keywords,
        })),
      },
    };
  }

  async getRules() {
    const { NOTIFICATION_CATEGORIES } = require('../services/classifier.service');
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          source_weights: SOURCE_BASE_WEIGHTS,
          scope_weights: SCOPE_WEIGHTS,
          priority_rules: PRIORITY_RULES,
          urgency_time_keywords: URGENCY_TIME_KEYWORDS,
          notification_categories: NOTIFICATION_CATEGORIES,
          default_courses: DEFAULT_COURSES,
        },
      },
    };
  }

  // ==========================================
  // 5. QUẢN LÝ THEO DÕI FANPAGE FACEBOOK (CUSTOM FB PAGES)
  // ==========================================
  async followFacebookPage(payload = {}) {
    const pageUrl = payload.page_url || payload.url;
    if (!pageUrl) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Vui lòng cung cấp "page_url" của Fanpage Facebook' },
      };
    }
    const studentId = payload.student_id || payload.student_code || '102200001';
    const pageName = payload.page_name || payload.name;

    try {
      const { fbCrawlerService } = require('../services/fb-crawler.service');
      const result = await fbCrawlerService.followPage({
        studentId,
        pageUrl,
        pageName,
      });
      return {
        statusCode: 201,
        body: result,
      };
    } catch (err) {
      return {
        statusCode: 400,
        body: { status: 'error', message: err.message },
      };
    }
  }

  async getFollowedFacebookPages(queryParams = {}) {
    const studentId = queryParams.student_id || queryParams.student_code || '102200001';
    try {
      const { fbCrawlerService } = require('../services/fb-crawler.service');
      const list = fbCrawlerService.getFollowedPages(studentId);
      return {
        statusCode: 200,
        body: {
          status: 'success',
          total: list.length,
          data: list,
        },
      };
    } catch (err) {
      return {
        statusCode: 500,
        body: { status: 'error', message: err.message },
      };
    }
  }

  async unfollowFacebookPage(pageId, queryParams = {}) {
    if (!pageId) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Vui lòng cung cấp ID của Fanpage cần hủy theo dõi' },
      };
    }
    const studentId = queryParams.student_id || queryParams.student_code;
    try {
      const { fbCrawlerService } = require('../services/fb-crawler.service');
      const ok = fbCrawlerService.unfollowPage(pageId, studentId);
      return {
        statusCode: 200,
        body: {
          status: 'success',
          message: ok ? 'Đã hủy theo dõi Fanpage thành công' : 'Không tìm thấy Fanpage để hủy',
          data: { id: pageId, unfollowed: ok },
        },
      };
    } catch (err) {
      return {
        statusCode: 500,
        body: { status: 'error', message: err.message },
      };
    }
  }

  async crawlCustomFacebookPage(payload = {}) {
    const pageUrl = payload.page_url || payload.url;
    if (!pageUrl) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Vui lòng cung cấp "page_url"' },
      };
    }
    const monthsLimit = payload.months_limit ? Number(payload.months_limit) : 2;
    const pageName = payload.page_name || payload.name;

    try {
      const { fbCrawlerService } = require('../services/fb-crawler.service');
      const result = await fbCrawlerService.scrapeCustomFacebookPage(pageUrl, {
        monthsLimit,
        pageName,
      });
      return {
        statusCode: 200,
        body: {
          status: 'success',
          data: result,
        },
      };
    } catch (err) {
      return {
        statusCode: 400,
        body: { status: 'error', message: err.message },
      };
    }
  }
}

const notificationController = new NotificationController();

module.exports = {
  NotificationController,
  notificationController,
  validateNotificationPayload,
};
