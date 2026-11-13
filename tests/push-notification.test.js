/**
 * Task 6: Kiểm thử đăng ký thiết bị và tích hợp Firebase Cloud Messaging.
 * Firebase Messaging được inject bằng fake provider nên test không cần credential
 * và không gửi dữ liệu ra mạng.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { DatabaseManager } = require('../src/db/database');
const { handleApiRequest } = require('../src/api/router');
const { normalizePrivateKey } = require('../src/config/firebase');
const {
  PushNotificationService,
  buildFcmMessage,
} = require('../src/services/pushNotificationService');

async function invokeApi(
  dbManager,
  { method = 'GET', url = '/api/notifications', body = null, dependencies = {} } = {}
) {
  const payloadStr = body ? JSON.stringify(body) : '';
  const req = Readable.from(payloadStr ? [Buffer.from(payloadStr)] : []);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000', 'content-type': 'application/json' };

  let statusCode = 200;
  let rawResponse = '';
  const res = {
    writeHead(code) {
      statusCode = code;
    },
    end(chunk = '') {
      rawResponse += chunk;
    },
  };

  await handleApiRequest(req, res, dbManager, dependencies);
  return {
    status: statusCode,
    json: rawResponse ? JSON.parse(rawResponse) : null,
  };
}

test('Task 6: Device token được đăng ký, upsert và hủy an toàn', () => {
  const db = new DatabaseManager(':memory:');
  try {
    const first = db.registerDeviceToken({
      student_id: '102230099',
      token: 'fcm-token-alpha-123456789',
      platform: 'android',
      device_id: 'android-device-01',
      app_version: '1.0.0',
    });

    assert.equal(first.created, true);
    assert.equal(first.device.platform, 'ANDROID');
    assert.equal(first.device.target_type, 'TOKEN');
    assert.equal(first.device.is_active, true);
    assert.equal('token' in first.device, false, 'API model không được làm lộ raw FCM token');

    const updated = db.registerDeviceToken({
      student_id: '102230099',
      token: 'fcm-token-beta-987654321',
      platform: 'ANDROID',
      device_id: 'android-device-01',
      app_version: '1.1.0',
    });

    assert.equal(updated.created, false);
    assert.equal(updated.device.id, first.device.id);
    assert.equal(updated.device.app_version, '1.1.0');
    assert.equal(db.getActiveDeviceTokenForDelivery('android-device-01').token, 'fcm-token-beta-987654321');

    assert.equal(db.unregisterDeviceToken('android-device-01', '102230099'), true);
    assert.equal(db.getActiveDeviceTokenForDelivery('android-device-01'), null);
  } finally {
    db.close();
  }
});

test('Task 6: Một token active được chuyển thiết bị mà không vi phạm unique constraint', () => {
  const db = new DatabaseManager(':memory:');
  try {
    db.registerDeviceToken({
      student_id: '102230001',
      token: 'shared-fcm-token-123456789',
      platform: 'ANDROID',
      device_id: 'old-device',
    });
    db.registerDeviceToken({
      student_id: '102230002',
      token: 'shared-fcm-token-123456789',
      platform: 'IOS',
      device_id: 'new-device',
    });

    assert.equal(db.listStudentDevices('102230001').length, 0);
    assert.equal(db.listStudentDevices('102230002').length, 1);
    assert.equal(db.listStudentDevices('102230001', { activeOnly: false })[0].last_error_code, 'TOKEN_REASSIGNED');
  } finally {
    db.close();
  }
});

test('Task 6: REST API đăng ký và hủy thiết bị không trả token về client', async () => {
  const db = new DatabaseManager(':memory:');
  try {
    const register = await invokeApi(db, {
      method: 'POST',
      url: '/api/devices/register',
      body: {
        student_id: '102230099',
        token: 'api-fcm-token-123456789',
        platform: 'WEB',
        device_id: 'browser-profile-01',
        app_version: 'web-1.0.0',
      },
    });
    assert.equal(register.status, 201);
    assert.equal(register.json.status, 'success');
    assert.equal(register.json.data.device_id, 'browser-profile-01');
    assert.equal('token' in register.json.data, false);

    const upsert = await invokeApi(db, {
      method: 'POST',
      url: '/api/devices/register',
      body: {
        student_id: '102230099',
        fid: 'firebase-installation-id-987654321',
        platform: 'WEB',
        device_id: 'browser-profile-01',
      },
    });
    assert.equal(upsert.status, 200);
    assert.equal(upsert.json.data.target_type, 'FID');

    const invalid = await invokeApi(db, {
      method: 'POST',
      url: '/api/devices/register',
      body: {
        student_id: '102230099',
        token: 'token',
        platform: 'WINDOWS_PHONE',
        device_id: 'device-invalid',
      },
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.json.code, 'INVALID_DEVICE_REGISTRATION');

    const unregister = await invokeApi(db, {
      method: 'DELETE',
      url: '/api/devices/browser-profile-01?student_id=102230099',
    });
    assert.equal(unregister.status, 204);
    assert.equal(unregister.json, null);
    assert.equal(db.listStudentDevices('102230099').length, 0);
  } finally {
    db.close();
  }
});

test('Task 6: Payload FCM tạo đúng cấu hình Android, iOS, Web và data string', () => {
  const android = buildFcmMessage({
    token: 'android-token',
    platform: 'ANDROID',
    title: 'Thông báo',
    body: 'Nội dung',
    data: { notification_id: 125, urgent: true, empty: null },
  });
  assert.equal(android.android.priority, 'high');
  assert.deepEqual(android.data, { notification_id: '125', urgent: 'true' });

  const ios = buildFcmMessage({
    token: 'ios-token',
    platform: 'IOS',
    title: 'Thông báo',
    body: 'Nội dung',
  });
  assert.equal(ios.apns.headers['apns-priority'], '10');
  assert.equal(ios.apns.payload.aps.sound, 'default');

  const web = buildFcmMessage({
    token: 'web-token',
    platform: 'WEB',
    title: 'Thông báo',
    body: 'Nội dung',
  });
  assert.equal(web.webpush.headers.TTL, '3600');

  const fidMessage = buildFcmMessage({
    token: 'firebase-installation-id',
    targetType: 'FID',
    platform: 'ANDROID',
    title: 'Thông báo',
    body: 'Nội dung',
  });
  assert.equal(fidMessage.fid, 'firebase-installation-id');
  assert.equal('token' in fidMessage, false);
});

test('Task 6: Push service gửi thành công và không làm lộ token trong kết quả', async () => {
  const db = new DatabaseManager(':memory:');
  try {
    const registered = db.registerDeviceToken({
      student_id: '102230099',
      token: 'ios-fcm-token-secret-123456789',
      platform: 'IOS',
      device_id: 'iphone-01',
    });

    const service = new PushNotificationService({
      dbManager: db,
      messagingFactory: () => ({
        async send(message) {
          assert.equal(message.token, 'ios-fcm-token-secret-123456789');
          assert.equal(message.data.notification_id, '88');
          assert.ok(message.apns);
          return 'projects/test/messages/message-001';
        },
      }),
    });

    const result = await service.sendToDevice({
      deviceTokenId: registered.device.id,
      title: 'Lịch thi',
      body: 'Phòng thi A105',
      data: { notification_id: 88 },
    });

    assert.equal(result.success, true);
    assert.equal(result.message_id, 'projects/test/messages/message-001');
    assert.equal('token' in result, false);
  } finally {
    db.close();
  }
});

test('Task 6: Token bị FCM từ chối vĩnh viễn sẽ tự động vô hiệu hóa', async () => {
  const db = new DatabaseManager(':memory:');
  try {
    const registered = db.registerDeviceToken({
      student_id: '102230099',
      token: 'expired-fcm-token-123456789',
      platform: 'ANDROID',
      device_id: 'expired-device',
    });

    const service = new PushNotificationService({
      dbManager: db,
      messagingFactory: () => ({
        async send() {
          const error = new Error('Token is no longer registered');
          error.code = 'messaging/registration-token-not-registered';
          throw error;
        },
      }),
    });

    await assert.rejects(
      service.sendToDevice({
        deviceTokenId: registered.device.id,
        title: 'Test',
        body: 'Test invalid token',
      }),
      (error) => error.code === 'INVALID_DEVICE_TOKEN' && error.httpStatus === 410
    );

    assert.equal(db.getActiveDeviceTokenForDelivery('expired-device'), null);
    const inactive = db.listStudentDevices('102230099', { activeOnly: false })[0];
    assert.equal(inactive.failure_count, 1);
    assert.equal(inactive.last_error_code, 'messaging/registration-token-not-registered');
  } finally {
    db.close();
  }
});

test('Task 6: API gửi thử dùng push service đã inject', async () => {
  const db = new DatabaseManager(':memory:');
  try {
    const registered = db.registerDeviceToken({
      student_id: '102230099',
      token: 'test-endpoint-token-123456789',
      platform: 'WEB',
      device_id: 'test-browser',
    });

    const fakePushService = {
      async sendToDevice(payload) {
        assert.equal(payload.deviceTokenId, registered.device.id);
        assert.equal(payload.data.notification_id, 99);
        return {
          success: true,
          message_id: 'projects/test/messages/api-test',
          device_id: 'test-browser',
          platform: 'WEB',
        };
      },
    };

    const response = await invokeApi(db, {
      method: 'POST',
      url: '/api/push/test',
      body: {
        student_id: '102230099',
        device_id: 'test-browser',
        title: 'Thông báo thử',
        body: 'Nội dung thử',
        data: { notification_id: 99 },
      },
      dependencies: { pushService: fakePushService },
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.data.message_id, 'projects/test/messages/api-test');
  } finally {
    db.close();
  }
});

test('Task 6: Firebase private key từ env được chuẩn hóa ký tự xuống dòng', () => {
  assert.equal(
    normalizePrivateKey('-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n'),
    '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----'
  );
});
