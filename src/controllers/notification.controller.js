/**
 * CONTROLLER XỬ LÝ CÁC ENDPOINT REST API HỆ THỐNG THÔNG BÁO DUT
 * Kiến trúc Direct PostgreSQL Query — Fail-fast & Full Error Propagation.
 */

const {
  classifyNotification,
  SOURCE_BASE_WEIGHTS,
  SCOPE_WEIGHTS,
  PRIORITY_RULES,
  URGENCY_TIME_KEYWORDS,
  DEFAULT_COURSES,
  NOTIFICATION_CATEGORIES,
} = require('../services/classifier.service');
const { db: defaultDb } = require('../config/db');
const { StudentRepository } = require('../db/student.repository');
const { NotificationRepository } = require('../db/postgres');
const { courseService } = require('../services/course.service');
const { deadlineService } = require('../services/deadline.service');
const { googleCalendarService } = require('../services/google-calendar.service');
const { notificationService } = require('../services/notification.service');
const { fbCrawlerService } = require('../services/fb-crawler.service');
const { crawlerManagerService } = require('../services/crawler-manager.service');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { AppError } = require('../utils/errors');
const { AuthService } = require('../services/auth.service');

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
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function validateNotificationPayload(payload = {}) {
  const errors = [];
  if (!payload.title || String(payload.title).trim().length === 0) {
    errors.push('Trường "title" (tiêu đề thông báo) là bắt buộc');
  }
  if (!payload.content || String(payload.content).trim().length === 0) {
    errors.push('Trường "content" (nội dung thông báo) là bắt buộc');
  }
  const source = payload.source_channel || payload.source_type;
  if (source && !VALID_SOURCE_TYPES.includes(source) && !String(source).startsWith('FB_')) {
    errors.push(`Trường nguồn thông báo không hợp lệ. Giá trị hợp lệ: ${VALID_SOURCE_TYPES.join(', ')}`);
  }
  return errors;
}

class NotificationController {
  constructor(repositoryOrDeps = null) {
    const isRepo =
      repositoryOrDeps &&
      typeof repositoryOrDeps.getSources === 'function' &&
      !repositoryOrDeps.repository;
    const deps = isRepo ? { repository: repositoryOrDeps } : (repositoryOrDeps || {});

    this.db = deps.db || defaultDb;
    this.authService = deps.authService || new AuthService(this.db);
    this.repository = deps.repository || new NotificationRepository(this.db);
    this.studentRepo = deps.studentRepo || new StudentRepository(this.db);
    this.courseSvc = deps.courseSvc || courseService;
    this.deadlineSvc = deps.deadlineSvc || deadlineService;
    this.calendarSvc = deps.calendarSvc || googleCalendarService;
    this.notificationSvc = deps.notificationSvc || notificationService;
    this.fbCrawlerSvc = deps.fbCrawlerSvc || fbCrawlerService;
    this.crawlerMgrSvc = deps.crawlerMgrSvc || crawlerManagerService;
  }

  _extractStudentIdentifier(source = {}) {
    return source.student_id || source.student_code || source.firebase_uid || source.username || null;
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

    const result = await this.courseSvc.login(studentCode, password);
    return {
      statusCode: 200,
      body: {
        status: 'success',
        message: 'Đăng nhập và định danh sinh viên sv.dut.udn.vn thành công',
        data: result,
      },
    };
  }

