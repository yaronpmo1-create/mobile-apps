// כפתור קישור לטקסט של אותו יום, בכל מסלול שיש לו מקור
import { h, toast, tabIcon } from '../ui.js';
import { learnInfo } from './tracks.js';
import { openLink } from './native.js';

export function linkBtn(st, track, date) {
  const url = learnInfo(track, date, st).url;
  if (!url) return null;
  return h('button', {
    class: 'iconbtn lnk nodrag', 'aria-label': 'פתיחת הטקסט של היום',
    onclick: async (e) => { e.stopPropagation(); const r = await openLink(url); if (r === 'copied') toast('אין דפדפן במכשיר - הקישור הועתק ללוח'); else if (r === 'fail') toast('לא ניתן לפתוח את הקישור'); },
  }, tabIcon('learn', 26));
}
