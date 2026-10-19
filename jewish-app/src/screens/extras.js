import { flash, pickGregDate, h, openPage, openSheet, confirmBox, seg, field, sel, txt, toggle, toast } from '../ui.js';
import { ctx, commit } from '../core.js';
import { CITIES } from '../lib/cities.js';
import { bearingTo, distanceKm, getLoc, inIsrael } from '../lib/zm.js';
import { startCompass, stopCompass, dirName } from '../lib/compass.js';
import { addTemplate } from '../lib/tracks.js';
import { status, requestExact, requestNotifications, openBattery, requestFullScreen, requestOverlay, testAlarm, syncNow } from '../lib/native.js';
import { replaceAll } from '../lib/store.js';
import { HDate } from '@hebcal/core';
import { uid } from '../lib/store.js';
import { deviceTz } from '../lib/cities.js';

// ---- מצפן לבית המקדש ----
export function openCompass() {
  const c = ctx();
  const loc = getLoc(c.s);
  const bear = bearingTo(loc.lat, loc.lon);
  const dist = Math.round(distanceKm(loc.lat, loc.lon));
  let heading = null, st0 = 'wait';
  openPage('מצפן לבית המקדש', () => {
    const root = h('div', { style: 'text-align:center' });
    root.appendChild(h('p', { class: 'h-sub' }, 'מ' + loc.name + ' לבית המקדש (הר הבית): ' + (dist < 2 ? 'ממש כאן' : dist + ' ק״מ') + ' · כיוון ' + Math.round(bear) + '° (' + dirName(bear) + ')'));
    const dial = h('div', { class: 'dial', id: 'cdial' });
    const needle = h('div', { class: 'needle', id: 'cneedle' });
    const box = h('div', { class: 'compass', id: 'cbox' }, dial, needle, h('div', { class: 'hub' }));
    ['צ', 'מ', 'ד', 'מע'].forEach((l, i) => {
      const t = h('span', { style: 'transform:rotate(' + i * 90 + 'deg) translateX(-50%);' }, '');
      t.textContent = '';
    });
    // תוויות כיוונים סביב המצפן
    [['צפון', 0], ['מזרח', 90], ['דרום', 180], ['מערב', 270]].forEach(([n, a]) => {
      const r = 42;
      const x = 50 + r * Math.sin((a * Math.PI) / 180), y = 50 - r * Math.cos((a * Math.PI) / 180);
      dial.appendChild(h('div', { style: 'position:absolute;left:' + x + '%;top:' + y + '%;transform:translate(-50%,-50%) rotate(' + 0 + 'deg);font-weight:800;font-size:.9rem;color:' + (a === 0 ? 'var(--bad)' : 'var(--muted)') }, n));
    });
    root.appendChild(box);
    const msg = h('p', { id: 'cmsg', class: 'muted' }, 'מחפש חיישן כיוון...');
    root.appendChild(msg);
    root.appendChild(h('p', { class: 'dim small' }, 'האפליקציה לא מחוברת לאינטרנט; המצפן משתמש בחיישן של המכשיר. הכיוון משתנה בהתאם למיקום שהגדרת (' + loc.name + ').'));
    root.appendChild(h('p', { class: 'dim small' }, 'כיול: סובבו את הטלפון בצורת 8 באוויר, והתרחקו ממתכת ומגנטים. החץ הזהב מצביע לכיוון הר הבית; כשהמסגרת ירוקה אתם מכוונים נכון.'));
    root.appendChild(h('p', { class: 'dim small' }, 'אם אין חיישן: פונים לכיוון ' + dirName(bear) + ' (' + Math.round(bear) + '° ממזרח לצפון).'));
    setTimeout(() => {
      startCompass((hd) => {
        heading = hd;
        const rot = bear - hd;
        needle.style.transform = 'rotate(' + rot + 'deg)';
        dial.style.transform = 'rotate(' + -hd + 'deg)';
        const diff = Math.abs(((rot + 540) % 360) - 180);
        box.classList.toggle('aligned', diff < 6);
        msg.textContent = diff < 6 ? 'מכוונים לבית המקדש ✓' : 'כיוון הטלפון: ' + Math.round(hd) + '° (' + dirName(hd) + ')';
      }, (state) => { msg.textContent = state === 'denied' ? 'אין הרשאה לחיישן.' : 'לא נמצא חיישן כיוון במכשיר. השתמשו בכיוון הכתוב מטה.'; });
    }, 50);
    return root;
  }, { onClose: stopCompass });
}

