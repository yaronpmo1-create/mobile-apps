// בונה את src/lib/tanya-data.js מ-data/tanya-sefaria.txt (לוח התניא היומי: הפסקה שבה מתחיל הלימוד בכל יום, מקור: Sefaria, נאסף 18.10.2026).
// כל שורה: תאריך|ref (למשל "Tanya, Part IV; Iggeret HaKodesh 26:20"). הפלט: תאריך -> "ספר|פרק|פסקה".
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const lines = fs.readFileSync(path.join(root, 'data/tanya-sefaria.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const BOOKS = [['Likkutei Amarim', 'L'], ['Shaar HaYichud', 'S'], ['Iggeret HaTeshuvah', 'T'], ['Iggeret HaKodesh', 'K'], ['Kuntres Acharon', 'A']];
const SPECIAL = [['Title Page', 'x1'], ['Approbation', 'x2'], ["Compiler's Foreword", 'x4'], ['Introduction', 'x3'], ['Chinukh Katan', 'x5']];
const entries = {}, errors = [];
for (const line of lines) {
  const [date, ref] = line.split('|');
  if (!ref || /^(ERR|NONE)$/.test(ref)) { errors.push('missing ' + date); continue; }
  const body = ref.replace(/^Tanya, Part [IV]+; /, '');
  const m = /^(.*?)(?:, ([A-Za-z' ]+?))? (\d+)(?::(\d+))?(?:-.*)?$/.exec(body);
  const bk = BOOKS.find(([k]) => body.startsWith(k));
  if (!m || !bk) { errors.push('format ' + line); continue; }
  const sp = SPECIAL.find(([k]) => body.includes(', ' + k));
  let code;
  if (sp) code = bk[1] + '|' + sp[1] + '|' + (m[4] || m[3]);
  else if (m[4]) code = bk[1] + '|' + m[3] + '|' + m[4];
  else { errors.push('nopara ' + line); continue; }
  entries[date] = code;
}
const sorted = Object.keys(entries).sort();
const keyD = (d) => new Date(d + 'T12:00:00');
for (let i = 1; i < sorted.length; i++) if (Math.round((keyD(sorted[i]) - keyD(sorted[i - 1])) / 86400000) !== 1) errors.push('gap before ' + sorted[i]);
console.log('days', sorted.length, 'first', sorted[0], 'last', sorted[sorted.length - 1]);
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
const out = '// נוצר אוטומטית מ-scripts/make-tanya.mjs. אל תערוך ידנית.\n// תאריך -> "ספר|פרק|פסקה" (פסקה = הפסקה שבה מתחיל הלימוד היומי). מקור: לוח התניא היומי של Sefaria\nexport const TANYA_DAYS = ' + JSON.stringify(Object.fromEntries(sorted.map((d) => [d, entries[d]]))) + ';\nexport const TANYA_LAST = ' + JSON.stringify(sorted[sorted.length - 1]) + ';\n';
fs.writeFileSync(path.join(root, 'src/lib/tanya-data.js'), out);
console.log('written', (out.length / 1024).toFixed(1) + 'KB');
