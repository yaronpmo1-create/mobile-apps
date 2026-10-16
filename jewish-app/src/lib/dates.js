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
export const hebrewDate = (d) => stripNikud(hd(d).renderGematriya());
export const hebrewDayMonth = (d) => { const h = hd(d); return stripNikud(h.renderGematriya().replace(/\s\S+$/, '')); };

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
