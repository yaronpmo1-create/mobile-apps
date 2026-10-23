// כרטיסי "חוברות שבועיות" (דבר מלכות) למסך הלימוד ולמסך היום
import { h, openSheet, toast } from '../ui.js';
import { rerender } from '../core.js';
import { weeklyBooklets, bookletName, refreshDm } from './dm.js';
import { timedOn, zmanimFor } from './zm.js';
import { openPdf, downloadPdf, copyText } from './native.js';

function afterHavdalah(c, d) {
  if (d.getDay() !== 6 || d.toDateString() !== c.today.toDateString()) return false;
  const tt = timedOn(d, c.loc, c.s);
  const t = tt.havdalah || zmanimFor(d, c.loc, c.s.method, c.s.tzeitMode).tzeit;
  return !!t && c.now >= t;
}
function bookletSheet(b) {
  openSheet(bookletName(b), (sh) => h('div', null,
    h('button', { class: 'opt', onclick: async () => { sh.close(); if ((await openPdf(b.url, b.title)) === 'fail') toast('לא ניתן לפתוח את החוברת'); } }, h('b', null, 'קריאה באפליקציה')),
    h('button', { class: 'opt', onclick: async () => { sh.close(); if ((await downloadPdf(b.url, 'דבר מלכות - ' + b.title)) === 'fail') toast('ההורדה נכשלה'); } }, h('b', null, 'הורדה לטלפון')),
    h('button', { class: 'opt', onclick: async () => { sh.close(); toast((await copyText(b.url)) ? 'הקישור הועתק ללוח' : 'ההעתקה נכשלה'); } }, 'העתקת קישור')));
}
let refreshing = false;
export function bookletsSection(c, d) {
  if (!refreshing) { refreshing = true; refreshDm().then((added) => { refreshing = false; if (added) rerender(); }).catch(() => { refreshing = false; }); }
  const list = weeklyBooklets(d, !!c.loc.il, afterHavdalah(c, d));
  if (!list.length) return null;
  return h('div', null,
    h('div', { class: 'section-title' }, 'חוברות שבועיות'),
    h('div', { class: 'list' }, list.map((b) => h('div', { class: 'row tap', onclick: () => bookletSheet(b) },
      h('div', { class: 'grow' }, h('div', { class: 't' }, bookletName(b)), h('div', { class: 's' }, 'קריאה באפליקציה או הורדה')),
      h('span', { class: 'muted' }, '›')))));
}
