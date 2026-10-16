// כלי ממשק: בניית אלמנטים, שכבות (דפים וחלונות) עם כפתור "חזרה" של אנדרואיד
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);

// ---- שכבות ----
// כל שכבה (דף/חלון) מוסיפה רשומת היסטוריה, כדי שכפתור החזרה של אנדרואיד יסגור אותה
const layers = [];
const pages = [];
let pendingBack = 0;
const queue = [];
export function openLayer(onClose) {
  const L = { onClose, closed: false, pushed: false };
  const go = () => { if (L.closed) return; layers.push(L); L.pushed = true; history.pushState({ n: layers.length }, ''); };
  if (pendingBack > 0) queue.push(go); else go();
  return () => {
    if (L.closed) return;
    L.closed = true;
    if (!L.pushed) { onClose(); return; }
    const i = layers.lastIndexOf(L);
    if (i >= 0) layers.splice(i, 1);
    onClose();
    pendingBack++;
    history.back();
  };
}
window.addEventListener('popstate', () => {
  if (pendingBack > 0) {
    pendingBack--;
    if (pendingBack === 0) queue.splice(0).forEach((f) => f());
    return;
  }
  const L = layers.pop();
  if (L) { L.closed = true; L.onClose(); }
});
export const layerCount = () => layers.length;

// דף מלא עם כותרת וחזרה. build() מחזיר אלמנט, נקרא שוב ב-refresh
export function openPage(title, build, opts = {}) {
  const body = h('div', { class: 'body' });
  const titleEl = h('h2', null, title);
  const head = h('div', { class: 'phead' },
    h('button', { class: 'iconbtn', 'aria-label': 'חזרה', onclick: () => api.close() }, '→'), titleEl,
    (opts.actions || []).map((a) => h('button', { class: 'btn sm', onclick: () => a.fn(api) }, a.label)));
  const el = h('div', { class: 'page' }, head, body);
  document.body.appendChild(el);
  let closeLayer;
  const api = {
    el, body,
    refresh() {
      const sc = body.scrollTop;
      body.replaceChildren(build(api));
      body.scrollTop = sc;
    },
    setTitle(t) { titleEl.textContent = t; },
    close() { closeLayer(); },
  };
  closeLayer = openLayer(() => { el.remove(); const i = pages.indexOf(api); if (i >= 0) pages.splice(i, 1); if (opts.onClose) opts.onClose(); });
  pages.push(api);
  api.refresh();
  return api;
}
export function refreshPages() { pages.slice().forEach((p) => p.refresh()); }
export const hasPages = () => pages.length > 0;

// חלון תחתון
export function openSheet(title, build, onClose) {
  const box = h('div', { class: 'sheet' });
  const ov = h('div', { class: 'overlay', onclick: (e) => { if (e.target === ov) api.close(); } }, box);
  document.body.appendChild(ov);
  let closeLayer;
  const api = {
    close() { closeLayer(); },
    refresh() { box.replaceChildren(title ? h('h3', null, title) : null, build(api)); },
  };
  closeLayer = openLayer(() => { ov.remove(); if (onClose) onClose(); });
  api.refresh();
  return api;
}
// אפשרויות פשוטות: [{label, fn, danger}]
export function actionSheet(title, opts) {
  return openSheet(title, (sh) => h('div', null, opts.filter(Boolean).map((o) => h('button', { class: 'opt', style: o.danger ? 'color:var(--bad)' : '', onclick: () => { sh.close(); setTimeout(o.fn, 30); } }, o.label))));
}
export function confirmBox(msg, okLabel = 'אישור', danger = false) {
  return new Promise((res) => {
    let answered = false;
    const answer = (v, s) => { answered = true; s.close(); setTimeout(() => res(v), 30); };
    openSheet('', (s) => h('div', null,
      h('p', { style: 'font-size:1.1rem;margin:4px 0 16px' }, msg),
      h('div', { class: 'inline' },
        h('button', { class: 'btn sec', onclick: () => answer(false, s) }, 'ביטול'),
        h('button', { class: 'btn' + (danger ? ' danger' : ''), onclick: () => answer(true, s) }, okLabel))),
    () => { if (!answered) res(false); });
  });
}

let toastEl = null, toastT = null;
export function toast(msg, actionLabel, action) {
  if (toastEl) toastEl.remove();
  clearTimeout(toastT);
  toastEl = h('div', { class: 'toast' }, h('span', null, msg), actionLabel ? h('button', { onclick: () => { toastEl.remove(); toastEl = null; action && action(); } }, actionLabel) : null);
  document.body.appendChild(toastEl);
  toastT = setTimeout(() => { if (toastEl) { toastEl.remove(); toastEl = null; } }, actionLabel ? 6000 : 3000);
}

// ---- רכיבים ----
export const toggle = (val, fn) => h('button', { class: 'sw' + (val ? ' on' : ''), role: 'switch', 'aria-checked': String(!!val), onclick: (e) => { e.stopPropagation(); fn(!val); } });
export const seg = (opts, val, fn) => h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { class: v === val ? 'on' : '', onclick: () => fn(v) }, l)));
export const chips = (opts, vals, fn) => h('div', { class: 'chips' }, opts.map(([v, l]) => h('button', { class: 'chip' + (vals.includes(v) ? ' on' : ''), onclick: () => fn(v) }, l)));
export const field = (label, input) => h('div', null, h('label', { class: 'f' }, label), input);
export const sel = (opts, val, fn) => h('select', { onchange: (e) => fn(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(val) }, l)));
export const txt = (val, fn, ph, type = 'text') => h('input', { type, value: val == null ? '' : val, placeholder: ph || '', oninput: (e) => fn(e.target.value) });

// לחיצה קצרה / ארוכה
export function press(el, onTap, onLong) {
  let t = null, fired = false;
  const start = () => { fired = false; t = setTimeout(() => { fired = true; if (navigator.vibrate) try { navigator.vibrate(20); } catch (e) { /* */ } onLong && onLong(); }, 520); };
  const stop = () => clearTimeout(t);
  el.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach((ev) => el.addEventListener(ev, (e) => { if (ev === 'pointermove' && Math.abs(e.movementY) < 2) return; stop(); }));
  el.addEventListener('click', (e) => { if (fired) { e.preventDefault(); fired = false; return; } onTap && onTap(e); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  return el;
}
