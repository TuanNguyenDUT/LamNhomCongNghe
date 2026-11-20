const test = require('node:test');
const assert = require('node:assert/strict');

const { FbCrawlerService, fbCrawlerService } = require('../src/services/fb-crawler.service');
const { InMemoryDbStore } = require('../src/config/db');
const { NotificationService } = require('../src/services/notification.service');
const { CrawlerManagerService } = require('../src/services/crawler-manager.service');
const { NotificationController } = require('../src/controllers/notification.controller');

test('FB-FOLLOW-01: parseFacebookPageUrl chuẩn hóa chính xác nhiều định dạng URL Fanpage Facebook', () => {
  // 1. Dạng link tiêu chuẩn desktop
  const res1 = fbCrawlerService.parseFacebookPageUrl('https://www.facebook.com/clb.guitar.dut');
  assert.equal(res1.isValid, true);
  assert.equal(res1.cleanUrl, 'https://www.facebook.com/clb.guitar.dut');
  assert.equal(res1.pageUsername, 'clb.guitar.dut');
  assert.equal(res1.channelCode, 'FB_CLB_GUITAR_DUT');

  // 2. Dạng link mobile m.facebook.com có trailing slash và query parameter
  const res2 = fbCrawlerService.parseFacebookPageUrl('https://m.facebook.com/DoanThanhNienDUT/?ref=bookmarks');
  assert.equal(res2.cleanUrl, 'https://www.facebook.com/DoanThanhNienDUT');
  assert.equal(res2.pageUsername, 'DoanThanhNienDUT');

  // 3. Dạng link profile.php?id=...
  const res3 = fbCrawlerService.parseFacebookPageUrl('https://www.facebook.com/profile.php?id=100064893829123');
  assert.equal(res3.cleanUrl, 'https://www.facebook.com/profile.php?id=100064893829123');
  assert.equal(res3.pageId, '100064893829123');

  // 4. Dạng link giao diện mới /p/Ten-Trang-100064893829123/
  const res4 = fbCrawlerService.parseFacebookPageUrl('https://www.facebook.com/p/CLB-Guitar-DUT-100064893829123/');
  assert.equal(res4.cleanUrl, 'https://www.facebook.com/profile.php?id=100064893829123');

  // 5. Dạng người dùng chỉ gõ username hoặc @username
  const res5 = fbCrawlerService.parseFacebookPageUrl('@khoacnttdhbk');
  assert.equal(res5.cleanUrl, 'https://www.facebook.com/khoacnttdhbk');
  assert.equal(res5.pageUsername, 'khoacnttdhbk');

  // 6. Dạng người dùng gõ không có https (facebook.com/...)
  const res6 = fbCrawlerService.parseFacebookPageUrl('facebook.com/ctsvdhbkdhdn');
  assert.equal(res6.cleanUrl, 'https://www.facebook.com/ctsvdhbkdhdn');
});

test('FB-FOLLOW-02: parseFacebookPageUrl bắt lỗi các URL không hợp lệ hoặc sai tên miền', () => {
  assert.throws(() => fbCrawlerService.parseFacebookPageUrl(''), /không được để trống/);
  assert.throws(() => fbCrawlerService.parseFacebookPageUrl('https://google.com/ctsv'), /thuộc mạng xã hội Facebook/);
  assert.throws(() => fbCrawlerService.parseFacebookPageUrl('https://facebook.com/groups/12345'), /không phải là một Fanpage/);
});

test('FB-FOLLOW-03: Luồng Follow Page, Get Followed Pages và Unfollow Page hoạt động chuẩn xác trong CSDL/Store', async () => {
  const store = new InMemoryDbStore();
  const crawler = new FbCrawlerService(store);

  const studentId = '102230026';
  const followResult = await crawler.followPage({
    studentId,
    pageUrl: 'https://www.facebook.com/clb.guitar.dut',
    pageName: 'CLB Guitar Bách Khoa',
  });

  assert.equal(followResult.status, 'success');
  assert.ok(followResult.data.page);
  assert.equal(followResult.data.page.page_url, 'https://www.facebook.com/clb.guitar.dut');
  assert.equal(followResult.data.page.page_name, 'CLB Guitar Bách Khoa');

  // Lấy danh sách trang theo dõi của sinh viên
  const followed = crawler.getFollowedPages(studentId);
  const found = followed.find((p) => p.page_url === 'https://www.facebook.com/clb.guitar.dut');
  assert.ok(found, 'Phải tìm thấy CLB Guitar trong danh sách theo dõi');
  assert.equal(found.is_active, true);

  // Hủy theo dõi
  const unfollowOk = crawler.unfollowPage(found.id, studentId);
  assert.equal(unfollowOk, true);

  const followedAfter = crawler.getFollowedPages(studentId);
  const foundAfter = followedAfter.find((p) => p.page_url === 'https://www.facebook.com/clb.guitar.dut');
  assert.equal(foundAfter, undefined, 'Trang phải bị xóa khỏi danh sách theo dõi sau khi unfollow');
});

