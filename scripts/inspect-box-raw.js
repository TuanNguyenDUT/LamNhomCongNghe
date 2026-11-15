const https = require('node:https');

const req = https.request({
  hostname: 'sv.dut.udn.vn',
  path: '/WebAjax/evLopHP_Load.aspx?E=CTRTBSV&PAGETB=1&COL=1&NAME=&TAB=0',
  method: 'POST',
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://sv.dut.udn.vn/',
    'Content-Length': 0
  }
}, (res) => {
  let d = '';
  res.on('data', (c) => (d += c));
  res.on('end', () => {
    const parts = d.split("<div class='tbBox'>");
    for (let i = 1; i <= Math.min(3, parts.length - 1); i++) {
      console.log(`\n=================== BOX ${i} RAW ===================`);
      console.log(parts[i]);
    }
  });
});
req.end();
