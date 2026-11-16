const test = require('node:test');
const assert = require('node:assert/strict');

const { FANPAGES, fbCrawlerService } = require('../src/services/fb-crawler.service');
const { InMemoryDbStore } = require('../src/config/db');
const { NotificationService } = require('../src/services/notification.service');
const { CrawlerManagerService } = require('../src/services/crawler-manager.service');

test('FB-FIX-01: fetchFanpagePosts thu thập đầy đủ bài viết từ cả 2 Fanpage với source_url chuẩn xác 100%', async () => {
  const ctsvPosts = await fbCrawlerService.fetchFanpagePosts('FB_CTSV');
  assert.ok(ctsvPosts.length >= 6, 'CTSV phải có ít nhất 6 bài viết thật trong 2 tháng');

  for (const post of ctsvPosts) {
    assert.equal(post.source_channel, 'FB_CTSV');
    assert.ok(post.source_url, `Bài "${post.title}" phải có source_url`);
    // Tuyệt đối không được là link root Fanpage
    assert.notEqual(
      post.source_url,
      'https://www.facebook.com/ctsvdhbkdhdn',
      `Bài "${post.title}" không được trỏ về root Fanpage: ${post.source_url}`
    );
    assert.ok(
      post.source_url.includes('facebook.com/ctsvdhbkdhdn/posts/') || post.source_url.includes('facebook.com/posts/'),
      `source_url phải chứa permalink bài viết thật: ${post.source_url}`
    );
    assert.ok(post.title && post.title.length > 5, 'Phải có tiêu đề rõ ràng');
    assert.ok(post.content && post.content.length > 20, 'Phải có nội dung');
    assert.ok(post.published_at, 'Phải có thời gian đăng');
  }

  const tuvanPosts = await fbCrawlerService.fetchFanpagePosts('FB_TUVAN_SV');
  assert.ok(tuvanPosts.length >= 5, 'Tư vấn SV phải có ít nhất 5 bài viết thật trong 2 tháng');

  for (const post of tuvanPosts) {
    assert.equal(post.source_channel, 'FB_TUVAN_SV');
    assert.ok(post.source_url, `Bài "${post.title}" phải có source_url`);
    // Tuyệt đối không được là link root Fanpage
    assert.notEqual(
      post.source_url,
      'https://www.facebook.com/tuvansinhvien.dut',
      `Bài "${post.title}" không được trỏ về root Fanpage: ${post.source_url}`
    );
    assert.ok(
      post.source_url.includes('facebook.com/tuvansinhvien.dut/posts/') || post.source_url.includes('facebook.com/posts/'),
      `source_url phải chứa permalink bài viết thật: ${post.source_url}`
    );
  }
});

test('FB-FIX-02: Bóc tách đường link đính kèm thật từ nội dung bài viết Facebook (Zalo, form, bom.so)', async () => {
  const tuvanPosts = await fbCrawlerService.fetchFanpagePosts('FB_TUVAN_SV');
  
  // Tìm bài viết Recap workshop
  const recap = tuvanPosts.find((p) => /RECAP WORKSHOP/i.test(p.title) || /RECAP WORKSHOP/i.test(p.content));
  assert.ok(recap, 'Phải có bài viết Recap workshop');
  assert.ok(recap.attachments.length >= 1, 'Bài Recap workshop phải có link Zalo nhận chứng nhận');
  assert.ok(
    recap.attachments.some((a) => a.url.includes('zalo.me')),
    'Attachments phải chứa link Zalo thật'
  );

  // Tìm bài Lịch thi cuối kỳ
  const exam = tuvanPosts.find((p) => /LỊCH THI/i.test(p.title) || /LỊCH THI/i.test(p.content));
  assert.ok(exam, 'Phải có bài viết Lịch thi');
  assert.ok(exam.attachments.length >= 2, 'Bài Lịch thi phải có ít nhất 2 link đính kèm');
  assert.ok(
    exam.attachments.some((a) => a.url.includes('bom.so/piUmQ2')),
    'Attachments phải có link xem lịch thi'
  );
  assert.ok(
    exam.attachments.some((a) => a.url.includes('bom.so/f2NIZM')),
    'Attachments phải có link đăng ký thi bổ sung'
  );
});

