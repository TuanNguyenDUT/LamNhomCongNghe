const { AppError, AuthenticationError } = require('../utils/errors');

const adminPaths = new Set([
  '/api/v1/crawler/trigger', '/api/v1/facebook/crawl-custom',
  '/api/v1/notifications/ingest', '/api/v1/notifications/collect',
  '/api/v1/notifications/collect-batch', '/api/push/test',
]);
const loginAttempts = new Map();

async function authorize(req, authService) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'POST' && ['/api/v1/auth/login','/api/v1/dut/login'].includes(pathname)) {
    const now = Date.now();
    for (const [key, entry] of loginAttempts) if (entry.until <= now) loginAttempts.delete(key);
    const ip = req.socket.remoteAddress;
    const entry = loginAttempts.get(ip) || { count:0, until:now + 10 * 60 * 1000 };
    entry.count += 1;
    loginAttempts.set(ip, entry);
    if (entry.count > 20) throw new AppError('Đăng nhập quá nhiều lần. Vui lòng thử lại sau', {httpStatus:429, code:'RATE_LIMITED'});
  }
  if (req.method === 'OPTIONS' ||
      ['/api/v1/auth/login', '/api/v1/dut/login', '/auth/google/callback', '/api/v1/calendar/google/callback'].includes(pathname)) return;
  if (!pathname.startsWith('/api/v1/') && !pathname.startsWith('/api/devices') && !pathname.startsWith('/api/push')) return;
  // Student images are public at the university source; the app proxies them.
  if (/^\/api\/v1\/avatar\/[\w.-]+$/.test(pathname)) return;
  const token = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.authorization || '')?.[1];
  if (!token) throw new AuthenticationError('Vui lòng đăng nhập');
  req.auth = await authService.authenticate(token);
  req.authToken = token;
  if (pathname === '/api/v1/calendar/google/connect') {
    throw new AppError('Vui lòng liên kết qua Google OAuth', {httpStatus:400, code:'OAUTH_REQUIRED'});
  }
  if (adminPaths.has(pathname)) {
    const admins = String(process.env.ADMIN_STUDENT_CODES || '').split(',').map(s => s.trim());
    if (!admins.includes(req.auth.student_code)) throw new AppError('Chức năng dành cho quản trị viên', {httpStatus:403, code:'FORBIDDEN'});
  }
}

function scopeToUser(req, payload) {
  if (!req.auth) return payload;
  return { ...payload, student_id: req.auth.id, student_code: req.auth.student_code,
    firebase_uid: req.auth.firebase_uid, username: req.auth.student_code };
}

module.exports = { authorize, scopeToUser };
