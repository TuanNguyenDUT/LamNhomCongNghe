/** Task 6: REST API đăng ký thiết bị và gửi Push Notification thử. */

const { URL } = require('node:url');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(payload === null ? '' : JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) reject(new Error('Payload quá lớn'));
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON body không hợp lệ'));
      }
    });
    req.on('error', reject);
  });
}

async function deviceRouter(req, res, controller) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    if (req.method === 'POST' && pathname === '/api/devices/register') {
      const result = await controller.register(await readJsonBody(req));
      sendJson(res, result.statusCode, result.body);
      return;
    }

    const deviceMatch = pathname.match(/^\/api\/devices\/([A-Za-z0-9._:-]+)$/);
    if (req.method === 'DELETE' && deviceMatch) {
      const result = await controller.unregister(
        deviceMatch[1],
        String(parsedUrl.searchParams.get('student_id') || '').trim()
      );
      sendJson(res, result.statusCode, result.body);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/push/test') {
      const enabled =
        process.env.NODE_ENV !== 'production' ||
        String(process.env.ENABLE_PUSH_TEST_ENDPOINT || '').toLowerCase() === 'true';
      if (!enabled) {
        sendJson(res, 404, { status: 'error', message: 'Không tìm thấy API endpoint' });
        return;
      }
      const result = await controller.sendTest(await readJsonBody(req));
      sendJson(res, result.statusCode, result.body);
      return;
    }

    sendJson(res, 404, {
      status: 'error',
      message: `Không tìm thấy API endpoint: ${req.method} ${pathname}`,
    });
  } catch (error) {
    sendJson(res, error.httpStatus || 400, {
      status: 'error',
      code: error.code || 'DEVICE_API_ERROR',
      message: error.message || 'Lỗi xử lý yêu cầu thiết bị',
    });
  }
}

module.exports = {
  deviceRouter,
  readJsonBody,
};
