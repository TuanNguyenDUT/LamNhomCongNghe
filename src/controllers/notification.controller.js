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
    courseService.dbStore.saveStudent(student);

    return {
      statusCode: 200,
      body: {
        status: 'success',
        message: 'Cập nhật tùy chọn chủ đề quan tâm thành công',
        data: {
          student_id: student.id,
          student_code: student.student_code,
          is_personalized_enabled: student.is_personalized_enabled,
          interested_topics: student.interested_topics,
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
    return {
      statusCode: 201,
      body: { status: 'success', message: 'Đã tạo mốc hạn chót thành công', data: deadline },
    };
  }

  async updateDeadline(id, payload = {}) {
    try {
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
      const res = await deadlineService.deleteDeadline(id);
      return { statusCode: 200, body: { status: 'success', message: res.message } };
    } catch (e) {
      return { statusCode: 404, body: { status: 'error', message: e.message } };
    }
  }

  // ==========================================
  // 4. GOOGLE CALENDAR SYNC & ICS (FR-09)
  // ==========================================
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
          default_courses: DEFAULT_COURSES,
        },
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
