// שמירת נתונים מקומית (localStorage). הכל בטלפון בלבד.
const KEY = 'jewish-app-v1';

export const PALETTES = {
  gold: ['זהב', '#C99A2E'], blue: ['כחול', '#2F6FB5'], green: ['ירוק', '#2E8B57'],
  purple: ['סגול', '#7B4FB0'], red: ['בורדו', '#A83A48'], teal: ['טורקיז', '#1F8A8A'],
};
export const TAB_COLORS = { today: '#C99A2E', learn: '#2E8B57', times: '#2F6FB5', journal: '#7B4FB0' };

export function defaults() {
  return {
    v: 1,
    first: true,
    settings: {
      theme: 'auto', palette: 'gold', fontScale: 1, density: 'normal', contrast: false, tabColors: false, corners: 'round',
      countLate: true, lateWindow: 14, partMorning: 12, partAfternoon: 18, partEvening: 24,
      loc: { mode: 'city', cityId: 'jerusalem', lat: 0, lon: 0, name: '', tz: '' },
      method: 'baal', tzeitMode: 'method', dayChange: 'sunset', candleMins: 0,
      sound: 'alarm', soundUri: '', soundName: '', ramp: true, vibrate: true, snoozeMin: 9, repeatUntilOff: false, quiet: false, quietFrom: '23:00', quietTo: '05:00',
      vacation: false, chabadDates: true, chabadList: null, milestones: true,
      auto: { roshChodesh: true, erevShabbat: true, candles: true, omer: false },
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

export function load() {
  const base = defaults();
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) state = merge(base, JSON.parse(raw));
    else state = base;
  } catch (e) { state = base; }
  return state;
}
export const get = () => state || load();
export function save() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* מלא */ }
  subs.forEach((f) => { try { f(); } catch (e) { /* */ } });
}
export const onChange = (f) => subs.push(f);
export function replaceAll(obj) { state = merge(defaults(), obj); first(false); }
function first(v) { state.first = v; save(); }
export const exportJson = () => JSON.stringify(get());
export function reset() { state = defaults(); state.first = true; save(); }
export const uid = (p = 'x') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
