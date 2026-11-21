/**
 * BỘ TEST SUITE TOÀN DIỆN CHO TOÀN BỘ 9 YÊU CẦU CHỨC NĂNG (FR-01 -> FR-09) TRÊN POSTGRESQL THẬT
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createServer } = require('../src/server');
const { notificationRouter } = require('../src/api/notification.routes');
const { dutCrawlerService } = require('../src/services/dut-crawler.service');
const { fbCrawlerService } = require('../src/services/fb-crawler.service');
const { classifySmartNotification } = require('../src/services/classifier.service');
const {
  createTestPool,
  resetDatabase,
  seedStudent,
  seedCourse,
  enrollStudent,
  seedNotification,
  teardownTestPool,
} = require('./helpers/pg-test-harness');

async function callApi(controller, { method = 'GET', url = '/', body = null } = {}) {
  const payloadStr = body ? JSON.stringify(body) : '';
  const req = Readable.from(payloadStr ? [Buffer.from(payloadStr)] : []);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost:3000', 'content-type': 'application/json' };

  let statusCode = 200;
  let rawResponse = '';
  let responseHeaders = {};

  const res = {
    writeHead(code, headers = {}) {
      statusCode = code;
      responseHeaders = headers;
    },
    end(chunk = '') {
      rawResponse += chunk;
    },
  };

  await notificationRouter(req, res, controller);
  return {
    status: statusCode,
    headers: responseHeaders,
    json: rawResponse && rawResponse.startsWith('{') ? JSON.parse(rawResponse) : null,
    rawText: rawResponse,
  };
}

test('FR-03: Phân loại thông minh kết hợp (Rules Engine + AI API)', async () => {
  const ruleResult = await classifySmartNotification({
    source_channel: 'DUT_COURSE_CLASS',
    title: 'THÔNG BÁO NGHỈ DẠY VÀ HỌC BÙ LỚP HỌC PHẦN IT401 - CÔNG NGHỆ PHẦN MỀM',
    content: 'Giảng viên nghỉ dạy ngày 18/03/2026, học bù vào ngày 22/03/2026 tại phòng F302.',
  });
  assert.equal(ruleResult.classified_by, 'RULE_ENGINE');
  assert.equal(ruleResult.course_code, 'IT401');
  assert.equal(ruleResult.is_emergency, true);
  assert.equal(ruleResult.priority, 'URGENT');
  assert.equal(ruleResult.reschedule_details.room, 'F302');

  const aiResult = await classifySmartNotification({
    source_channel: 'FB_CTSV',
    title: 'Học bổng doanh nghiệp Nippon Steel kỳ 2',
    content: 'Phòng CTSV thông báo 20 suất học bổng Nippon Steel trị giá 15 triệu. Hạn chót nộp hồ sơ trước ngày 28/03/2026 tại văn phòng.',
  });
  assert.equal(aiResult.classified_by, 'AI_API');
  assert.ok(aiResult.tags.some((t) => t.includes('hoc_bong')));
  assert.ok(aiResult.summary.length > 0);
  assert.ok(aiResult.deadline_at);
});

test.describe('FR-01..FR-09 Direct PostgreSQL Integration Suite', () => {
  let pool;

  test.before(async () => {
    pool = await createTestPool();
  });

  test.beforeEach(async () => {
    await resetDatabase(pool);
    await seedStudent(pool, { student_code: '102200001' });
  });

  test.after(async () => {
    await teardownTestPool(pool);
  });

  test('FR-01: Đồng bộ Học phần từ sv.dut.udn.vn', async () => {
    const { controller } = createServer(pool);

    const res = await callApi(controller, {
      method: 'POST',
      url: '/api/v1/dut/sync-courses',
      body: {
        student_code: '102200001',
        student_id: 'a0000000-0000-0000-0000-000000000001',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.status, 'success');
    assert.ok(res.json.data.total_courses >= 3);
    const courseCodes = res.json.data.courses.map((c) => c.course_code);
    assert.ok(courseCodes.includes('IT401'));
    assert.ok(courseCodes.includes('IT302'));
    assert.ok(courseCodes.includes('IT408'));
  });

  test('FR-02: Thu thập & Chống trùng lặp thông báo đa nguồn (SHA-256 hash)', async () => {
    const { controller } = createServer(pool);

    const dutNotices = await dutCrawlerService.fetchCategoryNotices('DUT_COURSE_CLASS');
    assert.ok(dutNotices.length > 0);

    const fbPosts = await fbCrawlerService.fetchFanpagePosts('FB_CTSV');
    assert.ok(fbPosts.length > 0);

    const ingest1 = await callApi(controller, {
      method: 'POST',
      url: '/api/v1/notifications/ingest',
      body: {
        source_channel: 'DUT_TUITION_FEE',
        title: 'Thông báo nộp học phí học kỳ 2 năm học 2025-2026',
        content: 'Sinh viên nộp học phí trước ngày 30/03/2026.',
        published_at: '2026-03-01T08:00:00Z',
      },
    });
    assert.ok([200, 201].includes(ingest1.status));
    assert.ok(ingest1.json.data.content_hash);

    const ingest2 = await callApi(controller, {
      method: 'POST',
      url: '/api/v1/notifications/ingest',
      body: {
        source_channel: 'DUT_TUITION_FEE',
        title: 'Thông báo nộp học phí học kỳ 2 năm học 2025-2026',
        content: 'Sinh viên nộp học phí trước ngày 30/03/2026.',
        published_at: '2026-03-01T08:00:00Z',
      },
    });
    assert.equal(ingest2.json.data.content_hash, ingest1.json.data.content_hash);
  });

  test('FR-04: Mục thông báo riêng cho từng Học phần đang học', async () => {
    const { controller } = createServer(pool);
    await seedCourse(pool, { course_code: 'IT401', course_name: 'Công nghệ phần mềm' });
    await enrollStudent(pool, 'a0000000-0000-0000-0000-000000000001', 'IT401');

    await callApi(controller, {
      method: 'POST',
      url: '/api/v1/notifications/ingest',
      body: {
        source_channel: 'DUT_COURSE_CLASS',
        course_code: 'IT401',
        title: 'Nộp báo cáo đồ án môn Công nghệ phần mềm (IT401)',
        content: 'Hạn cuối nộp báo cáo sprint 2 môn IT401 trước ngày 20/04/2026.',
      },
    });

    const enrolledRes = await callApi(controller, {
      method: 'GET',
      url: '/api/v1/courses/enrolled?student_id=a0000000-0000-0000-0000-000000000001',
    });
    assert.equal(enrolledRes.status, 200);
    const it401 = enrolledRes.json.data.find((c) => c.course_code === 'IT401');
    assert.ok(it401);
    assert.ok(it401.unread_count >= 1);

    const courseNotifs = await callApi(controller, {
      method: 'GET',
      url: '/api/v1/courses/IT401/notifications',
    });
    assert.equal(courseNotifs.status, 200);
    assert.ok(courseNotifs.json.total >= 1);
    assert.ok(courseNotifs.json.data.every((n) => n.course_code === 'IT401'));
  });

  test('FR-05: Bảng tin thông báo tập trung & Bộ lọc đa chiều', async () => {
    const { controller } = createServer(pool);
    await seedNotification(pool, {
      source_channel: 'DUT_COURSE_CLASS',
      scope: 'COURSE',
      title: 'Thông báo lớp học phần IT401',
    });

    const feedBySource = await callApi(controller, {
      method: 'GET',
      url: '/api/v1/notifications?source_channel=DUT_COURSE_CLASS',
    });
    assert.equal(feedBySource.status, 200);
    assert.ok(Array.isArray(feedBySource.json.data.notifications));

    const feedSearch = await callApi(controller, {
      method: 'GET',
      url: '/api/v1/notifications?search=h%E1%BB%8Dc%20ph%E1%BA%A7n',
    });
    assert.equal(feedSearch.status, 200);
  });

  test('FR-06: Quản lý danh sách hạn chót (Deadline Management CRUD)', async () => {
    const { controller } = createServer(pool);
    const seededNotif = await seedNotification(pool, {
      title: 'Thông báo đóng học phí học kỳ 2',
      source_channel: 'DUT_TUITION_FEE',
    });

    const createRes = await callApi(controller, {
      method: 'POST',
      url: '/api/v1/deadlines',
      body: {
        student_id: 'a0000000-0000-0000-0000-000000000001',
        notification_id: seededNotif.id,
        title: 'Đóng học phí học kỳ 2',
        due_date: '2026-03-30T17:00:00Z',
        course_code: null,
      },
    });
    assert.equal(createRes.status, 201);
    const deadlineId = createRes.json.data.deadline_id;
    assert.ok(deadlineId);

    const listRes = await callApi(controller, {
      method: 'GET',
      url: '/api/v1/deadlines?student_id=a0000000-0000-0000-0000-000000000001',
    });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.json.data.some((d) => d.deadline_id === deadlineId));

    const updateRes = await callApi(controller, {
      method: 'PUT',
      url: `/api/v1/deadlines/${deadlineId}`,
      body: { status: 'COMPLETED' },
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.json.data.status, 'COMPLETED');

    const delRes = await callApi(controller, {
      method: 'DELETE',
      url: `/api/v1/deadlines/${deadlineId}`,
    });
    assert.equal(delRes.status, 200);

    // Verify deleted directly in PostgreSQL
    const checkDb = await pool.query('SELECT * FROM deadlines WHERE deadline_id = $1::uuid', [deadlineId]);
    assert.equal(checkDb.rows.length, 0);
  });

  test('FR-07: Worker cảnh báo nhắc việc leo thang đa tầng', async () => {
    const { services } = createServer(pool);
    const { deadlineSvc } = services;
    const seededNotif = await seedNotification(pool, {
      title: 'Thông báo nộp chứng chỉ ngoại ngữ',
      source_channel: 'DUT_TRAINING',
    });

    const d1 = await deadlineSvc.createDeadline({
      student_id: 'a0000000-0000-0000-0000-000000000001',
      notification_id: seededNotif.id,
      title: 'Nộp chứng chỉ ngoại ngữ',
      due_date: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
    });

    const reminders = await deadlineSvc.processEscalationReminders();
    assert.ok(reminders.some((r) => r.deadline_id === d1.deadline_id && r.stage === 3));
  });

  test('FR-08: Cảnh báo khẩn cấp & Xác nhận Đã đọc (Read Receipt - ack)', async () => {
    const { controller } = createServer(pool);
    await seedCourse(pool, { course_code: 'IT302', course_name: 'Cơ sở dữ liệu' });
    await enrollStudent(pool, 'a0000000-0000-0000-0000-000000000001', 'IT302');

    const emergencyIngest = await callApi(controller, {
      method: 'POST',
      url: '/api/v1/notifications/ingest',
      body: {
        source_channel: 'DUT_COURSE_CLASS',
        course_code: 'IT302',
        title: '[KHẨN] Nghỉ học đột xuất môn Cơ sở dữ liệu chiều nay',
        content: 'Do giảng viên bị ốm đột xuất, lớp nghỉ học chiều 15/03/2026.',
      },
    });
    const notifId = emergencyIngest.json.data.id;
    assert.equal(emergencyIngest.json.data.is_emergency, true);

    const ackRes = await callApi(controller, {
      method: 'POST',
      url: `/api/v1/notifications/${notifId}/ack`,
      body: {
        student_id: 'a0000000-0000-0000-0000-000000000001',
      },
    });
    assert.equal(ackRes.status, 200);
    assert.equal(ackRes.json.data.success, true);
    assert.ok(ackRes.json.data.acknowledged_at);

    const ackRow = await pool.query(
      'SELECT is_acknowledged FROM student_notifications WHERE notification_id = $1::uuid AND student_id = $2::uuid',
      [notifId, 'a0000000-0000-0000-0000-000000000001']
    );
    assert.equal(ackRow.rows[0]?.is_acknowledged, true);
  });

  test('FR-09: Đồng bộ Google Calendar và Xuất tệp .ics', async () => {
    const { controller, services } = createServer(pool);
    services.calendarSvc.hasGoogleCredentials = () => true;
    services.calendarSvc.refreshAccessToken = async () => 'fake-access-token';
    services.calendarSvc._postHttps = async (_host, _path, payload) => ({id:JSON.parse(payload).id || 'fake-event'});

    const connectRes = await callApi(controller, {
      method: 'POST',
      url: '/api/v1/calendar/google/connect',
      body: {
        student_id: 'a0000000-0000-0000-0000-000000000001',
        refresh_token: 'valid_refresh_token_xyz',
      },
    });
    assert.equal(connectRes.status, 200);
    assert.equal(connectRes.json.data.is_calendar_sync_enabled, true);

    const syncRes = await callApi(controller, {
      method: 'POST',
      url: '/api/v1/calendar/google/sync',
      body: {
        student_id: 'a0000000-0000-0000-0000-000000000001',
      },
    });
    assert.equal(syncRes.status, 200);
    assert.ok(syncRes.json.data.events);

    const icsRes = await callApi(controller, {
      method: 'GET',
      url: '/api/v1/calendar/export.ics?student_id=a0000000-0000-0000-0000-000000000001',
    });
    assert.equal(icsRes.status, 200);
    assert.ok(icsRes.rawText.includes('BEGIN:VCALENDAR'));
    assert.ok(icsRes.rawText.includes('END:VCALENDAR'));
  });
});
