/**
 * TÍCH HỢP HỆ THỐNG BACKEND SERVER
 * Phụ trách các Task:
 * - Task 1: UI Web hiển thị danh sách hạn chót & bộ lọc môn học (Nguyễn Hữu Duy Bảo)
 * - Task 2: CSDL Deadlines & Môn học (Nguyễn Hữu Duy Bảo)
 * - Task 3: REST API CRUD Quản lý hạn chót (Nguyễn Hữu Duy Bảo)
 * - Task 4: Phân loại trạng thái tự động & Checkbox hoàn thành (Nguyễn Hữu Duy Bảo)
 * - Task 6: Tích hợp FCM Token thiết bị & Push Notification (Hồ Đăng Hùng)
 * - Task 11: Schema CSDL & API thu thập thông báo đa nguồn (Nguyễn Hữu Tuấn)
 */

const http = require('node:http');
const { NotificationRepository } = require('./db/postgres');
const { NotificationController } = require('./controllers/notification.controller');
const { DeadlineRepository } = require('./db/deadline.repository');
const { DeadlineController } = require('./controllers/deadline.controller');
const { FcmService } = require('./services/fcm.service');
const { appRouter } = require('./api/app.router');

function createServer(pgPool = null) {
  // 1. Task 11: Thông báo đa nguồn
  const notifRepository = new NotificationRepository(pgPool);
  const notificationController = new NotificationController(notifRepository);

  // 2. Task 2, 3, 4 & 6: Deadlines & FCM Token
  const deadlineRepository = new DeadlineRepository(pgPool);
  const fcmService = new FcmService(deadlineRepository);
  const deadlineController = new DeadlineController(deadlineRepository, fcmService);

  const server = http.createServer((req, res) => {
    appRouter(req, res, { notificationController, deadlineController });
  });

  return {
    server,
    repository: notifRepository,
    controller: notificationController,
    notifRepository,
    notificationController,
    deadlineRepository,
    deadlineController,
    fcmService,
  };
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const { server } = createServer();
  server.listen(PORT, () => {
    console.log(`===================================================================`);
    console.log(`🚀 DUT Management System Backend Server`);
    console.log(`👉 Web UI (Task 1)     : http://localhost:${PORT}/`);
    console.log(`👉 Deadlines API (T3,4): http://localhost:${PORT}/api/v1/deadlines`);
    console.log(`👉 FCM Tokens (Task 6) : http://localhost:${PORT}/api/v1/device-tokens`);
    console.log(`👉 Notifications (T11) : http://localhost:${PORT}/api/v1/notifications`);
    console.log(`===================================================================`);
  });
}

module.exports = {
  createServer,
};
