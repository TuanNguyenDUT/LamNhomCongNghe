/** Task 6: kiểm thử đăng ký thiết bị và tích hợp Firebase Cloud Messaging. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { DeviceTokenRepository } = require('../src/db/device-token.repository');
const { DeviceController } = require('../src/controllers/device.controller');
const { deviceRouter } = require('../src/api/device.routes');
const { normalizePrivateKey } = require('../src/config/firebase');
const { PushNotificationService, buildFcmMessage } = require('../src/services/pushNotificationService');

async function callApi(controller, { method = 'GET', url = '/', body = null } = {}) {
  const raw = body ? JSON.stringify(body) : '';
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000', 'content-type': 'application/json' };
  let status = 200;
  let response = '';
  const res = {
    writeHead(code) { status = code; },
    end(chunk = '') { response += chunk; },
  };
  await deviceRouter(req, res, controller);
  return { status, json: response ? JSON.parse(response) : null };
}

test('Task 6: đăng ký, upsert và hủy thiết bị an toàn', async () => {
  const repository = new DeviceTokenRepository();
  const first = await repository.registerDevice({
    student_id: '102230099',
    target: 'fcm-token-alpha-123456789',
    target_type: 'TOKEN',
    platform: 'ANDROID',
    device_id: 'android-device-01',
    app_version: '1.0.0',
  });
  assert.equal(first.created, true);
  assert.equal(first.device.platform, 'ANDROID');
  assert.equal('registration_target' in first.device, false);

  const updated = await repository.registerDevice({
    student_id: '102230099',
    target: 'firebase-installation-id-987654321',
    target_type: 'FID',
    platform: 'ANDROID',
    device_id: 'android-device-01',
    app_version: '1.1.0',
  });
  assert.equal(updated.created, false);
  assert.equal(updated.device.id, first.device.id);
  assert.equal(updated.device.target_type, 'FID');
  assert.equal(
    (await repository.getActiveByDevice('android-device-01')).registration_target,
    'firebase-installation-id-987654321'
  );

  assert.equal(await repository.unregisterDevice('android-device-01', '102230099'), true);
  assert.equal(await repository.getActiveByDevice('android-device-01'), null);
});

test('Task 6: một registration target active được chuyển thiết bị', async () => {
  const repository = new DeviceTokenRepository();
  await repository.registerDevice({
    student_id: '102230001', target: 'shared-target-123456789', target_type: 'TOKEN',
    platform: 'ANDROID', device_id: 'old-device',
  });
  await repository.registerDevice({
    student_id: '102230002', target: 'shared-target-123456789', target_type: 'TOKEN',
    platform: 'ANDROID', device_id: 'new-device',
  });
  assert.equal((await repository.listStudentDevices('102230001')).length, 0);
  const oldDevice = (await repository.listStudentDevices('102230001', { activeOnly: false }))[0];
  assert.equal(oldDevice.last_error_code, 'TOKEN_REASSIGNED');
});

test('Task 6: REST API đăng ký và hủy không trả registration target', async () => {
  const repository = new DeviceTokenRepository();
  const controller = new DeviceController(repository);
  const registered = await callApi(controller, {
    method: 'POST',
    url: '/api/devices/register',
    body: {
      student_id: '102230099', fid: 'firebase-installation-id-987654321',
      platform: 'ANDROID', device_id: 'android-device-01', app_version: '0.1.0',
    },
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.json.data.target_type, 'FID');
  assert.equal('registration_target' in registered.json.data, false);

  const invalid = await callApi(controller, {
    method: 'POST', url: '/api/devices/register',
    body: { student_id: '102230099', token: 'x', platform: 'WINDOWS', device_id: 'bad' },
  });
  assert.equal(invalid.status, 400);

  const removed = await callApi(controller, {
    method: 'DELETE', url: '/api/devices/android-device-01?student_id=102230099',
  });
  assert.equal(removed.status, 204);
  assert.equal(removed.json, null);
});

test('Task 6: payload FCM có cấu hình Android, iOS, Web và data string', () => {
  const android = buildFcmMessage({
    token: 'android-token', platform: 'ANDROID', title: 'Thông báo', body: 'Nội dung',
    data: { notification_id: 125, urgent: true, empty: null },
  });
  assert.equal(android.android.priority, 'high');
  assert.deepEqual(android.data, { notification_id: '125', urgent: 'true' });

  const ios = buildFcmMessage({
    token: 'ios-token', platform: 'IOS', title: 'Thông báo', body: 'Nội dung',
  });
  assert.equal(ios.apns.headers['apns-priority'], '10');

  const web = buildFcmMessage({
    token: 'web-token', platform: 'WEB', title: 'Thông báo', body: 'Nội dung',
  });
  assert.equal(web.webpush.headers.TTL, '3600');

  const fid = buildFcmMessage({
    token: 'firebase-installation-id', targetType: 'FID', platform: 'ANDROID',
    title: 'Thông báo', body: 'Nội dung',
  });
  assert.equal(fid.fid, 'firebase-installation-id');
  assert.equal('token' in fid, false);
});

test('Task 6: push service gửi thành công và không làm lộ target', async () => {
  const repository = new DeviceTokenRepository();
  const registered = await repository.registerDevice({
    student_id: '102230099', target: 'secret-token-123456789', target_type: 'TOKEN',
    platform: 'ANDROID', device_id: 'android-01',
  });
  const service = new PushNotificationService({
    deviceRepository: repository,
    messagingFactory: () => ({
      async send(message) {
        assert.equal(message.token, 'secret-token-123456789');
        return 'projects/test/messages/001';
      },
    }),
  });
  const result = await service.sendToDevice({
    deviceTokenId: registered.device.id, title: 'Lịch thi', body: 'Phòng A105',
  });
  assert.equal(result.success, true);
  assert.equal('token' in result, false);
});

test('Task 6: target bị FCM từ chối vĩnh viễn sẽ tự động vô hiệu hóa', async () => {
  const repository = new DeviceTokenRepository();
  const registered = await repository.registerDevice({
    student_id: '102230099', target: 'expired-token-123456789', target_type: 'TOKEN',
    platform: 'ANDROID', device_id: 'expired-device',
  });
  const service = new PushNotificationService({
    deviceRepository: repository,
    messagingFactory: () => ({
      async send() {
        const error = new Error('Token is no longer registered');
        error.code = 'messaging/registration-token-not-registered';
        throw error;
      },
    }),
  });
  await assert.rejects(
    service.sendToDevice({ deviceTokenId: registered.device.id, title: 'Test', body: 'Test' }),
    (error) => error.code === 'INVALID_DEVICE_TOKEN' && error.httpStatus === 410
  );
  assert.equal(await repository.getActiveByDevice('expired-device'), null);
});

test('Task 6: endpoint gửi thử dùng push service được inject', async () => {
  const repository = new DeviceTokenRepository();
  const registered = await repository.registerDevice({
    student_id: '102230099', target: 'test-token-123456789', target_type: 'TOKEN',
    platform: 'ANDROID', device_id: 'test-device',
  });
  const controller = new DeviceController(repository, {
    async sendToDevice(payload) {
      assert.equal(payload.deviceTokenId, registered.device.id);
      return { success: true, message_id: 'projects/test/messages/api-test' };
    },
  });
  const response = await callApi(controller, {
    method: 'POST', url: '/api/push/test',
    body: {
      student_id: '102230099', device_id: 'test-device',
      title: 'Thông báo thử', body: 'Nội dung thử', data: { notification_id: 99 },
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.message_id, 'projects/test/messages/api-test');
});

test('Task 6: Firebase private key env được chuẩn hóa xuống dòng', () => {
  assert.equal(
    normalizePrivateKey('-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n'),
    '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----'
  );
});
