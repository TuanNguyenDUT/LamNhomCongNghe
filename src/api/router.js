/**
 * TASK 11: Cấu trúc REST API thu thập, phân loại và truy vấn thông báo tập trung
 * Phụ trách: Nguyễn Hữu Tuấn
 */

const { URL } = require('node:url');
const { classifyNotification } = require('../services/classifierService');
const {
  parsePortalHtml,
  parseStudentEmail,
  parseWebhookPayload,
  crawlAllSources,
} = require('../services/crawlerService');

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Payload quá lớn'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('JSON đầu vào không hợp lệ'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApiRequest(req, res, dbManager) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return true;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (!pathname.startsWith('/api/')) {
    return false;
  }

  try {
    // 1. GET /api/notifications - Lấy danh sách bảng tin tập trung (Tìm kiếm, Lọc, Phân trang)
    if (req.method === 'GET' && pathname === '/api/notifications') {
      const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());
      const result = dbManager.queryNotifications(queryParams);
      sendJson(res, 200, {
        status: 'success',
        data: result,
      });
      return true;
    }

    // 2. GET /api/notifications/stats - Thống kê tổng quan theo nguồn, độ ưu tiên, môn học, cache
    if (req.method === 'GET' && pathname === '/api/notifications/stats') {
      const stats = dbManager.getDashboardStats();
      sendJson(res, 200, {
        status: 'success',
        data: stats,
      });
      return true;
    }

    // 3. PATCH /api/notifications/read-all - Đánh dấu đã đọc toàn bộ
    if (req.method === 'PATCH' && pathname === '/api/notifications/read-all') {
      const result = dbManager.markAllRead();
      sendJson(res, 200, {
        status: 'success',
        data: result,
      });
      return true;
    }

    // 4. GET /api/notifications/:id - Xem chi tiết 1 thông báo
    const singleMatch = pathname.match(/^\/api\/notifications\/(\d+)$/);
    if (req.method === 'GET' && singleMatch) {
      const item = dbManager.getNotificationById(singleMatch[1]);
      if (!item) {
        sendJson(res, 404, { status: 'error', message: 'Không tìm thấy thông báo' });
        return true;
      }
      sendJson(res, 200, { status: 'success', data: item });
      return true;
    }

    // 5. PATCH /api/notifications/:id/read - Đánh dấu đã đọc / chưa đọc
    const readMatch = pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
    if (req.method === 'PATCH' && readMatch) {
      const body = await parseJsonBody(req);
      const isRead = body.is_read !== undefined ? Boolean(body.is_read) : true;
      const updated = dbManager.updateReadStatus(readMatch[1], isRead);
      if (!updated) {
        sendJson(res, 404, { status: 'error', message: 'Không tìm thấy thông báo' });
        return true;
      }
      sendJson(res, 200, { status: 'success', data: updated });
      return true;
    }

    // 6. POST /api/notifications - Thu thập và phân loại tự động 1 thông báo mới
    if (req.method === 'POST' && pathname === '/api/notifications') {
      const body = await parseJsonBody(req);
      if (!body.title || !body.content) {
        sendJson(res, 400, {
          status: 'error',
          message: 'Vui lòng cung cấp đầy đủ tiêu đề (title) và nội dung (content)',
        });
        return true;
      }
      const result = dbManager.insertSingleNotification(body);
      sendJson(res, result.inserted ? 201 : 200, {
        status: 'success',
        data: result,
      });
      return true;
    }

    // 7. POST /api/ingest/webhook - Webhook tiếp nhận thông báo từ Portal / Email / LMS / CLB
    if (req.method === 'POST' && pathname === '/api/ingest/webhook') {
      const body = await parseJsonBody(req);

      // Hỗ trợ bóc tách HTML trực tiếp nếu gửi html_content
      if (body.html_content) {
        const extracted = parsePortalHtml(body.html_content, {
          source_code: body.source_code || 'PORTAL_PDT',
          source_type: body.source_type || 'TRAINING_DEPT',
          channel_name: body.channel_name || 'Portal Nhà trường',
        });
        const courses = dbManager.getCourses();
        const classified = extracted.map((item) => classifyNotification(item, courses));
        const batchResult = dbManager.insertNotificationsBatch(classified, `WEBHOOK-HTML-${Date.now()}`);
        sendJson(res, 201, {
          status: 'success',
          data: {
            extracted_count: extracted.length,
            ...batchResult,
          },
        });
        return true;
      }

      // Hỗ trợ bóc tách Email raw hoặc Webhook JSON
      const normalized = body.raw_email
        ? parseStudentEmail(body.raw_email)
        : parseWebhookPayload(body);

      if (!normalized.title || !normalized.content) {
        sendJson(res, 400, {
          status: 'error',
          message: 'Dữ liệu Webhook thiếu tiêu đề hoặc nội dung thông báo',
        });
        return true;
      }

      const result = dbManager.insertSingleNotification(normalized);
      sendJson(res, result.inserted ? 201 : 200, {
        status: 'success',
        data: result,
      });
      return true;
    }

    // 8. POST /api/ingest/crawl - Kích hoạt Crawler tự động tổng hợp từ tất cả các nguồn
    if (req.method === 'POST' && pathname === '/api/ingest/crawl') {
      const body = await parseJsonBody(req);
      const crawlResult = await crawlAllSources(dbManager, body.custom_feeds || null);
      sendJson(res, 200, {
        status: 'success',
        data: crawlResult,
      });
      return true;
    }

    // 9. GET /api/ingest/logs - Xem nhật ký các phiên cào/tổng hợp dữ liệu
    if (req.method === 'GET' && pathname === '/api/ingest/logs') {
      const logs = dbManager.getIngestionLogs(20);
      sendJson(res, 200, {
        status: 'success',
        data: logs,
      });
      return true;
    }

    // 10. POST /api/classify/preview - Xem trước kết quả phân loại & tính điểm ưu tiên (Task 13)
    if (req.method === 'POST' && pathname === '/api/classify/preview') {
      const body = await parseJsonBody(req);
      const courses = dbManager.getCourses();
      const preview = classifyNotification(body, courses);
      sendJson(res, 200, {
        status: 'success',
        data: preview,
      });
      return true;
    }

    sendJson(res, 404, {
      status: 'error',
      message: `Không tìm thấy API endpoint: ${req.method} ${pathname}`,
    });
    return true;
  } catch (err) {
    sendJson(res, 500, {
      status: 'error',
      message: err.message || 'Lỗi máy chủ nội bộ',
    });
    return true;
  }
}

module.exports = {
  handleApiRequest,
};
