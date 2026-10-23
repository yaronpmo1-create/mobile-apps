// פענוח דפי "דבר מלכות" (דף הבית וההיסטוריה): [תאריך התחלה ISO, שם, נתיב קובץ]
const MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
export function parseDm(html) {
  const out = [];
  const re = /<a href="(Download\/[^"]+\.pdf)">([^<]*)<\/a><\/td><td[^>]*>\s*([A-Za-z]+) (\d{1,2}), (\d{4})/g;
  let m;
  while ((m = re.exec(html))) {
    const mo = MONTHS[m[3]];
    if (!mo) continue;
    const iso = m[5] + '-' + String(mo).padStart(2, '0') + '-' + String(m[4]).padStart(2, '0');
    out.push([iso, m[2].replace(/&quot;/g, '"').replace(/"/g, '״').replace(/'/g, '׳').trim(), m[1]]);
  }
  return out;
}
