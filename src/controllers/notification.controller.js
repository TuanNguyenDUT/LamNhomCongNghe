/**
 * TASK 11: Controller xử lý các Endpoint thu thập và truy vấn thông báo đa nguồn
 * Phụ trách: Nguyễn Hữu Tuấn
 */

const {
  classifyNotification,
  SOURCE_BASE_WEIGHTS,
  SCOPE_WEIGHTS,
  PRIORITY_RULES,
  URGENCY_TIME_KEYWORDS,
  DEFAULT_COURSES,
} = require('../services/classifier.service');

const VALID_SOURCE_TYPES = [
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
  if (payload.source_type && !VALID_SOURCE_TYPES.includes(payload.source_type)) {
    errors.push(
      `Trường "source_type" không hợp lệ. Giá trị hợp lệ: ${VALID_SOURCE_TYPES.join(', ')}`
    );
  }
  return errors;
}

class NotificationController {
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * GET /api/v1/notifications/sources
   * Lấy danh sách các kênh nguồn thu thập thông báo
   */
  async getSources() {
    const sources = await this.repository.getSources();
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: sources,
      },
    };
  }

  /**
   * POST /api/v1/notifications/collect
   * API thu thập 1 thông báo mới từ kênh nguồn (Portal, Khoa, Lớp học phần, Email SV, Ngoại khóa)
   */
  async collectSingle(payload) {
    const errors = validateNotificationPayload(payload);
    if (errors.length > 0) {
      return {
        statusCode: 400,
        body: {
          status: 'error',
          message: 'Dữ liệu thông báo thu thập không hợp lệ',
          errors,
        },
      };
    }

    const result = await this.repository.createCollectedNotification(payload);
    return {
      statusCode: result.inserted ? 201 : 200,
      body: {
        status: 'success',
        message: result.inserted
          ? 'Đã thu thập và lưu thông báo mới thành công'
          : 'Thông báo đã tồn tại (bỏ qua trùng lặp qua content_hash)',
        data: result,
      },
    };
  }

  /**
   * POST /api/v1/notifications/collect-batch
   * API thu thập hàng loạt thông báo từ Crawler / Webhook đa nguồn
   */
  async collectBatch(payload = {}) {
    const items = Array.isArray(payload.notifications) ? payload.notifications : [];
    if (items.length === 0) {
      return {
        statusCode: 400,
        body: {
          status: 'error',
          message: 'Mảng "notifications" không được để trống',
        },
      };
    }

    for (let i = 0; i < items.length; i += 1) {
      const itemErrors = validateNotificationPayload(items[i]);
      if (itemErrors.length > 0) {
        return {
          statusCode: 400,
          body: {
            status: 'error',
            message: `Phần tử thứ ${i} trong danh sách không hợp lệ`,
            errors: itemErrors,
          },
        };
      }
    }

    const result = await this.repository.createCollectedBatch(items);
    return {
      statusCode: 201,
      body: {
        status: 'success',
        message: 'Đã xử lý lô thông báo thu thập đa nguồn',
        data: result,
      },
    };
  }

  /**
   * GET /api/v1/notifications
   * API lấy danh sách thông báo cho Flutter Client
   */
  async listNotifications(queryParams = {}) {
    const result = await this.repository.listNotifications(queryParams);
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: result,
      },
    };
  }

  /**
   * GET /api/v1/notifications/:id
   * API xem chi tiết 1 thông báo
   */
  async getNotificationDetail(id, studentId = null) {
    const item = await this.repository.getNotificationById(id, studentId);
    if (!item) {
      return {
        statusCode: 404,
        body: {
          status: 'error',
          message: 'Không tìm thấy thông báo',
        },
      };
    }
    return {
      statusCode: 200,
      body: {
        status: 'success',
        data: item,
      },
    };
  }

  async setReadStatus(id, payload = {}) {
    const studentId = String(payload.student_id || '').trim();
    if (!studentId) {
      return {
        statusCode: 400,
        body: { status: 'error', message: 'Trường "student_id" là bắt buộc' },
      };
    }
    const result = await this.repository.setReadStatus(
      id,
      studentId,
      payload.is_read !== undefined ? Boolean(payload.is_read) : true
    );
    if (!result) {
      return {
        statusCode: 404,
        body: { status: 'error', message: 'Không tìm thấy thông báo' },
      };
    }
    return { statusCode: 200, body: { status: 'success', data: result } };
  }

  /**
   * POST /api/v1/notifications/classify
   * TASK 13: API xem trước kết quả bộ quy tắc (gắn tag môn học, phân loại chung/riêng, tính điểm ưu tiên)
   */
  async classifyPreview(payload = {}) {
    if (!payload.title && !payload.content) {
      return {
        statusCode: 400,
        body: {
          status: 'error',
          message: 'Vui lòng cung cấp ít nhất "title" hoặc "content" để phân loại',
        },
      };
    }
    const result = classifyNotification(payload);
    return {
      statusCode: 200,
      body: {
        status: 'success',
        message: 'Đã phân loại và tính điểm ưu tiên thông báo thành công',
        data: result,
      },
    };
  }

  /**
   * GET /api/v1/notifications/rules
   * TASK 13: API tra cứu danh mục quy tắc, trọng số và từ khóa nhận diện
   */
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

module.exports = {
  NotificationController,
  validateNotificationPayload,
};
