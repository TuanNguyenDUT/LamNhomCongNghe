const test = require('node:test');
const assert = require('node:assert/strict');
const { NotificationController } = require('../src/controllers/notification.controller');

test('getCurrentUser (/api/v1/auth/me) returns all 18 student fields and courses', async () => {
  const mockStudent = {
    id: 42,
    student_code: '102240001',
    full_name: 'Trần Minh Quân',
    faculty: 'Khoa Công nghệ Thông tin',
    cohort: 'K24',
    class_name: '24T_CLC1',
    major: 'Công nghệ thông tin',
    program: 'Chất lượng cao',
    avatar_url: null,
    dob: '2006-05-14',
    gender: 'Nam',
    school_email: '102240001@sv1.dut.udn.vn',
    personal_email: 'quan.tran@example.com',
    phone: '0905123456',
    dut_last_synced_at: '2026-11-20T10:00:00.000Z',
    is_personalized_enabled: true,
    interested_topics: null,
  };
  const mockCourses = [
    { course_code: '1021999', course_name: 'Lập trình hướng đối tượng' },
    { course_code: '1022001', course_name: 'Cấu trúc dữ liệu' },
  ];

  const controller = new NotificationController({
    studentRepo: {
      resolveStudent: async (id) => (id === '102240001' ? mockStudent : null),
    },
    courseSvc: {
      getEnrolledCoursesWithStats: async (studentId) => {
        assert.equal(studentId, 42);
        return mockCourses;
      },
    },
  });

  const res = await controller.getCurrentUser({ student_id: '102240001' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'success');

  const { student, courses } = res.body.data;
  assert.deepEqual(courses, mockCourses);

  const expectedFields = [
    'id',
    'student_code',
    'full_name',
    'faculty',
    'cohort',
    'class_name',
    'major',
    'program',
    'avatar_url',
    'dob',
    'gender',
    'school_email',
    'personal_email',
    'phone',
    'dut_last_synced_at',
    'is_personalized_enabled',
    'interested_topics',
    'total_courses',
  ];
  assert.equal(expectedFields.length, 18);
  for (const field of expectedFields) {
    assert.ok(Object.prototype.hasOwnProperty.call(student, field), `Missing field: ${field}`);
  }

  assert.equal(student.id, 42);
  assert.equal(student.student_code, '102240001');
  assert.equal(student.avatar_url, '/api/v1/avatar/102240001.jpg');
  assert.equal(student.major, 'Công nghệ thông tin');
  assert.equal(student.program, 'Chất lượng cao');
  assert.equal(student.dob, '2006-05-14');
  assert.equal(student.gender, 'Nam');
  assert.equal(student.school_email, '102240001@sv1.dut.udn.vn');
  assert.equal(student.personal_email, 'quan.tran@example.com');
  assert.equal(student.phone, '0905123456');
  assert.equal(student.is_personalized_enabled, true);
  assert.deepEqual(student.interested_topics, [
    'ACADEMIC',
    'GRADE',
    'ADMINISTRATIVE',
    'EVENT',
    'CAREER',
    'SCHOLARSHIP',
  ]);
  assert.equal(student.total_courses, 2);
});

test('handleGoogleCallback redirects both meta refresh and anchor CTA to /deadlines?scope=personal', async () => {
  const controller = new NotificationController({
    calendarSvc: {
      exchangeAuthCodeForTokens: async () => ({ refresh_token: 'rt_123' }),
      connectGoogleAccount: async () => ({ connected: true }),
      syncDeadlinesToCalendar: async () => ({ synced_count: 3 }),
    },
  });

  const res = await controller.handleGoogleCallback({
    code: 'oauth_code_123',
    state: '102240001',
  });

  assert.equal(res.statusCode, 200);
  assert.ok(
    res.rawBody.includes('<meta http-equiv="refresh" content="4;url=/deadlines?scope=personal">'),
    'Meta refresh must redirect to /deadlines?scope=personal'
  );
  assert.ok(
    res.rawBody.includes('<a href="/deadlines?scope=personal" class="btn">'),
    'Anchor button must link to /deadlines?scope=personal'
  );
});
