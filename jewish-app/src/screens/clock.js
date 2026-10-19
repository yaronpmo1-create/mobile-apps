import { h, wheel, toast } from '../ui.js';
import { rerender } from '../core.js';
import { hebrewDate, weekdayName, hhmm, pad, dkey } from '../lib/dates.js';
import { nextZman, countdown } from './today.js';
import { buildInstances, instTitle } from '../lib/alarms.js';
import { startTimer, cancelTimer } from '../lib/native.js';

const hms = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return pad(Math.floor(t / 3600)) + ':' + pad(Math.floor(t / 60) % 60) + ':' + pad(t % 60); };
// מרענן אלמנט כל שנייה, ונעצר כשהוא יוצא מהמסך
function every(el, fn) {
  let seen = false, miss = 0;
  const id = setInterval(() => {
    if (el.isConnected) { seen = true; fn(); return; }
    if (seen || ++miss > 5) clearInterval(id);
  }, 1000);
  fn();
}

// ---- שעון ----
export function clockView(c) {
  const root = h('div', null);
  const big = h('div', { class: 'clockbig' });
  every(big, () => { const d = new Date(); big.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); });
  const d = new Date();
  root.appendChild(h('div', { style: 'text-align:center;margin:10px 0 14px' }, big,
    h('div', { class: 'h-date', style: 'margin:6px 0 0' }, weekdayName(d) + ', ' + hebrewDate(d)),
    h('div', { class: 'muted small' }, d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() + ' · ' + c.loc.name)));
  // התראות ותזכורות להיום ולמחר
  let inst = [];
  try { inst = buildInstances(c.st, c.now, 2, 300); } catch (e) { /* */ }
  const todayK = dkey(c.now), tmr = new Date(c.now.getFullYear(), c.now.getMonth(), c.now.getDate() + 1), tmrK = dkey(tmr);
  for (const [title, k] of [['היום', todayK], ['מחר', tmrK]]) {
    const rows = inst.filter((i) => dkey(new Date(i.t)) === k);
    root.appendChild(h('div', { class: 'section-title' }, title));
    root.appendChild(rows.length
      ? h('div', { class: 'list' }, rows.map((i) => h('div', { class: 'row' }, h('div', { class: 'ztime' }, hhmm(new Date(i.t))), h('div', { class: 'grow' }, h('div', { class: 't' }, instTitle(i))))))
      : h('div', { class: 'card empty-note', style: 'padding:12px' }, k === todayK ? 'אין עוד התראות או תזכורות להיום' : 'אין התראות או תזכורות למחר'));
  }
  return root;
}

// ---- בורר משך (טיימר ותזכורת מהירה): גלגלים וקיצורים בשורה אחת ----
const num = (n) => Array.from({ length: n }, (_, i) => [i, pad(i)]);
export function durationPicker(sel, { seconds = true, refresh, chips = [1, 5, 10, 15, 30] }) {
  const box = h('div', null);
  const lbls = seconds ? ['שעות', 'דקות', 'שניות'] : ['שעות', 'דקות'];
  box.appendChild(h('div', { class: 'inline', style: 'text-align:center;margin-top:8px;direction:ltr' }, lbls.map((l) => h('span', { class: 'muted small' }, l))));
  const ws = [wheel(num(24), sel.h, (v) => { sel.h = Number(v); }), wheel(num(60), sel.m, (v) => { sel.m = Number(v); })];
  if (seconds) ws.push(wheel(num(60), sel.s, (v) => { sel.s = Number(v); }));
  box.appendChild(h('div', { class: 'wheels', style: 'direction:ltr;grid-template-columns:' + ws.map(() => '1fr').join(' ') }, ws));
  box.appendChild(h('div', { class: 'chips one', style: 'margin-top:12px' }, chips.map((m) => h('button', { class: 'chip', onclick: () => { sel.h = 0; sel.m = m; sel.s = 0; refresh(); } }, m + ' דק׳'))));
  return box;
}

// ---- טיימר ----
const KEY = 'jewish-app-timer';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const save = (t) => { try { if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY); } catch (e) { /* */ } };
const sel = { h: 0, m: 5, s: 0 };

function begin(ms) {
  save({ total: ms, end: Date.now() + ms });
  startTimer(ms, 'הטיימר הסתיים', hms(ms) + ' עברו');
  rerender();
}

export function timerView() {
  const root = h('div', null);
  let t = load();
  // הטיימר הסתיים (גם אם האפליקציה הייתה סגורה): חוזרים למסך הבחירה, עם הבחירה האחרונה
  if (t && t.end && t.end <= Date.now()) {
    const s = Math.round((t.total || 0) / 1000);
    sel.h = Math.min(23, Math.floor(s / 3600)); sel.m = Math.floor(s / 60) % 60; sel.s = s % 60;
    save(null); t = null;
  }
  const btn = (label, fn, cls = 'btn') => h('button', { class: cls, onclick: fn }, label);
  if (!t) {
    root.appendChild(durationPicker(sel, { refresh: () => rerender() }));
    root.appendChild(btn('התחל', () => { const ms = ((sel.h * 60 + sel.m) * 60 + sel.s) * 1000; if (!ms) { toast('צריך לבחור זמן'); return; } begin(ms); }, 'btn block'));
    root.appendChild(h('p', { class: 'dim small', style: 'text-align:center;margin-top:10px;white-space:nowrap;font-size:.78rem' }, 'בסיום: צלצול עם כפתור כיבוי, גם כשהאפליקציה סגורה'));
    return root;
  }
  const big = h('div', { class: 'clockbig', style: 'text-align:center;margin:14px 0' });
  root.appendChild(big);
  if (t.end) {
    let fired = false;
    every(big, () => {
      const left = t.end - Date.now();
      if (left <= 0) { big.textContent = '00:00:00'; if (!fired) { fired = true; rerender(); } return; }
      big.textContent = hms(left);
    });
    root.appendChild(h('div', { class: 'inline' },
      btn('השהיה', () => { save({ total: t.total, left: t.end - Date.now() }); cancelTimer(); rerender(); }, 'btn sec'),
      btn('ביטול', () => { save(null); cancelTimer(); rerender(); }, 'btn sec')));
  } else {
    big.textContent = hms(t.left);
    root.appendChild(h('p', { class: 'h-sub', style: 'text-align:center' }, 'מושהה'));
    root.appendChild(h('div', { class: 'inline' },
      btn('המשך', () => begin(t.left), 'btn'),
      btn('איפוס', () => { save(null); rerender(); }, 'btn sec')));
  }
  return root;
}
