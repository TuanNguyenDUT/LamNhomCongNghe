const https = require('node:https');
const fs = require('node:fs');

https.get(
  'https://sv.dut.udn.vn/',
  {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  },
  (res) => {
    let html = '';
    res.on('data', (c) => (html += c));
    res.on('end', () => {
      console.log('Status:', res.statusCode, 'Length:', html.length);
      fs.writeFileSync('scripts/home.html', html, 'utf8');

      // Check for keywords from user image
      const keywords = [
        'Xét công nhận tốt nghiệp',
        'cấp bảng điểm',
        'BẢO HIỂM Y TẾ',
        'Cử Nhân',
        'Thông báo chung',
        'Đào tạo',
        'Lớp học phần',
        'Công tác SV',
        'Khảo thí',
        'Học phí',
        'Quy chế',
      ];
      for (const kw of keywords) {
        console.log(`Contains "${kw}":`, html.includes(kw));
      }

      // Find links and tabs
      const lines = html.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.includes('tbBox') ||
          line.includes('tab') ||
          line.includes('BẢO HIỂM') ||
          line.includes('cấp bảng điểm')
        ) {
          console.log(`Line ${i}:`, line.trim().slice(0, 150));
        }
      }
    });
  }
).on('error', console.error);
