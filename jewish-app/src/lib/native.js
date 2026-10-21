// גשר ל-Android (תוסף JewishAlarm). בדפדפן רגיל (בדיקות) הכל מדמה.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';
import { buildInstances } from './alarms.js';
import { get } from './store.js';

export const isNative = () => { try { return Capacitor.isNativePlatform(); } catch (e) { return false; } };
const JA = registerPlugin('JewishAlarm');
const safe = async (fn, fb) => { try { return await fn(); } catch (e) { return fb; } };

// התראה מקדימה לטיימר שרץ (נשמר ב-localStorage על ידי מסך הטיימר)
function timerPre() {
  try {
    const t = JSON.parse(localStorage.getItem('jewish-app-timer') || 'null');
    if (t && t.end && t.pre > 0 && t.end - t.pre * 60000 > Date.now() + 1000) return { id: 'TP|' + t.end, t: t.end - t.pre * 60000, kind: 'notify', pre: true, title: 'הטיימר מסתיים בקרוב', text: 'בעוד ' + t.pre + ' דקות' };
  } catch (e) { /* */ }
  return null;
}
let timer = null;
export function syncSoon() { clearTimeout(timer); timer = setTimeout(syncNow, 700); }
export async function syncNow() {
  const st = get();
  const items = buildInstances(st, new Date(), 60, 480, true);
  st.lastPush = Date.now();
  const nextTxt = (items.find((i) => !i.pre) || {}).title || '';
  const tp = timerPre();
  if (tp) { items.push(tp); items.sort((x, y) => x.t - y.t); }
  if (!isNative()) return { count: items.length };
  const done = {};
  for (const k in st.entries) for (const id in st.entries[k]) { const s = st.entries[k][id].s; if (s === 'done' || s === 'late' || s === 'skip') done[k + '|' + id] = 1; }
  return safe(() => JA.schedule({ items: JSON.stringify(items), done: JSON.stringify(Object.keys(done).slice(-400)), next: nextTxt }), null);
}
export const setDone = async (dk, tid, v) => (isNative() ? safe(() => JA.setDone({ key: dk + '|' + tid, value: !!v })) : null);
export const takeDone = async () => (isNative() ? safe(async () => JSON.parse((await JA.takeDone()).items || '[]'), []) : []);
export const status = async () => (isNative() ? safe(() => JA.status(), {}) : { exact: true, notif: true, battery: true, fullScreen: true, overlay: true, sdk: 0, web: true });
export const requestExact = () => isNative() && safe(() => JA.requestExact());
export const openBattery = () => isNative() && safe(() => JA.openBattery());
export const requestNotifications = () => isNative() && safe(() => JA.requestNotifications());
export const requestFullScreen = () => isNative() && safe(() => JA.requestFullScreen());
export const startTimer = async (ms, title, text) => isNative() && safe(() => JA.startTimer({ ms, title, text, snd: get().settings.soundUri || '' }));
export const timerState = async () => (isNative() ? safe(async () => { const r = await JA.timerState(); return { end: Number(r.end) || 0, dismissed: !!r.dismissed }; }, null) : null);
export const cancelTimer = async () => isNative() && safe(() => JA.cancelTimer());
export const requestOverlay = () => isNative() && safe(() => JA.requestOverlay());
export const testAlarm = async (kind) => isNative() && safe(() => JA.testAlarm({ kind, snd: get().settings.soundUri || '' }));
export const getPending = async () => (isNative() ? safe(() => JA.getPending(), { count: 0 }) : { count: 0 });
export const setWidget = async (next, left, dates) => isNative() && safe(() => JA.setWidget({ next, left, dates: JSON.stringify(dates || []) }));

// שיתוף טקסט דרך מערכת ההפעלה; אם אין, העתקה ללוח
export async function shareText(title, text) {
  if (isNative()) {
    const r = await safe(() => Share.share({ title, text, dialogTitle: title }), 'fail');
    if (r !== 'fail') return 'shared';
  }
  return (await copyText(text)) ? 'copied' : 'fail';
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}
// גיבוי לקובץ ואז שיתוף
export async function saveFile(name, text) {
  if (!isNative()) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = name; a.click(); return 'downloaded';
  }
  const w = await safe(() => Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: 'utf8' }), null);
  if (!w) return (await copyText(text)) ? 'copied' : 'fail';
  const sh = await safe(() => Share.share({ title: name, url: w.uri, dialogTitle: name }), 'fail');
  if (sh === 'fail') return (await copyText(text)) ? 'copied' : 'fail';
  return 'shared';
}
// קישור חיצוני; בלי דפדפן - מעתיק ללוח
export async function openLink(url) {
  if (!url) return 'none';
  if (isNative()) {
    const r = await safe(() => Browser.open({ url }), 'fail');
    if (r !== 'fail') return 'opened';
  } else { window.open(url, '_blank'); return 'opened'; }
  return (await copyText(url)) ? 'copied' : 'fail';
}

// בחירת צליל התראה מרשימת הצלילים של המכשיר. מחזיר {uri, name} או {cancelled:true}
export async function pickSound(current) {
  if (!isNative()) return { uri: '', name: 'צליל לדוגמה (בדפדפן אין בחירה אמיתית)' };
  return safe(() => JA.pickSound({ current: current || '' }), null);
}
