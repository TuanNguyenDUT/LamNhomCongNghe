/**
 * TEST BỘ PHÂN LOẠI 5 LOẠI THÔNG BÁO CHÍNH (NOTIFICATION CATEGORIES):
 * 1. Thông báo học tập (ACADEMIC: thay đổi lịch học, nghỉ học, học bù, đổi phòng học...)
 * 2. Thông báo điểm số (GRADE: phúc khảo điểm, cảnh báo kết quả học tập, công bố điểm...)
 * 3. Thông báo hành chính (ADMINISTRATIVE: đăng ký học phần, học phí, gia hạn học phí...)
 * 4. Hoạt động sự kiện (EVENT: workshop, cuộc thi, hoạt động tình nguyện, CLB...)
 * 5. Thông báo nghề nghiệp (CAREER: tuyển dụng, thực tập, hạn ứng tuyển thực tập...)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const {
  detectNotificationCategory,
  classifyNotification,
  NOTIFICATION_CATEGORIES,
} = require('../src/services/classifier.service');
const { notificationService } = require('../src/services/notification.service');
const { notificationController } = require('../src/controllers/notification.controller');
const { notificationRouter } = require('../src/api/notification.routes');

async function callApi({ method = 'GET', url = '/', body = null } = {}) {
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

  await notificationRouter(req, res, notificationController);
  return {
    status: statusCode,
    json: rawResponse ? JSON.parse(rawResponse) : null,
  };
}

test('1. Phân loại chuẩn xác: Thông báo học tập (ACADEMIC)', () => {
  // Thay đổi lịch học, đổi phòng học
  const r1 = detectNotificationCategory({
    title: 'Thông báo thay đổi lịch học và đổi phòng học môn Công nghệ phần mềm',
    content: 'Do giảng viên đi công tác, lớp IT401 chuyển sang học bù phòng F302.',
  });
  assert.equal(r1.category, 'ACADEMIC');
  assert.equal(r1.category_code, 'hoc_tap');
  assert.equal(r1.category_name, 'Thông báo học tập');
  assert.equal(r1.category_tag, '#HọcTập');

  // Nghỉ học và học bù
  const r2 = detectNotificationCategory({
    title: 'Nghỉ học tiết 1-3 và sắp xếp lịch học bù vào sáng thứ Bảy',
    content: 'Sinh viên theo dõi thời khóa biểu điều chỉnh trên hệ thống.',
  });
  assert.equal(r2.category, 'ACADEMIC');

  // Lịch thi kết thúc học phần
  const r3 = classifyNotification({
    title: 'Lịch thi kết thúc học phần môn Mạng máy tính học kỳ 1',
    content: 'Danh sách phòng thi và ca thi đã được cập nhật.',
  });
  assert.equal(r3.category, 'ACADEMIC');
  assert.ok(r3.tags.includes('#HọcTập'));
});

test('2. Phân loại chuẩn xác: Thông báo điểm số (GRADE)', () => {
  // Phúc khảo điểm
  const r1 = detectNotificationCategory({
    title: 'Thông báo tiếp nhận đơn phúc khảo điểm thi kết thúc học phần học kỳ 1',
    content: 'Sinh viên có nguyện vọng phúc khảo nộp đơn trực tuyến trước ngày 25.',
  });
  assert.equal(r1.category, 'GRADE');
  assert.equal(r1.category_code, 'diem_so');
  assert.equal(r1.category_name, 'Thông báo điểm số');
  assert.equal(r1.category_tag, '#ĐiểmSố');

  // Cảnh báo kết quả học tập / học vụ
  const r2 = detectNotificationCategory({
    title: 'Danh sách sinh viên bị cảnh báo kết quả học tập và cảnh báo học vụ đợt 1',
    content: 'Các sinh viên có điểm GPA dưới ngưỡng cần đến phòng đào tạo để tư vấn học vụ.',
  });
  assert.equal(r2.category, 'GRADE');

  // Công bố bảng điểm môn học qua classifyNotification
  const r3 = classifyNotification({
    title: 'Công bố bảng điểm tổng kết và thời hạn khiếu nại điểm môn CSDL',
    content: 'Giảng viên đã nhập điểm số lên trang cá nhân sinh viên.',
  });
  assert.equal(r3.category, 'GRADE');
  assert.ok(r3.tags.includes('#ĐiểmSố'));
});

test('3. Phân loại chuẩn xác: Thông báo hành chính (ADMINISTRATIVE)', () => {
  // Đăng ký học phần
  const r1 = detectNotificationCategory({
    title: 'Kế hoạch đăng ký học phần tín chỉ cho học kỳ tiếp theo năm học 2026-2027',
    content: 'Hệ thống mở cổng đăng ký theo từng khóa từ 8h00 ngày 15/12.',
  });
  assert.equal(r1.category, 'ADMINISTRATIVE');
  assert.equal(r1.category_code, 'hanh_chinh');
  assert.equal(r1.category_name, 'Thông báo hành chính');
  assert.equal(r1.category_tag, '#HànhChính');

  // Học phí và gia hạn nộp học phí
  const r2 = detectNotificationCategory({
    title: 'Thông báo gia hạn nộp học phí và thời hạn thanh toán học phí qua ngân hàng',
    content: 'Nhà trường gia hạn thời gian đóng học phí đến hết ngày 30.',
  });
  assert.equal(r2.category, 'ADMINISTRATIVE');

  // Rút học phần & thủ tục hồ sơ sinh viên
  const r3 = classifyNotification({
    title: 'Hướng dẫn rút học phần và nộp hồ sơ xin miễn giảm học phí',
    content: 'Sinh viên làm theo quy định thủ tục hành chính tại phòng một cửa.',
  });
  assert.equal(r3.category, 'ADMINISTRATIVE');
  assert.ok(r3.tags.includes('#HànhChính'));
});

test('4. Phân loại chuẩn xác: Hoạt động sự kiện (EVENT)', () => {
  // Workshop và cuộc thi
  const r1 = detectNotificationCategory({
    title: 'Mời sinh viên tham dự Workshop Trí tuệ nhân tạo và Cuộc thi Hackathon 2026',
    content: 'Chương trình diễn ra tại hội trường F với nhiều phần quà giá trị.',
  });
  assert.equal(r1.category, 'EVENT');
  assert.equal(r1.category_code, 'su_kien');
  assert.equal(r1.category_name, 'Hoạt động sự kiện');
  assert.equal(r1.category_tag, '#HoạtĐộngSựKiện');

  // Hoạt động tình nguyện và phong trào CLB
  const r2 = detectNotificationCategory({
    title: 'Chiến dịch hoạt động tình nguyện Mùa hè xanh và ngày hội hiến máu nhân đạo',
    content: 'Đoàn Thanh niên phát động phong trào hiến máu cứu người.',
  });
  assert.equal(r2.category, 'EVENT');

  // Giao lưu văn nghệ & thể thao CLB
  const r3 = classifyNotification({
    title: 'Đêm nhạc giao lưu chào tân sinh viên và giải bóng đá truyền thống câu lạc bộ',
    content: 'Mời toàn thể sinh viên các khóa tham gia cổ vũ phong trào.',
  });
  assert.equal(r3.category, 'EVENT');
  assert.ok(r3.tags.includes('#HoạtĐộngSựKiện'));
});

test('5. Phân loại chuẩn xác: Thông báo nghề nghiệp (CAREER)', () => {
  // Tuyển dụng & thực tập
  const r1 = detectNotificationCategory({
    title: 'Thông báo tuyển dụng thực tập sinh và cơ hội việc làm tại tập đoàn FPT',
    content: 'Tuyển các vị trí thực tập Lập trình viên Flutter, Backend Node.js.',
  });
  assert.equal(r1.category, 'CAREER');
  assert.equal(r1.category_code, 'nghe_nghiep');
  assert.equal(r1.category_name, 'Thông báo nghề nghiệp');
  assert.equal(r1.category_tag, '#NghềNghiệp');

  // Hạn ứng tuyển thực tập
  const r2 = detectNotificationCategory({
    title: 'Thông báo hạn ứng tuyển thực tập tốt nghiệp và nộp hồ sơ CV đợt hè',
    content: 'Hạn cuối nhận hồ sơ ứng tuyển thực tập doanh nghiệp là trước ngày 10/05.',
  });
  assert.equal(r2.category, 'CAREER');

  // Ngày hội việc làm / Job Fair
  const r3 = classifyNotification({
    title: 'Ngày hội việc làm Job Fair 2026 dành cho sinh viên sắp tốt nghiệp',
    content: 'Hơn 50 doanh nghiệp tham gia tuyển sinh viên với hàng trăm vị trí việc làm hấp dẫn.',
  });
  assert.equal(r3.category, 'CAREER');
  assert.ok(r3.tags.includes('#NghềNghiệp'));
});

test('6. REST API: GET /api/v1/notifications/categories trả về đủ 5 loại thông báo', async () => {
  const res = await callApi({
    method: 'GET',
    url: '/api/v1/notifications/categories',
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.status, 'success');
  const cats = res.json.data;
  assert.equal(cats.length, 5);

  const codes = cats.map((c) => c.category);
  assert.deepEqual(codes.sort(), ['ACADEMIC', 'ADMINISTRATIVE', 'CAREER', 'EVENT', 'GRADE'].sort());

  const academic = cats.find((c) => c.category === 'ACADEMIC');
  assert.equal(academic.category_name, 'Thông báo học tập');
  assert.equal(academic.category_tag, '#HọcTập');

  const grade = cats.find((c) => c.category === 'GRADE');
  assert.equal(grade.category_name, 'Thông báo điểm số');
  assert.equal(grade.category_tag, '#ĐiểmSố');

  const admin = cats.find((c) => c.category === 'ADMINISTRATIVE');
  assert.equal(admin.category_name, 'Thông báo hành chính');
  assert.equal(admin.category_tag, '#HànhChính');

  const event = cats.find((c) => c.category === 'EVENT');
  assert.equal(event.category_name, 'Hoạt động sự kiện');
  assert.equal(event.category_tag, '#HoạtĐộngSựKiện');

  const career = cats.find((c) => c.category === 'CAREER');
  assert.equal(career.category_name, 'Thông báo nghề nghiệp');
  assert.equal(career.category_tag, '#NghềNghiệp');
});

test('7. REST API: POST /api/v1/notifications/classify trả về trường category', async () => {
  const res = await callApi({
    method: 'POST',
    url: '/api/v1/notifications/classify',
    body: {
      title: 'Thông báo tuyển dụng thực tập sinh và hạn ứng tuyển thực tập kỳ hè',
      content: 'Công ty công nghệ tuyển sinh viên thực tập có phụ cấp.',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.json.data.category, 'CAREER');
  assert.equal(res.json.data.category_name, 'Thông báo nghề nghiệp');
  assert.ok(res.json.data.tags.includes('#NghềNghiệp'));
});

test('8. REST API & Ingest: Lưu thông báo có phân loại category và lọc theo category', async () => {
  // Ingest tin điểm số
  const ingGrade = await notificationService.ingestNotification({
    title: 'Thông báo kết quả phúc khảo điểm thi học kỳ môn Công nghệ phần mềm',
    content: 'Điểm số chính thức của các sinh viên phúc khảo đã được cập nhật.',
    source_channel: 'DUT_TESTING_QA',
  });
  assert.equal(ingGrade.notification.category, 'GRADE');

  // Ingest tin tuyển dụng
  const ingCareer = await notificationService.ingestNotification({
    title: 'Cơ hội thực tập và tuyển dụng kỹ sư phần mềm tại Đà Nẵng',
    content: 'Doanh nghiệp tuyển dụng sinh viên tốt nghiệp loại khá giỏi.',
    source_channel: 'DUT_STUDENT_AFFAIRS',
  });
  assert.equal(ingCareer.notification.category, 'CAREER');

  // Lọc feed theo category=GRADE
  const feedGrade = await notificationService.getFeedNotifications({
    category: 'GRADE',
  });
  assert.ok(feedGrade.notifications.every((n) => n.category === 'GRADE' || n.category_code === 'diem_so'));

  // Lọc feed theo category=CAREER
  const feedCareer = await notificationService.getFeedNotifications({
    category: 'CAREER',
  });
  assert.ok(feedCareer.notifications.every((n) => n.category === 'CAREER' || n.category_code === 'nghe_nghiep'));
});
