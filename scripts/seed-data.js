const { dutCrawlerService } = require('../src/services/dut-crawler.service');

async function seed() {
  const liveNotices = await dutCrawlerService.fetchLiveNotices(5);
  console.log('Cào được', liveNotices.length, 'thông báo');
  for (const n of liveNotices) {
    const res = await fetch('http://localhost:3000/api/v1/notifications/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n),
    });
    const d = await res.json();
    console.log('Ingested:', d.status, n.title);
  }

  console.log('Thu thập thông báo thật hoàn tất! (Tuân thủ GEMINI.md: Không tạo mock deadlines giả)');
}

seed();

