/** Task 6: nghiệp vụ đăng ký/hủy thiết bị nhận Push Notification. */

const { PushNotificationService } = require('../services/pushNotificationService');

function validateRegistration(payload = {}) {
  const studentId = String(payload.student_id || '').trim();
  const target = String(payload.fid || payload.token || '').trim();
  const platform = String(payload.platform || '').trim().toUpperCase();
  const deviceId = String(payload.device_id || '').trim();

  if (!studentId || studentId.length > 64 || !/^[A-Za-z0-9._-]+$/.test(studentId)) {
    return 'student_id không hợp lệ';
  }
  if (!target || target.length > 4096) {
    return 'Firebase Installation ID hoặc FCM token không hợp lệ';
  }
  if (!['ANDROID', 'IOS', 'WEB'].includes(platform)) {
    return 'platform phải là ANDROID, IOS hoặc WEB';
  }
  if (!deviceId || deviceId.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(deviceId)) {
    return 'device_id không hợp lệ';
  }
  return null;
}

class DeviceController {
  constructor(repository, pushService = null) {
    this.repository = repository;
    this.pushService = pushService || new PushNotificationService({ deviceRepository: repository });
  }

  async register(payload = {}) {
    const error = validateRegistration(payload);
    if (error) {
      return {
        statusCode: 400,
        body: { status: 'error', code: 'INVALID_DEVICE_REGISTRATION', message: error },
      };
    }
    const result = await this.repository.registerDevice({
      student_id: String(payload.student_id).trim(),
      target: String(payload.fid || payload.token).trim(),
      target_type: payload.fid ? 'FID' : 'TOKEN',
      platform: String(payload.platform).trim().toUpperCase(),
      device_id: String(payload.device_id).trim(),
      app_version: payload.app_version ? String(payload.app_version).trim() : null,
    });
    return {
      statusCode: result.created ? 201 : 200,
      body: { status: 'success', data: result.device },
    };
  }

  async unregister(deviceId, studentId) {
    if (!studentId) {
      return {
        statusCode: 400,
        body: {
          status: 'error',
          code: 'STUDENT_ID_REQUIRED',
          message: 'Thiếu student_id để xác nhận thiết bị cần hủy đăng ký',
        },
      };
    }
    await this.repository.unregisterDevice(deviceId, studentId);
    return { statusCode: 204, body: null };
  }

  async sendTest(payload = {}) {
    const deviceId = String(payload.device_id || '').trim();
    const studentId = String(payload.student_id || '').trim();
    const title = String(payload.title || '').trim();
    const body = String(payload.body || '').trim();
    if (!deviceId || !studentId || !title || !body) {
      return {
        statusCode: 400,
        body: {
          status: 'error',
          code: 'INVALID_TEST_PUSH_PAYLOAD',
          message: 'Vui lòng cung cấp student_id, device_id, title và body',
        },
      };
    }
    const device = await this.repository.getActiveByDevice(deviceId, studentId);
    if (!device) {
      return {
        statusCode: 404,
        body: {
          status: 'error',
          code: 'ACTIVE_DEVICE_NOT_FOUND',
          message: 'Không tìm thấy thiết bị đang hoạt động',
        },
      };
    }
    const result = await this.pushService.sendToDevice({
      deviceTokenId: device.id,
      title,
      body,
      data: payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
        ? payload.data
        : {},
    });
    return { statusCode: 200, body: { status: 'success', data: result } };
  }
}

module.exports = {
  DeviceController,
  validateRegistration,
};