// ---- יארצייטים וימי הולדת ----
const HMONTHS = [[7, 'תשרי'], [8, 'מרחשון'], [9, 'כסלו'], [10, 'טבת'], [11, 'שבט'], [12, 'אדר'], [13, 'אדר ב׳'], [1, 'ניסן'], [2, 'אייר'], [3, 'סיוון'], [4, 'תמוז'], [5, 'אב'], [6, 'אלול']];
export function openYahrzeits() {
  openPage('יארצייטים וימי הולדת עבריים', (pg) => {
    const c = ctx();
    const root = h('div', null);
    root.appendChild(h('button', { class: 'btn block', onclick: () => editYahrzeit() }, '+ הוספה'));
    if (!c.st.yahrzeits.length) root.appendChild(h('p', { class: 'empty-note' }, 'אין רשומות. אפשר להוסיף שם ותאריך עברי עם תזכורת.'));
    root.appendChild(h('div', { class: 'list', style: 'margin-top:10px' }, c.st.yahrzeits.map((y) => h('div', { class: 'row tap', onclick: () => editYahrzeit(y.id) },
      h('div', { class: 'grow' }, h('div', { class: 't' }, y.name), h('div', { class: 's' }, (y.type === 'birthday' ? 'יום הולדת' : 'יארצייט') + ' · ' + y.d + ' ' + (HMONTHS.find((m) => m[0] === y.m) || [0, ''])[1] + (y.remind === false ? ' · בלי תזכורת' : ''))),
      h('button', { class: 'iconbtn', onclick: async (e) => { e.stopPropagation(); if (await confirmBox('למחוק את ' + y.name + '?', 'מחיקה', true)) { c.st.yahrzeits = c.st.yahrzeits.filter((x) => x.id !== y.id); commit(); } } }, '✕')))));
    return root;
  });
}
function editYahrzeit(id) {
  const c = ctx();
  const orig = id ? c.st.yahrzeits.find((y) => y.id === id) : null;
  const hnow = new HDate(c.today);
  const d = JSON.parse(JSON.stringify(orig || { id: uid('y'), name: '', type: 'yahrzeit', m: hnow.getMonth(), d: hnow.getDate(), remind: true, time: '09:00', before: true }));
  let greg = '';
  openPage(orig ? 'עריכה' : 'הוספה', (pg) => {
    const root = h('div', null);
    root.appendChild(seg([['yahrzeit', 'יארצייט'], ['birthday', 'יום הולדת']], d.type, (v) => { d.type = v; pg.refresh(); }));
    root.appendChild(field('שם', txt(d.name, (v) => (d.name = v))));
    root.appendChild(h('div', { class: 'inline' }, field('יום בחודש', txt(d.d, (v) => (d.d = Math.max(1, Math.min(30, Number(v) || 1))), '', 'number')), field('חודש עברי', sel(HMONTHS, d.m, (v) => (d.m = Number(v))))));
    root.appendChild(field('או להמיר מתאריך לועזי', h('button', { class: 'timebtn', type: 'button', onclick: () => pickGregDate(greg, (k) => { const dt = new Date(k + 'T12:00:00'); if (!isNaN(dt)) { const hh = new HDate(dt); d.m = hh.getMonth(); d.d = hh.getDate(); greg = k; pg.refresh(); toast('הומר לתאריך עברי'); } }) }, greg || 'בחירת תאריך לועזי')));
    root.appendChild(h('div', { class: 'list' },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, 'תזכורת'), toggle(d.remind !== false, (v) => { d.remind = v; pg.refresh(); })),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, 'גם ערב קודם (תזכורת יום לפני)'), toggle(!!d.before, (v) => { d.before = v; pg.refresh(); }))));
    root.appendChild(field('שעת התזכורת', txt(d.time, (v) => (d.time = v), '', 'time')));
    root.appendChild(h('button', { class: 'btn block', style: 'margin-top:14px', onclick: () => {
      if (!d.name.trim()) { toast('צריך שם'); return; }
      if (orig) Object.assign(orig, d); else c.st.yahrzeits.push(d);
      pg.close(); commit();
    } }, 'שמירה'));
    return root;
  });
}

