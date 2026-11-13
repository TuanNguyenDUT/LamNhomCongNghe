/**
 * TASK 5: UNIT TEST CHO CÁC LUỒNG XỬ LÝ HẠN CHÓT & KIỂM TRA HIỂN THỊ RESPONSIVE
 * Phụ trách: Nguyễn Hữu Duy Bảo
 * Chạy bằng: node --test tests/deadline.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { DeadlineRepository, computeDeadlineStatus } = require('../src/db/deadline.repository');
const { DeadlineController } = require('../src/controllers/deadline.controller');
const { FcmService } = require('../src/services/fcm.service');

test('=== SUITE 1: THUẬT TOÁN TỰ ĐỘNG PHÂN LOẠI TRẠNG THÁI (Task 4) ===', async (t) => {
  await t.test('Nên trả về OVERDUE khi hạn chót đã trôi qua', () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 giờ trước
    const status = computeDeadlineStatus(pastDate, false);
    assert.equal(status, 'OVERDUE');
  });

  await t.test('Nên trả về DUE_SOON khi hạn chót trong vòng 48 giờ tới', () => {
    const soonDate = new Date(Date.now() + 24 * 3600000).toISOString(); // 24 giờ tới
    const status = computeDeadlineStatus(soonDate, false);
    assert.equal(status, 'DUE_SOON');
  });

  await t.test('Nên trả về UPCOMING khi còn nhiều hơn 48 giờ', () => {
    const futureDate = new Date(Date.now() + 5 * 86400000).toISOString(); // 5 ngày tới
    const status = computeDeadlineStatus(futureDate, false);
    assert.equal(status, 'UPCOMING');
  });

  await t.test('Nên trả về COMPLETED khi is_completed = true bất kể ngày hạn chót', () => {
    const pastDate = new Date(Date.now() - 100 * 86400000).toISOString();
    const status = computeDeadlineStatus(pastDate, true);
    assert.equal(status, 'COMPLETED');
  });
});

test('=== SUITE 2: LUỒNG CRUD VÀ BỘ LỌC DEADLINES (Task 2 & 3) ===', async (t) => {
  const repo = new DeadlineRepository();
  const fcmService = new FcmService(repo);
  const controller = new DeadlineController(repo, fcmService);

  await t.test('Nên lấy được danh sách môn học mặc định', async () => {
    const courses = await controller.getCourses();
    assert.equal(courses.status, 'SUCCESS');
    assert.ok(courses.count >= 6);
  });

  await t.test('Nên tạo mới thành công 1 deadline qua Controller', async () => {
    const dueDate = new Date(Date.now() + 30 * 3600000).toISOString();
    const res = await controller.createDeadline({
      title: 'Bài tập Unit Test Jest & Mocha',
      subject: 'IT401',
      due_date: dueDate,
      note: 'Kiểm tra độ bao phủ mã nguồn',
    });

    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.data.title, 'Bài tập Unit Test Jest & Mocha');
    assert.equal(res.data.subject, 'IT401');
    assert.equal(res.data.status, 'DUE_SOON');
    assert.equal(res.data.is_completed, false);
  });

  await t.test('Báo lỗi 400 khi thiếu trường dữ liệu bắt buộc lúc tạo deadline', async () => {
    await assert.rejects(
      async () => {
        await controller.createDeadline({ title: 'Thiếu môn học' });
      },
      { statusCode: 400 }
    );
  });

  await t.test('Lọc deadline theo môn học (subject filter)', async () => {
    const res = await controller.getDeadlines({ subject: 'IT401' });
    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.data.every((d) => d.subject === 'IT401' || d.course_code === 'IT401'));
  });

  await t.test('Toggle đánh dấu hoàn thành bài tập (Checkbox tick - Task 4)', async () => {
    const res = await controller.toggleComplete(1);
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.data.is_completed, true);
    assert.equal(res.data.status, 'COMPLETED');

    // Bỏ tick
    const res2 = await controller.toggleComplete(1);
    assert.equal(res2.data.is_completed, false);
    assert.notEqual(res2.data.status, 'COMPLETED');
  });

  await t.test('Cập nhật nội dung deadline (PUT)', async () => {
    const res = await controller.updateDeadline(2, {
      title: 'Làm bài tập Mạng máy tính tuần 9 (Đã cập nhật)',
      note: 'Thầy yêu cầu thêm sơ đồ Wireshark',
    });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.data.title, 'Làm bài tập Mạng máy tính tuần 9 (Đã cập nhật)');
  });

  await t.test('Xóa thành công deadline (DELETE)', async () => {
    const res = await controller.deleteDeadline(3);
    assert.equal(res.status, 'SUCCESS');

    await assert.rejects(
      async () => {
        await controller.getDeadlineById(3);
      },
      { statusCode: 404 }
    );
  });
});

test('=== SUITE 3: LƯU TRỮ FCM DEVICE TOKEN & PUSH NOTIFICATION (Task 6) ===', async (t) => {
  const repo = new DeadlineRepository();
  const fcmService = new FcmService(repo);
  const controller = new DeadlineController(repo, fcmService);

  await t.test('Đăng ký và lưu device token của sinh viên vào DB', async () => {
    const res = await controller.registerToken({
      student_id: '102230001',
      device_token: 'fcm_mock_token_xyz_12345',
      platform: 'ANDROID',
      device_model: 'Samsung Galaxy S23',
    });
    assert.equal(res.status, 'SUCCESS');
    assert.equal(res.data.device_token, 'fcm_mock_token_xyz_12345');
    assert.equal(res.data.is_active, true);
  });

  await t.test('Gửi thử nghiệm Push Notification giả lập', async () => {
    const res = await controller.testPushNotification({
      device_token: 'fcm_mock_token_xyz_12345',
      title: 'Nhắc nhở hạn chót',
      body: 'Bạn còn 2 giờ để nộp bài tập lớn',
    });
    assert.equal(res.status, 'SUCCESS');
    assert.ok(res.result.success);
  });
});

test('=== SUITE 4: KIỂM TRA HIỂN THỊ RESPONSIVE VÀ CHUẨN HTML (Task 1 & 5) ===', async () => {
  const htmlPath = path.join(__dirname, '../src/public/deadline-ui.html');
  assert.ok(fs.existsSync(htmlPath), 'File deadline-ui.html phải tồn tại');

  const content = fs.readFileSync(htmlPath, 'utf-8');

  // Kiểm tra thẻ viewport cho thiết bị di động
  assert.match(
    content,
    /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width/i,
    'Trang phải có thẻ viewport hỗ trợ responsive di động'
  );

  // Kiểm tra CSS Media Queries cho mobile/tablet
  assert.match(
    content,
    /@media\s*\(\s*max-width:\s*768px\s*\)/,
    'Trang phải chứa CSS media queries tối ưu cho màn hình di động 768px'
  );

  // Kiểm tra các phần tử cốt lõi của Task 1 & 4
  assert.match(content, /id=["']courseFilter["']/, 'Phải có dropdown lọc theo môn học');
  assert.match(content, /id=["']statusFilter["']/, 'Phải có bộ lọc trạng thái');
  assert.match(content, /id=["']searchInput["']/, 'Phải có ô tìm kiếm bài tập');
  assert.match(content, /checkbox/, 'Phải có checkbox đánh dấu hoàn thành');
});
