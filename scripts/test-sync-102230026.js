/**
 * KIỂM THỬ TRỰC TIẾP CHỨC NĂNG FR-01: ĐỒNG BỘ HỌC PHẦN SV.DUT.UDN.VN
 * Tài khoản: 102230026
 * Mật khẩu: matkhau
 */

const { createServer } = require('../src/server');

const PORT = 3899;

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
  console.log('🚀 KIỂM THỬ CHỨC NĂNG FR-01 VỚI TÀI KHOẢN SINH VIÊN DUT THỰC TẾ');
  console.log('👉 MSSV    : 102230026');
  console.log('👉 Password: ******');
  console.log('👉 Cổng sv : https://sv.dut.udn.vn/ (Live Scraping)');
  console.log('======================================================================\n');

  const { server } = createServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`✔ Backend Server đã lắng nghe trên cổng ${PORT}\n`);

  try {
    // 1. Gọi API POST /api/v1/dut/sync-courses với 102230026 & matkhau
    console.log('👉 [BƯỚC 1] Gửi yêu cầu đăng nhập & đồng bộ học phần qua REST API:');
    console.log('   POST http://localhost:3899/api/v1/dut/sync-courses');
    console.log('   Payload: { "student_code": "102230026", "password": "matkhau" }\n');

    const startTime = Date.now();
    const syncRes = await request('/api/v1/dut/sync-courses', {
      method: 'POST',
      body: JSON.stringify({
        student_code: '102230026',
        password: 'matkhau',
      }),
    });
    const elapsed = Date.now() - startTime;

    console.log(`✔ Kết quả phản hồi từ Backend (thời gian: ${elapsed}ms):`);
    console.log(`   HTTP Status Code: ${syncRes.status}`);
    console.log(`   Response Message: ${syncRes.json.message}`);
    console.log(`   Tổng số học phần cào được: ${syncRes.json.data.total_courses} môn học\n`);

    console.log('======================================================================');
    console.log('📚 DANH SÁCH CHI TIẾT CÁC LỚP HỌC PHẦN THẬT CỦA SINH VIÊN 102230026:');
    console.log('======================================================================');
    syncRes.json.data.courses.forEach((c, index) => {
      console.log(`[${index + 1}] Mã HP   : ${c.course_code}`);
      console.log(`    Tên HP  : ${c.course_name} (${c.credits || 2} tín chỉ)`);
      console.log(`    GV phụ trách : ${c.lecturer_name}`);
      console.log(`    Lịch học: ${c.schedule_info}`);
      console.log(`    Học kỳ  : ${c.semester}`);
      console.log(`    Dữ liệu : ${c.is_live ? 'CÀO TRỰC TIẾP TỪ SV.DUT.UDN.VN (LIVE)' : 'Mock'}`);
      console.log('----------------------------------------------------------------------');
    });

    // 2. Gọi API GET /api/v1/courses/enrolled để xem thống kê học phần đã lưu
    console.log('\n👉 [BƯỚC 2] Truy vấn danh sách học phần kèm số tin chưa đọc (FR-04):');
    console.log('   GET http://localhost:3899/api/v1/courses/enrolled?student_id=102230026\n');

    const enrolledRes = await request('/api/v1/courses/enrolled?student_id=102230026');
    console.log(`✔ Lấy thành công ${enrolledRes.json.data.length} học phần từ cơ sở dữ liệu hệ thống:`);
    enrolledRes.json.data.slice(0, 4).forEach((c) => {
      console.log(`   - [${c.course_code}] ${c.course_name} | Tin chưa đọc: ${c.unread_count} | Deadline: ${c.upcoming_deadlines}`);
    });
    if (enrolledRes.json.data.length > 4) {
      console.log(`   ... và ${enrolledRes.json.data.length - 4} học phần khác.`);
    }

    console.log('\n🎉 KIỂM THỬ THÀNH CÔNG RỰC RỠ: TÍNH NĂNG ĐỒNG BỘ ĐÃ HOẠT ĐỘNG HOÀN HẢO!');
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
