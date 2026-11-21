const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { fbCrawlerService } = require('../src/services/fb-crawler.service');
const { NotificationService } = require('../src/services/notification.service');
const { NotificationRepository } = require('../src/db/postgres');
const { CrawlerManagerService } = require('../src/services/crawler-manager.service');
const {
  createTestPool,
  resetDatabase,
  teardownTestPool,
} = require('./helpers/pg-test-harness');

test('FB-FIX-01: fetchFanpagePosts thu thập đầy đủ bài viết từ cả 2 Fanpage với source_url chuẩn xác 100%', async () => {
  const ctsvPosts = await fbCrawlerService.fetchFanpagePosts('FB_CTSV');
  assert.ok(ctsvPosts.length >= 6, 'CTSV phải có ít nhất 6 bài viết thật trong 2 tháng');

  for (const post of ctsvPosts) {
    assert.equal(post.source_channel, 'FB_CTSV');
    assert.ok(post.source_url, `Bài "${post.title}" phải có source_url`);
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

  const recap = tuvanPosts.find((p) => {
    const normTitle = String(p.title || '').normalize('NFKC');
    const normContent = String(p.content || '').normalize('NFKC');
    return /RECAP WORKSHOP/i.test(normTitle) || /RECAP WORKSHOP/i.test(normContent);
  });
  assert.ok(recap, 'Phải có bài viết Recap workshop');
  assert.ok(recap.attachments.length >= 1, 'Bài Recap workshop phải có link Zalo nhận chứng nhận');
  assert.ok(recap.attachments.some((a) => a.url.includes('zalo.me')), 'Attachments phải chứa link Zalo thật');

  const exam = tuvanPosts.find((p) => /LỊCH THI/i.test(p.title) || /LỊCH THI/i.test(p.content));
  assert.ok(exam, 'Phải có bài viết Lịch thi');
  assert.ok(exam.attachments.length >= 2, 'Bài Lịch thi phải có ít nhất 2 link đính kèm');
  assert.ok(exam.attachments.some((a) => a.url.includes('bom.so/piUmQ2')), 'Attachments phải có link xem lịch thi');
  assert.ok(exam.attachments.some((a) => a.url.includes('bom.so/f2NIZM')), 'Attachments phải có link đăng ký thi bổ sung');
});

test('FB-FIX-06: Edge cases: title normalization, emoji-only first line, link extraction, live post enrichment', async () => {
  const norm1 = fbCrawlerService._normalizePostTitle('📢 [THÔNG BÁO] – HỌC BỔNG TOYOTA NĂM 2026 🎉');
  const norm2 = fbCrawlerService._normalizePostTitle('Thông báo học bổng Toyota năm 2026');
  assert.equal(norm1, 'thông báo học bổng toyota năm 2026');
  assert.equal(norm2, 'thông báo học bổng toyota năm 2026');

  const sampleText = `
    Đăng ký tham gia tại link: https://forms.gle/xyz123abc.
    Xem thêm tài liệu tại (https://dut.udn.vn/tailieu) và https://bom.so/testlink!
  `;
  const links = fbCrawlerService._extractRealLinksFromText(sampleText);
  assert.equal(links.length, 3);
  assert.equal(links[0].url, 'https://forms.gle/xyz123abc');
  assert.equal(links[1].url, 'https://dut.udn.vn/tailieu');
  assert.equal(links[2].url, 'https://bom.so/testlink');

  const customFbCrawler = {
    fanpages: fbCrawlerService.fanpages,
    _normalizePostTitle: fbCrawlerService._normalizePostTitle.bind(fbCrawlerService),
    _getCuratedFallbackNotices: fbCrawlerService._getCuratedFallbackNotices.bind(fbCrawlerService),
    async fetchFanpagePosts(pageCode, opts) {
      return fbCrawlerService.fetchFanpagePosts.call(this, pageCode, opts);
    },
    async _crawlLiveFromPlugin(pageCode) {
      if (pageCode === 'FB_TUVAN_SV') {
        return [
          {
            source_channel: 'FB_TUVAN_SV',
            source_name: 'Tư vấn Sinh viên DUT',
            source_url: 'https://www.facebook.com/tuvansinhvien.dut/posts/pfbid0yzu1s1mD4icrWANYy8HEofDz5AeQV4RbrCscbsKLbeZDhfYrFE4XiJxcu96KwV9yl',
            title: 'Recap Workshop Upgrade Ideas With AI',
            content: 'Nội dung vắn tắt từ plugin',
            published_at: '2026-11-16T01:00:15.000Z',
            attachments: [],
          },
        ];
      }
      return [];
    },
  };

  const mergedPosts = await customFbCrawler.fetchFanpagePosts('FB_TUVAN_SV');
  const recap = mergedPosts.find((p) => p.source_url && p.source_url.includes('pfbid0yzu1s1mD4icrWANYy8HEofDz5AeQV4RbrCscbsKLbeZDhfYrFE4XiJxcu96KwV9yl'));
  assert.ok(recap, 'Bài viết recap phải có trong danh sách');
  assert.ok(recap.attachments.length > 0, 'Bài viết live phải được làm giàu attachments từ curated');
  assert.ok(recap.attachments.some((a) => a.url.includes('zalo.me')), 'Phải chứa link Zalo');
  assert.ok(recap.content.length > 50, 'Nội dung phải được kế thừa bản đầy đủ');
});

test('FB-FIX-07: Robustness against Unicode pictographs, digit preservation, channel isolation, and JSON key ordering', async () => {
  const notifSvc = new NotificationService();

  const inputWithEmojis = '⏳ [CẢNH BÁO] – HẠN CHÓT NỘP HỒ SƠ 2026 ‼️';
  const norm1 = fbCrawlerService._normalizePostTitle(inputWithEmojis);
  const norm2 = notifSvc._normalizeTitle(inputWithEmojis);
  assert.equal(norm1, 'cảnh báo hạn chót nộp hồ sơ 2026');
  assert.equal(norm2, 'cảnh báo hạn chót nộp hồ sơ 2026');

  const inputDigits = '🏆 09 SINH VIÊN BÁCH KHOA NHẬN HỌC BỔNG TOYOTA';
  assert.equal(fbCrawlerService._normalizePostTitle(inputDigits), '09 sinh viên bách khoa nhận học bổng toyota');

  const htmlOrder1 = '<script>{"timelinePosts":[{"createdTime":1763280000,"message":"Bài viết thứ tự 1","photoURL":""}]}</script>';
  const htmlOrder2 = '<script>/* ServerJS */ {"message":"Bài viết thứ tự 2","createdTime":1763280000,"photoURL":""}</script>';
  const posts1 = fbCrawlerService._parseTimelinePostsFromHtml(htmlOrder1);
  const posts2 = fbCrawlerService._parseTimelinePostsFromHtml(htmlOrder2);
  assert.equal(posts1.length, 1);
  assert.equal(posts1[0].message, 'Bài viết thứ tự 1');
  assert.equal(posts2.length, 1);
  assert.equal(posts2[0].message, 'Bài viết thứ tự 2');

  const fakePluginHtml = '<script>{"timelinePosts":[{"createdTime":1763280000,"message":"📢 [THÔNG BÁO]\\nLỊCH THI CUỐI KỲ I NĂM HỌC 2026 - 2027 TẠI CƠ SỞ ĐÀ NẴNG","photoURL":""}]}</script>';
  const parsed = fbCrawlerService._parseTimelinePostsFromHtml(fakePluginHtml);
  assert.equal(parsed.length, 1);
});

test.describe('Facebook Crawler Direct PostgreSQL Tests', () => {
  let pool;

  test.before(async () => {
    pool = await createTestPool();
  });

  test.beforeEach(async () => {
    await resetDatabase(pool);
  });

  test.after(async () => {
    await teardownTestPool(pool);
  });

  test('FB-FIX-03: Reload/Cào lại tự động cập nhật source_url từ generic link sang link bài viết chính xác', async () => {
    const notifSvc = new NotificationService({ pool });
    const repo = new NotificationRepository(pool);

    const initialGenericNotice = {
      title: 'SINH VIÊN BÁCH KHOA ĐÀ NẴNG ĐẠT GIẢI NHÌ CUỘC THI THIẾT KẾ VI MẠCH BẢO MẬT VÀ AN TOÀN THÔNG TIN 2026',
      content: 'Chi tiết cuộc thi vi mạch...',
      source_channel: 'FB_CTSV',
      source_name: 'Phòng Công tác Sinh viên ĐHBK - ĐHĐN',
      source_url: 'https://www.facebook.com/ctsvdhbkdhdn',
      published_at: '2026-11-10T08:11:49.000Z',
      attachments: [],
    };
    await notifSvc.ingestNotification(initialGenericNotice);

    const hash = notifSvc.generateContentHash({
      source_channel: 'FB_CTSV',
      title: initialGenericNotice.title,
    });
    const before = await repo.findByHash(hash);
    assert.ok(before);
    assert.equal(before.source_url, 'https://www.facebook.com/ctsvdhbkdhdn');

    const reloadPayload = {
      title: 'SINH VIÊN BÁCH KHOA ĐÀ NẴNG ĐẠT GIẢI NHÌ CUỘC THI THIẾT KẾ VI MẠCH BẢO MẬT VÀ AN TOÀN THÔNG TIN 2026',
      content: 'Chi tiết cuộc thi vi mạch mới nhất...',
      source_channel: 'FB_CTSV',
      source_name: 'Phòng Công tác Sinh viên ĐHBK - ĐHĐN',
      source_url: 'https://www.facebook.com/ctsvdhbkdhdn/posts/1098254897839181',
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

    const rows = await repo.listByChannels(['FB_CTSV']);
    assert.equal(rows.length, 1, 'PostgreSQL chỉ chứa 1 bản ghi duy nhất');
    assert.equal(rows[0].source_url, 'https://www.facebook.com/ctsvdhbkdhdn/posts/1098254897839181');
  });

  test('FB-FIX-04: Reload qua CrawlerManagerService hoàn tất thu thập toàn bộ bài viết từ 2 Fanpage mà không bị trùng lặp', async () => {
    const notifSvc = new NotificationService({ pool });
    const repo = new NotificationRepository(pool);

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

    const stats1 = await manager.crawlAllSources();
    assert.ok(stats1.inserted_count >= 11, `Lần 1 phải ingest ít nhất 11 bài từ 2 Fanpage, nhận được: ${stats1.inserted_count}`);
    assert.equal(stats1.duplicate_count, 0);

    const fbRows = await repo.listByChannels(['FB_CTSV', 'FB_TUVAN_SV']);
    for (const n of fbRows) {
      assert.ok(
        n.source_url && (n.source_url.includes('/posts/') || n.source_url.includes('facebook.com/')),
        `Bài "${n.title}" phải có source_url hợp lệ`
      );
      assert.notEqual(n.source_url, 'https://www.facebook.com/ctsvdhbkdhdn');
      assert.notEqual(n.source_url, 'https://www.facebook.com/tuvansinhvien.dut');
    }

    const stats2 = await manager.crawlAllSources();
    assert.equal(stats2.inserted_count, 0, 'Lần 2 reload không được nhân bản thêm bài viết');
    assert.equal(stats2.duplicate_count, stats1.total_scraped, 'Toàn bộ bài viết phải được nhận diện và đồng bộ');
  });

  test('FB-FIX-05: repairAndDeduplicateFacebookNotices hợp nhất nội dung phong phú và kế thừa attachments khi dọn trùng', async () => {
    const notifSvc = new NotificationService({ pool });
    const repo = new NotificationRepository(pool);

    const oldGeneric = {
      title: 'TỰ HÀO SINH VIÊN BÁCH KHOA! ROBOT TỰ HÀNH CHINH PHỤC GIẢI NHẤT AIoT DEVELOPER INNOWORKS 2026',
      content: 'Nội dung ngắn cũ...',
      source_channel: 'FB_CTSV',
      source_name: 'Phòng Công tác Sinh viên ĐHBK - ĐHĐN',
      source_url: 'https://www.facebook.com/ctsvdhbkdhdn',
      published_at: '2026-11-16T01:01:06.000Z',
      attachments: [],
    };
    await notifSvc.ingestNotification(oldGeneric);

    // Chèn trực tiếp bản ghi chi tiết bị trùng hash khác vào PostgreSQL để giả lập dữ liệu lịch sử bị trùng
    await repo.upsertNotification({
      id: crypto.randomUUID(),
      title: 'TỰ HÀO SINH VIÊN BÁCH KHOA! ROBOT TỰ HÀNH CHINH PHỤC GIẢI NHẤT AIoT DEVELOPER INNOWORKS 2026 🤖🌱',
      summary: 'AIoT Developer Innoworks 2026',
      content: 'Một lần nữa, sinh viên Trường Đại học Bách khoa, Đại học Đà Nẵng khẳng định bản lĩnh, trí tuệ và sự sáng tạo tại đấu trường công nghệ quốc tế với giải Nhất cuộc thi AIoT Developer Innoworks 2026 chi tiết đầy đủ.',
      source_channel: 'FB_CTSV',
      source_name: 'Phòng Công tác Sinh viên ĐHBK - ĐHĐN',
      scope: 'GLOBAL',
      priority: 'NORMAL',
      priority_score: 30,
      source_url: 'https://www.facebook.com/ctsvdhbkdhdn/posts/1824646392020124',
      published_at: '2026-11-16T01:01:06.000Z',
      attachments: [{ title: 'Xem chi tiết giải thưởng', url: 'https://dut.udn.vn/innoworks2026' }],
      content_hash: crypto.createHash('sha256').update(`legacy_dup_${Date.now()}`).digest('hex'),
    });

    const beforeRows = await repo.listByChannels(['FB_CTSV']);
    assert.equal(beforeRows.length, 2, 'Trước khi dọn dẹp, PostgreSQL phải có 2 bản ghi');

    const result = await notifSvc.repairAndDeduplicateFacebookNotices();
    assert.equal(result.deletedDuplicates, 1, 'Phải xóa 1 bản ghi trùng lặp');

    const afterRows = await repo.listByChannels(['FB_CTSV']);
    assert.equal(afterRows.length, 1, 'Phải còn lại 1 bản ghi duy nhất');
    const remaining = afterRows[0];
    assert.equal(remaining.source_url, 'https://www.facebook.com/ctsvdhbkdhdn/posts/1824646392020124', 'source_url phải là URL bài viết cụ thể');
    assert.ok(remaining.content.length > 50, 'Nội dung phải được giữ lại bản đầy đủ phong phú');
    assert.ok(remaining.attachments && remaining.attachments.length > 0, 'Attachments phải được kế thừa đầy đủ');
  });
});