test('FB-FIX-03: Reload/Cào lại tự động cập nhật source_url từ generic link sang link bài viết chính xác', async () => {
  const store = new InMemoryDbStore();
  const notifSvc = new NotificationService(store);

  // Giả lập trong CSDL ban đầu có một bài viết bị lưu link chung (lỗi cũ)
  const initialGenericNotice = {
    id: 'test-generic-fb-id',
    title: 'SINH VIÊN BÁCH KHOA ĐÀ NẴNG ĐẠT GIẢI NHÌ CUỘC THI THIẾT KẾ VI MẠCH BẢO MẬT VÀ AN TOÀN THÔNG TIN 2026',
    content: 'Chi tiết cuộc thi vi mạch...',
    source_channel: 'FB_CTSV',
    source_name: 'Phòng Công tác Sinh viên ĐHBK - ĐHĐN',
    source_url: 'https://www.facebook.com/ctsvdhbkdhdn', // Generic URL cũ bị lỗi
    published_at: '2026-11-10T08:11:49.000Z',
    attachments: [],
  };
  await notifSvc.ingestNotification(initialGenericNotice);

  const before = store.findNotificationByHash(
    notifSvc.generateContentHash({
      source_channel: 'FB_CTSV',
      title: initialGenericNotice.title,
    })
  );
  assert.ok(before);
  assert.equal(before.source_url, 'https://www.facebook.com/ctsvdhbkdhdn');

  // Trigger reload/ingest lại với payload chuẩn có source_url bài viết chính xác
  const reloadPayload = {
    title: 'SINH VIÊN BÁCH KHOA ĐÀ NẴNG ĐẠT GIẢI NHÌ CUỘC THI THIẾT KẾ VI MẠCH BẢO MẬT VÀ AN TOÀN THÔNG TIN 2026',
    content: 'Chi tiết cuộc thi vi mạch mới nhất...',
    source_channel: 'FB_CTSV',
    source_name: 'Phòng Công tác Sinh viên ĐHBK - ĐHĐN',
    source_url: 'https://www.facebook.com/ctsvdhbkdhdn/posts/1098254897839181', // URL chuẩn
    published_at: '2026-11-10T08:11:49.000Z',
    attachments: [],
  };

  const reloadResult = await notifSvc.ingestNotification(reloadPayload);
  assert.equal(reloadResult.status, 'DUPLICATE', 'Không được nhân bản dòng mới');
  assert.equal(
    reloadResult.notification.source_url,
    'https://www.facebook.com/ctsvdhbkdhdn/posts/1098254897839181',
    'source_url phải được tự động sửa chữa cập nhật sang link bài thật'
  );

  // Kiểm tra trong store chỉ có đúng 1 bản ghi và source_url đã được sửa
  let fbCount = 0;
  for (const n of store.notifications.values()) {
    if (n.source_channel === 'FB_CTSV') {
      fbCount++;
      assert.equal(n.source_url, 'https://www.facebook.com/ctsvdhbkdhdn/posts/1098254897839181');
    }
  }
  assert.equal(fbCount, 1, 'Không bị nhân đôi bản ghi');
});

test('FB-FIX-04: Reload qua CrawlerManagerService hoàn tất thu thập toàn bộ bài viết từ 2 Fanpage mà không bị trùng lặp', async () => {
  const store = new InMemoryDbStore();
  const notifSvc = new NotificationService(store);

  const manager = new CrawlerManagerService({
    dutCrawler: {
      async scrapeAllDutTabs() {
        return { total_found: 0, valid_notices: [], total_skipped_old: 0, by_tab: {} };
      },
    },
    fbCrawler: fbCrawlerService,
    notificationSvc: notifSvc,
    monthsLimit: 2,
  });

  // Lần 1: Cào toàn bộ 2 Fanpage
  const stats1 = await manager.crawlAllSources();
  assert.ok(stats1.inserted_count >= 11, `Lần 1 phải ingest ít nhất 11 bài từ 2 Fanpage, nhận được: ${stats1.inserted_count}`);
  assert.equal(stats1.duplicate_count, 0);

  // Mọi bài trong store phải có source_url bài viết chính xác
  for (const n of store.notifications.values()) {
    if (n.source_channel === 'FB_CTSV' || n.source_channel === 'FB_TUVAN_SV') {
      assert.ok(
        n.source_url && (n.source_url.includes('/posts/') || n.source_url.includes('facebook.com/')),
        `Bài "${n.title}" phải có source_url hợp lệ`
      );
      assert.notEqual(n.source_url, 'https://www.facebook.com/ctsvdhbkdhdn');
      assert.notEqual(n.source_url, 'https://www.facebook.com/tuvansinhvien.dut');
    }
  }

  // Lần 2: Reload lại toàn bộ
  const stats2 = await manager.crawlAllSources();
  assert.equal(stats2.inserted_count, 0, 'Lần 2 reload không được nhân bản thêm bài viết');
  assert.equal(stats2.duplicate_count, stats1.total_scraped, 'Toàn bộ bài viết phải được nhận diện và đồng bộ');
});