// ---- בחירת מיקום ----
export function openLocation(onDone) {
  openPage('מיקום', (pg) => {
    const c = ctx();
    const L = c.s.loc;
    const root = h('div', null);
    root.appendChild(seg([['city', 'עיר מהרשימה'], ['gps', 'מיקום אוטומטי'], ['manual', 'ידני']], L.mode === 'auto' ? 'gps' : L.mode, (v) => { L.mode = v === 'gps' ? 'auto' : v; commit(); }));
    if (L.mode === 'city' || !L.mode) {
      root.appendChild(field('עיר', sel(CITIES.map((x) => [x.id, x.name]), L.cityId, (v) => { L.cityId = v; commit(); })));
      root.appendChild(h('p', { class: 'dim small' }, 'עובד בלי GPS ובלי אינטרנט.'));
    } else if (L.mode === 'auto') {
      root.appendChild(h('button', { class: 'btn block', onclick: () => gps(L, pg) }, 'קבלת מיקום עכשיו'));
      root.appendChild(h('p', { class: 'muted' }, L.lat ? 'נשמר: ' + Number(L.lat).toFixed(3) + ', ' + Number(L.lon).toFixed(3) : 'עוד לא נקבע מיקום.'));
      root.appendChild(h('p', { class: 'dim small' }, 'המיקום נשמר בטלפון ונשאר גם בלי GPS או אינטרנט. אם אין GPS, בחרו עיר או הזינו ידנית.'));
    } else {
      root.appendChild(h('div', { class: 'inline' }, field('קו רוחב', txt(L.lat || '', (v) => (L.lat = Number(v)), '31.77', 'number')), field('קו אורך', txt(L.lon || '', (v) => (L.lon = Number(v)), '35.21', 'number'))));
      root.appendChild(field('שם המקום', txt(L.name || '', (v) => (L.name = v))));
      root.appendChild(h('button', { class: 'btn block', style: 'margin-top:10px', onclick: () => { L.tz = deviceTz(); commit(); toast('נשמר'); } }, 'שמירה'));
    }
    const cur = getLoc(c.s);
    root.appendChild(h('div', { class: 'card', style: 'margin-top:12px' }, h('b', null, 'פעיל כעת: '), cur.name, h('div', { class: 'small muted' }, (cur.il ? 'ארץ ישראל (חג אחד)' : 'חוץ לארץ (שני ימי חג)') + ' · ' + cur.tz)));
    return root;
  }, { onClose: onDone });
}
function gps(L, pg) {
  if (!navigator.geolocation) { toast('אין GPS במכשיר'); return; }
  toast('מחפש מיקום...');
  navigator.geolocation.getCurrentPosition((p) => {
    L.lat = p.coords.latitude; L.lon = p.coords.longitude; L.tz = deviceTz(); L.name = 'מיקום נוכחי';
    commit(); toast('המיקום נקבע');
  }, () => toast('לא הצלחתי לקבל מיקום. בחרו עיר מהרשימה.'), { timeout: 20000, maximumAge: 600000 });
}

// ---- בדיקת תקינות והרשאות ----
export function openHealth() {
  openPage('הרשאות ואמינות', (pg) => {
    const root = h('div', null);
    root.appendChild(h('p', { class: 'h-sub' }, 'כדי שההתראות יצלצלו בדיוק, גם כשהאפליקציה סגורה:'));
    const box = h('div', { class: 'list' });
    root.appendChild(box);
    status().then((s) => {
      const items = [
        ['שעון מעורר מדויק', s.exact, 'מאפשר צלצול בדקה המדויקת', requestExact],
        ['התראות', s.notif, 'חובה כדי לקבל תזכורות', requestNotifications],
        ['פטור מחיסכון בסוללה', s.battery, 'מונע מהמערכת לעכב צלצולים', openBattery],
        ['מסך צלצול מלא על הנעילה', s.fullScreen, 'כך הצלצול נפתח גם כשהמסך נעול', requestFullScreen],
        ['הצגה מעל אפליקציות אחרות', s.overlay !== false, 'כך מסך הצלצול עם כפתור הנודניק הגדול נפתח גם כשאתם משתמשים בטלפון, ולא רק כהתראה בוילון', requestOverlay],
      ];
      items.forEach(([n, okv, why, fn]) => box.appendChild(h('div', { class: 'row' },
        h('div', { class: 'chk' + (okv ? ' on' : ''), style: okv ? '' : 'border-color:var(--bad);color:var(--bad)' }, okv ? '✓' : '!'),
        h('div', { class: 'grow' }, h('div', { class: 't' }, n), h('div', { class: 's' }, okv ? 'תקין' : why)),
        okv ? null : h('button', { class: 'btn sm', onclick: async () => { await fn(); setTimeout(() => pg.refresh(), 1500); } }, 'תיקון'))));
      if (s.web) box.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow s' }, 'בדיקה זו פועלת רק בתוך אפליקציית Android.')));
    });
    root.appendChild(h('div', { class: 'section-title' }, 'בדיקת צלצול'));
    root.appendChild(h('div', { class: 'inline' },
      h('button', { class: 'btn', onclick: (e) => { testAlarm('ring'); flash(e.currentTarget, 'צלצול בעוד 5 שניות...'); toast('אפשר לנעול את המסך'); } }, 'צלצול בעוד 5 שניות'),
      h('button', { class: 'btn sec', onclick: (e) => { testAlarm('learn'); flash(e.currentTarget, 'התראת לימוד בעוד 5 שניות...'); } }, 'בדיקת תזכורת לימוד')));
    root.appendChild(h('button', { class: 'btn ghost block', style: 'margin-top:10px', onclick: async () => { await syncNow(); toast('ההתראות תוזמנו מחדש'); } }, 'תזמון ההתראות מחדש עכשיו'));
    return root;
  });
}

