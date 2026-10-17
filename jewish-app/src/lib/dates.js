// כלי תאריכים: מפתח יום (YYYY-MM-DD מקומי), חישובי שבוע, ותצוגה עברית
import { HDate } from '@hebcal/core';

export const pad = (n) => (n < 10 ? '0' : '') + n;
export const dkey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); };
export const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0); return x; };
export const sameDay = (a, b) => dkey(a) === dkey(b);
export const weekStart = (d) => addDays(d, -d.getDay());
export const hd = (d) => new HDate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12));

const NIKUD = /[֑-ׇ]/g;
export const stripNikud = (s) => (s || '').replace(NIKUD, '');

// "ד׳ חשוון תשפ״ז"
// השנה עם ה׳ בתחילתה: "התשפ״ז"
const withHe = (s) => s.replace(/(\S+)$/, (y) => (y.startsWith('ה') ? y : 'ה' + y));
const fixM = (s) => s.replace(/(^|\s)חשון(?=\s|$)/, '$1מרחשון');
export const hebrewDate = (d) => withHe(fixM(stripNikud(hd(d).renderGematriya())));
// אות היום בחודש העברי: "ז׳"
export const hebrewDayLetter = (d) => stripNikud(hd(d).renderGematriya()).split(' ')[0];
// מספר לאותיות עבריות: 26 -> כ״ו
export function gematria(n) {
  const L = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']];
  let s = '', x = n;
  if (x === 15) return 'ט״ו';
  if (x === 16) return 'ט״ז';
  for (const [v, l] of L) while (x >= v) { s += l; x -= v; }
  return s.length > 1 ? s.slice(0, -1) + '״' + s.slice(-1) : s + '׳';
}
// עוגן החודש העברי (היום הראשון שלו) לפי היסט חודשים מהחודש של d
export function hebrewMonthAnchor(d, off) {
  const h0 = hd(d);
  let a = new HDate(1, h0.getMonth(), h0.getFullYear());
  for (let i = 0; i < Math.abs(off); i++) {
    if (off > 0) a = a.add(a.daysInMonth(), 'd');
    else { const p = a.add(-1, 'd'); a = new HDate(1, p.getMonth(), p.getFullYear()); }
  }
  return a.greg();
}
// 1 בתשרי של השנה העברית הנוכחית (מפתח יום)
export const tishreiKey = (d = new Date()) => dkey(new HDate(1, 7, new HDate(d).getFullYear()).greg());
export const hebrewDayMonth = (d) => { const h = hd(d); return fixM(stripNikud(h.renderGematriya().replace(/\s\S+$/, ''))); };

export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const WD_LETTER = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
export const weekdayName = (d) => 'יום ' + WEEKDAYS[d.getDay()];
export const gregDate = (d) => d.getDate() + ' ב' + ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'][d.getMonth()] + ' ' + d.getFullYear();

export const hhmm = (d, tz) => {
  if (!d) return '--:--';
  const f = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || undefined });
  return f.format(d);
};

// עיגול לדקה הקרובה
export const roundMin = (d) => (d ? new Date(Math.round(d.getTime() / 60000) * 60000) : null);

export const hebrewMonthYear = (d) => hebrewDate(d).split(' ').slice(1).join(' ');
// ימי החודש העברי של חודש שמכיל את d: מחזיר רשימת תאריכים לועזיים
export const hebrewMonthDays = (d) => {
  const h = hd(d);
  const first = new HDate(1, h.getMonth(), h.getFullYear());
  const n = first.daysInMonth();
  const out = [];
  for (let i = 0; i < n; i++) out.push(first.add(i, 'd').greg());
  return out;
};
