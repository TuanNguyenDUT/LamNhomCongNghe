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

function postPage(url, postData, cookieHeader = '') {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://sv.dut.udn.vn/PageDangNhap.aspx',
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

async function findStudentInfo() {
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

  const caNhanRes = await getPage('https://sv.dut.udn.vn/PageCaNhan.aspx', cookieHeader);
  
  // Tìm các ô chứa tên, lớp
  const rows = [...caNhanRes.html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  rows.forEach(r => {
    const text = r[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.includes('Họ và tên') || text.includes('Lớp') || text.includes('Khoa') || text.includes('Ngành') || text.includes('Khóa')) {
      console.log('Row:', text);
    }
  });
}

findStudentInfo().catch(console.error);
