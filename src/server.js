/**
 * TASK 11: Khởi chạy Node.js Backend Server cho cấu trúc API thu thập thông báo
 * Phụ trách: Nguyễn Hữu Tuấn
 */

const http = require('node:http');
const { NotificationRepository } = require('./db/postgres');
const { NotificationController } = require('./controllers/notification.controller');
const { notificationRouter } = require('./api/notification.routes');

function createServer(pgPool = null) {
  const repository = new NotificationRepository(pgPool);
  const controller = new NotificationController(repository);

  const server = http.createServer((req, res) => {
    notificationRouter(req, res, controller);
  });

  return { server, repository, controller };
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const { server } = createServer();
  server.listen(PORT, () => {
    console.log(`===================================================================`);
    console.log(`🚀 [Task 11] API Thu thập Thông báo Đa nguồn (Node.js + PostgreSQL)`);
    console.log(`👉 Base URL : http://localhost:${PORT}/api/v1/notifications`);
    console.log(`👉 Phụ trách: Nguyễn Hữu Tuấn`);
    console.log(`===================================================================`);
  });
}

module.exports = {
  createServer,
};
