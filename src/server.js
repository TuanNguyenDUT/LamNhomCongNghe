/**
 * TASK 11: Khởi chạy Node.js Backend Server cho cấu trúc API thu thập thông báo
 * Phụ trách: Nguyễn Hữu Tuấn
 */

const http = require('node:http');
const { NotificationRepository } = require('./db/postgres');
const { DeviceTokenRepository } = require('./db/device-token.repository');
const { NotificationController } = require('./controllers/notification.controller');
const { DeviceController } = require('./controllers/device.controller');
const { notificationRouter } = require('./api/notification.routes');
const { deviceRouter } = require('./api/device.routes');
const { getFirebaseConfigurationStatus } = require('./config/firebase');

function createServer(pgPool = null) {
  const repository = new NotificationRepository(pgPool);
  const controller = new NotificationController(repository);
  const deviceRepository = new DeviceTokenRepository(pgPool);
  const deviceController = new DeviceController(deviceRepository);

  const server = http.createServer(async (req, res) => {
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
    console.log(`🚀 [Task 11] API Thu thập Thông báo Đa nguồn (Node.js + PostgreSQL)`);
    console.log(`👉 Base URL : http://localhost:${PORT}/api/v1/notifications`);
    console.log(`👉 Device API: http://localhost:${PORT}/api/devices/register`);
    console.log(`👉 Firebase  : ${firebaseStatus.configured ? 'Đã cấu hình' : 'Chưa cấu hình (API khác vẫn hoạt động)'}`);
    console.log(`👉 Phụ trách : Nguyễn Hữu Tuấn / Hồ Đăng Hưng`);
    console.log(`===================================================================`);
  });
}

module.exports = {
  createServer,
};
