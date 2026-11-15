const https = require('node:https');

function fetchTab(tabIndex, page = 1) {
  return new Promise((resolve, reject) => {
    const isTeacher = tabIndex === 2;
    const eParam = isTeacher ? 'CTRTBGV' : 'CTRTBSV';
    const path = `/WebAjax/evLopHP_Load.aspx?E=${eParam}&PAGETB=${page}&COL=1&NAME=&TAB=${tabIndex}`;
    
    const options = {
      hostname: 'sv.dut.udn.vn',
      path,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://sv.dut.udn.vn/',
        'Content-Length': 0,
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function test() {
  const tabs = [
    { index: 0, name: 'Thông báo chung' },
    { index: 1, name: 'Đào tạo' },
    { index: 2, name: 'Lớp học phần' },
    { index: 3, name: 'Công tác SV' },
    { index: 4, name: 'Khảo thí & ĐBCL' },
    { index: 5, name: 'Học phí, lệ phí' },
    { index: 6, name: 'Quy chế - Quy định' }
  ];

  for (const t of tabs) {
    console.log(`\nFetching Tab ${t.index}: ${t.name}...`);
    try {
      const res = await fetchTab(t.index);
      console.log(`Status: ${res.statusCode}, Length: ${res.data.length}`);
      const boxCount = (res.data.match(/<div class=['"]tbBox['"]/gi) || []).length;
      console.log(`tbBox count: ${boxCount}`);
      // Print first notice
      const firstBox = res.data.match(/<div class=['"]tbBox['"]>[\s\S]*?<\/div>\s*<\/div>/i);
      if (firstBox) {
        const text = firstBox[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        console.log(`First notice:`, text.slice(0, 150));
      } else {
        console.log('Sample content:', res.data.slice(0, 200).replace(/\s+/g, ' '));
      }
    } catch (e) {
      console.error(`Error tab ${t.index}:`, e.message);
    }
  }
}

test();
