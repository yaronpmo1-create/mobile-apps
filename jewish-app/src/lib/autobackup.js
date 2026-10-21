// גיבוי אוטומטי שבועי: עותק בתיקיית האפליקציה בטלפון, ושלושה עותקים אחרונים לשחזור מהיר מתוך האפליקציה.
// בנוסף, אנדרואיד מגבה את נתוני האפליקציה לחשבון גוגל (allowBackup) ומשחזר אותם במכשיר חדש.
import { Filesystem, Directory } from '@capacitor/filesystem';
import { get, save, exportJson } from './store.js';
import { isNative } from './native.js';

const LS = 'jewish-app-autobak';
const WEEK = 7 * 86400000;
const stamp = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

export function listBackups() {
  try { return JSON.parse(localStorage.getItem(LS) || '[]').slice().reverse(); } catch (e) { return []; }
}
export async function backupNow() {
  const text = exportJson(), now = Date.now();
  let ok = false;
  try {
    if (text.length < 700000) {
      const list = JSON.parse(localStorage.getItem(LS) || '[]');
      list.push({ t: now, d: text });
      localStorage.setItem(LS, JSON.stringify(list.slice(-3)));
      ok = true;
    }
  } catch (e) { /* אין מקום: ממשיכים לקובץ */ }
  if (isNative()) {
    try {
      await Filesystem.writeFile({ path: 'backups/jewish-app-backup-' + stamp(now) + '.json', data: text, directory: Directory.External, encoding: 'utf8', recursive: true });
      ok = true;
    } catch (e) { /* */ }
  }
  if (ok) { get().settings.lastAutoBackup = now; save(); }
  return ok;
}
export async function autoBackupIfDue() {
  const s = get().settings;
  if (s.autoBackup === false) return false;
  if (Date.now() - (s.lastAutoBackup || 0) < WEEK) return false;
  return backupNow();
}
export const backupStamp = stamp;
