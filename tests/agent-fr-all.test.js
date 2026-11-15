/**
 * BỘ TEST SUITE TOÀN DIỆN CHO TOÀN BỘ 9 YÊU CẦU CHỨC NĂNG (FR-01 -> FR-09) THEO AGENT.MD
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createServer } = require('../src/server');
const { notificationRouter } = require('../src/api/notification.routes');
const { dutCrawlerService } = require('../src/services/dut-crawler.service');
const { fbCrawlerService } = require('../src/services/fb-crawler.service');
const { classifySmartNotification, extractDeadline, extractRescheduleDetails } = require('../src/services/classifier.service');
const { deadlineService } = require('../src/services/deadline.service');
const { googleCalendarService } = require('../src/services/google-calendar.service');
const { notificationService } = require('../src/services/notification.service');

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

test('FR-01: Đồng bộ Học phần từ sv.dut.udn.vn', async () => {
  const { controller } = createServer();

  // Test qua API POST /api/v1/dut/sync-courses
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
  const { controller } = createServer();

  // Thu thập từ Scraper DUT 7 chuyên mục
  const dutNotices = await dutCrawlerService.fetchCategoryNotices('DUT_COURSE_CLASS');
  assert.ok(dutNotices.length > 0);

  // Thu thập từ Facebook 2 Fanpages
  const fbPosts = await fbCrawlerService.fetchFanpagePosts('FB_CTSV');
  assert.ok(fbPosts.length > 0);

  // Gửi bản tin lần 1 -> Phải thành công (INSERTED)
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

  // Gửi lại đúng bản tin đó -> Hệ thống phải nhận diện trùng khớp hash và không nhân bản
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

test('FR-03: Phân loại thông minh kết hợp (Rules Engine + AI API)', async () => {
  // 1. Phân loại Rules Engine cho nguồn sv.dut.udn.vn có cấu trúc
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

  // 2. Phân loại AI API cho bài viết Facebook phi cấu trúc
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

test('FR-04: Mục thông báo riêng cho từng Học phần đang học', async () => {
  const { controller } = createServer();

  // Ingest 1 tin dành riêng cho IT401
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

  // Lấy danh sách học phần kèm thống kê tin chưa đọc
  const enrolledRes = await callApi(controller, {
    method: 'GET',
    url: '/api/v1/courses/enrolled?student_id=a0000000-0000-0000-0000-000000000001',
  });
  assert.equal(enrolledRes.status, 200);
  const it401 = enrolledRes.json.data.find((c) => c.course_code === 'IT401');
  assert.ok(it401);
  assert.ok(it401.unread_count >= 1);

  // Lấy luồng thông báo riêng của môn IT401
  const courseNotifs = await callApi(controller, {
    method: 'GET',
    url: '/api/v1/courses/IT401/notifications',
  });
  assert.equal(courseNotifs.status, 200);
  assert.ok(courseNotifs.json.total >= 1);
  assert.ok(courseNotifs.json.data.every((n) => n.course_code === 'IT401'));
});

test('FR-05: Bảng tin thông báo tập trung & Bộ lọc đa chiều', async () => {
  const { controller } = createServer();

  // Lấy feed với lọc theo source_channel
  const feedBySource = await callApi(controller, {
    method: 'GET',
    url: '/api/v1/notifications?source_channel=DUT_COURSE_CLASS',
  });
  assert.equal(feedBySource.status, 200);
  assert.ok(Array.isArray(feedBySource.json.data.notifications));

  // Lọc theo từ khóa tìm kiếm
  const feedSearch = await callApi(controller, {
    method: 'GET',
    url: '/api/v1/notifications?search=học%20phần',
  });
  assert.equal(feedSearch.status, 200);
});

test('FR-06: Quản lý danh sách hạn chót (Deadline Management CRUD)', async () => {
  const { controller } = createServer();

  // Lấy 1 thông báo thực tế từ feed để gắn deadline đi kèm
  const feedRes = await callApi(controller, {
    method: 'GET',
    url: '/api/v1/notifications',
  });
  const notifId = feedRes.json?.data?.notifications?.[0]?.id || 'a0000000-0000-0000-0000-000000000010';

  // 1. Tạo deadline (bắt buộc gắn liền với notification_id từ bản tin)
  const createRes = await callApi(controller, {
    method: 'POST',
    url: '/api/v1/deadlines',
    body: {
      student_id: 'a0000000-0000-0000-0000-000000000001',
      notification_id: notifId,
      title: 'Đóng học phí học kỳ 2',
      due_date: '2026-03-30T17:00:00Z',
      course_code: null,
    },
  });
  assert.equal(createRes.status, 201);
  const deadlineId = createRes.json.data.deadline_id;
  assert.ok(deadlineId);

  // 2. Lấy danh sách deadline
  const listRes = await callApi(controller, {
    method: 'GET',
    url: '/api/v1/deadlines?student_id=a0000000-0000-0000-0000-000000000001',
  });
  assert.equal(listRes.status, 200);
  assert.ok(listRes.json.data.some((d) => d.deadline_id === deadlineId));

  // 3. Cập nhật hoàn thành (COMPLETED)
  const updateRes = await callApi(controller, {
    method: 'PUT',
    url: `/api/v1/deadlines/${deadlineId}`,
    body: { status: 'COMPLETED' },
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.json.data.status, 'COMPLETED');

  // 4. Xóa deadline
  const delRes = await callApi(controller, {
    method: 'DELETE',
    url: `/api/v1/deadlines/${deadlineId}`,
  });
  assert.equal(delRes.status, 200);
});

test('FR-07: Worker cảnh báo nhắc việc leo thang đa tầng', async () => {
  // Tạo deadline trong vòng 20 giờ tới (thuộc Stage 3 - trước 24h)
  const d1 = await deadlineService.createDeadline({
    student_id: 'a0000000-0000-0000-0000-000000000001',
    title: 'Nộp chứng chỉ ngoại ngữ',
    due_date: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
  });

  const reminders = await deadlineService.processEscalationReminders();
  assert.ok(reminders.some((r) => r.deadline_id === d1.deadline_id && r.stage === 3));
});

test('FR-08: Cảnh báo khẩn cấp & Xác nhận Đã đọc (Read Receipt - ack)', async () => {
  const { controller } = createServer();

  // Tiếp nhận thông báo nghỉ học đột xuất
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

  // Sinh viên gửi xác nhận đã đọc
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
});

test('FR-09: Đồng bộ Google Calendar và Xuất tệp .ics', async () => {
  const { controller } = createServer();

  // 1. Kết nối Google Calendar
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

  // 2. Đồng bộ deadline sang Calendar
  const syncRes = await callApi(controller, {
    method: 'POST',
    url: '/api/v1/calendar/google/sync',
    body: {
      student_id: 'a0000000-0000-0000-0000-000000000001',
    },
  });
  assert.equal(syncRes.status, 200);
  assert.ok(syncRes.json.data.events);

  // 3. Xuất tệp .ics
  const icsRes = await callApi(controller, {
    method: 'GET',
    url: '/api/v1/calendar/export.ics?student_id=a0000000-0000-0000-0000-000000000001',
  });
  assert.equal(icsRes.status, 200);
  assert.ok(icsRes.rawText.includes('BEGIN:VCALENDAR'));
  assert.ok(icsRes.rawText.includes('END:VCALENDAR'));
});

