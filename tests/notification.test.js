/**
 * TASK 15: Kiểm thử luồng tích hợp dữ liệu đa nguồn và tối ưu hiệu năng lấy tin
 * Phụ trách: Nguyễn Hữu Tuấn
 *
 * Bao phủ toàn bộ 5 Task (11 -> 15):
 * - Task 11: Kiểm thử Schema DB (Phòng Đào tạo, Khoa, Lớp, Email SV, Ngoại khóa) & REST API
 * - Task 12: Kiểm thử Crawler bóc tách HTML Portal, Email Sinh viên, Webhook & chống trùng lặp
 * - Task 13: Kiểm thử bộ lọc gắn tag môn học, phân loại Chung/Riêng và thuật toán điểm ưu tiên
 * - Task 14: Kiểm thử API phục vụ giao diện Feed (Tìm kiếm, Bộ lọc đa chiều, Phân trang)
 * - Task 15: Kiểm thử tải đồng thời đa nguồn (Concurrent Multi-Source Load Test) & tối ưu Cache/Index
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { DatabaseManager } = require('../src/db/database');
const { classifyNotification } = require('../src/services/classifierService');
const {
  parsePortalHtml,
  parseStudentEmail,
} = require('../src/services/crawlerService');
const { handleApiRequest } = require('../src/api/router');

/**
 * Helper gọi trực tiếp REST API Router phục vụ kiểm thử tích hợp nhanh và ổn định
 */
async function invokeApi(dbManager, { method = 'GET', url = '/api/notifications', body = null } = {}) {
  const payloadStr = body ? JSON.stringify(body) : '';
  const req = Readable.from(payloadStr ? [Buffer.from(payloadStr)] : []);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000', 'content-type': 'application/json' };

  let statusCode = 200;
  let rawResponse = '';

  const res = {
    writeHead(code) {
      statusCode = code;
    },
    end(chunk = '') {
      rawResponse += chunk;
    },
  };

  await handleApiRequest(req, res, dbManager);
  return {
    status: statusCode,
    json: rawResponse ? JSON.parse(rawResponse) : null,
  };
}

test('Task 11: Thiết kế Database Schema & khởi tạo 5 nhóm kênh nguồn chuẩn xác', () => {
  const db = new DatabaseManager(':memory:');
  const sources = db.getSources();
  const courses = db.getCourses();

  assert.equal(sources.length, 5, 'Phải có đủ 5 kênh nguồn: Phòng Đào tạo, Khoa, Lớp, Email SV, Ngoại khóa');
  const sourceTypes = sources.map((s) => s.source_type).sort();
  assert.deepEqual(
    sourceTypes,
    ['CLASS', 'EXTRACURRICULAR', 'FACULTY', 'STUDENT_EMAIL', 'TRAINING_DEPT'],
    'Đầy đủ 5 loại nguồn theo đặc tả'
  );
  assert.ok(courses.length >= 5, 'Bảng courses phải có danh mục môn học phục vụ gắn tag');
  db.close();
});

test('Task 12: Crawler bóc tách chính xác thông báo từ HTML Portal & Email sinh viên', () => {
  const sampleHtml = `
    <div>
      <article class="notice-item" data-id="PDT-999">
        <h3>Thông báo lịch thi cuối kỳ môn Cơ sở dữ liệu IT302</h3>
        <span class="sender">Phòng Đào tạo</span>
        <time datetime="2026-11-12T08:00:00.000Z"></time>
        <p class="content">Sinh viên lớp học phần IT302 xem danh sách phòng thi cuối kỳ tại cổng thông tin.</p>
        <a href="https://sv.dut.udn.vn/exam-it302">Chi tiết</a>
      </article>
    </div>
  `;

  const portalItems = parsePortalHtml(sampleHtml, {
    source_code: 'PORTAL_PDT',
    source_type: 'TRAINING_DEPT',
    channel_name: 'Portal Phòng Đào tạo',
  });

  assert.equal(portalItems.length, 1);
  assert.equal(portalItems[0].external_id, 'PDT-999');
  assert.match(portalItems[0].title, /IT302/);

  const rawEmail = [
    'Message-ID: <msg-01@sv.dut.udn.vn>',
    'From: Phòng CTSV <ctsv@dut.udn.vn>',
    'To: 102230123@sv.dut.udn.vn',
    'Subject: Cảnh báo học vụ và nhắc nợ học phí cá nhân',
    'Date: 2026-11-12T09:00:00.000Z',
    '',
    'Thông báo riêng cho sinh viên MSSV: 102230123 về việc hoàn thành học phí trước 17h hôm nay.',
  ].join('\n');

  const parsedEmail = parseStudentEmail(rawEmail);
  assert.equal(parsedEmail.source_type, 'STUDENT_EMAIL');
  assert.equal(parsedEmail.recipient_student_id, '102230123');
  assert.match(parsedEmail.title, /học phí cá nhân/);
});

