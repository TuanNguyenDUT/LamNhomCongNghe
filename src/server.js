/**
 * Server khởi chạy ứng dụng MVP Tổng hợp thông báo đa nguồn
 * Phụ trách: Nguyễn Hữu Tuấn (Tasks 11 - 15)
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { DatabaseManager } = require('./db/database');
const { handleApiRequest } = require('./api/router');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function createAppServer(dbPath) {
  const dbManager = new DatabaseManager(dbPath);
  dbManager.seedSampleNotificationsIfEmpty();

  const publicDir = path.join(__dirname, '../public');

  const server = http.createServer(async (req, res) => {
    const handled = await handleApiRequest(req, res, dbManager);
    if (handled) {
      return;
    }

    // Phục vụ giao diện tĩnh (Task 14 - UI Bảng tin thông báo tập trung)
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let safePath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }

    const filePath = path.join(publicDir, safePath);
    if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return { server, dbManager };
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const { server } = createAppServer();
  server.listen(PORT, () => {
    console.log(`====================================================================`);
    console.log(`🚀 MVP Bảng tin Tổng hợp Thông báo Đa nguồn đã khởi chạy!`);
    console.log(`👉 Giao diện Web UI : http://localhost:${PORT}`);
    console.log(`👉 REST API Feed   : http://localhost:${PORT}/api/notifications`);
    console.log(`👉 Phụ trách       : Nguyễn Hữu Tuấn (Tasks 11, 12, 13, 14, 15)`);
    console.log(`====================================================================`);
  });
}

module.exports = {
  createAppServer,
};
