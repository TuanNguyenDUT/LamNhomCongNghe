/**
 * TASK 11: Định nghĩa cấu trúc REST API thu thập & truy vấn thông báo đa nguồn
 * Phụ trách: Nguyễn Hữu Tuấn
 */

const { URL } = require('node:url');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(payload, null, 2));
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
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // 1. Health check & thông tin cấu trúc API Task 11
    if (req.method === 'GET' && pathname === '/') {
      sendJson(res, 200, {
        service: 'DUT Multi-Source Notification Collector API',
        task: 'Task 11: Thiết kế Schema CSDL (PostgreSQL) và cấu trúc API thu thập thông báo',
        pic: 'Nguyễn Hữu Tuấn',
        endpoints: [
          'GET  /api/v1/notifications/sources',
          'POST /api/v1/notifications/collect',
          'POST /api/v1/notifications/collect-batch',
          'GET  /api/v1/notifications',
          'GET  /api/v1/notifications/:id',
        ],
      });
      return;
    }

    // 2. GET /api/v1/notifications/sources - Danh sách kênh nguồn
    if (req.method === 'GET' && pathname === '/api/v1/notifications/sources') {
      const result = await controller.getSources();
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // 3. POST /api/v1/notifications/collect - Thu thập 1 thông báo từ kênh nguồn
    if (req.method === 'POST' && pathname === '/api/v1/notifications/collect') {
      const payload = await readJsonBody(req);
      const result = await controller.collectSingle(payload);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // 4. POST /api/v1/notifications/collect-batch - Thu thập hàng loạt thông báo từ Crawler/Webhook
    if (req.method === 'POST' && pathname === '/api/v1/notifications/collect-batch') {
      const payload = await readJsonBody(req);
      const result = await controller.collectBatch(payload);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // 5. GET /api/v1/notifications - Lấy danh sách thông báo (cho Flutter App)
    if (req.method === 'GET' && pathname === '/api/v1/notifications') {
      const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());
      const result = await controller.listNotifications(queryParams);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    // 6. GET /api/v1/notifications/:id - Xem chi tiết 1 thông báo
    const detailMatch = pathname.match(/^\/api\/v1\/notifications\/(\d+)$/);
    if (req.method === 'GET' && detailMatch) {
      const result = await controller.getNotificationDetail(detailMatch[1]);
      sendJson(res, result.statusCode, result.body);
      return;
    }

    sendJson(res, 404, {
      status: 'error',
      message: `Không tìm thấy API endpoint: ${req.method} ${pathname}`,
    });
  } catch (err) {
    sendJson(res, 400, {
      status: 'error',
      message: err.message || 'Lỗi xử lý yêu cầu API',
    });
  }
}

module.exports = {
  notificationRouter,
};
