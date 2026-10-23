// לשונית "עוד": קישורים וחיפושים שימושיים, ספר כתובות אישי (אנשי קשר, עסקים, תרומות) ורעיונות להמשך
import { h, openSheet, actionSheet, confirmBox, field, txt, toast } from '../ui.js';
import { ctx, commit } from '../core.js';
import { uid } from '../lib/store.js';
import { openLink } from '../lib/native.js';
import { settingsMain } from './settings.js';

const maps = (q) => 'https://www.google.com/maps/search/' + encodeURIComponent(q);
// קישורי חיפוש (נפתחים בדפדפן או במפות; בלי דפדפן הקישור מועתק ללוח)
const SECTIONS = [
  { id: 'kosher', title: 'כשרות ואוכל', hint: 'מסעדות, חנויות ומאפיות כשרות לידך, והמקומות שאתם ממליצים עליהם',
    links: [['מסעדות כשרות לידי', maps('מסעדות כשרות')], ['מכולות ומרכולים כשרים לידי', maps('מכולת כשרה')], ['מאפיות וקונדיטוריות כשרות', maps('מאפייה כשרה')], ['בתי קפה כשרים', maps('בית קפה כשר')]] },
  { id: 'community', title: 'קהילה ובתי כנסת', hint: 'בית חב״ד, מניין ובית כנסת קרוב, והמקומות הקבועים שלכם',
    links: [['בתי כנסת לידי', maps('בית כנסת')], ['בתי חב״ד לידי', maps('בית חב״ד')], ['מקווה טהרה לידי', maps('מקווה')], ['איתור מרכזי חב״ד בעולם', 'https://www.chabad.org/Centers/']] },
  { id: 'contacts', title: 'אנשי קשר חשובים', hint: 'רב הקהילה, גבאי, חברא קדישא, מוהל, סופר סת״ם, שליח', links: [] },
  { id: 'pros', title: 'אנשי מקצוע ויועצים מומלצים', hint: 'רואה חשבון, עורך דין, יועץ משכנתאות, מורה, רופא ועוד', links: [] },
  { id: 'biz', title: 'עסקים מומלצים', hint: 'בעלי מקצוע ועסקים בכשרות מהודרת, שנבדקו והומלצו', links: [] },
  { id: 'give', title: 'תרומות וצדקה', hint: 'עמותות וגמ״חים שאתם תומכים בהם, וקישורי תרומה', links: [], tool: 'maaser' },
];
const IDEAS = [
  ['מניין עכשיו', 'התראה על מניין שמתארגן באזור (כמו אפליקציית Minyan)'],
  ['אירוח לשבת וחג', 'מי מארח ומי מחפש ארוחה, כמו שבתות בבתי חב״ד'],
  ['לוח מודעות קהילתי', 'מכירה, השאלה, דרושים, שמחות ואבלות'],
  ['גמ״חים', 'רשימת גמ״חים באזור: ציוד, ספרים, ריהוט, כסף'],
  ['דירוג וביקורות', 'דירוג אישי לעסקים כשרים, כמו KosherNearMe'],
  ['אירועי קהילה', 'שיעורים, התוועדויות וכנסים לפי העיר'],
];

const entries = (st) => (Array.isArray(st.more) ? st.more : (st.more = []));

const smallBtn = (label, fn) => h('button', { class: 'btn sm sec', onclick: (e) => { e.stopPropagation(); fn(); } }, label);
async function go(url) {
  const r = await openLink(url);
  if (r === 'copied') toast('אין דפדפן במכשיר - הקישור הועתק ללוח');
  else if (r === 'fail') toast('לא ניתן לפתוח את הקישור');
}

