/**
 * DỊCH VỤ QUẢN LÝ HỌC PHẦN & MỤC THÔNG BÁO RIÊNG TỪNG HỌC PHẦN (FR-01, FR-04)
 * Kiến trúc Direct PostgreSQL Query.
 */

const crypto = require('node:crypto');
const { dutCrawlerService } = require('./dut-crawler.service');
const { db: defaultDb, createDbAdapter } = require('../config/db');
const { StudentRepository, isUuid } = require('../db/student.repository');
const { CourseRepository } = require('../db/course.repository');
const { NotificationRepository } = require('../db/postgres');
const { ValidationError, AuthenticationError } = require('../utils/errors');
const { encryptSecret, decryptSecret } = require('../config/secrets');
const { AuthService } = require('./auth.service');

class CourseService {
  constructor({
    pool = null,
    db = null,
    studentRepo = null,
    courseRepo = null,
    notificationRepo = null,
    crawler = dutCrawlerService,
  } = {}) {
    this.db = db || (pool ? createDbAdapter(pool) : defaultDb);
    this.studentRepo = studentRepo || new StudentRepository(this.db);
    this.courseRepo = courseRepo || new CourseRepository(this.db);
    this.notificationRepo = notificationRepo || new NotificationRepository(this.db);
    this.crawler = crawler;
  }

  /**
   * Đăng nhập bằng tài khoản sv.dut.udn.vn, lấy thông tin định danh & cập nhật học phần
   * Xác thực 100% với cổng trường sv.dut.udn.vn, từ chối ngay lập tức nếu sai tài khoản/mật khẩu
   */
  async login(studentCode, password) {
    if (!studentCode || !password) {
      throw new ValidationError('Vui lòng nhập đầy đủ mã sinh viên và mật khẩu sv.dut.udn.vn');
    }

    const cleanCode = String(studentCode).trim();
    const cleanPass = String(password).trim();

    // 1. Xác thực THẬT SỰ với cổng sv.dut.udn.vn
    const authResult = await this.crawler.authenticateWithDut(cleanCode, cleanPass);
    if (!authResult.authenticated) {
      throw new AuthenticationError(
        authResult.message || 'Tài khoản hoặc mật khẩu sv.dut.udn.vn không chính xác!'
      );
    }

    const enrolledCourses = authResult.courses || [];
    const profile = authResult.profile || {};
    const kYear = cleanCode.length >= 5 ? cleanCode.slice(3, 5) : '23';
    const encryptedPass = encryptSecret(cleanPass);

    // 2. Lưu/cập nhật sinh viên, môn học & đăng ký môn học trong transaction
    const student = await this.db.withTransaction(async (tx) => {
      const existing = await this.studentRepo.resolveStudent(cleanCode, tx);
      const savedStudent = await this.studentRepo.upsertStudent(
        {
          id: existing?.id || crypto.randomUUID(),
          firebase_uid: existing?.firebase_uid || `dut_uid_${cleanCode}`,
          student_code: cleanCode,
          full_name: profile.full_name || existing?.full_name || `Sinh viên ${cleanCode}`,
          faculty: profile.faculty || existing?.faculty || 'Khoa Công nghệ Thông tin',
          cohort: profile.cohort || existing?.cohort || `K${kYear}`,
          class_name: profile.class_name || existing?.class_name || `${kYear}T_DT`,
          major: profile.major || existing?.major || 'Công nghệ Thông tin',
          program: profile.program || existing?.program || '',
          avatar_url: `/api/v1/avatar/${cleanCode}.jpg`,
          dob: profile.dob || existing?.dob || '',
          gender: profile.gender || existing?.gender || '',
          school_email: profile.school_email || existing?.school_email || '',
          personal_email: profile.personal_email || existing?.personal_email || '',
          phone: profile.phone || existing?.phone || '',
          dut_session_encrypted: encryptedPass,
          is_personalized_enabled: existing ? existing.is_personalized_enabled !== false : true,
          interested_topics: existing?.interested_topics || ['hoc_vu', 'hoc_bong', 'tuyen_dung'],
          quick_reminder_options: existing?.quick_reminder_options,
          google_refresh_token: existing?.google_refresh_token,
          google_calendar_id: existing?.google_calendar_id,
          is_calendar_sync_enabled: existing?.is_calendar_sync_enabled,
          dut_last_synced_at: new Date().toISOString(),
        },
        tx
      );

      for (const c of enrolledCourses) {
        await this.courseRepo.upsertCourse(c, tx);
        await this.courseRepo.enrollStudentCourse(savedStudent.id, c.course_code, tx);
      }

      return savedStudent;
    });

    // 3. Phân phối thông báo hiện có và đồng bộ deadline cho sinh viên (lỗi DB sẽ propagate)
    const { NotificationService } = require('./notification.service');
    const notifService = new NotificationService({ db: this.db });
    await notifService.distributeExistingNotificationsToStudent(student);

    // 4. Lấy danh sách học phần kèm thống kê
    const coursesWithStats = await this.getEnrolledCoursesWithStats(student.id);

    return {
      token: await new AuthService(this.db).createSession(student.id),
      student: {
        id: student.id,
        student_code: student.student_code,
        full_name: student.full_name,
        faculty: student.faculty,
        cohort: student.cohort,
        class_name: student.class_name,
        major: student.major,
        program: student.program,
        avatar_url: student.avatar_url,
        dob: student.dob,
        gender: student.gender,
        school_email: student.school_email,
        personal_email: student.personal_email,
        phone: student.phone,
        dut_last_synced_at: student.dut_last_synced_at,
        is_personalized_enabled: student.is_personalized_enabled !== false,
        interested_topics: student.interested_topics || ['hoc_vu', 'hoc_bong', 'tuyen_dung'],
        total_courses: coursesWithStats.length,
      },
      courses: coursesWithStats,
    };
  }

