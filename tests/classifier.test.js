/**
 * TASK 13: Bộ kiểm thử tự động cho Rules Engine (Bộ quy tắc phân loại & tính điểm ưu tiên)
 * Phụ trách: Nguyễn Hữu Tuấn
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const {
  detectCourseTag,
  detectScopeType,
  classifyNotification,
} = require('../src/services/classifier.service');
const { createServer } = require('../src/server');
const { notificationRouter } = require('../src/api/notification.routes');

async function callApi(controller, { method = 'GET', url = '/', body = null } = {}) {
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

  await notificationRouter(req, res, controller);
  return {
    status: statusCode,
    json: rawResponse ? JSON.parse(rawResponse) : null,
  };
}

test('Task 13 - Quy tắc 1: Tự động nhận diện môn học và gắn tag môn học chuẩn xác', () => {
  // Case 1: Nhận diện qua tên môn tiếng Việt
  const r1 = detectCourseTag({
    title: 'Thông báo nộp báo cáo môn Công nghệ phần mềm',
    content: 'Các nhóm sinh viên chuẩn bị tài liệu SRS và MVP',
  });
  assert.equal(r1.course_code, 'IT401');
  assert.equal(r1.course_tag, '#IT401-CNPM');

  // Case 2: Nhận diện qua từ viết tắt / mã môn học IT302
  const r2 = detectCourseTag({
    title: 'Lịch thi kết thúc học phần IT302 - CSDL',
    content: 'Sinh viên chuẩn bị kiểm tra thực hành SQL trên PostgreSQL',
  });
  assert.equal(r2.course_code, 'IT302');
  assert.equal(r2.course_tag, '#IT302-CSDL');

  // Case 3: Nhận diện qua từ khóa AI / Trí tuệ nhân tạo
  const r3 = detectCourseTag({
    title: 'Hội thảo Nhập môn AI và Machine Learning',
    content: 'Buổi hướng dẫn bổ trợ môn Trí tuệ nhân tạo học kỳ này',
  });
  assert.equal(r3.course_code, 'IT408');
  assert.equal(r3.course_tag, '#IT408-AI');

  // Case 4: Không có môn học cụ thể
  const r4 = detectCourseTag({
    title: 'Thông báo quy chế sinh viên đầu khóa',
    content: 'Toàn thể tân sinh viên tham gia tuần sinh hoạt công dân',
  });
  assert.equal(r4.course_code, null);
  assert.equal(r4.course_tag, null);
});

test('Task 13 - Quy tắc 2: Phân loại phạm vi thông báo Chung / Lớp học phần / Cá nhân', () => {
  // Case 1: Thông báo riêng cá nhân sinh viên (chứa MSSV hoặc từ khóa riêng)
  const p1 = detectScopeType({
    title: '[Cảnh báo học vụ] Thông báo nhắc nợ học phí cá nhân',
    content: 'Sinh viên MSSV: 102230005 hoàn thành học phí trước ngày 15.',
  });
  assert.equal(p1, 'PERSONAL');

  // Case 2: Thông báo riêng qua target_student_id
  const p2 = detectScopeType({
    target_student_id: '102230099',
    title: 'Kết quả xử lý phúc khảo bài thi',
    content: 'Điểm môn học đã được cập nhật lại trên hệ thống.',
  });
  assert.equal(p2, 'PERSONAL');

  // Case 3: Thông báo lớp học phần (đổi phòng học, bài tập lớn, có mã môn)
  const c1 = detectScopeType(
    {
      source_type: 'CLASS_SECTION',
      title: 'Đổi phòng học môn Công nghệ phần mềm',
      content: 'Buổi học thứ Sáu chuyển sang phòng F302.',
    },
    { course_code: 'IT401' }
  );
  assert.equal(c1, 'CLASS');

  // Case 4: Thông báo chung toàn trường
  const g1 = detectScopeType(
    {
      source_type: 'TRAINING_DEPT',
      title: 'Kế hoạch nghỉ Tết Nguyên đán của toàn trường',
      content: 'Ban Giám hiệu thông báo lịch nghỉ Tết cho toàn bộ cán bộ, sinh viên.',
    },
    { course_code: null }
  );
  assert.equal(g1, 'GENERAL');
});

test('Task 13 - Quy tắc 3: Thuật toán chấm điểm ưu tiên đa trọng số và gắn nhãn độ quan trọng', () => {
  // Case 1: Tin Khẩn cấp (URGENT >= 80 điểm) - Hoãn thi/nghỉ đột xuất + gấp
  const urgent = classifyNotification({
    source_type: 'TRAINING_DEPT',
    title: '[KHẨN CẤP] Thông báo hoãn thi học kỳ và nghỉ bão đột xuất',
    content: 'Toàn bộ các ca thi chiều nay hoãn lại, sinh viên theo dõi thông báo mới ngay lập tức.',
  });
  assert.equal(urgent.priority, 'URGENT');
  assert.ok(urgent.priority_score >= 80);
  assert.ok(urgent.tags.includes('#KhẩnCấp'));
  assert.ok(urgent.tags.includes('#Gấp'));

  // Case 2: Tin Ưu tiên cao (HIGH 60-79 điểm) - Lịch thi cuối kỳ môn IT401
  const high = classifyNotification({
    source_type: 'FACULTY',
    title: 'Thông báo lịch thi cuối kỳ và danh sách phòng thi môn Công nghệ phần mềm (IT401)',
    content: 'Khoa CNTT công bố lịch thi và danh sách thi môn IT401.',
  });
  assert.equal(high.priority, 'HIGH');
  assert.ok(high.priority_score >= 60 && high.priority_score < 80);
  assert.equal(high.course_code, 'IT401');
  assert.ok(high.tags.includes('#IT401-CNPM'));
  assert.ok(high.tags.includes('#LịchThi'));

  // Case 3: Tin Thấp (LOW < 40 điểm) - Hoạt động văn nghệ câu lạc bộ ngoại khóa
  const low = classifyNotification({
    source_type: 'EXTRACURRICULAR',
    title: 'Đêm nhạc giao lưu chào đón tân sinh viên CLB Guitar',
    content: 'Mời các bạn sinh viên yêu âm nhạc đăng ký tham gia giao lưu minigame cuối tuần.',
  });
  assert.equal(low.priority, 'LOW');
  assert.ok(low.priority_score < 40);
  assert.ok(low.tags.includes('#NgoạiKhóa'));
});

test('Task 13 - API Endpoint: POST /api/v1/notifications/classify và GET /api/v1/notifications/rules', async () => {
  const { controller } = createServer();

  // Test API Tra cứu bộ quy tắc
  const rulesRes = await callApi(controller, {
    method: 'GET',
    url: '/api/v1/notifications/rules',
  });
  assert.equal(rulesRes.status, 200);
  assert.equal(rulesRes.json.status, 'success');
  assert.ok(Array.isArray(rulesRes.json.data.priority_rules));
  assert.ok(Array.isArray(rulesRes.json.data.default_courses));

  // Test API Preview phân loại
  const classifyRes = await callApi(controller, {
    method: 'POST',
    url: '/api/v1/notifications/classify',
    body: {
      source_type: 'STUDENT_EMAIL',
      title: 'Cảnh báo học vụ và nhắc nợ học phí cá nhân đối với MSSV: 102230012',
      content: 'Yêu cầu sinh viên hoàn tất học phí trước 17h hôm nay để không bị đình chỉ thi.',
    },
  });
  assert.equal(classifyRes.status, 200);
  assert.equal(classifyRes.json.status, 'success');
  const classifiedData = classifyRes.json.data;
  assert.equal(classifiedData.scope_type, 'PERSONAL');
  assert.equal(classifiedData.target_student_id, '102230012');
  assert.equal(classifiedData.priority, 'URGENT');
  assert.ok(classifiedData.tags.includes('#HọcPhí'));
  assert.ok(classifiedData.tags.includes('#TinRiêng'));
  assert.ok(classifiedData.tags.includes('#Gấp'));
});

test('Task 13 - Tích hợp: Tự động chạy bộ quy tắc khi thu thập thông báo mới', async () => {
  const { controller } = createServer();

  const res = await callApi(controller, {
    method: 'POST',
    url: '/api/v1/notifications/collect',
    body: {
      source_type: 'CLASS_SECTION',
      title: 'Thông báo đổi phòng học và hạn chót nộp bài tập lớn môn CSDL (IT302)',
      content: 'Lớp học phần Cơ sở dữ liệu sáng mai chuyển sang phòng A105, nộp bài trước 23h59 hôm nay.',
    },
  });

  assert.equal(res.status, 201);
  const item = res.json.data.notification;
  assert.equal(item.course_code, 'IT302');
  assert.equal(item.scope_type, 'CLASS');
  assert.ok(['HIGH', 'URGENT'].includes(item.priority));
  assert.ok(item.tags.includes('#IT302-CSDL'));
  assert.ok(item.tags.includes('#LớpHọcPhần'));
});
