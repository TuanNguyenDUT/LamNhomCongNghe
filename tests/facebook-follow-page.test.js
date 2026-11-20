const test = require('node:test');
const assert = require('node:assert/strict');

const { FbCrawlerService, fbCrawlerService } = require('../src/services/fb-crawler.service');
const { NotificationService } = require('../src/services/notification.service');
const { CrawlerManagerService } = require('../src/services/crawler-manager.service');
const { createServer } = require('../src/server');
const {
  createTestPool,
  resetDatabase,
  seedStudent,
  teardownTestPool,
} = require('./helpers/pg-test-harness');

test('FB-FOLLOW-01: parseFacebookPageUrl chuẩn hóa chính xác nhiều định dạng URL Fanpage Facebook', () => {
  const res1 = fbCrawlerService.parseFacebookPageUrl('https://www.facebook.com/clb.guitar.dut');
  assert.equal(res1.isValid, true);
  assert.equal(res1.cleanUrl, 'https://www.facebook.com/clb.guitar.dut');
  assert.equal(res1.pageUsername, 'clb.guitar.dut');
  assert.equal(res1.channelCode, 'FB_CLB_GUITAR_DUT');

  const res2 = fbCrawlerService.parseFacebookPageUrl('https://m.facebook.com/DoanThanhNienDUT/?ref=bookmarks');
  assert.equal(res2.cleanUrl, 'https://www.facebook.com/DoanThanhNienDUT');
  assert.equal(res2.pageUsername, 'DoanThanhNienDUT');

  const res3 = fbCrawlerService.parseFacebookPageUrl('https://www.facebook.com/profile.php?id=100064893829123');
  assert.equal(res3.cleanUrl, 'https://www.facebook.com/profile.php?id=100064893829123');
  assert.equal(res3.pageId, '100064893829123');

  const res4 = fbCrawlerService.parseFacebookPageUrl('https://www.facebook.com/p/CLB-Guitar-DUT-100064893829123/');
  assert.equal(res4.cleanUrl, 'https://www.facebook.com/profile.php?id=100064893829123');

  const res5 = fbCrawlerService.parseFacebookPageUrl('@khoacnttdhbk');
  assert.equal(res5.cleanUrl, 'https://www.facebook.com/khoacnttdhbk');
  assert.equal(res5.pageUsername, 'khoacnttdhbk');

  const res6 = fbCrawlerService.parseFacebookPageUrl('facebook.com/ctsvdhbkdhdn');
  assert.equal(res6.cleanUrl, 'https://www.facebook.com/ctsvdhbkdhdn');
});

test('FB-FOLLOW-02: parseFacebookPageUrl bắt lỗi các URL không hợp lệ hoặc sai tên miền', () => {
  assert.throws(() => fbCrawlerService.parseFacebookPageUrl(''), /không được để trống/);
  assert.throws(() => fbCrawlerService.parseFacebookPageUrl('https://google.com/ctsv'), /thuộc mạng xã hội Facebook/);
  assert.throws(() => fbCrawlerService.parseFacebookPageUrl('https://facebook.com/groups/12345'), /không phải là một Fanpage/);
});

