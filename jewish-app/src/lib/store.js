// שמירת נתונים מקומית (localStorage). הכל בטלפון בלבד.
import { tishreiKey } from './dates.js';
const KEY = 'jewish-app-v1';

export const PALETTES = {
  gold: ['זהב', '#C99A2E'], blue: ['כחול', '#2F6FB5'], green: ['ירוק', '#2E8B57'],
  purple: ['סגול', '#7B4FB0'], red: ['בורדו', '#A83A48'], teal: ['טורקיז', '#1F8A8A'],
};
export const TAB_COLORS = { today: '#C99A2E', learn: '#2E8B57', times: '#2F6FB5', journal: '#7B4FB0' };

export function defaults() {
  return {
    v: 6,
    first: true,
    settings: {
      theme: 'auto', palette: 'gold', fontScale: 1, density: 'normal', contrast: false, tabColors: false, corners: 'round',
      countLate: true, lateWindow: 14, partMorning: 12, partAfternoon: 18, partEvening: 24,
      loc: { mode: 'city', cityId: 'jerusalem', lat: 0, lon: 0, name: '', tz: '' },
      method: 'baal', tzeitMode: 'method', dayChange: 'midnight', dayChangeTime: '21:00', candleMins: 0,
      sound: 'alarm', soundUri: '', soundName: '', ramp: true, vibrate: true, snoozeMin: 10, repeatUntilOff: false, quiet: false, quietFrom: '23:00', quietTo: '05:00',
      vacation: false, chabadDates: true, chabadList: null, milestones: true,
      auto: { roshChodesh: true, erevShabbat: true, candles: true, omer: true },
      autoTimes: { roshChodesh: '08:00', erevShabbat: '12:00', omer: '21:00' },
      candleBefore: 20,
    },
    tracks: [],
    entries: {},
    notes: {},
    alarms: [],
    special: {},
    vacations: [],
    yahrzeits: [],
    created: Date.now(),
    lastPush: 0,
  };
}

let state = null;
const subs = [];

function merge(d, s) {
  for (const k in s) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) merge(d[k], s[k]);
    else d[k] = s[k];
  }
  return d;
}

// שדרוג נתונים ישנים (גרסה 1 -> 2): עומר דולק, נודניק 10, בלי אבני דרך, ומסלולים מתחילים מתשרי
function migrate(s) {
  if ((s.v || 1) < 2) {
    s.settings.auto.omer = true;
    if (s.settings.snoozeMin === 9) s.settings.snoozeMin = 10;
    const tk = tishreiKey();
    for (const t of s.tracks) if (!t.created || t.created > tk) t.created = tk;
    s.v = 2;
  }
  if (s.v < 3) {
    if (!s.settings.dayChange || s.settings.dayChange === 'sunset') s.settings.dayChange = 'midnight';
    for (const t of s.tracks) {
      if (t.name === 'תהילים (חודשי)') t.name = 'תהילים יומי';
      if (t.name === 'תניא') t.name = 'תניא יומי';
      if (t.tpl === 'tanya' && t.total === 53) t.total = 109;
    }
    s.v = 3;
  }
  if (s.v < 4) {
    for (const t of s.tracks) if (t.tpl === 'tanya') { t.auto = 'tanyaYomi'; t.counter = false; t.total = 0; }
    s.v = 4;
  }
  if (s.v < 5) {
    for (const t of s.tracks) if (t.name === 'מסלול חופשי') t.name = 'מסלול בהתאמה אישית';
    s.v = 5;
  }
  if (s.v < 6) {
    // חת״ת חמישה מסלולים: מוסיפים "משיח וגאולה" למי שיש לו את מסלולי החת״ת. לא נמחק ולא משתנה שום דבר קיים
    const has = (p) => s.tracks.some((t) => t.tpl === p);
    if (has('chumash') && has('tanya') && !has('moshiach')) {
      const base = s.tracks.find((t) => t.tpl === 'tanya');
      s.tracks.push({ id: 't' + Date.now().toString(36) + 'mg', tpl: 'moshiach', name: 'משיח וגאולה', auto: '', counter: false, unit: '', pos: 1, total: 0, step: 1, freq: 'daily', days: [0, 1, 2, 3, 4, 5, 6], weeklyDay: 6, monthlyDay: 1, target: 1, part: 'morning', remind: { mode: 'none', time: '21:00', zman: 'shkiah', rel: 'before', mins: 30, ring: true }, url: '', paused: false, archived: false, order: s.tracks.length, where: '', created: (base && base.created) || tishreiKey() });
    }
    s.v = 6;
  }
  return s;
}
// הגנה על מידע עבר: לפני שדרוג מבנה נתונים נשמר עותק של הנתונים הישנים, ונתונים שלא ניתן לקרוא לא נמחקים אלא נשמרים בצד
const CUR_V = 6;
export function load() {
  const base = defaults();
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { try { localStorage.setItem(KEY + '-unreadable', raw); } catch (e2) { /* */ } }
      if (parsed) {
        const ov = parsed.v || 1;
        if (ov < CUR_V) { try { localStorage.setItem(KEY + '-backup-v' + ov, raw); } catch (e) { /* */ } }
        state = migrate(merge(base, parsed));
      } else state = base;
    } else state = base;
  } catch (e) { state = base; }
  return state;
}
export const get = () => state || load();
export function save() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* מלא */ }
  subs.forEach((f) => { try { f(); } catch (e) { /* */ } });
}
export const onChange = (f) => subs.push(f);
export function replaceAll(obj) { state = migrate(merge(defaults(), obj)); first(false); }
function first(v) { state.first = v; save(); }
export const exportJson = () => JSON.stringify(get());
export function reset() { state = defaults(); state.first = true; save(); }
export const uid = (p = 'x') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
