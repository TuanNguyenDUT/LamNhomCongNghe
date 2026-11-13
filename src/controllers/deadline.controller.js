/**
 * TASK 3, 4, 6: Controller xử lý REST API cho Deadline và Push Notification FCM
 */

class DeadlineController {
  /**
   * @param {import('../db/deadline.repository').DeadlineRepository} repository
   * @param {import('../services/fcm.service').FcmService} fcmService
   */
  constructor(repository, fcmService) {
    this.repository = repository;
    this.fcmService = fcmService;
  }

  async getCourses() {
    const courses = await this.repository.getCourses();
    return {
      status: 'SUCCESS',
      count: courses.length,
      data: courses,
    };
  }

  async getDeadlines({ subject, status, search }) {
    const deadlines = await this.repository.getDeadlines({ subject, status, search });
    return {
      status: 'SUCCESS',
      count: deadlines.length,
      data: deadlines,
    };
  }

  async getDeadlineById(id) {
    const deadline = await this.repository.getDeadlineById(id);
    if (!deadline) {
      const err = new Error(`Không tìm thấy deadline với ID = ${id}`);
      err.statusCode = 404;
      throw err;
    }
    return {
      status: 'SUCCESS',
      data: deadline,
    };
  }

  async createDeadline(body) {
    if (!body.title || !body.subject || !body.due_date) {
      const err = new Error('Thiếu trường bắt buộc: title, subject, due_date');
      err.statusCode = 400;
      throw err;
    }

    const created = await this.repository.createDeadline({
      title: body.title,
      subject: body.subject,
      due_date: body.due_date,
      note: body.note,
      student_id: body.student_id,
    });

    return {
      status: 'SUCCESS',
      message: 'Tạo deadline thành công',
      data: created,
    };
  }

  async updateDeadline(id, body) {
    const updated = await this.repository.updateDeadline(id, body);
    if (!updated) {
      const err = new Error(`Không tìm thấy deadline với ID = ${id} để cập nhật`);
      err.statusCode = 404;
      throw err;
    }
    return {
      status: 'SUCCESS',
      message: 'Cập nhật deadline thành công',
      data: updated,
    };
  }

  async toggleComplete(id) {
    const updated = await this.repository.toggleComplete(id);
    if (!updated) {
      const err = new Error(`Không tìm thấy deadline với ID = ${id}`);
      err.statusCode = 404;
      throw err;
    }
    return {
      status: 'SUCCESS',
      message: updated.is_completed ? 'Đã đánh dấu hoàn thành' : 'Đã bỏ đánh dấu hoàn thành',
      data: updated,
    };
  }

  async deleteDeadline(id) {
    const success = await this.repository.deleteDeadline(id);
    if (!success) {
      const err = new Error(`Không tìm thấy deadline với ID = ${id} để xóa`);
      err.statusCode = 404;
      throw err;
    }
    return {
      status: 'SUCCESS',
      message: `Đã xóa thành công deadline #${id}`,
    };
  }

  // ================= FCM DEVICE TOKENS (Task 6) =================
  async registerToken(body) {
    if (!body.device_token) {
      const err = new Error('Trường device_token là bắt buộc');
      err.statusCode = 400;
      throw err;
    }
    const tokenRecord = await this.fcmService.registerDeviceToken(body);
    return {
      status: 'SUCCESS',
      message: 'Lưu token thiết bị thành công',
      data: tokenRecord,
    };
  }

  async getDeviceTokens() {
    const tokens = await this.repository.getAllDeviceTokens();
    return {
      status: 'SUCCESS',
      count: tokens.length,
      data: tokens,
    };
  }

  async testPushNotification(body) {
    const { device_token, title, body: msgBody, data } = body;
    if (!device_token) {
      const err = new Error('Thiếu device_token');
      err.statusCode = 400;
      throw err;
    }
    const result = await this.fcmService.sendDeadlinePush({
      device_token,
      title: title || 'DUT Notification Test',
      body: msgBody || 'Kiểm tra gửi Push Notification qua FCM / APNs',
      data,
    });
    return {
      status: 'SUCCESS',
      message: 'Gửi push notification thành công',
      result,
    };
  }
}

module.exports = {
  DeadlineController,
};