test('Task 13: Bộ lọc tự động gắn Tag môn học, phân loại Chung/Riêng và tính điểm ưu tiên', () => {
  // 1. Tin khẩn cấp riêng cá nhân từ Email SV
  const urgentPersonal = classifyNotification({
    source_type: 'STUDENT_EMAIL',
    title: '[KHẨN CẤP] Cảnh báo học vụ và nhắc nợ học phí cá nhân đối với MSSV: 102230111',
    content: 'Yêu cầu sinh viên thanh toán học phí ngay lập tức trước 17h hôm nay.',
  });
  assert.equal(urgentPersonal.scope_type, 'PERSONAL');
  assert.equal(urgentPersonal.priority, 'URGENT');
  assert.ok(urgentPersonal.priority_score >= 80);
  assert.ok(urgentPersonal.tags.includes('#HọcPhí'));
  assert.ok(urgentPersonal.tags.includes('#TinRiêng'));

  // 2. Tin lớp học phần có mã môn Công nghệ phần mềm IT401
  const classNotice = classifyNotification({
    source_type: 'CLASS',
    title: 'Thông báo đổi phòng học và hạn chót nộp bài tập lớn môn Công nghệ phần mềm (IT401)',
    content: 'Lớp học phần IT401 chuyển sang phòng A105 và nộp báo cáo MVP.',
  });
  assert.equal(classNotice.course_code, 'IT401');
  assert.equal(classNotice.course_tag, '#IT401-CNPM');
  assert.equal(classNotice.scope_type, 'CLASS');
  assert.ok(['URGENT', 'HIGH'].includes(classNotice.priority));

  // 3. Tin hoạt động ngoại khóa thông thường
  const extraNotice = classifyNotification({
    source_type: 'EXTRACURRICULAR',
    title: 'Giao lưu văn nghệ và minigame câu lạc bộ cuối tuần',
    content: 'Mời các bạn sinh viên tham gia đêm nhạc giao lưu câu lạc bộ tình nguyện.',
  });
  assert.equal(extraNotice.scope_type, 'GENERAL');
  assert.equal(extraNotice.priority, 'LOW');
  assert.ok(extraNotice.priority_score < 40);
});

