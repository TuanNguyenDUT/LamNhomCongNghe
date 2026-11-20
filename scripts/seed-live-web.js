const http = require('http');
const { DutCrawlerService } = require('../src/services/dut-crawler.service');

async function seed() {
  const crawler = new DutCrawlerService();
  const notices = await crawler.fetchLiveNotices({ maxItems: 10 });
  console.log(`Đã cào ${notices.length} thông báo thực tế từ sv.dut.udn.vn`);
  
  for (const n of notices) {
    const postData = JSON.stringify({
      source_channel: n.channel || 'DUT_GENERAL',
      title: n.title,
      content: n.content,
      raw_html: n.raw_html || n.content,
      source_url: n.source_url || 'https://sv.dut.udn.vn/'
    });

    await new Promise((resolve, reject) => {
      const req = http.request('http://localhost:3000/api/v1/notifications/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let resData = '';
        res.on('data', chunk => resData += chunk);
        res.on('end', () => resolve(resData));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }
  console.log('✅ Đã nạp thành công các thông báo thực tế vào server Web!');
}

seed().catch(err => console.error('Lỗi nạp dữ liệu:', err));

