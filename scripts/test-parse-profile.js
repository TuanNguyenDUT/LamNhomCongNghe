const fs = require('node:fs');
const html = fs.readFileSync('scripts/ca_nhan.html', 'utf8');

function extractInputValue(fieldId) {
  // Find the entire <input ...> tag containing fieldId
  const tagRegex = new RegExp(`<input[^>]*?(?:id|name)=["'][^"']*?${fieldId}["'][^>]*>`, 'i');
  const tagMatch = html.match(tagRegex);
  if (!tagMatch) return '';
  const tag = tagMatch[0];
  const valMatch = tag.match(/value=["']([^"']*)["']/i);
  return valMatch ? valMatch[1].trim() : '';
}

function extractAttr(regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : '';
}

const hoTenRaw = extractInputValue('CN_txtHoTen') || extractAttr(/Chào\s+([^-]+)-/);
// Convert 'NGUYỄN VĂN LỢI' to title case if uppercase, or keep as is
function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const hoTen = toTitleCase(hoTenRaw) || hoTenRaw;
const lop = extractInputValue('CN_txtLop');
const nganh = extractInputValue('CN_txtNganh');
const ctdt = extractInputValue('CN_txtCTDT');
const ngaySinh = extractInputValue('CN_txtNgaySinh');
const gioiTinh = extractInputValue('CN_txtGioiTinh');
const mailTruong = extractInputValue('CN_txtMail1');
const mailCaNhan = extractInputValue('CN_txtMail2');
const phone = extractInputValue('CN_txtPhone');
const avatarUrl = extractAttr(/id=["'](?:MainContent_CaNhan_)?imgAnh["'][^>]*src=["']([^"']+)["']/i);

// Cohort & Faculty
let cohort = 'K23';
if (ctdt.match(/K\s*(\d{2,4})/i)) {
  cohort = ctdt.match(/K\s*(\d{2,4})/i)[0].toUpperCase();
} else if (lop.match(/^(\d{2})/)) {
  cohort = `K${lop.match(/^(\d{2})/)[1]}`;
}

const faculty = nganh.includes('Công nghệ Thông tin')
  ? 'Khoa Công nghệ Thông tin'
  : (nganh ? `Khoa / Ngành ${nganh}` : 'Khoa Công nghệ Thông tin');

console.log('Result:', JSON.stringify({
  hoTenRaw,
  hoTen,
  lop,
  nganh,
  ctdt,
  cohort,
  faculty,
  ngaySinh,
  gioiTinh,
  mailTruong,
  mailCaNhan,
  phone,
  avatarUrl
}, null, 2));
