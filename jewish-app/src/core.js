// מצב משותף למסכים: שמירה, רענון וסנכרון התראות
import { get, save } from './lib/store.js';
import { getLoc, todayKey } from './lib/zm.js';
import { parseKey } from './lib/dates.js';
import { syncSoon } from './lib/native.js';
import { refreshPages } from './ui.js';

let renderBase = () => {};
export const setRender = (f) => { renderBase = f; };

export function ctx() {
  const st = get();
  const now = new Date();
  const tk = todayKey(st.settings, now);
  return { st, s: st.settings, loc: getLoc(st.settings), now, tk, today: parseKey(tk) };
}
// שומר ומרענן הכל
export function commit() {
  save();
  syncSoon();
  renderBase();
  refreshPages();
}
export const rerender = () => renderBase();
// שמירה שקטה בלי רענון (בזמן הקלדה)
export function quietSave() { save(); }

export const nav = { tab: 'today', goTab: null, openLearnEdit: null, openDay: null, openAlarmEdit: null, newAlarm: null, timesView: null };