  async getCurrentUser(queryParams = {}) {
    const studentId = this._extractStudentIdentifier(queryParams);
    if (!studentId) {
      throw new ValidationError('Vui lòng cung cấp student_id hoặc student_code');
    }
    const student = await this.studentRepo.resolveStudent(studentId);
    if (!student) {
      return {
        statusCode: 404,
        body: { status: 'error', message: 'Không tìm thấy hồ sơ sinh viên' },
      };
    }
    const courses = await this.courseSvc.getEnrolledCoursesWithStats(student.id);
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
            major: student.major ?? null,
            program: student.program ?? null,
            avatar_url: student.avatar_url || `/api/v1/avatar/${student.student_code}.jpg`,
            dob: student.dob ?? null,
            gender: student.gender ?? null,
            school_email: student.school_email ?? null,
            personal_email: student.personal_email ?? null,
            phone: student.phone ?? null,
            dut_last_synced_at: student.dut_last_synced_at,
            is_personalized_enabled: student.is_personalized_enabled !== false,
            interested_topics: student.interested_topics || [
              'ACADEMIC',
              'GRADE',
              'ADMINISTRATIVE',
              'EVENT',
              'CAREER',
              'SCHOLARSHIP',
            ],
            total_courses: courses.length,
          },
          courses,
        },
      },
    };
  }

  async logout(token) {
    await this.authService.revoke(token);
    return {
      statusCode: 200,
      body: { status: 'success', message: 'Đăng xuất thành công' },
    };
  }

  // ==========================================
  // 0.1 CÁ NHÂN HÓA & TÙY CHỌN CHỦ ĐỀ QUAN TÂM
  // ==========================================
  async getStudentPreferences(queryParams = {}) {
    const studentId = this._extractStudentIdentifier(queryParams);
    const student = await this.studentRepo.requireStudent(studentId);
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          student_id: student.id,
          student_code: student.student_code,
          is_personalized_enabled: student.is_personalized_enabled !== false,
          interested_topics: student.interested_topics || ['ACADEMIC', 'GRADE', 'ADMINISTRATIVE', 'EVENT', 'CAREER', 'SCHOLARSHIP'],
          is_calendar_sync_enabled: Boolean(student.is_calendar_sync_enabled),
          quick_reminder_options: Array.isArray(student.quick_reminder_options)
            ? student.quick_reminder_options
            : ['1_hour', 'tonight', 'tomorrow_morning', '1_day', '3_days', '1_week'],
        },
      },
    };
  }

  async updateStudentPreferences(payload = {}) {
    const studentId = this._extractStudentIdentifier(payload);
    const updated = await this.studentRepo.updatePreferences(studentId, payload);

    return {
      statusCode: 200,
      body: {
        status: 'success',
        message: 'Cập nhật cấu hình nhắc nhở và tùy chọn thành công',
        data: {
          student_id: updated.id,
          student_code: updated.student_code,
          is_personalized_enabled: updated.is_personalized_enabled,
          interested_topics: updated.interested_topics,
          is_calendar_sync_enabled: updated.is_calendar_sync_enabled,
          quick_reminder_options: updated.quick_reminder_options,
        },
      },
    };
  }

  // ==========================================
  // 1. ĐỒNG BỘ DUT & HỌC PHẦN (FR-01, FR-04)
  // ==========================================
  async syncCourses(payload = {}) {
    const studentCode = payload.student_code || payload.student_id;
    const password = payload.password || '';
    const studentId = payload.student_id || studentCode;
    if (!studentId && !studentCode) {
      throw new ValidationError('Vui lòng cung cấp student_code hoặc student_id');
    }
    const result = await this.courseSvc.syncCoursesFromDut(studentId, studentCode, password);
    return {
      statusCode: 200,
      body: { status: 'success', message: 'Đồng bộ danh sách học phần từ sv.dut.udn.vn thành công', data: result },
    };
  }

  async getEnrolledCourses(queryParams = {}) {
    const studentId = this._extractStudentIdentifier(queryParams);
    if (!studentId) {
      return {
        statusCode: 200,
        body: { status: 'success', data: [] },
      };
    }
    const courses = await this.courseSvc.getEnrolledCoursesWithStats(studentId);
    return {
      statusCode: 200,
      body: { status: 'success', data: courses },
    };
  }

  async getCourseNotifications(courseCode, queryParams = {}) {
    const studentId = this._extractStudentIdentifier(queryParams);
    const notifications = await this.courseSvc.getCourseNotifications(courseCode, studentId);
    return {
      statusCode: 200,
      body: { status: 'success', course_code: courseCode, total: notifications.length, data: notifications },
    };
  }

  // ==========================================
  // 2. BẢNG TIN & TIẾP NHẬN THÔNG BÁO (FR-02, FR-03, FR-05, FR-08)
  // ==========================================
  async listNotifications(queryParams = {}) {
    const result = await this.notificationSvc.getFeedNotifications(queryParams);
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
    const result = await this.notificationSvc.ingestNotification(payload);
    return {
      statusCode: result.status === 'INSERTED' ? 201 : 200,
      body: { status: 'success', message: result.message, data: result.notification },
    };
  }

  async acknowledgeNotification(id, payload = {}) {
    const studentId = this._extractStudentIdentifier(payload);
    await this.notificationSvc.assertCanRead(id, studentId);
    const result = await this.notificationSvc.acknowledgeEmergencyNotification(id, studentId);
    return {
      statusCode: 200,
      body: { status: 'success', data: result },
    };
  }

  // ==========================================
  // 3. QUẢN LÝ HẠN CHÓT (DEADLINES) (FR-06, FR-07)
  // ==========================================
  async listDeadlines(queryParams = {}) {
    const studentId = this._extractStudentIdentifier(queryParams);
    const list = await this.deadlineSvc.getDeadlines(studentId, queryParams);
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
    await this.notificationSvc.assertCanRead(payload.notification_id, this._extractStudentIdentifier(payload));
    const deadline = await this.deadlineSvc.createDeadline(payload);

    let calendarWarning = null;
    let googleCalendarSynced = false;
    if (payload.sync_google_calendar || payload.auto_sync_google_calendar) {
      try {
        const studentId = this._extractStudentIdentifier(payload) || deadline.student_id;
        const syncRes = await this.calendarSvc.syncDeadlinesToCalendar(studentId, deadline.deadline_id);
        if (syncRes && syncRes.synced_count > 0 && syncRes.mode === 'REAL_GOOGLE_API') {
          googleCalendarSynced = true;
        } else {
          calendarWarning = 'Tài khoản chưa liên kết Google Calendar';
        }
      } catch (gErr) {
        console.warn('Lỗi tự động đồng bộ Google Calendar khi tạo nhắc việc:', gErr.message);
        calendarWarning = gErr.message;
      }
    }

    return {
      statusCode: 201,
      body: {
        status: 'success',
        message: 'Đã tạo mốc hạn chót thành công',
        data: {
          ...deadline,
          google_calendar_synced: googleCalendarSynced,
        },
        google_calendar_synced: googleCalendarSynced,
        ...(calendarWarning ? { calendar_warning: calendarWarning } : {}),
      },
    };
  }

  async updateDeadline(id, payload = {}) {
    const existing = await this.deadlineSvc.getDeadlineById(id);
    await this._assertDeadlineOwner(existing, this._extractStudentIdentifier(payload));
    if (payload.status === 'COMPLETED' && existing.google_event_id) {
      await this.calendarSvc.deleteEventFromCalendar(existing.student_id, id);
    }

    const updated = await this.deadlineSvc.updateDeadline(id, payload);
    return {
      statusCode: 200,
      body: { status: 'success', message: 'Đã cập nhật hạn chót thành công', data: updated },
    };
  }

  async deleteDeadline(id, studentId = null) {
    const existing = await this.deadlineSvc.getDeadlineById(id);
    await this._assertDeadlineOwner(existing, studentId);
    if (existing.google_event_id) {
      await this.calendarSvc.deleteEventFromCalendar(existing.student_id, id);
    }

    const res = await this.deadlineSvc.deleteDeadline(id);
    return { statusCode: 200, body: { status: 'success', message: res.message } };
  }

  async _assertDeadlineOwner(deadline, studentIdentifier) {
    if (!studentIdentifier) return; // Internal callers; HTTP always supplies the authenticated UUID.
    const student = await this.studentRepo.requireStudent(studentIdentifier);
    if (deadline.student_id !== student.id) {
      throw new AppError('Không có quyền truy cập nhắc việc này', { httpStatus: 403, code: 'FORBIDDEN' });
    }
  }

  // ==========================================
  // 4. GOOGLE CALENDAR SYNC & ICS (FR-09)
  // ==========================================
  async getGoogleAuthUrl(queryParams = {}) {
    const studentId = this._extractStudentIdentifier(queryParams);
    if (!studentId) {
      throw new ValidationError('Vui lòng cung cấp student_id hoặc student_code');
    }
    const student = await this.studentRepo.requireStudent(studentId);
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
    const state = this.calendarSvc.hasGoogleCredentials()
      ? await this.authService.createOAuthState(student.id) : '';
    const authData = this.calendarSvc.getOAuthConsentUrl(redirectUri, state);
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          ...authData,
          url: authData.url,
          auth_url: authData.url,
          student_id: studentId,
          redirect_uri: redirectUri,
        },
      },
    };
  }

  async getGoogleCalendarStatus(queryParams = {}) {
    const studentId = this._extractStudentIdentifier(queryParams);
    if (!studentId) {
      throw new ValidationError('Vui lòng cung cấp student_id hoặc student_code');
    }
    const statusData = await this.calendarSvc.getGoogleCalendarStatus(studentId);
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
    let studentId;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

    if (error) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        rawBody: `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><title>Lỗi ủy quyền Google Calendar</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}.card{background:#fff;padding:32px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.08);max-width:440px;text-align:center;}.btn{display:inline-block;margin-top:20px;padding:10px 20px;background:#007AFF;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;}</style></head>
<body><div class="card"><div style="font-size:48px;margin-bottom:12px;">⚠️</div><h2>Cấp quyền không thành công</h2><p style="color:#64748b;font-size:14px;">Google từ chối hoặc bạn đã hủy ủy quyền: <strong>${escapeHtml(error)}</strong></p><a href="/" class="btn">Quay lại ứng dụng</a></div></body></html>`,
      };
    }

    if (!code) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Thiếu Authorization Code từ Google Callback' },
      };
    }

    if (!queryParams.state) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Thiếu state định danh sinh viên từ Google Callback' },
      };
    }

    try {
      studentId = await this.authService.consumeOAuthState(queryParams.state);
      const tokens = await this.calendarSvc.exchangeAuthCodeForTokens(code, redirectUri);
      if (!tokens.refresh_token) throw new ValidationError('Google chưa cấp refresh token; vui lòng cấp quyền lại');
      await this.calendarSvc.connectGoogleAccount(studentId, {
        refresh_token: tokens.refresh_token,
        calendar_id: 'primary',
      });
      const syncResult = await this.calendarSvc.syncDeadlinesToCalendar(studentId);

      const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="4;url=/deadlines?scope=personal">
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
    <div class="badge">Đã đồng bộ ${syncResult.synced_count} nhắc việc</div>
    <p>Tài khoản Google Calendar của bạn đã được liên kết chính thức. Tất cả hạn chót và thông báo học tập quan trọng sẽ được cập nhật tự động vào Lịch Google của bạn.</p>
    <a href="/deadlines?scope=personal" class="btn">Quay lại ứng dụng DUT ngay</a>
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
        statusCode: err.httpStatus || 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        rawBody: `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8"><title>Lỗi kết nối</title><style>body{font-family:sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}.card{background:#fff;padding:32px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.08);max-width:440px;text-align:center;}</style></head>
<body><div class="card"><div style="font-size:48px;margin-bottom:12px;">❌</div><h2>Đổi mã Token thất bại</h2><p style="color:#64748b;font-size:14px;">${escapeHtml(err.message)}</p><a href="/" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#007AFF;color:#fff;text-decoration:none;border-radius:10px;">Quay lại</a></div></body></html>`,
      };
    }
  }

  async connectGoogleCalendar(payload = {}) {
    const studentId = this._extractStudentIdentifier(payload);
    const result = await this.calendarSvc.connectGoogleAccount(studentId, payload);
    return { statusCode: 200, body: { status: 'success', data: result } };
  }

  async syncGoogleCalendar(payload = {}) {
    const studentId = this._extractStudentIdentifier(payload);
    const deadlineId = payload.deadline_id || null;
    const result = await this.calendarSvc.syncDeadlinesToCalendar(studentId, deadlineId);
    if (!result.is_connected && result.synced_count === 0) {
      return {
        statusCode: 400,
        body: {
          status: 'error',
          code: 'GOOGLE_CALENDAR_NOT_CONNECTED',
          message: 'Tài khoản chưa liên kết Google Calendar. Vui lòng vào Cài đặt & Đồng bộ để kết nối Google Calendar.',
          data: result,
        },
      };
    }
    if (result.errors?.length) {
      return {statusCode:502, body:{status:'error', code:'GOOGLE_SYNC_FAILED', message:'Một số sự kiện chưa đồng bộ được. Vui lòng thử lại', data:result}};
    }
    return {
      statusCode: 200,
      body: { status: 'success', message: `Đã đồng bộ ${result.synced_count} sự kiện lên Google Calendar`, data: result },
    };
  }

  async disconnectGoogleCalendar(payload = {}) {
    const studentId = this._extractStudentIdentifier(payload);
    const result = await this.calendarSvc.disconnectGoogleAccount(studentId);
    return {
      statusCode: 200,
      body: { status: 'success', data: result },
    };
  }

  async deleteGoogleCalendarEvent(payload = {}) {
    const studentId = this._extractStudentIdentifier(payload);
    const deadlineId = payload.deadline_id || null;
    const result = await this.calendarSvc.deleteEventFromCalendar(studentId, deadlineId);
    return {
      statusCode: 200,
      body: { status: 'success', message: result.message || 'Đã xóa sự kiện khỏi Google Calendar', data: result },
    };
  }

  async exportIcsCalendar(queryParams = {}) {
    const studentId = this._extractStudentIdentifier(queryParams);
    const icsContent = await this.calendarSvc.generateIcsCalendar(studentId);
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
    const stats = await this.crawlerMgrSvc.crawlAllSources();
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
    const status = this.crawlerMgrSvc.getStatus();
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: status,
      },
    };
  }

  // ==========================================
  // 6. CÁC API THU THẬP, CHI TIẾT & ĐỌC THÔNG BÁO
  // ==========================================
  async getSources() {
    const sources = await this.repository.getSources();
    return { statusCode: 200, body: { status: 'success', data: sources } };
  }

  async collectSingle(payload) {
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

  async collectBatch(payload = {}) {
    const items = Array.isArray(payload.notifications) ? payload.notifications : [];
    const result = await this.repository.createCollectedBatch(items);
    return { statusCode: 201, body: { status: 'success', data: result } };
  }

  async getNotificationDetail(id, studentId = null) {
    if (studentId) await this.notificationSvc.assertCanRead(id, studentId);
    const item = await this.repository.getNotificationById(id, studentId);
    if (!item) {
      throw new NotFoundError('Không tìm thấy thông báo');
    }
    return { statusCode: 200, body: { status: 'success', data: item } };
  }

  async setReadStatus(id, payload = {}) {
    const studentId = String(this._extractStudentIdentifier(payload) || '').trim();
    await this.notificationSvc.assertCanRead(id, studentId);
    const isRead = payload.is_read !== undefined ? Boolean(payload.is_read) : true;
    const result = await this.repository.setReadStatus(id, studentId, isRead);
    return { statusCode: 200, body: { status: 'success', data: result } };
  }

  async classifyPreview(payload = {}) {
    if (!payload.title && !payload.content) {
      return { statusCode: 400, body: { status: 'error', message: 'Vui lòng cung cấp ít nhất "title" hoặc "content"' } };
    }
    const result = classifyNotification(payload);
    return { statusCode: 200, body: { status: 'success', data: result } };
  }

  async getCategories() {
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
    const studentId = this._extractStudentIdentifier(payload);
    const pageName = payload.page_name || payload.name;

    const result = await this.fbCrawlerSvc.followPage({
      studentId,
      pageUrl,
      pageName,
    });
    return {
      statusCode: 201,
      body: result,
    };
  }

  async getFollowedFacebookPages(queryParams = {}) {
    const studentId = this._extractStudentIdentifier(queryParams);
    const list = await this.fbCrawlerSvc.getFollowedPages(studentId);
    return {
      statusCode: 200,
      body: {
        status: 'success',
        total: list.length,
        data: list,
      },
    };
  }

  async unfollowFacebookPage(pageId, queryParams = {}) {
    if (!pageId) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Vui lòng cung cấp ID của Fanpage cần hủy theo dõi' },
      };
    }
    const studentId = this._extractStudentIdentifier(queryParams);
    const ok = await this.fbCrawlerSvc.unfollowPage(pageId, studentId);
    return {
      statusCode: 200,
      body: {
        status: 'success',
        message: ok ? 'Đã hủy theo dõi Fanpage thành công' : 'Không tìm thấy Fanpage để hủy',
        data: { id: pageId, unfollowed: ok },
      },
    };
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

    const result = await this.fbCrawlerSvc.scrapeCustomFacebookPage(pageUrl, {
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
  }
}

const notificationController = new NotificationController();

module.exports = {
  NotificationController,
  notificationController,
  validateNotificationPayload,
};