// ---- מסך פתיחה ראשון ----
export function firstRun(done) {
  let step = 0, kit = 'chitas';
  openPage('ברוכים הבאים', (pg) => {
    const c = ctx();
    const root = h('div', null);
    if (step === 0) {
      root.appendChild(h('h2', { style: 'color:var(--accent)' }, 'אפליקציה יהודית'));
      root.appendChild(h('p', null, 'לימוד יומי, יומן והשלמות, זמני היום והתראות, ומצפן לבית המקדש. הכל עובד גם בלי אינטרנט.'));
      root.appendChild(h('label', { class: 'f' }, 'איפה אתם נמצאים? (לחישוב הזמנים)'));
      root.appendChild(sel(CITIES.map((x) => [x.id, x.name]), c.s.loc.cityId, (v) => { c.s.loc.mode = 'city'; c.s.loc.cityId = v; }));
      root.appendChild(h('button', { class: 'btn sec block', style: 'margin-top:10px', onclick: () => gps(c.s.loc, pg) }, 'מיקום אוטומטי (GPS)'));
      root.appendChild(h('p', { class: 'dim small' }, 'אפשר לשנות בכל עת בהגדרות. שיטת החישוב ברירת המחדל: בעל התניא.'));
    } else if (step === 1) {
      root.appendChild(h('h2', null, 'ערכת מסלולים'));
      root.appendChild(seg([['chitas', 'חת״ת'], ['rambam', 'רמב״ם'], ['none', 'להתחיל ריק']], kit, (v) => { kit = v; pg.refresh(); }));
      root.appendChild(h('p', { class: 'muted' }, kit === 'chitas' ? 'חומש עם רש״י, תהילים, תניא והיום יום.' : kit === 'rambam' ? 'מסלול רמב״ם (שלושה פרקים ביום) ודף יומי.' : 'תוכלו להוסיף מסלולים בלשונית "לימוד".'));
    } else {
      root.appendChild(h('h2', null, 'הרשאות להתראות'));
      root.appendChild(h('p', null, 'כדי לצלצל בזמן, נדרשות הרשאות להתראות ולשעון מעורר מדויק. אפשר לדלג ולהגדיר אחר כך ב"הרשאות ואמינות".'));
      root.appendChild(h('button', { class: 'btn block', onclick: async () => { await requestNotifications(); } }, 'אישור התראות'));
      root.appendChild(h('button', { class: 'btn sec block', style: 'margin-top:8px', onclick: () => requestExact() }, 'אישור שעון מעורר מדויק'));
      root.appendChild(h('button', { class: 'btn sec block', style: 'margin-top:8px', onclick: () => openBattery() }, 'פטור מחיסכון בסוללה'));
      root.appendChild(h('button', { class: 'btn sec block', style: 'margin-top:8px', onclick: () => requestOverlay() }, 'הצגה מעל אפליקציות אחרות (מסך צלצול מלא)'));
    }
    root.appendChild(h('div', { class: 'inline', style: 'margin-top:20px' },
      step > 0 ? h('button', { class: 'btn sec', onclick: () => { step--; pg.refresh(); } }, 'הקודם') : null,
      h('button', { class: 'btn', onclick: () => {
        if (step < 2) { step++; pg.refresh(); return; }
        const c2 = ctx();
        if (kit === 'chitas') addTemplate(c2.st, 'chitas');
        else if (kit === 'rambam') { addTemplate(c2.st, 'rambam3'); addTemplate(c2.st, 'dafyomi'); }
        c2.st.first = false;
        done();
        pg.close();
        commit();
      } }, step < 2 ? 'הבא' : 'סיום והתחלה')));
    return root;
  }, { onClose: () => { const c = ctx(); if (c.st.first) { c.st.first = false; commit(); } } });
}
