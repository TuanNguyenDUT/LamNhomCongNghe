/**
 * HỆ THỐNG ROUTER CHÍNH TÍCH HỢP TẤT CẢ CÁC MODULE
 * - Task 1: Giao diện UI Web Responsive
 * - Task 2, 3, 4: Quản lý hạn chót (CRUD Deadlines & Phân loại tự động)
 * - Task 6: Tích hợp FCM Token & Push Notifications
 * - Task 11: Thu thập thông báo đa nguồn
 */

const { URL } = require('node:url');
const fs = require('node:fs');
const path = require('node:path');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendHtml(res, filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
  } catch (err) {
    sendJson(res, 500, { error: 'Không tìm thấy file giao diện', details: err.message });
  }
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

async function appRouter(req, res, { notificationController, deadlineController }) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const searchParams = Object.fromEntries(parsedUrl.searchParams.entries());

  try {
    // -------------------------------------------------------------
    // GIAO DIỆN WEB (Task 1)
    // -------------------------------------------------------------
    const htmlPath = path.join(__dirname, '../public/deadline-ui.html');
    if (req.method === 'GET' && (pathname === '/' || pathname === '/deadlines' || pathname === '/ui')) {
      sendHtml(res, htmlPath);
      return;
    }

    // -------------------------------------------------------------
    // TASK 3 & 4: REST API QUẢN LÝ DEADLINE (CRUD & AUTO-STATUS)
    // -------------------------------------------------------------
    // Lấy danh sách môn học
    if (req.method === 'GET' && pathname === '/api/v1/courses') {
      const data = await deadlineController.getCourses();
      sendJson(res, 200, data);
      return;
    }

    // GET /api/v1/deadlines (hỗ trợ filter ?subject=...&status=...&search=...)
    if (req.method === 'GET' && pathname === '/api/v1/deadlines') {
      const data = await deadlineController.getDeadlines(searchParams);
      sendJson(res, 200, data);
      return;
    }

    // POST /api/v1/deadlines (Tạo deadline mới)
    if (req.method === 'POST' && pathname === '/api/v1/deadlines') {
      const body = await readJsonBody(req);
      const data = await deadlineController.createDeadline(body);
      sendJson(res, 201, data);
      return;
    }

    // Toggle hoàn thành: PATCH /api/v1/deadlines/:id/complete (Task 4)
    const toggleMatch = pathname.match(/^\/api\/v1\/deadlines\/(\d+)\/complete$/);
    if (req.method === 'PATCH' && toggleMatch) {
      const data = await deadlineController.toggleComplete(toggleMatch[1]);
      sendJson(res, 200, data);
      return;
    }

    // GET / PUT / DELETE /api/v1/deadlines/:id
    const deadlineIdMatch = pathname.match(/^\/api\/v1\/deadlines\/(\d+)$/);
    if (deadlineIdMatch) {
      const id = deadlineIdMatch[1];
      if (req.method === 'GET') {
        const data = await deadlineController.getDeadlineById(id);
        sendJson(res, 200, data);
        return;
      }
      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const data = await deadlineController.updateDeadline(id, body);
        sendJson(res, 200, data);
        return;
      }
      if (req.method === 'DELETE') {
        const data = await deadlineController.deleteDeadline(id);
        sendJson(res, 200, data);
        return;
      }
    }

    // -------------------------------------------------------------
    // TASK 6: FIREBASE CLOUD MESSAGING (FCM) & DEVICE TOKENS
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/v1/device-tokens') {
      const body = await readJsonBody(req);
      const data = await deadlineController.registerToken(body);
      sendJson(res, 201, data);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/device-tokens') {
      const data = await deadlineController.getDeviceTokens();
      sendJson(res, 200, data);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/device-tokens/test-push') {
      const body = await readJsonBody(req);
      const data = await deadlineController.testPushNotification(body);
      sendJson(res, 200, data);
      return;
    }

    // -------------------------------------------------------------
    // TASK 11: API THU THẬP THÔNG BÁO ĐA NGUỒN
    // -------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/v1/notifications/sources') {
      const result = await notificationController.getSources();
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/notifications/collect') {
      const payload = await readJsonBody(req);
      const result = await notificationController.collectSingle(payload);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/v1/notifications/collect-batch') {
      const payload = await readJsonBody(req);
      const result = await notificationController.collectBatch(payload);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/v1/notifications') {
      const result = await notificationController.listNotifications(searchParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    const notifMatch = pathname.match(/^\/api\/v1\/notifications\/(\d+)$/);
    if (req.method === 'GET' && notifMatch) {
      const result = await notificationController.getNotificationDetail(notifMatch[1]);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // 404 Route Not Found
    sendJson(res, 404, {
      status: 'ERROR',
      message: `Không tìm thấy endpoint: ${req.method} ${pathname}`,
      available_endpoints: [
        'GET    /',
        'GET    /api/v1/deadlines',
        'POST   /api/v1/deadlines',
        'GET    /api/v1/deadlines/:id',
        'PUT    /api/v1/deadlines/:id',
        'PATCH  /api/v1/deadlines/:id/complete',
        'DELETE /api/v1/deadlines/:id',
        'GET    /api/v1/courses',
        'POST   /api/v1/device-tokens',
        'GET    /api/v1/device-tokens',
        'POST   /api/v1/device-tokens/test-push',
        'GET    /api/v1/notifications',
      ],
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    sendJson(res, statusCode, {
      status: 'ERROR',
      message: err.message || 'Lỗi máy chủ nội bộ',
    });
  }
}

module.exports = {
  appRouter,
  sendJson,
  readJsonBody,
};
