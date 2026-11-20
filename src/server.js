/**
 * KHỞI CHẠY HỆ THỐNG BACKEND THU THẬP & CẢNH BÁO THÔNG BÁO SINH VIÊN DUT
 * Triển khai theo đặc tả AGENT.md (Mục II.3.1)
 * Kiến trúc: Node.js (node:http) + PostgreSQL + Flutter + Firebase + Google Calendar
 */

const http = require('node:http');
const { NotificationRepository } = require('./db/postgres');
const { DeviceTokenRepository } = require('./db/device-token.repository');
const { NotificationController } = require('./controllers/notification.controller');
const { DeviceController } = require('./controllers/device.controller');
const { notificationRouter } = require('./api/notification.routes');
const { deviceRouter } = require('./api/device.routes');
const { getFirebaseConfigurationStatus } = require('./config/firebase');
const { crawlerManagerService } = require('./services/crawler-manager.service');
const { getPool } = require('./config/db');

function createServer(pgPool = getPool()) {
  const repository = new NotificationRepository(pgPool);
  const controller = new NotificationController(repository);
  const deviceRepository = new DeviceTokenRepository(pgPool);
  const deviceController = new DeviceController(deviceRepository);

  const server = http.createServer(async (req, res) => {
    const startTime = Date.now();
    if (process.env.NODE_ENV !== 'test') {
      res.on('finish', () => {
        console.log(`[HTTP] ${req.method} ${req.url} - ${res.statusCode} (${Date.now() - startTime}ms)`);
      });
    }

    if (req.url?.startsWith('/api/devices') || req.url?.startsWith('/api/push')) {
      await deviceRouter(req, res, deviceController);
      return;
    }
    await notificationRouter(req, res, controller);
  });

  return { server, repository, controller, deviceRepository, deviceController };
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const { server } = createServer();
  server.listen(PORT, () => {
    const firebaseStatus = getFirebaseConfigurationStatus();
    console.log(`===================================================================`);
    console.log(`🚀 Hệ Thống Tổng Hợp & Cảnh Báo Thông Báo Sinh Viên DUT (AGENT.md)`);
    console.log(`👉 Cổng chạy Server: http://localhost:${PORT}`);
    console.log(`👉 Bảng tin chung  : http://localhost:${PORT}/api/v1/notifications`);
    console.log(`👉 Học phần sv.dut : http://localhost:${PORT}/api/v1/courses/enrolled`);
    console.log(`👉 Quản lý Hạn chót: http://localhost:${PORT}/api/v1/deadlines`);
    console.log(`👉 Lịch Calendar   : http://localhost:${PORT}/api/v1/calendar/export.ics`);
    console.log(`👉 Trạng thái cào  : http://localhost:${PORT}/api/v1/crawler/status`);
    console.log(`👉 Kích hoạt cào   : POST http://localhost:${PORT}/api/v1/crawler/trigger`);
    console.log(`👉 Firebase FCM    : ${firebaseStatus.configured ? 'Đã kích hoạt' : 'Chưa cấu hình (Mock fallback mode)'}`);
    console.log(`===================================================================`);

    // Khởi động Worker cào định kỳ mỗi 30 phút
    crawlerManagerService.startPeriodicCrawl(30);

    // Kích hoạt chu kỳ cào đầu tiên sau 2 giây
    setTimeout(() => {
      crawlerManagerService.crawlAllSources().catch((err) => {
        console.warn('Lỗi cào khởi đầu:', err.message);
      });
    }, 2000);
  });
}

module.exports = {
  createServer,
};
