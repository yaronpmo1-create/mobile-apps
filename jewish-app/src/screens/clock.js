import { h, wheel, toast } from '../ui.js';
import { rerender } from '../core.js';
import { hebrewDate, weekdayName, hhmm, pad } from '../lib/dates.js';
import { nextZman, countdown } from './today.js';
import { buildInstances } from '../lib/alarms.js';
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
  const nz = nextZman(c);
  let nextAl = null;
  try { nextAl = buildInstances(c.st, c.now, 3, 40)[0] || null; } catch (e) { /* */ }
  root.appendChild(h('div', { class: 'card mini' }, h('div', { class: 'muted small' }, 'הזמן הבא'),
    h('div', { class: 'big mid' }, nz ? nz.name + ' · ' + hhmm(nz.t, c.loc.tz) : '-'), h('div', { class: 'muted small' }, nz ? 'בעוד ' + countdown(nz.t - c.now) : '')));
  root.appendChild(h('div', { class: 'card mini', style: 'margin-top:8px' }, h('div', { class: 'muted small' }, 'ההתראה הבאה'),
    h('div', { class: 'big mid wrap' }, nextAl ? nextAl.title + ' · ' + hhmm(new Date(nextAl.t)) : 'אין התראה בקרוב'), h('div', { class: 'muted small' }, nextAl ? 'בעוד ' + countdown(nextAl.t - c.now.getTime()) : '')));
  return root;
}

// ---- טיימר ----
const KEY = 'jewish-app-timer';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const save = (t) => { try { if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY); } catch (e) { /* */ } };
const sel = { h: 0, m: 5, s: 0 };
const num = (n) => Array.from({ length: n }, (_, i) => [i, pad(i)]);

function begin(ms) {
  save({ total: ms, end: Date.now() + ms });
  startTimer(ms, 'הטיימר הסתיים', hms(ms) + ' עברו');
  rerender();
}

export function timerView() {
  const root = h('div', null);
  const t = load();
  const btn = (label, fn, cls = 'btn') => h('button', { class: cls, onclick: fn }, label);
  if (!t) {
    root.appendChild(h('div', { class: 'inline', style: 'text-align:center;margin-top:8px;direction:ltr' }, h('span', { class: 'muted small' }, 'שעות'), h('span', { class: 'muted small' }, 'דקות'), h('span', { class: 'muted small' }, 'שניות')));
    root.appendChild(h('div', { class: 'wheels', style: 'direction:ltr;grid-template-columns:1fr 1fr 1fr' },
      wheel(num(24), sel.h, (v) => { sel.h = Number(v); }), wheel(num(60), sel.m, (v) => { sel.m = Number(v); }), wheel(num(60), sel.s, (v) => { sel.s = Number(v); })));
    root.appendChild(h('div', { class: 'chips', style: 'justify-content:center;margin-top:12px' }, [1, 5, 10, 15, 30].map((m) => h('button', { class: 'chip', onclick: () => { sel.h = 0; sel.m = m; sel.s = 0; rerender(); } }, m + ' דק׳'))));
    root.appendChild(btn('התחל', () => { const ms = ((sel.h * 60 + sel.m) * 60 + sel.s) * 1000; if (!ms) { toast('צריך לבחור זמן'); return; } begin(ms); }, 'btn block'));
    root.appendChild(h('p', { class: 'dim small', style: 'text-align:center;margin-top:10px' }, 'בסיום יהיה צלצול מלא עם כפתור כיבוי, גם אם האפליקציה סגורה'));
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
    if (t.end <= Date.now()) {
      big.textContent = '00:00:00';
      root.appendChild(h('p', { class: 'h-sub', style: 'text-align:center' }, 'הטיימר הסתיים'));
      root.appendChild(btn('סגירה', () => { save(null); cancelTimer(); rerender(); }, 'btn block'));
    } else {
      root.appendChild(h('div', { class: 'inline' },
        btn('השהיה', () => { save({ total: t.total, left: t.end - Date.now() }); cancelTimer(); rerender(); }, 'btn sec'),
        btn('ביטול', () => { save(null); cancelTimer(); rerender(); }, 'btn sec')));
    }
  } else {
    big.textContent = hms(t.left);
    root.appendChild(h('p', { class: 'h-sub', style: 'text-align:center' }, 'מושהה'));
    root.appendChild(h('div', { class: 'inline' },
      btn('המשך', () => begin(t.left), 'btn'),
      btn('איפוס', () => { save(null); rerender(); }, 'btn sec')));
  }
  return root;
}
