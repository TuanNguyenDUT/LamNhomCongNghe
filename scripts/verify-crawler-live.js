const http = require('node:http');

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });
}

function httpPost(path, payload = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runVerification() {
  console.log('=== 1. KIỂM TRA TRẠNG THÁI CRAWLER WORKER (GET /api/v1/crawler/status) ===');
  const statusRes = await httpGet('/api/v1/crawler/status');
  console.log('Status code:', statusRes.statusCode);
  console.log('Worker Active:', statusRes.body.data.is_periodic_active);
  console.log('Chu kỳ cào:', statusRes.body.data.interval_minutes, 'phút');
  console.log('Giới hạn thời gian:', statusRes.body.data.months_limit, 'tháng');
  console.log('Lần cào gần nhất:', statusRes.body.data.last_crawl_at);
  console.log('Lần cào tiếp theo:', statusRes.body.data.next_crawl_at);
  console.log('Thống kê lần gần nhất:', statusRes.body.data.last_stats);

  console.log('\n=== 2. KIỂM TRA DANH SÁCH THÔNG BÁO THỰC TẾ (GET /api/v1/notifications?limit=5) ===');
  const feedRes = await httpGet('/api/v1/notifications?limit=5');
  console.log('Total notifications:', feedRes.body.data.total);
  feedRes.body.data.notifications.slice(0, 5).forEach((n, i) => {
    console.log(`\n[${i+1}] ${n.published_at.slice(0, 10)} | ${n.title.slice(0, 70)}...`);
    console.log(`    Nguồn kênh: ${n.source_channel} (${n.source_name})`);
    console.log(`    URL nguồn : ${n.source_url}`);
    console.log(`    Độ ưu tiên: ${n.priority} (Điểm: ${n.priority_score}) | Phân loại: ${n.classified_by}`);
    if (n.attachments && n.attachments.length > 0) {
      console.log(`    Đính kèm  :`, n.attachments);
    }
  });

  console.log('\n=== 3. KIỂM TRA CHỐNG TRÙNG LẶP: KÍCH HOẠT CÀO LẠI (POST /api/v1/crawler/trigger) ===');
  const triggerRes = await httpPost('/api/v1/crawler/trigger');
  console.log('Trigger code:', triggerRes.statusCode);
  console.log('Message:', triggerRes.body.message);
  console.log('Inserted:', triggerRes.body.data.inserted_count);
  console.log('Duplicates:', triggerRes.body.data.duplicate_count);

  if (triggerRes.body.data.inserted_count === 0 && triggerRes.body.data.duplicate_count > 0) {
    console.log('\n✔ XÁC MINH CHỐNG TRÙNG LẶP HOÀN TOÀN THÀNH CÔNG: 0 bản tin bị trùng lặp!');
  }
}

runVerification().catch(console.error);