test('Task 14 & 15: Kiểm thử REST API Feed, Tìm kiếm, Phân trang, Crawler Đa nguồn & Hiệu năng tải cao', async () => {
  const dbManager = new DatabaseManager(':memory:');
  dbManager.seedSampleNotificationsIfEmpty();

  try {
    // 1. Kiểm tra API lấy danh sách & phân trang
    const feedRes = await invokeApi(dbManager, {
      method: 'GET',
      url: '/api/notifications?page=1&limit=3',
    });
    assert.equal(feedRes.status, 200);
    assert.equal(feedRes.json.status, 'success');
    assert.equal(feedRes.json.data.items.length, 3);
    assert.ok(feedRes.json.data.pagination.total >= 6);

    // 2. Kiểm tra API kích hoạt Crawler thu thập đa nguồn đồng thời
    const crawlRes = await invokeApi(dbManager, {
      method: 'POST',
      url: '/api/ingest/crawl',
      body: {},
    });
    assert.equal(crawlRes.status, 200);
    assert.ok(crawlRes.json.data.fetched_count >= 6);
    assert.ok(crawlRes.json.data.inserted_count >= 1);

    // 3. Gọi lại Crawler lần 2 để kiểm tra cơ chế chống trùng lặp (Deduplication)
    const crawlDupRes = await invokeApi(dbManager, {
      method: 'POST',
      url: '/api/ingest/crawl',
      body: {},
    });
    assert.equal(
      crawlDupRes.json.data.inserted_count,
      0,
      'Lần cào thứ 2 cùng dữ liệu phải bị chặn trùng lặp 100%'
    );
    assert.equal(crawlDupRes.json.data.duplicate_count, crawlDupRes.json.data.fetched_count);

    // 4. Kiểm thử Webhook tiếp nhận thông báo mới và đánh dấu đã đọc
    const webhookRes = await invokeApi(dbManager, {
      method: 'POST',
      url: '/api/ingest/webhook',
      body: {
        source_code: 'CLASS_LMS',
        source_type: 'CLASS',
        channel_name: 'Lớp IT408 - AI',
        title: 'Thông báo nộp báo cáo cuối kỳ môn Trí tuệ nhân tạo IT408',
        content: 'Hạn chót nộp đồ án Trí tuệ nhân tạo IT408 là trước 17h hôm nay.',
      },
    });
    assert.equal(webhookRes.status, 201);
    assert.equal(webhookRes.json.data.notification.course_code, 'IT408');

    const createdId = webhookRes.json.data.notification.id;
    const readRes = await invokeApi(dbManager, {
      method: 'PATCH',
      url: `/api/notifications/${createdId}/read`,
      body: { is_read: true },
    });
    assert.equal(readRes.status, 200);
    assert.equal(readRes.json.data.is_read, true);

    // 5. Kiểm thử tải tích hợp đồng thời 500 thông báo từ 5 kênh nguồn & đo tốc độ truy vấn (Task 15)
    const sources = ['TRAINING_DEPT', 'FACULTY', 'CLASS', 'STUDENT_EMAIL', 'EXTRACURRICULAR'];
    const courses = dbManager.getCourses();
    const bulkItems = [];

    for (let i = 0; i < 500; i += 1) {
      const src = sources[i % sources.length];
      bulkItems.push(
        classifyNotification(
          {
            external_id: `LOAD-${i}`,
            source_code: 'PORTAL_PDT',
            source_type: src,
            channel_name: `Kênh tải ${src}`,
            title: `[LoadTest #${i}] Thông báo lịch thi và bài tập môn IT401 Công nghệ phần mềm`,
            content: `Nội dung kiểm thử hiệu năng đa nguồn bản ghi số ${i} cho học phần IT401 và IT302.`,
            published_at: new Date(Date.now() - i * 60000).toISOString(),
          },
          courses
        )
      );
    }

    const batchRes = dbManager.insertNotificationsBatch(bulkItems, 'LOAD-TEST-500');
    assert.equal(batchRes.insertedCount, 500);
    assert.ok(
      batchRes.durationMs < 500,
      `Batch insert 500 bản ghi phải dưới 500ms (thực tế: ${batchRes.durationMs}ms)`
    );

    // Đo tốc độ truy vấn lần 1 (Index SQLite) và lần 2 (In-Memory Cache)
    const q1 = dbManager.queryNotifications({
      source_type: 'CLASS',
      course_code: 'IT401',
      page: 1,
      limit: 20,
    });
    assert.equal(q1.performance.cache_hit, false);
    assert.ok(q1.performance.query_time_ms < 50, 'Truy vấn có Index trên >500 bản ghi phải < 50ms');

    const q2 = dbManager.queryNotifications({
      source_type: 'CLASS',
      course_code: 'IT401',
      page: 1,
      limit: 20,
    });
    assert.equal(q2.performance.cache_hit, true, 'Truy vấn lặp lại phải trúng Cache (Cache Hit)');
    assert.ok(q2.performance.query_time_ms < 5, 'Truy vấn từ Cache phải < 5ms');
  } finally {
    dbManager.close();
  }
});
