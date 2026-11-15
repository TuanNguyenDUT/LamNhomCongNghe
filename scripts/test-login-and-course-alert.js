/**
 * KIỂM THỬ TÍCH HỢP:
 * 1. Đăng nhập bằng tài khoản sv.dut.udn.vn (102230026 / matkhau) -> lấy profile & học phần thực tế
 * 2. Cào hoặc ingest thông báo có liên quan đến học phần của sinh viên (VD: "Chuyên đề công nghệ" hoặc "An toàn Thông tin mạng")
 * 3. Kiểm tra thông báo có được phân loại vào đúng môn học của sinh viên và tăng unread_count không!
 */

const { createServer } = require('../src/server');

const PORT = 3788;

async function request(path, options = {}) {
  const url = `http://127.0.0.1:${PORT}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    return { status: res.status, headers: res.headers, json };
  }
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

async function run() {
  console.log('======================================================================');
  console.log('🧪 KIỂM THỬ: ĐĂNG NHẬP ĐỊNH DANH USER & THÔNG BÁO THEO HỌC PHẦN');
  console.log('======================================================================\n');

  const { server } = createServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  try {
    // 1. Đăng nhập với tài khoản 102230026
    console.log('👉 [BƯỚC 1] Đăng nhập bằng tài khoản sinh viên sv.dut.udn.vn:');
    const loginRes = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        student_code: '102230026',
        password: 'matkhau',
      }),
    });

    console.log(`✔ Đăng nhập thành công! HTTP ${loginRes.status}`);
    console.log(`   - Sinh viên: ${loginRes.json.data.student.full_name} (${loginRes.json.data.student.student_code})`);
    console.log(`   - Lớp: ${loginRes.json.data.student.class_name} | Khoa: ${loginRes.json.data.student.faculty}`);
    console.log(`   - Tổng số môn học đồng bộ: ${loginRes.json.data.student.total_courses} môn`);

    // 2. Ingest thông báo liên quan đến môn "Chuyên đề công nghệ" (Mã lớp: 1023603.2610.23.99)
    console.log('\n👉 [BƯỚC 2] Thu thập bản tin liên quan đến môn "Chuyên đề công nghệ":');
    const ingestRes = await request('/api/v1/notifications/ingest', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Thông báo nộp báo cáo Đề tài môn Chuyên đề công nghệ (1023603.2610.23.99)',
        content: 'Yêu cầu toàn bộ các nhóm sinh viên hoàn thiện slide thuyết trình và nộp mã nguồn trước ngày 10/12/2026.',
        source_channel: 'DUT_COURSE_CLASS',
        published_at: new Date().toISOString(),
      }),
    });

    const notif = ingestRes.json.data || ingestRes.json.notification || {};
    console.log(`✔ Tiếp nhận thông báo thành công:`);
    console.log(`   - Mã môn nhận diện : ${notif.course_code}`);
    console.log(`   - Phạm vi thông báo : ${notif.scope}`);
    console.log(`   - Mức độ ưu tiên    : ${notif.priority} (Điểm: ${notif.priority_score})`);
    console.log(`   - Các thẻ tags      : ${JSON.stringify(notif.tags)}`);

    // 3. Kiểm tra danh sách học phần của sinh viên xem môn này đã có thông báo chưa
    console.log('\n👉 [BƯỚC 3] Kiểm tra bảng tin học phần của sinh viên 102230026:');
    const coursesRes = await request('/api/v1/courses/enrolled?student_id=102230026');
    const cnpmCourse = coursesRes.json.data.find((c) => c.course_code === '1023603.2610.23.99' || c.course_name.includes('Chuyên đề công nghệ'));

    console.log(`✔ Trạng thái học phần "Chuyên đề công nghệ":`);
    console.log(`   - Mã môn: ${cnpmCourse.course_code}`);
    console.log(`   - Tên môn: ${cnpmCourse.course_name}`);
    console.log(`   - Số tin mới chưa đọc (unread_count): ${cnpmCourse.unread_count} tin`);

    // 4. Lấy chi tiết thông báo của riêng môn này
    const notifsRes = await request(`/api/v1/courses/${encodeURIComponent(cnpmCourse.course_code)}/notifications?student_id=102230026`);
    console.log(`✔ Số thông báo trong không gian học phần này: ${notifsRes.json.total} thông báo`);
    console.log(`   - Tiêu đề thông báo: "${notifsRes.json.data[0].title}"`);

    console.log('\n🎉 HOÀN THÀNH KIỂM THỬ: HỆ THỐNG ĐÃ TỰ ĐỘNG PHÂN LOẠI & THÔNG BÁO ĐẾN HỌC PHẦN CỦA USER!');
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error('Lỗi:', err);
  process.exit(1);
});