  /**
   * Đồng bộ danh sách học phần sinh viên đang học từ sv.dut.udn.vn (FR-01)
   */
  async syncCoursesFromDut(studentId, studentCode, password = '') {
    let student =
      (await this.studentRepo.resolveStudent(studentId)) ||
      (await this.studentRepo.resolveStudent(studentCode));

    if (!student) {
      if (!studentCode) {
        throw new ValidationError('Thiếu mã sinh viên (student_code) để đồng bộ học phần');
      }
      student = await this.studentRepo.upsertStudent({
        id: isUuid(studentId) ? studentId : crypto.randomUUID(),
        student_code: studentCode,
        full_name: `Sinh viên ${studentCode}`,
        faculty: 'Khoa Công nghệ Thông tin',
        cohort: 'K23',
        class_name: '23T_DT',
      });
    }

    const effectiveCode = studentCode || student.student_code;
    let effectivePassword = (password || '').trim();
    if (!effectivePassword && student.dut_session_encrypted) {
      try {
        effectivePassword = decryptSecret(student.dut_session_encrypted);
      } catch (err) {
        throw err;
      }
    }

    const enrolledCourses = await this.crawler.syncStudentCourses(effectiveCode, effectivePassword);
    const syncedAt = new Date().toISOString();

    await this.db.withTransaction(async (tx) => {
      for (const c of enrolledCourses) {
        await this.courseRepo.upsertCourse(c, tx);
        await this.courseRepo.enrollStudentCourse(student.id, c.course_code, tx);
      }
      await this.studentRepo.upsertStudent(
        {
          ...student,
          dut_session_encrypted: effectivePassword
            ? encryptSecret(effectivePassword)
            : student.dut_session_encrypted,
          dut_last_synced_at: syncedAt,
        },
        tx
      );
    });

    return {
      synced_at: syncedAt,
      student_id: student.id,
      student_code: effectiveCode,
      total_courses: enrolledCourses.length,
      courses: enrolledCourses,
    };
  }

  /**
   * Lấy danh sách các học phần sinh viên đang học kèm số tin chưa đọc & deadline (FR-04)
   */
  async getEnrolledCoursesWithStats(studentIdentifier) {
    if (!studentIdentifier) return [];
    const student = await this.studentRepo.resolveStudent(studentIdentifier);
    if (!student) return [];
    return this.courseRepo.getEnrolledCoursesWithStats(student.id);
  }

  /**
   * Lấy luồng thông báo riêng biệt của một học phần (FR-04)
   */
  async getCourseNotifications(courseCode, studentIdentifier = null) {
    let studentUuid = null;
    if (studentIdentifier) {
      const student = await this.studentRepo.resolveStudent(studentIdentifier);
      studentUuid = student ? student.id : null;
      const enrolled = student ? await this.courseRepo.getStudentCourses(student.id) : [];
      if (!enrolled.some(course => course.course_code === courseCode)) {
        const { AppError } = require('../utils/errors');
        throw new AppError('Bạn chưa đăng ký học phần này', {httpStatus:403, code:'FORBIDDEN'});
      }
    }
    return this.notificationRepo.listByCourse(courseCode, studentUuid);
  }
}

const courseService = new CourseService();

module.exports = {
  CourseService,
  courseService,
};
