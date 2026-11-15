const test = require('node:test');
const assert = require('node:assert/strict');

const { DUT_TABS, DutCrawlerService } = require('../src/services/dut-crawler.service');
const { FANPAGES, FbCrawlerService } = require('../src/services/fb-crawler.service');
const { CrawlerManagerService } = require('../src/services/crawler-manager.service');
const { NotificationService } = require('../src/services/notification.service');
const { InMemoryDbStore } = require('../src/config/db');
const { NotificationController } = require('../src/controllers/notification.controller');

test('CRAWLER-01: Định danh đủ 7 tab của sv.dut.udn.vn và 2 Fanpage FB', () => {
  assert.equal(DUT_TABS.length, 7, 'Cần đúng 7 chuyên mục chuẩn của sv.dut.udn.vn');
  const expectedCodes = [
    'DUT_GENERAL',
    'DUT_TRAINING',
    'DUT_COURSE_CLASS',
    'DUT_STUDENT_AFFAIRS',
    'DUT_TESTING_QA',
    'DUT_TUITION_FEE',
    'DUT_REGULATIONS',
  ];
  const actualCodes = DUT_TABS.map((t) => t.code);
  assert.deepEqual(actualCodes, expectedCodes);

  assert.ok(FANPAGES.FB_CTSV, 'Phải có cấu hình Fanpage CTSV');
  assert.ok(FANPAGES.FB_TUVAN_SV, 'Phải có cấu hình Fanpage Tư vấn SV');
  assert.equal(FANPAGES.FB_CTSV.id, 'FB_CTSV');
  assert.equal(FANPAGES.FB_TUVAN_SV.id, 'FB_TUVAN_SV');
});

test('CRAWLER-02: Giới hạn thời gian 2 tháng (60 ngày) - Bỏ qua tin cũ hơn', async () => {
  const store = new InMemoryDbStore();
  const notifSvc = new NotificationService(store);

  // Tạo mock crawler có 1 tin mới (10 ngày trước) và 1 tin cũ (75 ngày trước)
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const seventyFiveDaysAgo = new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString();

  const mockDutCrawler = {
    async scrapeAllDutTabs({ monthsLimit = 2 }) {
      const cutoff = new Date(Date.now() - monthsLimit * 30 * 24 * 60 * 60 * 1000);
      const items = [
        {
          title: 'Tin mới trong hạn 2 tháng',
          content: 'Nội dung hợp lệ',
          source_channel: 'DUT_GENERAL',
          source_name: 'Thông báo chung',
          published_at: tenDaysAgo,
        },
        {
          title: 'Tin cũ 75 ngày trước',
          content: 'Nội dung hết hạn',
          source_channel: 'DUT_GENERAL',
          source_name: 'Thông báo chung',
          published_at: seventyFiveDaysAgo,
        },
      ];
      const valid = items.filter((i) => new Date(i.published_at) >= cutoff);
      const skipped = items.filter((i) => new Date(i.published_at) < cutoff);
      return {
        total_found: valid.length,
        valid_notices: valid,
        total_skipped_old: skipped.length,
        by_tab: {},
      };
    },
  };

  const mockFbCrawler = {
    async scrapeAllFanpages() {
      return [];
    },
  };

  const manager = new CrawlerManagerService({
    dutCrawler: mockDutCrawler,
    fbCrawler: mockFbCrawler,
    notificationSvc: notifSvc,
    monthsLimit: 2,
  });

  const stats = await manager.crawlAllSources();
  assert.equal(stats.total_scraped, 1, 'Chỉ 1 tin trong vòng 2 tháng được chấp nhận');
  assert.equal(stats.inserted_count, 1, 'Lưu đúng 1 tin mới');
  assert.equal(stats.skipped_old_count, 1, 'Đã bỏ qua đúng 1 tin cũ hơn 2 tháng');
});

