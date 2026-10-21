// בדיקת קישורי הלימוד של כל התבניות: node scripts/check-links.mjs [שנה-חודש-יום]
import { defaults } from '../src/lib/store.js';
import { TEMPLATES, addTemplate, learnInfo } from '../src/lib/tracks.js';
import { parseKey, dkey, addDays } from '../src/lib/dates.js';

const start = parseKey(process.argv[2] || dkey(new Date()));
const st = defaults();
const rows = new Map();
for (const t of TEMPLATES) {
  const tr = addTemplate(st, t.tpl) || st.tracks[st.tracks.length - 1];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    let info; try { info = learnInfo(tr, d, st); } catch (e) { rows.set(t.tpl + i, { name: tr.name, day: dkey(d), err: String(e) }); continue; }
    if (!info.url) { if (i === 0) rows.set(t.tpl + 'none', { name: tr.name, day: dkey(d), none: true }); continue; }
    rows.set(info.url, rows.get(info.url) || { name: tr.name, day: dkey(d), url: info.url, sub: info.sub });
  }
}
const list = [...rows.values()];
for (const r of list) {
  if (!r.url) continue;
  try {
    const res = await fetch(r.url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } });
    r.status = res.status; r.final = res.url;
    const body = res.status === 200 ? (await res.text()).slice(0, 4000) : '';
    r.title = (body.match(/<title>([^<]*)/i) || [])[1];
  } catch (e) { r.status = 'ERR ' + e.message; }
  await new Promise((x) => setTimeout(x, 400));
}
for (const r of list) console.log(JSON.stringify(r));