test('FB-FIX-05: repairAndDeduplicateFacebookNotices hợp nhất nội dung phong phú và kế thừa attachments khi dọn trùng', async () => {
  const store = new InMemoryDbStore();
  const notifSvc = new NotificationService(store);

  // Bản ghi cũ: có link generic, nội dung ngắn (15 ký tự), không attachments
  const oldGeneric = {
    id: 'old-generic-robot-id',
    title: 'TỰ HÀO SINH VIÊN BÁCH KHOA! ROBOT TỰ HÀNH CHINH PHỤC GIẢI NHẤT AIoT DEVELOPER INNOWORKS 2026',
    content: 'Nội dung ngắn cũ...',
    source_channel: 'FB_CTSV',
    source_name: 'Phòng Công tác Sinh viên ĐHBK - ĐHĐN',
    source_url: 'https://www.facebook.com/ctsvdhbkdhdn',
    published_at: '2026-11-16T01:01:06.000Z',
    attachments: [],
  };

  // Bản ghi mới: có link posts cụ thể, nội dung chi tiết đầy đủ (200 ký tự), có attachments
  const newDetailed = {
    id: 'new-detailed-robot-id',
    title: 'TỰ HÀO SINH VIÊN BÁCH KHOA! ROBOT TỰ HÀNH CHINH PHỤC GIẢI NHẤT AIoT DEVELOPER INNOWORKS 2026 🤖🌱',
    content: 'Một lần nữa, sinh viên Trường Đại học Bách khoa, Đại học Đà Nẵng khẳng định bản lĩnh, trí tuệ và sự sáng tạo tại đấu trường công nghệ quốc tế với giải Nhất cuộc thi AIoT Developer Innoworks 2026 chi tiết đầy đủ.',
    source_channel: 'FB_CTSV',
    source_name: 'Phòng Công tác Sinh viên ĐHBK - ĐHĐN',
    source_url: 'https://www.facebook.com/ctsvdhbkdhdn/posts/1824646392020124',
    published_at: '2026-11-16T01:01:06.000Z',
    attachments: [{ title: 'Xem chi tiết giải thưởng', url: 'https://dut.udn.vn/innoworks2026' }],
  };

  await notifSvc.ingestNotification(oldGeneric);
  // Cố tình thêm trực tiếp vào store để giả lập dữ liệu lịch sử bị trùng trong CSDL
  store.notifications.set(newDetailed.id, { ...newDetailed });

  assert.equal(store.notifications.size, 2, 'Trước khi dọn dẹp, store phải có 2 bản ghi');

  const result = await notifSvc.repairAndDeduplicateFacebookNotices();
  assert.equal(result.deletedDuplicates, 1, 'Phải xóa 1 bản ghi trùng lặp');

  // Kiểm tra bản ghi còn lại trong store:
  let remaining = null;
  for (const n of store.notifications.values()) {
    if (n.source_channel === 'FB_CTSV') {
      remaining = n;
      break;
    }
  }
  assert.ok(remaining, 'Phải còn lại 1 bản ghi duy nhất');
  assert.equal(remaining.source_url, 'https://www.facebook.com/ctsvdhbkdhdn/posts/1824646392020124', 'source_url phải là URL bài viết cụ thể');
  assert.ok(remaining.content.length > 50, 'Nội dung phải được giữ lại bản đầy đủ phong phú');
  assert.ok(remaining.attachments && remaining.attachments.length > 0, 'Attachments phải được kế thừa đầy đủ');
});