test('CRAWLER-03: Chống trùng lặp tuyệt đối - Chạy cào 2 lần không lưu trùng', async () => {
  const store = new InMemoryDbStore();
  const notifSvc = new NotificationService(store);

  const sampleNotices = [
    {
      title: 'TB về Xét công nhận tốt nghiệp đợt 4 năm 2026',
      content: 'Chi tiết xét tốt nghiệp...',
      source_channel: 'DUT_TRAINING',
      source_name: 'Phòng Đào tạo',
      source_url: 'https://sv.dut.udn.vn/#tabs_PubTB-divT1',
      published_at: '2026-11-13T08:00:00.000Z',
    },
    {
      title: 'THÔNG BÁO NỘP TIỀN BẢO HIỂM Y TẾ SINH VIÊN 2027',
      content: 'Chi tiết nộp tiền BHYT...',
      source_channel: 'DUT_TUITION_FEE',
      source_name: 'Học phí & KHTC',
      source_url: 'https://sv.dut.udn.vn/#tabs_PubTB-divT5',
      published_at: '2026-11-11T08:00:00.000Z',
    },
  ];

  const mockDut = {
    async scrapeAllDutTabs() {
      return { total_found: 2, valid_notices: sampleNotices, total_skipped_old: 0, by_tab: {} };
    },
  };
  const mockFb = {
    async scrapeAllFanpages() {
      return [];
    },
  };

  const manager = new CrawlerManagerService({
    dutCrawler: mockDut,
    fbCrawler: mockFb,
    notificationSvc: notifSvc,
    monthsLimit: 2,
  });

  // Lần cào 1: Lưu mới 2 thông báo
  const stats1 = await manager.crawlAllSources();
  assert.equal(stats1.inserted_count, 2, 'Lần 1 phải insert 2 bài');
  assert.equal(stats1.duplicate_count, 0, 'Lần 1 chưa có bài trùng');
  assert.equal(store.notifications.size, 2, 'DB chứa 2 thông báo');

  // Lần cào 2: Không lưu lại bất kỳ thông báo nào, báo trùng 2 bài
  const stats2 = await manager.crawlAllSources();
  assert.equal(stats2.inserted_count, 0, 'Lần 2 không được insert lại');
  assert.equal(stats2.duplicate_count, 2, 'Lần 2 phải phát hiện trùng khớp 2 bài');
  assert.equal(store.notifications.size, 2, 'DB vẫn giữ nguyên 2 thông báo (không bị nhân đôi)');
});

test('CRAWLER-04: Xác định chính xác nguồn gốc trên mỗi thông báo', async () => {
  const store = new InMemoryDbStore();
  const notifSvc = new NotificationService(store);

  const res = await notifSvc.ingestNotification({
    title: 'Học bổng doanh nghiệp Nippon Steel',
    content: '20 suất học bổng cho sinh viên...',
    source_channel: 'FB_CTSV',
    source_url: 'https://www.facebook.com/ctsvdhbkdhdn/posts/1209384756',
    published_at: new Date().toISOString(),
  });

  assert.equal(res.status, 'INSERTED');
  assert.equal(res.notification.source_channel, 'FB_CTSV');
  assert.equal(res.notification.source_name, 'Fanpage Phòng Công tác Sinh viên');
  assert.ok(res.notification.source_url.includes('facebook.com'));
});

test('CRAWLER-05: Worker cào định kỳ mỗi 30 phút & API Trigger/Status', async () => {
  const manager = new CrawlerManagerService({ intervalMinutes: 30 });
  manager.startPeriodicCrawl(30);

  const status = manager.getStatus();
  assert.equal(status.interval_minutes, 30);
  assert.equal(status.is_periodic_active, true);
  assert.ok(status.next_crawl_at, 'Phải có mốc thời gian lần cào tiếp theo');

  manager.stopPeriodicCrawl();
  assert.equal(manager.getStatus().is_periodic_active, false);

  // Test Controller endpoints
  const controller = new NotificationController();
  const statusRes = await controller.getCrawlerStatus();
  assert.equal(statusRes.statusCode, 200);
  assert.equal(statusRes.body.status, 'success');
  assert.equal(statusRes.body.data.interval_minutes, 30);
});
