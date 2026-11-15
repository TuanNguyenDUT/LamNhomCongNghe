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

  // Create some sample deadlines
  await fetch('http://localhost:3000/api/v1/deadlines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: '102200001',
      course_code: 'IT401',
      title: 'Nộp báo cáo giữa kỳ Chuyên đề Công nghệ phần mềm',
      due_date: new Date(Date.now() + 2 * 86400000).toISOString(),
      priority: 'HIGH'
    })
  });

  await fetch('http://localhost:3000/api/v1/deadlines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: '102200001',
      course_code: 'IT402',
      title: 'Đăng ký đề tài Khóa luận tốt nghiệp',
      due_date: new Date(Date.now() + 5 * 86400000).toISOString(),
      priority: 'URGENT'
    })
  });

  console.log('Seed hoàn tất!');
}

seed();

