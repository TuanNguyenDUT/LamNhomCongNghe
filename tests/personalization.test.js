const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { createServer } = require('../src/server');
const { notificationRouter } = require('../src/api/notification.routes');
const { StudentRepository } = require('../src/db/student.repository');
const { detectNotificationTopics } = require('../src/services/classifier.service');
const {
  createTestPool,
  resetDatabase,
  seedStudent,
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
    end(data) {
      if (data) rawResponse += data;
    },
  };

  await notificationRouter(req, res, controller);
  let parsedBody = null;
  try {
    parsedBody = rawResponse ? JSON.parse(rawResponse) : null;
  } catch (_) {
    parsedBody = rawResponse;
  }
  return { statusCode, headers: responseHeaders, body: parsedBody };
}

test('PERSONALIZATION-02: Phân loại chủ đề thông báo tự động (detectNotificationTopics)', async () => {
  const notifHocBong = {
    title: 'Thông báo xét cấp học bổng khuyến khích học tập học kỳ 1 năm học 2026-2027',
    content: 'Danh sách sinh viên đủ điều kiện nhận học bổng...',
    source_channel: 'DUT_STUDENT_AFFAIRS',
  };
  const topicsHB = detectNotificationTopics(notifHocBong);
  assert.ok(topicsHB.includes('hoc_bong'));

  const notifTuyenDung = {
    title: 'Tập đoàn FPT tuyển dụng thực tập sinh phần mềm K23',
    content: 'Cơ hội việc làm và phỏng vấn trực tiếp tại Ngày hội việc làm DUT',
    source_channel: 'DUT_GENERAL',
  };
  const topicsTD = detectNotificationTopics(notifTuyenDung);
  assert.ok(topicsTD.includes('tuyen_dung'));

  const notifHocVu = {
    title: 'Thông báo thời khóa biểu và đăng ký môn học bù lớp học phần',
    content: 'Đề nghị sinh viên kiểm tra lịch thi và bảng điểm',
    source_channel: 'DUT_TRAINING',
  };
  const topicsHV = detectNotificationTopics(notifHocVu);
  assert.ok(topicsHV.includes('hoc_vu'));
});

test.describe('Personalization & Session Sync Direct PostgreSQL Tests', () => {
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

  test('PERSONALIZATION-01: GET & PUT /api/v1/students/preferences', async () => {
    const { controller } = createServer(pool);

    const getRes = await callApi(controller, {
      method: 'GET',
      url: '/api/v1/students/preferences?student_code=102200001',
    });
    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.body.status, 'success');
    assert.equal(typeof getRes.body.data.is_personalized_enabled, 'boolean');
    assert.ok(Array.isArray(getRes.body.data.interested_topics));

    const newTopics = ['hoc_vu', 'hoc_bong', 'tuyen_dung'];
    const putRes = await callApi(controller, {
      method: 'PUT',
      url: '/api/v1/students/preferences',
      body: {
        student_code: '102200001',
        is_personalized_enabled: true,
        interested_topics: newTopics,
      },
    });
    assert.equal(putRes.statusCode, 200);
    assert.equal(putRes.body.status, 'success');
    assert.deepEqual(putRes.body.data.interested_topics, newTopics);
    assert.equal(putRes.body.data.is_personalized_enabled, true);

    const verifyRes = await callApi(controller, {
      method: 'GET',
      url: '/api/v1/students/preferences?student_code=102200001',
    });
    assert.deepEqual(verifyRes.body.data.interested_topics, newTopics);
  });

  test('AUTH-SEC-01: Đồng bộ học phần không cần hardcode mật khẩu, dùng phiên đã xác thực', async () => {
    const { controller } = createServer(pool);
    const studentRepo = new StudentRepository(pool);
    await studentRepo.upsertStudent({
      id: crypto.randomUUID(),
      student_code: '102299999',
      full_name: 'Sinh viên Test Session',
      faculty: 'Khoa Công nghệ Thông tin',
      cohort: 'K23',
      class_name: '23T_DT',
      dut_session_encrypted: require('../src/config/secrets').encryptSecret('student_real_password_123'),
      dut_last_synced_at: new Date().toISOString(),
    });

    const syncRes = await callApi(controller, {
      method: 'POST',
      url: '/api/v1/dut/sync-courses',
      body: {
        student_code: '102299999',
      },
    });

    assert.equal(syncRes.statusCode, 200);
    assert.equal(syncRes.body.status, 'success');
    assert.ok(syncRes.body.data.courses.length > 0);
  });
});
