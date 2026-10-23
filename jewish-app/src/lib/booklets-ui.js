// כרטיסי "חוברות שבועיות" (דבר מלכות) למסך הלימוד ולמסך היום
import { h, toast, tabIcon } from '../ui.js';
import { rerender } from '../core.js';
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
const subTitle = (b) => (HOLIDAY.test(b.title) ? '' : 'פרשת ') + b.title + ' (' + b.label + ')';
const read = async (b) => { if ((await openPdf(b.url, b.title)) === 'fail') toast('לא ניתן לפתוח את החוברת'); };
const down = async (b) => { if ((await downloadPdf(b.url, 'דבר מלכות - ' + b.title)) === 'fail') toast('ההורדה נכשלה'); };
const btn = (label, ic, fn) => h('button', { class: 'iconbtn lnk nodrag', 'aria-label': label, onclick: (e) => { e.stopPropagation(); fn(); } }, ic);
let refreshing = false;
export function bookletsSection(c, d) {
  if (!refreshing) { refreshing = true; refreshDm().then((added) => { refreshing = false; if (added) rerender(); }).catch(() => { refreshing = false; }); }
  const list = weeklyBooklets(d, !!c.loc.il, afterHavdalah(c, d));
  if (!list.length) return null;
  return h('div', null,
    h('div', { class: 'section-title' }, 'חוברות שבועיות'),
    h('div', { class: 'list' }, list.map((b) => h('div', { class: 'row tap', onclick: () => read(b) },
      h('div', { class: 'grow' }, h('div', { class: 't', style: 'font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, 'חוברת דבר מלכות לקריאה / הורדה'), h('div', { class: 's' }, subTitle(b))),
      btn('קריאה באפליקציה', tabIcon('learn', 26), () => read(b)),
      btn('הורדה לטלפון', dlIcon(), () => down(b))))));
}
