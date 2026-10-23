// כרטיסי "חוברות שבועיות" (דבר מלכות) למסך הלימוד ולמסך היום
import { h, toast, tabIcon, openPage, toggle } from '../ui.js';
import { rerender, ctx, commit } from '../core.js';
import { weeklyBooklets, refreshDm } from './dm.js';
import { timedOn, zmanimFor } from './zm.js';
import { openPdf, downloadPdf } from './native.js';

function afterHavdalah(c, d) {
  if (d.getDay() !== 6 || d.toDateString() !== c.today.toDateString()) return false;
  const tt = timedOn(d, c.loc, c.s);
  const t = tt.havdalah || zmanimFor(d, c.loc, c.s.method, c.s.tzeitMode).tzeit;
  return !!t && c.now >= t;
}
const DL_ICON = '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>';
const dlIcon = (size = 26) => { const e = h('span', { class: 'ico', 'aria-hidden': 'true' }); e.innerHTML = '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + DL_ICON + '</svg>'; return e; };
const HOLIDAY = /^(שבוע|שמחת|אחרון|חג|פסח|שבועות|ראש|יום|סוכות|שמיני|שביעי|ליל)/;
const subTitle = (b) => 'החוברת של ' + b.label + ' · ' + (HOLIDAY.test(b.title) ? '' : 'פרשת ') + b.title;
const read = async (b) => { if ((await openPdf(b.url, b.title)) === 'fail') toast('לא ניתן לפתוח את החוברת'); };
const down = async (b) => { if ((await downloadPdf(b.url, 'דבר מלכות - ' + b.title)) === 'fail') toast('ההורדה נכשלה'); };
const btn = (label, ic, fn) => h('button', { class: 'iconbtn lnk nodrag', 'aria-label': label, onclick: (e) => { e.stopPropagation(); fn(); } }, ic);
const shown = (s) => {
  if (!s.bkShow) s.bkShow = s.showBooklets ? { 'השבוע': true, 'השבוע שעבר': true, 'השבוע הבא': true } : {};
  return s.bkShow;
};
let refreshing = false;
// picker = דף "תוספות": לכל חוברת מתג "להציג במסך היום"; בלי picker (מסך היום): רק החוברות שנבחרו
export function bookletsSection(c, d, picker) {
  if (!refreshing) { refreshing = true; refreshDm().then((added) => { refreshing = false; if (added) rerender(); }).catch(() => { refreshing = false; }); }
  const sh = shown(c.s);
  let list = weeklyBooklets(d, !!c.loc.il, afterHavdalah(c, d));
  if (!picker) list = list.filter((b) => sh[b.label]);
  if (!list.length) return null;
  return h('div', null,
    picker ? null : h('div', { class: 'section-title' }, 'חוברות שבועיות'),
    h('div', { class: 'list' }, list.map((b) => h('div', { class: 'row tap', onclick: () => read(b) },
      h('div', { class: 'grow' }, h('div', { class: 't', style: 'font-size:.98rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, 'חוברת דבר מלכות לקריאה / הורדה'), h('div', { class: 's' }, subTitle(b)),
        picker ? h('div', { class: 'inline', style: 'justify-content:flex-start;gap:10px;margin-top:6px', onclick: (e) => e.stopPropagation() }, h('span', { class: 'muted small' }, 'להציג במסך היום'), toggle(!!sh[b.label], (v) => { sh[b.label] = v; commit(); })) : null),
      btn('קריאה באפליקציה', tabIcon('learn', 26), () => read(b)),
      btn('הורדה לטלפון', dlIcon(), () => down(b))))));
}

// דף "תוספות" (מכפתור בלימוד ומסלולים): בוחרים אילו חוברות להציג במסך היום (הכול כבוי כברירת מחדל)
export function openExtras() {
  openPage('תוספות', () => {
    const c = ctx();
    return h('div', null,
      h('p', { class: 'muted' }, 'חוברות שבועיות של "דבר מלכות": קריאה באפליקציה או הורדה. לכל חוברת אפשר לבחור אם להציג אותה גם במסך היום.'),
      bookletsSection(c, c.today, true));
  });
}
