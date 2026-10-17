// בונה את src/lib/tanya-data.js מ-data/tanya-raw.txt (לוח התניא היומי של חב"ד, נאסף מ-chabad.org ב-18.10.2026)
// מריץ גם בדיקות שלמות: תאריכים רצופים, סדר עולה, ואותה תבנית טקסט.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const lines = fs.readFileSync(path.join(root, 'data/tanya-raw.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);

const BOOKS = { 'Likutei Amarim': 'L', 'Shaar Hayichud Vehaemunah': 'S', 'Igeret HaTeshuva': 'T', 'Iggeret HaKodesh': 'K', 'Kuntres Acharon': 'A' };
const SPECIAL = { "Title Page and Approbations": ['x1', -30], "Approbations (cont'd)": ['x2', -20], 'Introduction': ['x3', 2] };
const entries = {};
const rank = {};
const errors = [];
for (const line of lines) {
  const [date, rest] = line.split('|');
  const m = /^([^,]+), (.+)$/.exec(rest);
  if (!m || !BOOKS[m[1]]) { errors.push('book? ' + line); continue; }
  const b = BOOKS[m[1]];
  let t = m[2], pos = 'w', n = 0, code, rk;
  const pm = /^(beginning|middle|end) of (.+)$/.exec(t);
  if (pm) { pos = { beginning: 'b', middle: 'm', end: 'e' }[pm[1]]; t = pm[2]; }
  const rp = { b: 1, m: 2, w: 2, e: 3 }[pos];
  if (SPECIAL[t]) { code = b + '|' + SPECIAL[t][0] + '|' + pos; rk = SPECIAL[t][1]; }
  else if (t === "Compiler's Foreword") { code = b + '|x4|' + pos; rk = rp; }
  else {
    const nm = /^(Chapter|Epistle|Essay) (\d+)$/.exec(t);
    if (!nm) { errors.push('text? ' + line); continue; }
    n = Number(nm[2]); code = b + '|' + n + '|' + pos; rk = n * 10 + rp;
  }
  if (entries[date]) errors.push('dup ' + date);
  entries[date] = code; rank[date] = { b, rk };
}
// רצף תאריכים ללא חורים, וסדר לא יורד (חוץ מתחילת מחזור חדש)
const dates = Object.keys(entries).sort();
const keyD = (d) => new Date(d + 'T12:00:00');
const order = { L: 0, S: 1, T: 2, K: 3, A: 4 };
const sorted = dates.filter((d) => d >= '2026-10-16');
let wraps = 0;
for (let i = 1; i < sorted.length; i++) {
  const gap = Math.round((keyD(sorted[i]) - keyD(sorted[i - 1])) / 86400000);
  if (gap !== 1) errors.push('gap before ' + sorted[i] + ' (' + gap + ')');
  const a = rank[sorted[i - 1]], c = rank[sorted[i]];
  const ao = order[a.b] * 1000 + a.rk, co = order[c.b] * 1000 + c.rk;
  if (co < ao) { if (a.b === 'A' && c.b === 'L') wraps++; else errors.push('order ' + sorted[i - 1] + ' -> ' + sorted[i] + ': ' + entries[sorted[i - 1]] + ' -> ' + entries[sorted[i]]); }
}
console.log('days', sorted.length, 'first', sorted[0], 'last', sorted[sorted.length - 1], 'cycle wraps', wraps);
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
const out = '// נוצר אוטומטית מ-scripts/make-tanya.mjs. אל תערוך ידנית.\n// תאריך -> "ספר|מספר|מקום" (b תחילת, m אמצע, e סוף, w שלם). מקור: לוח התניא היומי של chabad.org\nexport const TANYA_DAYS = ' + JSON.stringify(Object.fromEntries(sorted.map((d) => [d, entries[d]]))) + ';\nexport const TANYA_LAST = ' + JSON.stringify(sorted[sorted.length - 1]) + ';\n';
fs.writeFileSync(path.join(root, 'src/lib/tanya-data.js'), out);
console.log('written', (out.length / 1024).toFixed(1) + 'KB');
