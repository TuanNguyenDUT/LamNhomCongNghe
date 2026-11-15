const https = require('node:https');
const querystring = require('node:querystring');

function getLoginPage() {
  return new Promise((resolve, reject) => {
    https.get('https://sv.dut.udn.vn/PageDangNhap.aspx', (res) => {
      let data = '';
      const cookies = res.headers['set-cookie'] || [];
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ html: data, cookies }));
    }).on('error', reject);
  });
}

async function tryLogin(acc, pass) {
  console.log(`[1] Đang tải trang đăng nhập https://sv.dut.udn.vn/PageDangNhap.aspx...`);
  const { html, cookies } = await getLoginPage();

  const vsMatch = html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const vsgMatch = html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

  const viewstate = vsMatch ? vsMatch[1] : '';
  const viewstateGenerator = vsgMatch ? vsgMatch[1] : '';
  const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');

  console.log(`[2] ViewState length: ${viewstate.length}, Cookie: ${cookieHeader}`);

  const postData = querystring.stringify({
    '__VIEWSTATE': viewstate,
    '__VIEWSTATEGENERATOR': viewstateGenerator,
    '_ctl0:MainContent:DN_txtAcc': acc,
    '_ctl0:MainContent:DN_txtPass': pass,
    '_ctl0:MainContent:QLTH_btnLogin': 'Đăng nhập',
  });

  console.log(`[3] Đang gửi POST đăng nhập tài khoản "${acc}"...`);

  return new Promise((resolve, reject) => {
    const req = https.request('https://sv.dut.udn.vn/PageDangNhap.aspx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://sv.dut.udn.vn/PageDangNhap.aspx',
      },
    }, (res) => {
      let resData = '';
      const newCookies = res.headers['set-cookie'] || [];
      res.on('data', (c) => { resData += c; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          cookies: [...cookies, ...newCookies],
          html: resData,
        });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const acc = process.argv[2] || '102230026';
  const pass = process.argv[3] || 'matkhau';

  try {
    const res = await tryLogin(acc, pass);
    console.log(`\n=== KẾT QUẢ ĐĂNG NHẬP ===`);
    console.log(`HTTP Status:`, res.statusCode);
    console.log(`Redirect Location:`, res.headers.location || 'None');
    console.log(`Set-Cookie:`, res.headers['set-cookie'] || []);

    // Tìm kiếm các thông báo lỗi nếu có
    const scriptAlert = res.html.match(/alert\((['"])(.*?)\1\)/);
    if (scriptAlert) {
      console.log(`Popup Alert từ server DUT:`, scriptAlert[2]);
    }

    const spanMsg = res.html.match(/<span[^>]*id="[^"]*(lbl|error|msg)[^"]*"[^>]*>(.*?)<\/span>/i);
    if (spanMsg) {
      console.log(`Thông báo span:`, spanMsg[2]);
    }

    // Kiểm tra xem có text "Đăng xuất" hoặc tên sinh viên không
    const logoutMatch = res.html.match(/Đăng xuất|Logout|Xin chào|Họ và tên/i);
    console.log(`Trạng thái phiên đăng nhập:`, logoutMatch ? `Thành công (${logoutMatch[0]})` : 'Không có dấu hiệu đăng nhập thành công');

    // Nếu có redirect hoặc đăng nhập thành công, in ra một đoạn HTML
    if (res.statusCode === 302 || logoutMatch) {
      console.log(`Đăng nhập thành công!`);
    } else {
      console.log(`Trang phản hồi độ dài: ${res.html.length} bytes`);
      // Trích xuất các thẻ span hoặc div trong MainContent
      const mainContentMatch = res.html.match(/<div[^>]*id="MainContent[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (mainContentMatch) {
        console.log(`Nội dung MainContent:\n`, mainContentMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      }
    }
  } catch (err) {
    console.error('Lỗi khi thực hiện:', err.message);
  }
}

main();
