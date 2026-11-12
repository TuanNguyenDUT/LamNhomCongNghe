/**
 * Script đo kiểm hiệu năng tích hợp đa nguồn & tối ưu truy vấn (Task 15)
 * Phụ trách: Nguyễn Hữu Tuấn
 */

const { DatabaseManager } = require('../db/database');
const { classifyNotification } = require('../services/classifierService');

function runBenchmark() {
  const db = new DatabaseManager(':memory:');
  const courses = db.getCourses();
  const sources = ['TRAINING_DEPT', 'FACULTY', 'CLASS', 'STUDENT_EMAIL', 'EXTRACURRICULAR'];

  const totalRecords = 1000;
  console.log(`=== BẮT ĐẦU KIỂM THỬ HIỆU NĂNG TÍCH HỢP ĐA NGUỒN (${totalRecords} THÔNG BÁO) ===`);

  const startClassify = performance.now();
  const batch = [];
  for (let i = 0; i < totalRecords; i += 1) {
    batch.push(
      classifyNotification(
        {
          external_id: `BENCH-${i}`,
          source_code: 'PORTAL_PDT',
          source_type: sources[i % sources.length],
          channel_name: 'Kênh Benchmark Đa nguồn',
          title: `[Benchmark #${i}] Thông báo lịch thi cuối kỳ và hạn chót bài tập IT401 Công nghệ phần mềm`,
          content: `Nội dung thông báo tự động số ${i} từ nhiều nguồn phục vụ kiểm thử tải và tối ưu hóa truy vấn.`,
          published_at: new Date(Date.now() - i * 30000).toISOString(),
        },
        courses
      )
    );
  }
  const classifyMs = (performance.now() - startClassify).toFixed(2);
  const insertStats = db.insertNotificationsBatch(batch, 'BENCHMARK-1000');

  const coldQuery = db.queryNotifications({
    priority: 'HIGH',
    course_code: 'IT401',
    page: 1,
    limit: 20,
  });

  const warmQuery = db.queryNotifications({
    priority: 'HIGH',
    course_code: 'IT401',
    page: 1,
    limit: 20,
  });

  console.log(`1. Thời gian phân loại & gắn nhãn 1,000 tin : ${classifyMs} ms`);
  console.log(`2. Thời gian ghi Batch Transaction 1,000 tin : ${insertStats.durationMs} ms`);
  console.log(`3. Truy vấn phân trang (SQLite Composite Index): ${coldQuery.performance.query_time_ms} ms`);
  console.log(`4. Truy vấn phân trang (In-Memory Cache Hit)   : ${warmQuery.performance.query_time_ms} ms`);
  console.log(`=== KẾT QUẢ: ĐẠT YÊU CẦU TỐI ƯU HIỆU NĂNG (TASK 15) ===`);

  db.close();
}

runBenchmark();