function editEntry(sec, e) {
  const st = ctx().st;
  const d = Object.assign({ id: uid('m'), sec, name: '', phone: '', url: '', note: '' }, e || {});
  openSheet(e ? 'עריכת רשומה' : 'רשומה חדשה', (sh) => h('div', null,
    field('שם', txt(d.name, (v) => (d.name = v))),
    field('טלפון', txt(d.phone, (v) => (d.phone = v), '050-0000000', 'tel')),
    field('קישור (אופציונלי)', txt(d.url, (v) => (d.url = v), 'https://...')),
    field('הערה', txt(d.note, (v) => (d.note = v))),
    h('div', { class: 'inline', style: 'margin-top:14px' },
      h('button', { class: 'btn', onclick: () => {
        if (!d.name.trim()) { toast('צריך שם'); return; }
        const l = entries(st), i = l.findIndex((x) => x.id === d.id);
        if (i >= 0) l[i] = d; else l.push(d);
        sh.close(); commit();
      } }, 'שמירה'),
      h('button', { class: 'btn sec', onclick: () => sh.close() }, 'ביטול'))));
}
function entryRow(st, e) {
  return h('div', { class: 'row tap', onclick: () => actionSheet(e.name, [
    { label: 'עריכה', fn: () => editEntry(e.sec, e) },
    { label: 'מחיקה', danger: true, fn: async () => { if (await confirmBox('למחוק את "' + e.name + '"?', 'מחיקה', true)) { st.more = entries(st).filter((x) => x.id !== e.id); commit(); } } },
  ]) },
    h('div', { class: 'grow' }, h('div', { class: 't' }, e.name), e.note ? h('div', { class: 's' }, e.note) : null, e.phone ? h('div', { class: 's', style: 'direction:ltr;text-align:right' }, e.phone) : null),
    e.phone ? smallBtn('חיוג', () => go('tel:' + e.phone.replace(/[^\d+]/g, ''))) : null,
    e.url ? smallBtn('פתיחה', () => go(e.url)) : null);
}
function maaser() {
  let amt = 0;
  const out = h('div', { class: 'big', style: 'margin:10px 0' }, '');
  const upd = () => { out.textContent = amt > 0 ? 'מעשר (10%): ' + Math.round(amt * 0.1).toLocaleString('he-IL') + ' ₪ · חומש (20%): ' + Math.round(amt * 0.2).toLocaleString('he-IL') + ' ₪' : ''; };
  return h('div', { class: 'card' }, h('div', { class: 't' }, 'מחשבון מעשר כספים'),
    h('div', { class: 's' }, 'הכנסה לחישוב, בשקלים'),
    h('input', { type: 'number', inputmode: 'decimal', placeholder: '0', enterkeyhint: 'done', oninput: (ev) => { amt = Number(ev.target.value) || 0; upd(); } }), out);
}

export function more() {
  const c = ctx(), st = c.st;
  const root = h('div', null);
  root.appendChild(h('div', { class: 'list', style: 'margin-bottom:10px' }, h('div', { class: 'row tap', onclick: () => settingsMain() },
    h('span', { style: 'font-size:1.5rem;color:var(--accent);flex:none' }, '⚙'), h('div', { class: 'grow' }, h('div', { class: 't' }, 'הגדרות'), h('div', { class: 's' }, 'מראה, זמנים, התראות, נתונים וגיבוי')), h('span', { class: 'muted' }, '›'))));
  root.appendChild(h('p', { class: 'h-sub' }, 'מדריך אישי: הרשומות נשמרות בטלפון ובגיבוי. הקישורים נפתחים בדפדפן או במפות.'));
  for (const s of SECTIONS) {
    root.appendChild(h('div', { class: 'section-title' }, s.title));
    root.appendChild(h('p', { class: 'dim small', style: 'margin:0 0 6px' }, s.hint));
    const rows = [];
    s.links.forEach(([l, u]) => rows.push(h('div', { class: 'row tap', onclick: () => go(u) }, h('div', { class: 'grow' }, h('div', { class: 't' }, l)), h('span', { class: 'muted' }, '›'))));
    entries(st).filter((x) => x.sec === s.id).forEach((e) => rows.push(entryRow(st, e)));
    if (rows.length) root.appendChild(h('div', { class: 'list' }, rows));
    if (s.tool === 'maaser') root.appendChild(maaser());
    root.appendChild(h('button', { class: 'btn ghost sm block', style: 'margin-top:6px', onclick: () => editEntry(s.id) }, '+ הוספה ל"' + s.title + '"'));
  }
  root.appendChild(h('div', { class: 'section-title' }, 'רעיונות להמשך'));
  root.appendChild(h('div', { class: 'list' }, IDEAS.map(([t, d]) => h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 't' }, t), h('div', { class: 's' }, d)), h('span', { class: 'tag blue' }, 'בקרוב')))));
  return root;
}
