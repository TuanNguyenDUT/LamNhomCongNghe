/**
 * Task 6: Gửi Push Notification qua Firebase Cloud Messaging.
 * FCM tự định tuyến tới Android/Web; với iOS, Firebase chuyển tiếp qua APNs sau
 * khi APNs key/certificate đã được cấu hình trong Firebase Console.
 */

const { getFirebaseMessaging } = require('../config/firebase');

const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/installation-id-not-registered',
]);

class PushNotificationError extends Error {
  constructor(message, { code = 'PUSH_SEND_FAILED', httpStatus = 502, providerCode = null } = {}) {
    super(message);
    this.name = 'PushNotificationError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.providerCode = providerCode;
  }
}

function normalizeDataPayload(data = {}) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [String(key), String(value)])
  );
}

function buildFcmMessage({
  token,
  targetType = 'TOKEN',
  title,
  body,
  data = {},
  platform = 'ANDROID',
}) {
  const message = {
    notification: {
      title: String(title).trim(),
      body: String(body).trim(),
    },
    data: normalizeDataPayload(data),
  };

  if (targetType === 'FID') {
    message.fid = token;
  } else {
    message.token = token;
  }

  if (platform === 'ANDROID') {
    message.android = {
      priority: 'high',
      notification: {
        channelId: process.env.FCM_ANDROID_CHANNEL_ID || 'student_notifications',
        sound: 'default',
      },
    };
  } else if (platform === 'IOS') {
    message.apns = {
      headers: {
        'apns-priority': '10',
      },
      payload: {
        aps: {
          sound: 'default',
        },
      },
    };
  } else if (platform === 'WEB') {
    message.webpush = {
      headers: {
        TTL: '3600',
      },
    };
  }

  return message;
}

function getProviderErrorCode(error) {
  return error?.code || error?.errorInfo?.code || 'messaging/unknown-error';
}

class PushNotificationService {
  constructor({ deviceRepository, messagingFactory = getFirebaseMessaging } = {}) {
    this.deviceRepository = deviceRepository;
    this.messagingFactory = messagingFactory;
  }

  async sendToDevice({ deviceTokenId, title, body, data = {} }) {
    if (!this.deviceRepository) {
      throw new PushNotificationError('Thiếu DeviceTokenRepository cho PushNotificationService', {
        code: 'PUSH_SERVICE_MISCONFIGURED',
        httpStatus: 500,
      });
    }

    const device = await this.deviceRepository.getByIdForDelivery(deviceTokenId);
    if (!device) {
      throw new PushNotificationError('Không tìm thấy thiết bị đang hoạt động', {
        code: 'ACTIVE_DEVICE_NOT_FOUND',
        httpStatus: 404,
      });
    }

    const message = buildFcmMessage({
      token: device.registration_target,
      targetType: device.target_type,
      platform: device.platform,
      title,
      body,
      data,
    });

    try {
      const messaging = this.messagingFactory();
      const messageId = await messaging.send(message);
      await this.deviceRepository.recordPushSuccess(device.id);
      return {
        success: true,
        message_id: messageId,
        device_id: device.device_id,
        platform: device.platform,
      };
    } catch (error) {
      if (error?.code === 'FCM_NOT_CONFIGURED') {
        throw error;
      }

      const providerCode = getProviderErrorCode(error);
      const invalidToken = INVALID_TOKEN_ERROR_CODES.has(providerCode);
      await this.deviceRepository.recordPushFailure(device.id, providerCode, {
        deactivate: invalidToken,
      });

      throw new PushNotificationError(
        invalidToken
          ? 'FCM token không còn hợp lệ và đã được vô hiệu hóa'
          : 'Không thể gửi Push Notification qua Firebase',
        {
          code: invalidToken ? 'INVALID_DEVICE_TOKEN' : 'PUSH_SEND_FAILED',
          httpStatus: invalidToken ? 410 : 502,
          providerCode,
        }
      );
    }
  }
}

module.exports = {
  INVALID_TOKEN_ERROR_CODES,
  PushNotificationError,
  PushNotificationService,
  buildFcmMessage,
  normalizeDataPayload,
};
