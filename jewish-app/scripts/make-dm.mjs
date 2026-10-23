// יוצר src/lib/dm-data.js: חוברות "דבר מלכות" משנתיים אחרונות (מדף ההיסטוריה). נכשל בשקט ומשאיר את הקובץ הקיים.
import fs from 'node:fs';
import path from 'node:path';
import { parseDm } from '../src/lib/dm-parse.js';

const file = path.resolve(import.meta.dirname, '../src/lib/dm-data.js');
try {
  const r = await fetch('https://dvarmalchus.com/Download.aspx?History=True', { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const all = parseDm(await r.text());
  try { const h = await fetch('https://dvarmalchus.com/', { headers: { 'user-agent': 'Mozilla/5.0' } }); if (h.ok) all.push(...parseDm(await h.text())); } catch (e) { /* בלי דף הבית */ }
  const from = new Date(Date.now() - 800 * 86400000).toISOString().slice(0, 10);
  const seen = new Set();
  const rows = all.filter((x) => x[0] >= from && !seen.has(x[2]) && seen.add(x[2])).sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
  if (rows.length < 20) throw new Error('too few rows: ' + rows.length);
  fs.writeFileSync(file, '// נוצר אוטומטית ע"י scripts/make-dm.mjs\nexport const DM_DATA = [\n' + rows.map((x) => '  ' + JSON.stringify(x)).join(',\n') + ',\n];\n');
  console.log('dm-data: ' + rows.length + ' rows');
} catch (e) {
  console.log('dm-data not updated: ' + e.message);
  if (!fs.existsSync(file)) fs.writeFileSync(file, 'export const DM_DATA = [];\n');
}