test.describe('Facebook Follow Page Direct PostgreSQL Tests', () => {
  let pool;
  let student;

  test.before(async () => {
    pool = await createTestPool();
  });

  test.beforeEach(async () => {
    await resetDatabase(pool);
    student = await seedStudent(pool, { student_code: '102230026' });
  });

  test.after(async () => {
    await teardownTestPool(pool);
  });

  test('FB-FOLLOW-03: Luồng Follow Page, Get Followed Pages và Unfollow Page lưu UUID thật trong PostgreSQL', async () => {
    const crawler = new FbCrawlerService({ pool });
    crawler.scrapeCustomFacebookPage = async () => ({ page: {}, posts: [] });

    const studentCode = '102230026';
    const followResult = await crawler.followPage({
      studentId: studentCode,
      pageUrl: 'https://www.facebook.com/clb.guitar.dut',
      pageName: 'CLB Guitar Bách Khoa',
    });

    assert.equal(followResult.status, 'success');
    assert.ok(followResult.data.page);
    assert.equal(followResult.data.page.student_id, student.id, 'Phải ánh xạ student_code sang students.id UUID');
    assert.equal(followResult.data.page.page_url, 'https://www.facebook.com/clb.guitar.dut');
    assert.equal(followResult.data.page.page_name, 'CLB Guitar Bách Khoa');

    // Xác minh trực tiếp trong bảng followed_fb_pages của PostgreSQL
    const dbRows = await pool.query('SELECT * FROM followed_fb_pages WHERE student_id = $1::uuid AND is_active = TRUE', [student.id]);
    assert.equal(dbRows.rows.length, 1);

    const followed = await crawler.getFollowedPages(studentCode);
    const found = followed.find((p) => p.page_url === 'https://www.facebook.com/clb.guitar.dut');
    assert.ok(found, 'Phải tìm thấy CLB Guitar trong danh sách theo dõi');
    assert.equal(found.is_active, true);

    const unfollowOk = await crawler.unfollowPage(found.id, studentCode);
    assert.equal(unfollowOk, true);

    const followedAfter = await crawler.getFollowedPages(studentCode);
    const foundAfter = followedAfter.find((p) => p.page_url === 'https://www.facebook.com/clb.guitar.dut');
    assert.equal(foundAfter, undefined, 'Trang phải bị xóa khỏi danh sách theo dõi sau khi unfollow');
  });

  test('FB-FOLLOW-04: API Controller - followFacebookPage, getFollowedFacebookPages, unfollowFacebookPage', async () => {
    const { controller, services } = createServer(pool);
    services.fbCrawlerSvc.scrapeCustomFacebookPage = async () => ({ page: {}, posts: [] });

    const followRes = await controller.followFacebookPage({
      student_id: '102230026',
      page_url: 'https://www.facebook.com/DoanThanhNienDUT',
      page_name: 'Đoàn Thanh niên Trường ĐHBK',
    });
    assert.equal(followRes.statusCode, 201);
    assert.equal(followRes.body.status, 'success');

    const getRes = await controller.getFollowedFacebookPages({ student_id: '102230026' });
    assert.equal(getRes.statusCode, 200);
    assert.ok(getRes.body.data.some((p) => p.page_url.includes('DoanThanhNienDUT')));

    const pageItem = getRes.body.data.find((p) => p.page_url.includes('DoanThanhNienDUT'));
    const unfollowRes = await controller.unfollowFacebookPage(pageItem.id, { student_id: '102230026' });
    assert.equal(unfollowRes.statusCode, 200);
    assert.equal(unfollowRes.body.data.unfollowed, true);
  });

  test('FB-FOLLOW-05: CrawlerManagerService quét và cào tự động các bài viết từ Fanpage được theo dõi', async () => {
    const notifSvc = new NotificationService({ pool });
    const fbCrawler = new FbCrawlerService({ pool, notificationSvc: notifSvc });

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

    await fbCrawler.followPage({
      studentId: '102230026',
      pageUrl: 'https://www.facebook.com/clb.guitar.dut',
      pageName: 'CLB Guitar DUT',
    });

    const crawlerMgr = new CrawlerManagerService({
      dutCrawler: {
        async scrapeAllDutTabs() {
          return { total_found: 0, valid_notices: [], total_skipped_old: 0, by_tab: {} };
        },
      },
      fbCrawler,
      notificationSvc: notifSvc,
    });
    fbCrawler.scrapeAllFanpages = async () => [];

    const stats = await crawlerMgr.crawlAllSources();
    assert.ok(stats.total_scraped > 0);

    const notifs = await notifSvc.getFeedNotifications({ limit: 100 });
    const guitarPost = notifs.notifications.find((n) => n.title.includes('CLB GUITAR'));
    assert.ok(guitarPost, 'Bài viết từ Fanpage theo dõi phải được lưu vào PostgreSQL');
    assert.equal(guitarPost.source_channel, 'FB_CLB_GUITAR_DUT');
    assert.equal(guitarPost.source_url, 'https://www.facebook.com/clb.guitar.dut/posts/99887766554433');
    assert.equal(guitarPost.attachments.length, 1);
    assert.equal(guitarPost.attachments[0].url, 'https://forms.gle/guitarGen10');
  });
});
