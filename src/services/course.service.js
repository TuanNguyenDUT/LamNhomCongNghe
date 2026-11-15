/**
 * DỊCH VỤ QUẢN LÝ HỌC PHẦN & MỤC THÔNG BÁO RIÊNG TỪNG HỌC PHẦN (FR-01, FR-04)
 * Triển khai theo đặc tả AGENT.md
 */

const crypto = require('node:crypto');
const { dutCrawlerService } = require('./dut-crawler.service');
const { getDbStore } = require('../config/db');

class CourseService {
  constructor(dbStore = getDbStore(), crawler = dutCrawlerService) {
    this.dbStore = dbStore;
    this.crawler = crawler;
  }

  /**
   * Đăng nhập bằng tài khoản sv.dut.udn.vn, lấy thông tin định danh & cập nhật học phần
   * Xác thực 100% với cổng trường sv.dut.udn.vn, từ chối ngay lập tức nếu sai tài khoản/mật khẩu
   */
  async login(studentCode, password) {
    if (!studentCode || !password) {
      throw new Error('Vui lòng nhập đầy đủ mã sinh viên và mật khẩu sv.dut.udn.vn');
    }

    const cleanCode = String(studentCode).trim();
    const cleanPass = String(password).trim();

    // 1. Xác thực THẬT SỰ với cổng sv.dut.udn.vn
    const authResult = await this.crawler.authenticateWithDut(cleanCode, cleanPass);
    if (!authResult.authenticated) {
      throw new Error(authResult.message || 'Tài khoản hoặc mật khẩu sv.dut.udn.vn không chính xác!');
    }

    const enrolledCourses = authResult.courses || [];
    const profile = authResult.profile || {};

    // 2. Khởi tạo/cập nhật định danh sinh viên vào CSDL với dữ liệu thật từ PageCaNhan.aspx
    let student = this.dbStore.findStudentByCodeOrId(cleanCode);
    const kYear = cleanCode.length >= 5 ? cleanCode.slice(3, 5) : '23';
    const encryptedPass = Buffer.from(cleanPass, 'utf8').toString('base64');
    if (!student) {
      student = {
        id: crypto.randomUUID(),
        firebase_uid: `dut_uid_${cleanCode}`,
        student_code: cleanCode,
        full_name: profile.full_name || `Sinh viên ${cleanCode}`,
        faculty: profile.faculty || 'Khoa Công nghệ Thông tin',
        cohort: profile.cohort || `K${kYear}`,
        class_name: profile.class_name || `${kYear}T_DT`,
        major: profile.major || 'Công nghệ Thông tin',
        program: profile.program || '',
        avatar_url: `/api/v1/avatar/${cleanCode}.jpg`,
        dob: profile.dob || '',
        gender: profile.gender || '',
        school_email: profile.school_email || '',
        personal_email: profile.personal_email || '',
        phone: profile.phone || '',
        dut_session_encrypted: encryptedPass,
        is_personalized_enabled: true,
        interested_topics: ['hoc_vu', 'hoc_bong', 'tuyen_dung'],
        dut_last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      if (profile.full_name) student.full_name = profile.full_name;
      if (profile.class_name) student.class_name = profile.class_name;
      if (profile.faculty) student.faculty = profile.faculty;
      if (profile.cohort) student.cohort = profile.cohort;
      if (profile.major) student.major = profile.major;
      if (profile.program) student.program = profile.program;
      student.avatar_url = `/api/v1/avatar/${cleanCode}.jpg`;
      if (profile.dob) student.dob = profile.dob;
      if (profile.gender) student.gender = profile.gender;
      if (profile.school_email) student.school_email = profile.school_email;
      if (profile.personal_email) student.personal_email = profile.personal_email;
      if (profile.phone) student.phone = profile.phone;
      student.dut_session_encrypted = encryptedPass;
      student.dut_last_synced_at = new Date().toISOString();
      student.updated_at = new Date().toISOString();
    }
    this.dbStore.saveStudent(student);

    // 3. Tự động lưu & cập nhật học phần hiện tại vào Database
    if (enrolledCourses && enrolledCourses.length > 0) {
      for (const c of enrolledCourses) {
        this.dbStore.saveCourse(c);
        this.dbStore.enrollStudentCourse(student.id, c.course_code);
      }
    }

    // 3.1. Phân phối các thông báo thực tế và đồng bộ nhắc nhở/hạn chót bóc tách từ bản tin
    try {
      const { notificationService } = require('./notification.service');
      await notificationService.distributeExistingNotificationsToStudent(student);
    } catch (e) {
      console.warn('Lỗi phân phối thông báo khi đăng nhập:', e.message);
    }

    // 4. Lấy danh sách học phần kèm thống kê
    const coursesWithStats = await this.getEnrolledCoursesWithStats(student.id);

    return {
      token: `dut_token_${Buffer.from(cleanCode + ':' + Date.now()).toString('base64')}`,
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
    let student = this.dbStore.findStudentByCodeOrId(studentId) || this.dbStore.findStudentByCodeOrId(studentCode);
    if (!student) {
      student = this.dbStore.saveStudent({
        student_code: studentCode,
        full_name: `Sinh viên ${studentCode}`,
        faculty: 'Khoa Công nghệ Thông tin',
        cohort: 'K23',
        class_name: '23T_DT',
      });
    }
    const targetStudentId = student.id;

    // Sử dụng mật khẩu sinh viên cung cấp hoặc dùng phiên đã lưu trong CSDL
    let effectivePassword = (password || '').trim();
    if (!effectivePassword && student.dut_session_encrypted) {
      try {
        effectivePassword = Buffer.from(student.dut_session_encrypted, 'base64').toString('utf8');
      } catch (err) {
        console.warn('Không thể giải mã session mật khẩu sv.dut:', err.message);
      }
    } else if (effectivePassword) {
      student.dut_session_encrypted = Buffer.from(effectivePassword, 'utf8').toString('base64');
    }

    const enrolledCourses = await this.crawler.syncStudentCourses(studentCode, effectivePassword);

    for (const c of enrolledCourses) {
      this.dbStore.saveCourse(c);
      this.dbStore.enrollStudentCourse(targetStudentId, c.course_code);
    }

    if (student) {
      student.dut_last_synced_at = new Date().toISOString();
      this.dbStore.saveStudent(student);
    }

    return {
      synced_at: new Date().toISOString(),
      student_id: targetStudentId,
      student_code: studentCode,
      total_courses: enrolledCourses.length,
      courses: enrolledCourses,
    };
  }

  /**
   * Lấy danh sách các học phần sinh viên đang học kèm số tin chưa đọc & deadline (FR-04)
   */
  async getEnrolledCoursesWithStats(studentId) {
    const student = this.dbStore.findStudentByCodeOrId(studentId);
    const sId = student ? student.id : studentId;
    const courses = this.dbStore.getStudentCourses(sId);

    // Tính unread_count và upcoming_deadlines cho từng môn
    const result = courses.map((course) => {
      // Đếm tin thông báo thuộc môn này
      let unreadCount = 0;
      for (const notif of this.dbStore.notifications.values()) {
        if (notif.course_code === course.course_code) {
          const isRead = this.dbStore.student_notifications.some(
            (sn) => sn.notification_id === notif.id && sn.student_id === sId && sn.is_read
          );
          if (!isRead) unreadCount++;
        }
      }

      // Đếm deadline sắp tới thuộc môn này
      const now = new Date();
      let upcomingDeadlines = 0;
      for (const d of this.dbStore.deadlines.values()) {
        if (d.student_id === sId && d.course_code === course.course_code) {
          if (d.status === 'PENDING' || d.status === 'DUE_SOON') {
            if (new Date(d.due_date) >= now) upcomingDeadlines++;
          }
        }
      }

      return {
        ...course,
        unread_count: unreadCount,
        upcoming_deadlines: upcomingDeadlines,
      };
    });

    return result;
  }

  /**
   * Lấy luồng thông báo riêng biệt của một học phần (FR-04)
   * Phân loại riêng nghỉ học, học bù, đổi phòng, bài tập
   */
  async getCourseNotifications(courseCode, studentId = null) {
    const allNotifs = Array.from(this.dbStore.notifications.values()).filter(
      (n) => n.course_code === courseCode || (n.tags && n.tags.includes(`#${courseCode}`))
    );

    allNotifs.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

    return allNotifs.map((n) => {
      let isRead = false;
      let isAcknowledged = false;
      if (studentId) {
        const student = this.dbStore.findStudentByCodeOrId(studentId);
        const sId = student ? student.id : studentId;
        const entry = this.dbStore.student_notifications.find(
          (sn) => sn.notification_id === n.id && sn.student_id === sId
        );
        if (entry) {
          isRead = Boolean(entry.is_read);
          isAcknowledged = Boolean(entry.is_acknowledged);
        }
      }
      return {
        ...n,
        is_read: isRead,
        is_acknowledged: isAcknowledged,
      };
    });
  }
}

const courseService = new CourseService();

module.exports = {
  CourseService,
  courseService,
};

