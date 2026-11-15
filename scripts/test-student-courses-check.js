const { dutCrawlerService } = require('../src/services/dut-crawler.service');

async function run() {
  const res = await dutCrawlerService.authenticateWithDut('102230026', 'matkhau');
  console.log(`Student: ${res.profile.full_name} (${res.profile.class_name})`);
  console.log(`Total courses: ${res.courses.length}\n`);
  res.courses.forEach((c, i) => {
    console.log(`[${i+1}] ${c.course_code} - ${c.course_name} (${c.lecturer_name})`);
    console.log(`    Lịch: ${c.schedule_info}`);
  });
}

run();
