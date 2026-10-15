(function () {
  'use strict';
  var KEY = 'limud-yomi-v1';
  var DEFAULT_DAILY = [
    { id: 'chumash', name: 'חומש עם רש"י' },
    { id: 'tehilim', name: 'תהילים' },
    { id: 'tanya', name: 'תניא' },
    { id: 'hayom', name: 'היום יום' },
    { id: 'moshiach', name: 'ענייני משיח וגאולה' }
  ];
  var DEFAULT_WEEKLY = [
    { id: 'sicha', name: 'שיחה שבועית של הרבי' },
    { id: 'maamar', name: 'מאמר שבועי של הרבי' },
    { id: 'zaken', name: 'מאמר שבועי של אדמו"ר הזקן' },
    { id: 'other', name: 'מאמר שבועי של אחד האדמו"רים' }
  ];
  // חלוקת תהילים לפי ימי החודש העברי
  var TEHILIM = ['1-9', '10-17', '18-22', '23-28', '29-34', '35-38', '39-43', '44-48', '49-54', '55-59', '60-65', '66-68', '69-71', '72-76', '77-78', '79-82', '83-87', '88-89', '90-96', '97-103', '104-105', '106-107', '108-112', '113-118', '119 (א-צו)', '119 (צז-קעו)', '120-134', '135-139', '140-144', '145-150'];

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.done) return s;
    } catch (e) {}
    return { done: {}, custom: [], hidden: [] };
  }
  var state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function weekStart(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - x.getDay()); return x; }
  function wkey(d) { return 'w' + dkey(weekStart(d)); }

  function hebParts(d) {
    var o = {};
    new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'numeric', year: 'numeric' })
      .formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  function hebDay(d) { return parseInt(hebParts(d).day, 10); }

  function tehilimToday(d) {
    var day = hebDay(d);
    var next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    var shortMonth = hebDay(next) === 1 && day === 29;
    if (day === 30) return TEHILIM[29];
    if (shortMonth) return '140-150';
    return TEHILIM[day - 1];
  }

  function gem(n) {
    var o = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'], t = ['', 'י', 'כ', 'ל'];
    if (n === 15) return 'ט"ו';
    if (n === 16) return 'ט"ז';
    var s = t[Math.floor(n / 10)] + o[n % 10];
    return s.length > 1 ? s.slice(0, -1) + '"' + s.slice(-1) : s + "'";
  }

  function gemYear(y) {
    var n = y % 1000, h = ['', 'ק', 'ר', 'ש', 'ת'], s = '';
    while (n >= 400) { s += 'ת'; n -= 400; }
    s += h[Math.floor(n / 100)]; n %= 100;
    if (n === 15) s += 'טו'; else if (n === 16) s += 'טז';
    else { s += ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'][Math.floor(n / 10)] + ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'][n % 10]; }
    return s.slice(0, -1) + '"' + s.slice(-1);
  }

  // שקיעה: מיקום וזמני שקיעה נשמרים במכשיר; בלי מיקום או בלי אינטרנט - חצות לועזית
  var LKEY = 'limud-loc-v1';
  var loc = (function () { try { return JSON.parse(localStorage.getItem(LKEY)) || {}; } catch (e) { return {}; } })();
  function saveLoc() { try { localStorage.setItem(LKEY, JSON.stringify(loc)); } catch (e) {} }
  function sunTime(k) { var s = loc.sun && loc.sun[k]; return s ? new Date(s) : null; }
  function effDate() {
    var n = new Date(), s = sunTime(dkey(n));
    if (s && n >= s) n.setDate(n.getDate() + 1);
    return n;
  }
  function fetchSun() {
    if (loc.lat == null) return;
    var k = dkey(new Date());
    if (loc.sun && loc.sun[k]) return;
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch('https://www.hebcal.com/zmanim?cfg=json&latitude=' + loc.lat + '&longitude=' + loc.lon + '&tzid=' + encodeURIComponent(tz) + '&date=' + k)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.times || !j.times.sunset) return;
        loc.sun = {}; loc.sun[k] = j.times.sunset; saveLoc(); render();
      }).catch(function () {});
  }
  function askLoc() {
    var msg = document.getElementById('locmsg');
    if (!navigator.geolocation) { msg.textContent = 'המכשיר לא תומך במיקום'; return; }
    msg.textContent = 'מאתר מיקום...';
    navigator.geolocation.getCurrentPosition(function (p) {
      loc.lat = Math.round(p.coords.latitude * 1000) / 1000;
      loc.lon = Math.round(p.coords.longitude * 1000) / 1000;
      loc.sun = {}; saveLoc(); msg.textContent = ''; fetchSun();
    }, function () { msg.textContent = 'אין הרשאת מיקום - היום מתחלף בחצות'; }, { timeout: 15000, maximumAge: 3600000 });
  }

  function items(type) {
    var base = type === 'daily' ? DEFAULT_DAILY : DEFAULT_WEEKLY;
    return base.concat(state.custom.filter(function (c) { return c.type === type; }));
  }
  function isDone(key, id) { return !!(state.done[key] && state.done[key][id]); }
  function toggle(key, id) {
    state.done[key] = state.done[key] || {};
    if (state.done[key][id]) delete state.done[key][id]; else state.done[key][id] = 1;
    save(); render();
  }

  var pressTimer;
  function row(it, key, note) {
    var li = document.createElement('li');
    if (isDone(key, it.id)) li.className = 'done';
    li.innerHTML = '<span class="box">✓</span><span class="name"></span>';
    var nm = li.querySelector('.name');
    nm.textContent = it.name;
    if (note) { var n = document.createElement('span'); n.className = 'note'; n.textContent = note; nm.appendChild(n); }
    var long = false;
    li.addEventListener('pointerdown', function () {
      long = false;
      if (it.custom) pressTimer = setTimeout(function () {
        long = true;
        if (confirm('למחוק את "' + it.name + '"?')) {
          state.custom = state.custom.filter(function (c) { return c.id !== it.id; });
          save(); render();
        }
      }, 700);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { li.addEventListener(ev, function () { clearTimeout(pressTimer); }); });
    li.addEventListener('click', function () { if (!long) toggle(key, it.id); });
    return li;
  }

  function dayStatus(d) {
    var k = dkey(d), list = items('daily'), n = 0;
    list.forEach(function (it) { if (isDone(k, it.id)) n++; });
    return n === 0 ? 'none' : (n === list.length ? 'full' : 'part');
  }

  function render() {
    var real = new Date(), now = effDate(), dk = dkey(now), wk = wkey(now);
    var hp = {};
    new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(now).forEach(function (p) { hp[p.type] = p.value; });
    document.getElementById('heb').textContent = hp.weekday + ', ' + gem(parseInt(hp.day, 10)) + ' ' + hp.month + ' ' + gemYear(parseInt(hp.year, 10));
    var ss = sunTime(dkey(real));
    document.getElementById('greg').textContent = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(real) +
      (ss ? ' · שקיעה ' + pad(ss.getHours()) + ':' + pad(ss.getMinutes()) : '');
    document.getElementById('locbtn').textContent = loc.lat == null ? 'הפעלת מעבר יום בשקיעה (מיקום)' : 'עדכון מיקום';

    var dl = document.getElementById('daily'); dl.innerHTML = '';
    var dd = 0, dlist = items('daily');
    dlist.forEach(function (it) {
      if (isDone(dk, it.id)) dd++;
      dl.appendChild(row(it, dk, it.id === 'tehilim' ? 'פרקים ' + tehilimToday(now) : null));
    });
    document.getElementById('dcount').textContent = '(' + dd + '/' + dlist.length + ')';

    var wl = document.getElementById('weekly'); wl.innerHTML = '';
    var wd = 0, wlist = items('weekly');
    wlist.forEach(function (it) { if (isDone(wk, it.id)) wd++; wl.appendChild(row(it, wk)); });
    document.getElementById('wcount').textContent = '(' + wd + '/' + wlist.length + ')';

    // רצף ימים: ימים רצופים שבהם הכול בוצע (היום לא שובר רצף אם עדיין לא הושלם)
    var streak = 0, d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dayStatus(d) !== 'full') d.setDate(d.getDate() - 1);
    while (dayStatus(d) === 'full' && streak < 3650) { streak++; d.setDate(d.getDate() - 1); }
    document.getElementById('streak').textContent = streak ? 'רצף: ' + streak + (streak === 1 ? ' יום' : ' ימים') : '';

    var h = document.getElementById('hist'); h.innerHTML = '';
    for (var i = 29; i >= 0; i--) {
      var x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      var b = document.createElement('i');
      b.className = 'd ' + dayStatus(x);
      b.title = dkey(x);
      h.appendChild(b);
    }
  }

  document.getElementById('add').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('newname').value.trim();
    if (!name) return;
    state.custom.push({ id: 'c' + Date.now(), name: name, type: document.getElementById('newtype').value, custom: true });
    document.getElementById('newname').value = '';
    save(); render();
  });

  // עדכון אוטומטי כשהיום משתנה בזמן שהאפליקציה פתוחה
  var shown = dkey(effDate());
  function tick() { fetchSun(); if (dkey(effDate()) !== shown) { shown = dkey(effDate()); render(); } }
  setInterval(tick, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { tick(); render(); } });
  document.getElementById('locbtn').addEventListener('click', askLoc);

  render();
  fetchSun();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
