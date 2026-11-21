/**
 * KHỞI CHẠY HỆ THỐNG BACKEND THU THẬP & CẢNH BÁO THÔNG BÁO SINH VIÊN DUT
 * Triển khai theo đặc tả AGENT.md (Mục II.3.1)
 * Kiến trúc: Direct PostgreSQL Query (Node.js node:http + pg + Flutter + Firebase + Google Calendar)
 */

const http = require('node:http');
const { loadRuntimeEnv } = require('./config/env');
loadRuntimeEnv();
const { encryptionKey } = require('./config/secrets');
const { migrate } = require('./db/migrate');
const { AuthService } = require('./services/auth.service');
const { authorize } = require('./api/auth');
const { PushDeliveryService } = require('./services/push-delivery.service');
const { ReminderWorker } = require('./workers/reminder.worker');
const { getPool, createDbAdapter, verifyDbConnection, closePool } = require('./config/db');
const { StudentRepository } = require('./db/student.repository');
const { CourseRepository } = require('./db/course.repository');
const { DeadlineRepository } = require('./db/deadline.repository');
const { FollowedPageRepository } = require('./db/followed-page.repository');
const { NotificationRepository } = require('./db/postgres');
const { DeviceTokenRepository } = require('./db/device-token.repository');
const { CourseService } = require('./services/course.service');
const { DeadlineService } = require('./services/deadline.service');
const { GoogleCalendarService } = require('./services/google-calendar.service');
const { NotificationService } = require('./services/notification.service');
const { FbCrawlerService } = require('./services/fb-crawler.service');
const { CrawlerManagerService } = require('./services/crawler-manager.service');
const { PushNotificationService } = require('./services/pushNotificationService');
const { NotificationController } = require('./controllers/notification.controller');
const { DeviceController } = require('./controllers/device.controller');
const { notificationRouter } = require('./api/notification.routes');
const { deviceRouter } = require('./api/device.routes');
const { getFirebaseConfigurationStatus } = require('./config/firebase');

function createServer(pgPool = null) {
  const dbAdapter = pgPool ? createDbAdapter(pgPool) : createDbAdapter();
  const authService = new AuthService(dbAdapter);
  const studentRepo = new StudentRepository(dbAdapter);
  const courseRepo = new CourseRepository(dbAdapter);
  const deadlineRepo = new DeadlineRepository(dbAdapter);
  const followedPageRepo = new FollowedPageRepository(dbAdapter);
  const repository = new NotificationRepository(dbAdapter);
  const deviceRepository = new DeviceTokenRepository(dbAdapter);
  const pushService = new PushNotificationService({ deviceRepository });

  const deadlineSvc = new DeadlineService({ db: dbAdapter, studentRepo, deadlineRepo });
  const deliveryService = new PushDeliveryService({db:dbAdapter,pushService});
  const reminderWorker = new ReminderWorker(deadlineSvc, deliveryService);
  const calendarSvc = new GoogleCalendarService({ db: dbAdapter, studentRepo, deadlineRepo });
  const notificationSvc = new NotificationService({
    db: dbAdapter,
    notificationRepo: repository,
    studentRepo,
    courseRepo,
    deadlineSvc,
    deviceRepo: deviceRepository,
    pushService,
  });
  const courseSvc = new CourseService({
    db: dbAdapter,
    studentRepo,
    courseRepo,
    notificationRepo: repository,
  });
  const fbCrawlerSvc = new FbCrawlerService({
    db: dbAdapter,
    studentRepo,
    followedPageRepo,
    notificationSvc,
  });
  const crawlerMgrSvc = new CrawlerManagerService({
    fbCrawler: fbCrawlerSvc,
    notificationSvc,
  });

  const controller = new NotificationController({
    db: dbAdapter,
    authService,
    repository,
    studentRepo,
    courseSvc,
    deadlineSvc,
    calendarSvc,
    notificationSvc,
    fbCrawlerSvc,
    crawlerMgrSvc,
    reminderWorker,
  });
  const deviceController = new DeviceController(deviceRepository, pushService, studentRepo);

  const server = http.createServer(async (req, res) => {
    const startTime = Date.now();
    if (process.env.NODE_ENV !== 'test') {
      res.on('finish', () => {
        console.log(`[HTTP] ${req.method} ${new URL(req.url, 'http://localhost').pathname} - ${res.statusCode} (${Date.now() - startTime}ms)`);
      });
    }

    try {
      await authorize(req, authService);
      if (req.url?.startsWith('/api/devices') || req.url?.startsWith('/api/push')) {
        await deviceRouter(req, res, deviceController);
        return;
      }
      await notificationRouter(req, res, controller);
    } catch (error) {
      const status = error.httpStatus || 500;
      res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*'});
      res.end(JSON.stringify({status:'error', code:error.code || 'INTERNAL_ERROR', message:status >= 500 ? 'Lỗi máy chủ nội bộ' : error.message}));
    }
  });

  return {
    server,
    db: dbAdapter,
    repository,
    controller,
    authService,
    deviceRepository,
    deviceController,
    crawlerMgrSvc,
    reminderWorker,
    services: {
      courseSvc,
      deadlineSvc,
      calendarSvc,
      notificationSvc,
      fbCrawlerSvc,
      crawlerMgrSvc,
      deliveryService,
    },
  };
}

async function startServer() {
  loadRuntimeEnv();
  encryptionKey();
  const pool = getPool();
  await verifyDbConnection(pool);
  await migrate(pool);

  const PORT = process.env.PORT || 3000;
  const { server, crawlerMgrSvc, reminderWorker } = createServer(pool);

  await new Promise((resolve) => {
    server.listen(PORT, resolve);
  });

  const firebaseStatus = getFirebaseConfigurationStatus();
  console.log(`===================================================================`);
  console.log(`🚀 Hệ Thống Tổng Hợp & Cảnh Báo Thông Báo Sinh Viên DUT (Direct PG)`);
  console.log(`👉 Cổng chạy Server: http://localhost:${PORT}`);
  console.log(`👉 Bảng tin chung  : http://localhost:${PORT}/api/v1/notifications`);
  console.log(`👉 Học phần sv.dut : http://localhost:${PORT}/api/v1/courses/enrolled`);
  console.log(`👉 Quản lý Hạn chót: http://localhost:${PORT}/api/v1/deadlines`);
  console.log(`👉 Lịch Calendar   : http://localhost:${PORT}/api/v1/calendar/export.ics`);
  console.log(`👉 Trạng thái cào  : http://localhost:${PORT}/api/v1/crawler/status`);
  console.log(`👉 Kích hoạt cào   : POST http://localhost:${PORT}/api/v1/crawler/trigger`);
  console.log(`👉 Firebase FCM    : ${firebaseStatus.configured ? 'Đã kích hoạt' : 'Chưa cấu hình (Mock fallback mode)'}`);
  console.log(`===================================================================`);

  crawlerMgrSvc.startPeriodicCrawl(30);
  reminderWorker.start();
  setTimeout(() => {
    crawlerMgrSvc.crawlAllSources().catch((err) => {
      console.warn('Lỗi cào khởi đầu:', err.message);
    });
  }, 2000);

  const shutdown = async () => {
    crawlerMgrSvc.stopPeriodicCrawl();
    await reminderWorker.stop();
    await new Promise((resolve) => server.close(resolve));
    await closePool();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return server;
}

if (require.main === module) {
  startServer().catch(async (err) => {
    console.error('[FATAL] Khởi động thất bại (PostgreSQL fail-fast):', err.message || err);
    await closePool().catch(() => {});
    process.exit(1);
  });
}

module.exports = {
  createServer,
  startServer,
};
