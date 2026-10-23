// חוברות שבועיות "דבר מלכות": רשימה מובנית (שנתיים) + רענון מדף הבית כשיש אינטרנט
import { DM_DATA } from './dm-data.js';
import { parseDm } from './dm-parse.js';
import { dkey, addDays, parseKey } from './dates.js';
import { isNative, fetchText } from './native.js';

const BASE = 'https://dvarmalchus.com/';
const LS = 'jewish-app-dm', LS_T = 'jewish-app-dm-t';
let extra = [];
try { extra = JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { extra = []; }

export function allDm() {
  const m = new Map();
  for (const r of DM_DATA.concat(extra)) m.set(r[2], r);
  return [...m.values()].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
}
// רענון בזמן ריצה (עד פעם בשש שעות); מוסיף שבועות חדשים. מחזיר true אם נוספו
export async function refreshDm() {
  try {
    if (Date.now() - Number(localStorage.getItem(LS_T) || 0) < 6 * 3600000) return false;
  } catch (e) { /* */ }
  if (!isNative()) return false;
  const txt = await fetchText(BASE);
  if (!txt) return false;
  const rows = parseDm(txt);
  if (!rows.length) return false;
  const known = new Set(allDm().map((r) => r[2]));
  const fresh = rows.filter((r) => !known.has(r[2]));
  try { localStorage.setItem(LS_T, String(Date.now())); } catch (e) { /* */ }
  if (!fresh.length) return false;
  extra = extra.concat(fresh).slice(-60);
  try { localStorage.setItem(LS, JSON.stringify(extra)); } catch (e) { /* */ }
  return true;
}

// קבוצות לפי תאריך התחלה (בראשית וכד' יש בהן כמה גרסאות), מהחדש לישן
function groups() {
  const g = new Map();
  for (const r of allDm()) { if (!g.has(r[0])) g.set(r[0], []); g.get(r[0]).push(r); }
  return [...g.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}
const pickVariant = (arr, il) => {
  if (arr.length === 1) return arr[0];
  const want = il ? 'בארץ הקודש' : 'בכל העולם';
  return arr.find((r) => r[1].includes(want)) || arr[0];
};
// החוברת של השבוע שמכיל את התאריך d (השבת של אותו שבוע): הקבוצה האחרונה שהתחילה עד השבת
function indexFor(gs, d) {
  const sat = dkey(addDays(d, 6 - d.getDay()));
  return gs.findIndex((x) => x[0] <= sat);
}
// שתי החוברות להצגה. מוצאי שבת (afterHavdalah): "השבוע הבא" ו"השבוע". אחרת: "השבוע" ו"השבוע שעבר".
export function weeklyBooklets(d, il, afterHavdalah) {
  const gs = groups();
  const out = [];
  const add = (idx, label) => { if (idx >= 0 && idx < gs.length) { const r = pickVariant(gs[idx][1], il); out.push({ label, title: r[1], date: r[0], url: BASE + r[2] }); } };
  const cur = indexFor(gs, d);
  if (afterHavdalah) {
    const nx = indexFor(gs, addDays(d, 1));
    if (nx >= 0 && nx !== cur) { add(nx, 'השבוע הבא'); add(cur, 'השבוע'); }
    else { add(cur, 'השבוע'); add(cur + 1, 'השבוע שעבר'); }
  } else { add(cur, 'השבוע'); add(cur + 1, 'השבוע שעבר'); }
  return out;
}
export const bookletName = (b) => 'דבר מלכות: חוברת ' + b.title + ' (' + b.label + ')';
