const fs = require('fs');
const html = fs.readFileSync('scripts/home.html', 'utf8');

const regex = /<div\s+id=['"](tabs_PubTB-divT\d+)['"]/gi;
let m;
const divs = [];
while ((m = regex.exec(html)) !== null) {
  divs.push({ id: m[1], index: m.index });
}
console.log('Divs found:', divs);

divs.forEach((d, i) => {
  const nextIndex = i < divs.length - 1 ? divs[i + 1].index : html.indexOf('</form>', d.index);
  const part = html.slice(d.index, nextIndex !== -1 ? nextIndex : d.index + 20000);
  const count = (part.match(/<div class=['"]tbBox['"]/gi) || []).length;
  console.log(`${d.id}: Length ${part.length}, tbBox count: ${count}`);
});
