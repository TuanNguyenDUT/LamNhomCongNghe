/**
 * TEST THỰC TẾ TRỰC TIẾP VỚI CỔNG THÔNG TIN SV.DUT.UDN.VN & REST API MÁY CHỦ
 * - Cào dữ liệu trực tiếp từ https://sv.dut.udn.vn/
 * - Khởi động Backend Server
 * - Bơm tin tức thật vào Ingestion Pipeline
 * - Xuất tệp Calendar .ics thật ra đĩa
 */

const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('../src/server');
const { dutCrawlerService } = require('../src/services/dut-crawler.service');

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

async function runLiveTest() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('======================================================================');
  console.log('🌐 BẮT ĐẦU KIỂM THỬ THỰC TẾ (LIVE TESTING) VỚI CỔNG SV.DUT.UDN.VN');
  console.log('======================================================================');
  console.log(colors.reset);

  // 1. Cào tin tức thực tế từ sv.dut.udn.vn
  console.log(`${colors.yellow}👉 [1/5] Đang kết nối mạng và cào dữ liệu THẬT từ https://sv.dut.udn.vn/...${colors.reset}`);
  const liveNotices = await dutCrawlerService.fetchLiveNotices(5);
  console.log(`${colors.green}✔ Đã cào thành công ${liveNotices.length} thông báo thực tế từ sv.dut.udn.vn:${colors.reset}`);
  liveNotices.forEach((n, idx) => {
    console.log(`   ${idx + 1}. [${n.published_at.slice(0, 10)}] ${n.title}`);
  });

  // 2. Khởi động server
  console.log(`\n${colors.yellow}👉 [2/5] Khởi động Backend Server trên cổng ${PORT}...${colors.reset}`);
  const { server } = createServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`${colors.green}✔ Máy chủ đã sẵn sàng tại ${BASE_URL}${colors.reset}`);

  try {
    // 3. Bơm thông báo thật vào Pipeline
    console.log(`\n${colors.yellow}👉 [3/5] Nạp các bản tin thật qua Ingestion API (/api/v1/notifications/ingest)...${colors.reset}`);
    for (const notice of liveNotices) {
      const res = await fetch(`${BASE_URL}/api/v1/notifications/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notice),
      });
      const data = await res.json();
      const n = data.data;
      console.log(`${colors.green}  ✔ Đã phân loại tin:${colors.reset} "${n.title.slice(0, 50)}..."`);
      console.log(`    ↳ Nguồn: ${n.source_channel} | Điểm: ${n.priority_score} | Mức: ${n.priority} | Tags: ${n.tags.join(', ')}`);
      if (n.deadline_at) {
        console.log(`    ↳ ⏰ Hạn chót phát hiện: ${n.deadline_at}`);
      }
    }

    // 4. Đồng bộ học phần & Kiểm tra bảng tin tổng hợp
    console.log(`\n${colors.yellow}👉 [4/5] Đồng bộ học phần và truy vấn Bảng tin thực tế...${colors.reset}`);
    await fetch(`${BASE_URL}/api/v1/dut/sync-courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_code: '102200001' }),
    });

    const feedRes = await fetch(`${BASE_URL}/api/v1/notifications?limit=10`);
    const feedData = await feedRes.json();
    console.log(`${colors.green}✔ Truy vấn Bảng tin thành công: Có ${feedData.data.total} thông báo được tổng hợp và phân loại.${colors.reset}`);

    // 5. Xuất tệp lịch .ics ra đĩa thật
    console.log(`\n${colors.yellow}👉 [5/5] Xuất tệp lịch iCalendar (.ics) ra đĩa để kiểm tra định dạng...${colors.reset}`);
    const icsRes = await fetch(`${BASE_URL}/api/v1/calendar/export.ics?student_id=102200001`);
    const icsContent = await icsRes.text();
    const icsFilePath = path.join(process.cwd(), 'dut_deadlines_real.ics');
    fs.writeFileSync(icsFilePath, icsContent, 'utf8');
    console.log(`${colors.green}✔ Đã ghi thành công tệp lịch: ${icsFilePath} (${icsContent.split('\n').length} dòng)${colors.reset}`);
    console.log(`   Đoạn trích tệp .ics:\n   -------------------------------------------------`);
    console.log(icsContent.split('\r\n').slice(0, 15).map(l => `   ${l}`).join('\n'));
    console.log(`   -------------------------------------------------`);

    console.log(`\n${colors.bright}${colors.green}======================================================================`);
    console.log('🎉 KIỂM THỬ THỰC TẾ HOÀN TẤT: HỆ THỐNG ĐÃ KẾT NỐI VÀ XỬ LÝ DỮ LIỆU THẬT!');
    console.log('======================================================================\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('ℹ Đã đóng kết nối máy chủ thử nghiệm.');
  }
}

runLiveTest().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

