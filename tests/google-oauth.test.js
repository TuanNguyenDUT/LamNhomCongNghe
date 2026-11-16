const test = require('node:test');
const assert = require('node:assert/strict');
const { googleCalendarService } = require('../src/services/google-calendar.service');
const { notificationController } = require('../src/controllers/notification.controller');

test('Google OAuth2 - Nhận diện Client ID và Secret từ file hoặc biến môi trường', async () => {
  const hasCreds = googleCalendarService.hasGoogleCredentials();
  assert.equal(hasCreds, true, 'Hệ thống phải tự động nhận diện credentials từ client_secret*.json hoặc .env');
  assert.ok(process.env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID phải được thiết lập');
  assert.ok(process.env.GOOGLE_CLIENT_SECRET, 'GOOGLE_CLIENT_SECRET phải được thiết lập');
  assert.ok(
    process.env.GOOGLE_CLIENT_ID.includes('1022604367361'),
    'Client ID phải khớp với file của người dùng'
  );
});

test('Google OAuth2 - getOAuthConsentUrl sinh URL ủy quyền chính xác với redirect_uri và state', async () => {
  const result = googleCalendarService.getOAuthConsentUrl('http://localhost:3000/auth/google/callback', '102230026');
  assert.equal(result.configured, true);
  assert.ok(result.url.includes('accounts.google.com/o/oauth2/v2/auth'));
  assert.ok(result.url.includes('client_id=' + process.env.GOOGLE_CLIENT_ID));
  assert.ok(result.url.includes('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fgoogle%2Fcallback'));
  assert.ok(result.url.includes('state=102230026'));
  assert.ok(result.url.includes('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events'));
});

test('Google OAuth2 - API GET /api/v1/calendar/google/auth-url trả về URL ủy quyền', async () => {
  const res = await notificationController.getGoogleAuthUrl({ student_id: '102230026' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'success');
  assert.equal(res.body.data.configured, true);
  assert.ok(res.body.data.url.includes('accounts.google.com'));
  assert.equal(res.body.data.student_id, '102230026');
});

test('Google OAuth2 - API GET /api/v1/calendar/google/status trả về trạng thái cấu hình', async () => {
  const res = await notificationController.getGoogleCalendarStatus({ student_id: '102230026' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'success');
  assert.equal(res.body.data.configured, true);
  assert.equal(res.body.data.redirect_uri, 'http://localhost:3000/auth/google/callback');
});

test('Google OAuth2 - handleGoogleCallback xử lý lỗi từ chối người dùng (error parameter)', async () => {
  const res = await notificationController.handleGoogleCallback({
    error: 'access_denied',
    state: '102230026',
  });
  assert.equal(res.statusCode, 400);
  assert.ok(res.rawBody.includes('Cấp quyền không thành công'));
  assert.ok(res.rawBody.includes('access_denied'));
});

test('Google OAuth2 - handleGoogleCallback xử lý thiếu code', async () => {
  const res = await notificationController.handleGoogleCallback({});
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.status, 'error');
});
