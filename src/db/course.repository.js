/**
 * Course Repository: Direct PostgreSQL queries for courses & student_courses.
 */

const { db: defaultDb, createDbAdapter } = require('../config/db');
const { isUuid } = require('./student.repository');

function normalizeCourseRow(row) {
  if (!row) return null;
  const copy = { ...row };
  if (copy.created_at instanceof Date) copy.created_at = copy.created_at.toISOString();
  if (copy.enrolled_at instanceof Date) copy.enrolled_at = copy.enrolled_at.toISOString();
  if (copy.unread_count !== undefined) copy.unread_count = Number(copy.unread_count);
  if (copy.upcoming_deadlines !== undefined) copy.upcoming_deadlines = Number(copy.upcoming_deadlines);
  return copy;
}

class CourseRepository {
  constructor(poolOrDb = null) {
    this.db = poolOrDb && typeof poolOrDb.query === 'function'
      ? poolOrDb
      : (poolOrDb ? createDbAdapter(poolOrDb) : defaultDb);
  }

  async upsertCourse(course, client = null) {
    const runner = client || this.db;
    const { rows } = await runner.query(
      `INSERT INTO courses (course_code, course_name, semester, lecturer_name, schedule_info)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (course_code) DO UPDATE SET
         course_name = EXCLUDED.course_name,
         semester = EXCLUDED.semester,
         lecturer_name = EXCLUDED.lecturer_name,
         schedule_info = EXCLUDED.schedule_info
       RETURNING *`,
      [
        course.course_code,
        course.course_name || course.course_code,
        course.semester || 'Học kỳ 1 (2026-2027)',
        course.lecturer_name || 'Chưa cập nhật',
        course.schedule_info || 'Chưa có lịch cụ thể',
      ]
    );
    return normalizeCourseRow(rows[0]);
  }

  async enrollStudentCourse(studentUuid, courseCode, client = null) {
    if (!isUuid(studentUuid)) {
      throw new Error(`Invalid student UUID for enrollment: ${studentUuid}`);
    }
    const runner = client || this.db;
    await runner.query(
      `INSERT INTO student_courses (student_id, course_code)
       VALUES ($1::uuid, $2)
       ON CONFLICT (student_id, course_code) DO NOTHING`,
      [studentUuid, courseCode]
    );
  }

  async getStudentCourses(studentUuid, client = null) {
    if (!isUuid(studentUuid)) return [];
    const runner = client || this.db;
    const { rows } = await runner.query(
      `SELECT c.*, sc.is_muted, sc.enrolled_at
       FROM courses c
       INNER JOIN student_courses sc ON sc.course_code = c.course_code
       WHERE sc.student_id = $1::uuid
       ORDER BY c.course_code ASC`,
      [studentUuid]
    );
    return rows.map(normalizeCourseRow);
  }

  async getAllCourses(client = null) {
    const runner = client || this.db;
    const { rows } = await runner.query('SELECT * FROM courses ORDER BY course_code ASC');
    return rows.map(normalizeCourseRow);
  }

  async getEnrolledCoursesWithStats(studentUuid, client = null) {
    if (!isUuid(studentUuid)) return [];
    const runner = client || this.db;
    const { rows } = await runner.query(
      `SELECT
         c.*,
         sc.is_muted,
         sc.enrolled_at,
         (
           SELECT COUNT(*)::int
           FROM notifications n
           LEFT JOIN student_notifications sn
             ON sn.notification_id = n.id AND sn.student_id = sc.student_id
           WHERE (n.course_code = c.course_code OR n.tags ? ('#' || c.course_code))
             AND COALESCE(sn.is_read, FALSE) = FALSE
         ) AS unread_count,
         (
           SELECT COUNT(*)::int
           FROM deadlines d
           WHERE d.student_id = sc.student_id
             AND d.course_code = c.course_code
             AND d.status IN ('PENDING', 'DUE_SOON')
             AND d.due_date >= NOW()
         ) AS upcoming_deadlines
       FROM courses c
       INNER JOIN student_courses sc ON sc.course_code = c.course_code
       WHERE sc.student_id = $1::uuid
       ORDER BY c.course_code ASC`,
      [studentUuid]
    );
    return rows.map(normalizeCourseRow);
  }
}

const courseRepository = new CourseRepository();

module.exports = {
  CourseRepository,
  courseRepository,
  normalizeCourseRow,
};
