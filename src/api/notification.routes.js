/**
 * ĐỊNH NGHĨA TOÀN DIỆN CẤU TRÚC REST API CHO HỆ THỐNG THÔNG BÁO DUT
 * Triển khai theo đặc tả AGENT.md (TSD Mục 3.3)
 */

const { URL } = require('node:url');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveFlutterWebFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const fileData = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(fileData);
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendRaw(res, statusCode, rawContent, headers = {}) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    ...headers,
  });
  res.end(rawContent);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON body không hợp lệ'));
      }
    });
    req.on('error', reject);
  });
}

async function notificationRouter(req, res, controller) {
  if (!controller) {
    const { notificationController } = require('../controllers/notification.controller');
    controller = notificationController;
  }
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());

  try {
    // 0. Phục vụ ứng dụng Flutter Mobile Web (Liquid Glass App) tại root "/" và "/app"
    const flutterWebDir = path.join(__dirname, '../../mobile/build/web');
    if (fs.existsSync(flutterWebDir)) {
      const isFlutterSpaRoute =
        pathname === '/' ||
        pathname === '/app' ||
        pathname.startsWith('/app/') ||
        pathname === '/login' ||
        pathname.startsWith('/notifications') ||
        pathname.startsWith('/courses') ||
        pathname.startsWith('/deadlines') ||
        pathname.startsWith('/reminds') ||
        pathname.startsWith('/profile');

      if (isFlutterSpaRoute && !pathname.startsWith('/api/')) {
        const indexPath = path.join(flutterWebDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          serveFlutterWebFile(res, indexPath);
          return;
        }
      }

      // Phục vụ các tệp tài nguyên tĩnh của Flutter Web (js, wasm, json, css, assets...)
      const subPath = pathname.startsWith('/app/') ? pathname.replace('/app/', '') : pathname.replace(/^\//, '');
      const targetPath = path.join(flutterWebDir, subPath);
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
        serveFlutterWebFile(res, targetPath);
        return;
      }
    }

    // 0.1 Trang Dashboard Web (hoặc fallback khi chưa build Flutter Web) phục vụ theo dõi dữ liệu
    if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/' || pathname === '/admin' || pathname === '/web' || pathname === '/dev')) {
      const fs = require('node:fs');
      const path = require('node:path');
      const htmlPath = path.join(__dirname, '../public/index.html');
      if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        res.end(html);
        return;
      }
    }

    // 0.2 Root API info / Health check
    if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/api' || pathname === '/api/')) {
      sendJson(res, 200, {
        service: 'DUT Student Multi-Source Notification & Alert System API',
        version: '2.0.0',
        spec: 'AGENT.md (FR-01 to FR-09)',
        endpoints: [
          'POST   /api/v1/dut/sync-courses',
          'GET    /api/v1/courses/enrolled',
          'GET    /api/v1/courses/:courseCode/notifications',
          'GET    /api/v1/notifications',
          'POST   /api/v1/notifications/ingest',
          'POST   /api/v1/notifications/:id/ack',
          'GET    /api/v1/deadlines',
          'POST   /api/v1/deadlines',
          'PUT    /api/v1/deadlines/:id',
          'DELETE /api/v1/deadlines/:id',
          'POST   /api/v1/calendar/google/connect',
          'POST   /api/v1/calendar/google/sync',
          'GET    /api/v1/calendar/export.ics',
        ],
      });
      return;
    }

    // 0. Xác thực & Định danh tài khoản sv.dut.udn.vn
    if (req.method === 'POST' && (pathname === '/api/v1/auth/login' || pathname === '/api/v1/dut/login')) {
      const body = await readJsonBody(req);
      const result = await controller.login(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && (pathname === '/api/v1/auth/me' || pathname === '/api/v1/auth/profile')) {
      const result = await controller.getCurrentUser(queryParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/auth/logout') {
      const result = await controller.logout();
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // 0.1 Tùy chọn cá nhân hóa & Chủ đề quan tâm
    if (req.method === 'GET' && pathname === '/api/v1/students/preferences') {
      const result = await controller.getStudentPreferences(queryParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if ((req.method === 'PUT' || req.method === 'POST') && pathname === '/api/v1/students/preferences') {
      const body = await readJsonBody(req);
      const result = await controller.updateStudentPreferences(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // Proxy ảnh thẻ sinh viên DUT (giải quyết triệt để lỗi CORS trên trình duyệt Flutter Web)
    const avatarMatch = pathname.match(/^\/api\/v1\/avatar\/([0-9a-zA-Z_-]+)(?:\.jpg)?$/);
    if (req.method === 'GET' && avatarMatch) {
      const studentCode = avatarMatch[1];
      const kYear = studentCode.length >= 5 ? studentCode.slice(3, 5) : '23';
      const targetUrl = `https://cb.dut.udn.vn/ImageSV/${kYear}/${studentCode}.jpg`;

      https.get(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      }, (proxyRes) => {
        if (proxyRes.statusCode === 200) {
          res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400',
          });
          proxyRes.pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ status: 'error', message: 'Không tìm thấy ảnh thẻ sinh viên' }));
        }
      }).on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ status: 'error', message: err.message }));
      });
      return;
    }

    // 1. Đồng bộ DUT & Học phần (FR-01, FR-04)
    if (req.method === 'POST' && pathname === '/api/v1/dut/sync-courses') {
      const body = await readJsonBody(req);
      const result = await controller.syncCourses(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/courses/enrolled') {
      const result = await controller.getEnrolledCourses(queryParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    const courseNotifsMatch = pathname.match(/^\/api\/v1\/courses\/([^/]+)\/notifications$/);
    if (req.method === 'GET' && courseNotifsMatch) {
      const courseCode = decodeURIComponent(courseNotifsMatch[1]);
      const result = await controller.getCourseNotifications(courseCode, queryParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // 2. Crawler & Thu thập định kỳ đa nguồn (sv.dut.udn.vn & Facebook Fanpages)
    if (req.method === 'POST' && pathname === '/api/v1/crawler/trigger') {
      const result = await controller.triggerCrawler();
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/crawler/status') {
      const result = await controller.getCrawlerStatus();
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // 2.1 Quản lý theo dõi Fanpage Facebook bất kỳ (Custom Facebook Pages)
    if (req.method === 'POST' && pathname === '/api/v1/facebook/follow') {
      const body = await readJsonBody(req);
      const result = await controller.followFacebookPage(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/facebook/followed') {
      const result = await controller.getFollowedFacebookPages(queryParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    const unfollowMatch = pathname.match(/^\/api\/v1\/facebook\/unfollow\/([^/]+)$/);
    if ((req.method === 'DELETE' || req.method === 'POST') && unfollowMatch) {
      const pageId = unfollowMatch[1];
      const result = await controller.unfollowFacebookPage(pageId, queryParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/facebook/crawl-custom') {
      const body = await readJsonBody(req);
      const result = await controller.crawlCustomFacebookPage(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // 2. Ingest & Bảng tin thông báo (FR-02, FR-03, FR-05, FR-08)
    if (req.method === 'POST' && pathname === '/api/v1/notifications/ingest') {
      const body = await readJsonBody(req);
      const result = await controller.ingestNotification(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    const ackMatch = pathname.match(/^\/api\/v1\/notifications\/([^/]+)\/ack$/);
    if (req.method === 'POST' && ackMatch) {
      const id = ackMatch[1];
      const body = await readJsonBody(req);
      const result = await controller.acknowledgeNotification(id, body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // Tương thích ngược: Collect, Classify, Rules, Sources, Categories
    if (req.method === 'GET' && (pathname === '/api/v1/notifications/categories' || pathname === '/api/v1/categories')) {
      const result = await controller.getCategories();
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/notifications/sources') {
      const result = await controller.getSources();
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/notifications/rules') {
      const result = await controller.getRules();
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/notifications/classify') {
      const body = await readJsonBody(req);
      const result = await controller.classifyPreview(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/notifications/collect') {
      const body = await readJsonBody(req);
      const result = await controller.collectSingle(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/notifications/collect-batch') {
      const body = await readJsonBody(req);
      const result = await controller.collectBatch(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/notifications') {
      const result = await controller.listNotifications(queryParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    const readMatch = pathname.match(/^\/api\/v1\/notifications\/([^/]+)\/read$/);
    if (req.method === 'PATCH' && readMatch) {
      const id = readMatch[1];
      const body = await readJsonBody(req);
      const result = await controller.setReadStatus(id, body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    const singleNotifMatch = pathname.match(/^\/api\/v1\/notifications\/([^/]+)$/);
    if (req.method === 'GET' && singleNotifMatch) {
      const id = singleNotifMatch[1];
      const result = await controller.getNotificationDetail(id, queryParams.student_id);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // 3. Quản lý hạn chót (Deadlines) & Nhắc việc (Reminds) (FR-06, FR-07)
    if (req.method === 'GET' && pathname === '/api/v1/deadlines') {
      const result = await controller.listDeadlines(queryParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/reminds') {
      const result = await controller.listDeadlines({ ...queryParams, item_type: 'REMINDER' });
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/deadlines') {
      const body = await readJsonBody(req);
      const result = await controller.createDeadline(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/reminds') {
      const body = await readJsonBody(req);
      const result = await controller.createDeadline({ ...body, item_type: 'REMINDER' });
      sendJson(res, result.statusCode, result.body);
      return;
    }

    const deadlineDetailMatch = pathname.match(/^\/api\/v1\/deadlines\/([^/]+)$/);
    if (deadlineDetailMatch) {
      const id = deadlineDetailMatch[1];
      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const result = await controller.updateDeadline(id, body);
        sendJson(res, result.statusCode, result.body);
        return;
      }
      if (req.method === 'DELETE') {
        const result = await controller.deleteDeadline(id);
        sendJson(res, result.statusCode, result.body);
        return;
      }
    }

    // 4. Google Calendar (FR-09)
    if (req.method === 'GET' && pathname === '/api/v1/calendar/google/auth-url') {
      const result = await controller.getGoogleAuthUrl(queryParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/calendar/google/status') {
      const result = await controller.getGoogleCalendarStatus(queryParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && (pathname === '/auth/google/callback' || pathname === '/api/v1/calendar/google/callback')) {
      const result = await controller.handleGoogleCallback(queryParams);
      if (result.rawBody) {
        sendRaw(res, result.statusCode, result.rawBody, result.headers);
      } else {
        sendJson(res, result.statusCode, result.body);
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/calendar/google/connect') {
      const body = await readJsonBody(req);
      const result = await controller.connectGoogleCalendar(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/calendar/google/disconnect') {
      const body = await readJsonBody(req);
      const result = await controller.disconnectGoogleCalendar(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && (pathname === '/api/v1/calendar/google/sync' || pathname === '/api/v1/calendar/google/sync-event')) {
      const body = await readJsonBody(req);
      const result = await controller.syncGoogleCalendar(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if ((req.method === 'POST' || req.method === 'DELETE') && pathname === '/api/v1/calendar/google/delete-event') {
      const body = await readJsonBody(req);
      const result = await controller.deleteGoogleCalendarEvent(body);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/calendar/export.ics') {
      const result = await controller.exportIcsCalendar(queryParams);
      sendRaw(res, result.statusCode, result.rawBody, result.headers);
      return;
    }

    // Fallback 404
    sendJson(res, 404, {
      status: 'error',
      message: `Endpoint không tồn tại: ${req.method} ${pathname}`,
    });
  } catch (error) {
    console.error('API Router Error:', error);
    const statusCode = error.httpStatus || 500;
    sendJson(res, statusCode, {
      status: 'error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: statusCode >= 500 ? (error.message || 'Lỗi máy chủ nội bộ') : error.message,
    });
  }
}

module.exports = {
  notificationRouter,
};