test('FB-FOLLOW-04: API Controller - followFacebookPage, getFollowedFacebookPages, unfollowFacebookPage', async () => {
  const controller = new NotificationController();

  // Test Follow qua API
  const followRes = await controller.followFacebookPage({
    student_id: '102230026',
    page_url: 'https://www.facebook.com/DoanThanhNienDUT',
    page_name: 'Đoàn Thanh niên Trường ĐHBK',
  });
  assert.equal(followRes.statusCode, 201);
  assert.equal(followRes.body.status, 'success');

  // Test Get Followed Pages qua API
  const getRes = await controller.getFollowedFacebookPages({ student_id: '102230026' });
  assert.equal(getRes.statusCode, 200);
  assert.ok(getRes.body.data.some((p) => p.page_url.includes('DoanThanhNienDUT')));

  // Test Unfollow qua API
  const pageItem = getRes.body.data.find((p) => p.page_url.includes('DoanThanhNienDUT'));
  const unfollowRes = await controller.unfollowFacebookPage(pageItem.id, { student_id: '102230026' });
  assert.equal(unfollowRes.statusCode, 200);
  assert.equal(unfollowRes.body.data.unfollowed, true);
});

test('FB-FOLLOW-05: CrawlerManagerService quét và cào tự động các bài viết từ Fanpage được theo dõi', async () => {
  const store = new InMemoryDbStore();
  const notifSvc = new NotificationService(store);
  const fbCrawler = new FbCrawlerService(store);

  // Giả lập mock hàm scrapeCustomFacebookPage trả về bài viết từ fanpage mới
  fbCrawler.scrapeCustomFacebookPage = async (pageUrl, options = {}) => {
    return {
      page: {
        clean_url: pageUrl,
        channel_code: 'FB_CLB_GUITAR_DUT',
        page_name: options.pageName || 'CLB Guitar DUT',
      },
      posts: [
        {
          title: '[TUYỂN THÀNH VIÊN GEN 10] CLB GUITAR TRƯỜNG ĐẠI HỌC BÁCH KHOA',
          content: 'CLB Guitar DUT chính thức mở đơn tuyển thành viên thế hệ thứ 10! Đăng ký ngay tại form: https://forms.gle/guitarGen10',
          source_channel: 'FB_CLB_GUITAR_DUT',
          source_name: 'CLB Guitar DUT',
          source_url: 'https://www.facebook.com/clb.guitar.dut/posts/99887766554433',
          published_at: new Date().toISOString(),
          attachments: [{ title: 'Form đăng ký Gen 10', url: 'https://forms.gle/guitarGen10' }],
        },
      ],
    };
  };

  // Follow trang
  await fbCrawler.followPage({
    studentId: '102230026',
    pageUrl: 'https://www.facebook.com/clb.guitar.dut',
    pageName: 'CLB Guitar DUT',
  });

  const crawlerMgr = new CrawlerManagerService({
    fbCrawler,
    notificationSvc: notifSvc,
  });

  // Chạy một chu kỳ cào toàn bộ các nguồn
  const stats = await crawlerMgr.crawlAllSources();
  assert.ok(stats.total_scraped > 0);

  // Kiểm tra bài viết của CLB Guitar đã được lưu vào hệ thống
  const notifs = await notifSvc.getFeedNotifications({ limit: 100 });
  const guitarPost = notifs.notifications.find((n) => n.title.includes('CLB GUITAR'));
  assert.ok(guitarPost, 'Bài viết từ Fanpage theo dõi phải được lưu vào CSDL');
  assert.equal(guitarPost.source_url, 'https://www.facebook.com/clb.guitar.dut/posts/99887766554433');
  assert.equal(guitarPost.attachments.length, 1);
  assert.equal(guitarPost.attachments[0].url, 'https://forms.gle/guitarGen10');
});
