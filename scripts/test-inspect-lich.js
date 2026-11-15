const https = require('node:https');
const querystring = require('node:querystring');

function getPage(url, cookieHeader = '') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://sv.dut.udn.vn/PageCaNhan.aspx',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        html: data,
      }));
    }).on('error', reject);
  });
}

function postPage(url, postData, cookieHeader = '', referer = '') {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer || url,
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        html: data,
      }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function inspectLichTH() {
  const acc = '102230026';
  const pass = 'matkhau';

  const loginPageRes = await getPage('https://sv.dut.udn.vn/PageDangNhap.aspx');
  const cookieHeader = (loginPageRes.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');

  const vsMatch = loginPageRes.html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const vsgMatch = loginPageRes.html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

  const postData = querystring.stringify({
    '__VIEWSTATE': vsMatch ? vsMatch[1] : '',
    '__VIEWSTATEGENERATOR': vsgMatch ? vsgMatch[1] : '',
    '_ctl0:MainContent:DN_txtAcc': acc,
    '_ctl0:MainContent:DN_txtPass': pass,
    '_ctl0:MainContent:QLTH_btnLogin': 'Đăng nhập',
  });

  await postPage('https://sv.dut.udn.vn/PageDangNhap.aspx', postData, cookieHeader);

  console.log('--- 1. Kiểm tra PageLichTH.aspx ---');
  const lichTHRes = await getPage('https://sv.dut.udn.vn/PageLichTH.aspx', cookieHeader);
  console.log(`PageLichTH status: ${lichTHRes.statusCode}, length: ${lichTHRes.html.length}`);

  // Tìm các bảng trong PageLichTH
  const tables = [...lichTHRes.html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
  console.log(`Số bảng tìm thấy trong PageLichTH: ${tables.length}`);
  tables.forEach((t, idx) => {
    console.log(`\nTable ${idx + 1} preview (200 ký tự đầu):`);
    console.log(t[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300));
  });

  console.log('\n--- 2. Kiểm tra PageKQRLKy.aspx ---');
  const kqRes = await getPage('https://sv.dut.udn.vn/PageKQRLKy.aspx', cookieHeader);
  console.log(`PageKQRLKy status: ${kqRes.statusCode}, length: ${kqRes.html.length}`);
  const kqTables = [...kqRes.html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
  console.log(`Số bảng tìm thấy trong PageKQRLKy: ${kqTables.length}`);
  kqTables.forEach((t, idx) => {
    console.log(`\nTable ${idx + 1} preview:`);
    console.log(t[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300));
  });
}

inspectLichTH().catch(console.error);
