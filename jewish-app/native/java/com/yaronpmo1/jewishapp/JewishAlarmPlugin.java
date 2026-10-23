package com.yaronpmo1.jewishapp;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.app.Activity;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

/** גשר בין האפליקציה (JS) לשעון המעורר, ההתראות והווידג'טים של Android. */
@CapacitorPlugin(name = "JewishAlarm")
public class JewishAlarmPlugin extends Plugin {

    private Context ctx() {
        return getContext();
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        try {
            String items = call.getString("items", "[]");
            String done = call.getString("done", "[]");
            JSONArray dones = new JSONArray(done);
            JSONObject d = Store.obj(ctx(), "done");
            for (int i = 0; i < dones.length(); i++) d.put(dones.getString(i), 1);
            Store.p(ctx()).edit().putString("items", items).putString("done", d.toString())
                    .putString("next", call.getString("next", "")).apply();
            Scheduler.channels(ctx());
            Scheduler.scheduleNext(ctx());
            WidgetBase.updateAll(ctx());
            JSObject r = new JSObject();
            r.put("count", new JSONArray(items).length());
            call.resolve(r);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        Store.p(ctx()).edit().putString("items", "[]").putString("snoozes", "[]").apply();
        Scheduler.cancel(ctx());
        call.resolve();
    }

    @PluginMethod
    public void setDone(PluginCall call) {
        Store.markDone(ctx(), call.getString("key", ""), Boolean.TRUE.equals(call.getBoolean("value", true)));
        call.resolve();
    }

    @PluginMethod
    public void takeDone(PluginCall call) {
        JSONArray a = Store.arr(ctx(), "pendingDone");
        Store.p(ctx()).edit().putString("pendingDone", "[]").apply();
        JSObject r = new JSObject();
        r.put("items", a.toString());
        call.resolve(r);
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context c = ctx();
        JSObject r = new JSObject();
        boolean exact = true;
        if (Build.VERSION.SDK_INT >= 31) {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            exact = am.canScheduleExactAlarms();
        }
        boolean notif = NotificationManagerCompat.from(c).areNotificationsEnabled();
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        boolean battery = Build.VERSION.SDK_INT < 23 || pm.isIgnoringBatteryOptimizations(c.getPackageName());
        boolean full = true;
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            full = nm.canUseFullScreenIntent();
        }
        r.put("exact", exact);
        r.put("notif", notif);
        r.put("battery", battery);
        r.put("fullScreen", full);
        r.put("overlay", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c));
        r.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    private void launch(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx().startActivity(i);
        } catch (Exception e) {
            try {
                ctx().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {
            }
        }
    }

    @PluginMethod
    public void requestExact(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31) {
            launch(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + ctx().getPackageName())));
        }
        call.resolve();
    }

    @PluginMethod
    public void openBattery(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 23) {
            launch(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx().getPackageName())));
        }
        call.resolve();
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getActivity() != null) {
            ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4711);
        } else {
            launch(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx().getPackageName()));
        }
        call.resolve();
    }

    @PluginMethod
    public void requestFullScreen(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 34) {
            launch(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + ctx().getPackageName())));
        }
        call.resolve();
    }

    /** טיימר: צלצול חד-פעמי בעוד ms מילישניות (מחליף טיימר קודם) */
    @PluginMethod
    public void startTimer(PluginCall call) {
        try {
            long ms = call.getData().optLong("ms", 0L);
            Store.removeTimers(ctx());
            Store.p(ctx()).edit().putBoolean("timerDismissed", false).apply();
            JSONObject it = new JSONObject();
            it.put("kind", "ring");
            it.put("title", call.getString("title", "הטיימר הסתיים"));
            it.put("text", call.getString("text", ""));
            it.put("snd", call.getString("snd", ""));
            it.put("snooze", 5);
            it.put("snoozeLeft", 3);
            it.put("rep", false);
            it.put("ramp", false);
            it.put("vib", true);
            it.put("timer", true);
            Store.addSnooze(ctx(), it, System.currentTimeMillis() + Math.max(1000L, ms));
            Scheduler.channels(ctx());
            Scheduler.scheduleNext(ctx());
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void timerState(PluginCall call) {
        JSObject r = new JSObject();
        r.put("end", (double) Store.p(ctx()).getLong("timer_end", 0L));
        r.put("dismissed", Store.p(ctx()).getBoolean("timerDismissed", false));
        call.resolve(r);
    }

    @PluginMethod
    public void cancelTimer(PluginCall call) {
        Store.p(ctx()).edit().putLong("timer_end", 0L).apply();
        Store.removeTimers(ctx());
        Scheduler.scheduleNext(ctx());
        call.resolve();
    }

    @PluginMethod
    public void requestOverlay(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 23) {
            launch(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + ctx().getPackageName())));
        }
        call.resolve();
    }

    @PluginMethod
    public void testAlarm(PluginCall call) {
        try {
            String kind = call.getString("kind", "ring");
            JSONObject it = new JSONObject();
            it.put("kind", kind);
            it.put("title", kind.equals("learn") ? "זמן לימוד" : "בדיקת צלצול");
            it.put("text", kind.equals("learn") ? "עכשיו תניא - עדיין לא סומן היום" : "כך ייראה ויישמע הצלצול");
            it.put("snd", call.getString("snd", ""));
            it.put("snooze", 1);
            it.put("rep", false);
            it.put("ramp", true);
            it.put("vib", true);
            if (kind.equals("learn")) {
                it.put("dk", "test");
                it.put("tid", "test");
            }
            Store.addSnooze(ctx(), it, System.currentTimeMillis() + 5000L);
            Scheduler.channels(ctx());
            Scheduler.scheduleNext(ctx());
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    /** בחירת צליל מרשימת הצלילים של המכשיר */
    @PluginMethod
    public void pickSound(PluginCall call) {
        try {
            Intent i = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM | RingtoneManager.TYPE_RINGTONE);
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "בחירת צליל התראה");
            String cur = call.getString("current", "");
            if (cur != null && !cur.isEmpty()) i.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(cur));
            else i.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM));
            startActivityForResult(call, i, "pickSoundResult");
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @ActivityCallback
    private void pickSoundResult(PluginCall call, ActivityResult result) {
        JSObject r = new JSObject();
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            r.put("cancelled", true);
            call.resolve(r);
            return;
        }
        Uri uri = result.getData().getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        String name = "";
        try {
            if (uri != null) name = RingtoneManager.getRingtone(ctx(), uri).getTitle(ctx());
        } catch (Exception ignored) { }
        r.put("uri", uri == null ? "" : uri.toString());
        r.put("name", uri == null ? "" : name);
        call.resolve(r);
    }

    /** פתיחת קישור בדפדפן; אם אין דפדפן במכשיר מחזיר opened=false (בלי לפתוח מסך ריק) */
    @PluginMethod
    public void openUrl(PluginCall call) {
        JSObject r = new JSObject();
        boolean ok = false;
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(call.getString("url", ""))).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (i.resolveActivity(ctx().getPackageManager()) != null) {
                ctx().startActivity(i);
                ok = true;
            } else if (ReaderActivity.allowed(call.getString("url", ""))) {
                ctx().startActivity(new Intent(ctx(), ReaderActivity.class).putExtra("url", call.getString("url", "")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                ok = true;
                r.put("reader", true);
            }
        } catch (Exception ignored) { }
        r.put("opened", ok);
        call.resolve(r);
    }

    /** צליל סימון לימוד (קבצי res/raw, מבוססים על הצליל שבחר המשתמש): kind=one (מסלול אחד: נמוך וחלש יותר, רבע למטה) או all (כל המסלולים: הצליל המקורי, גבוה וחזק יותר). עוצמת מדיה */
    @PluginMethod
    public void playPing(PluginCall call) {
        final boolean all = "all".equals(call.getString("kind", "one"));
        call.resolve();
        try {
            int id = ctx().getResources().getIdentifier(all ? "ja_ping_all" : "ja_ping_one", "raw", ctx().getPackageName());
            android.content.res.AssetFileDescriptor fd = ctx().getResources().openRawResourceFd(id);
            final android.media.MediaPlayer mp = new android.media.MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            mp.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
            fd.close();
            mp.setOnCompletionListener(m -> m.release());
            mp.setOnErrorListener((m, w, e) -> { m.release(); return true; });
            mp.setOnPreparedListener(m -> { m.setVolume(1f, 1f); m.start(); });
            mp.prepareAsync();
        } catch (Exception e) {
            android.util.Log.e("JewishPing", "ping failed", e);
            try {
                new android.media.ToneGenerator(android.media.AudioManager.STREAM_MUSIC, 80).startTone(android.media.ToneGenerator.TONE_PROP_ACK, 200);
            } catch (Exception ignored) { }
        }
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject r = new JSObject();
        r.put("count", Store.all(ctx()).size());
        call.resolve(r);
    }

    @PluginMethod
    public void setWidget(PluginCall call) {
        Store.p(ctx()).edit().putString("w_next", call.getString("next", "")).putString("w_left", call.getString("left", "")).putString("w_dates", call.getString("dates", "[]")).apply();
        WidgetBase.updateAll(ctx());
        call.resolve();
    }

    // ---- חוברות דבר מלכות: משיכת דף הבית, קורא PDF פנימי והורדה ----
    private static boolean dmHost(String url) {
        try {
            Uri u = Uri.parse(url);
            String h = u.getHost() == null ? "" : u.getHost().toLowerCase();
            return "https".equals(u.getScheme()) && (h.equals("dvarmalchus.com") || h.equals("www.dvarmalchus.com"));
        } catch (Exception e) {
            return false;
        }
    }

    /** הורדת טקסט (דף הבית של דבר מלכות) כדי לרענן את רשימת החוברות. מוגבל לאתר דבר מלכות */
    @PluginMethod
    public void fetchText(final PluginCall call) {
        final String url = call.getString("url", "");
        if (!dmHost(url)) { call.reject("host"); return; }
        new Thread(() -> {
            try {
                java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                c.setConnectTimeout(10000);
                c.setReadTimeout(15000);
                c.setRequestProperty("User-Agent", "Mozilla/5.0");
                java.io.InputStream in = c.getInputStream();
                java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0 && bo.size() < 3000000) bo.write(buf, 0, n);
                in.close();
                JSObject r = new JSObject();
                r.put("text", bo.toString("UTF-8"));
                call.resolve(r);
            } catch (Exception e) {
                call.reject("fetch failed");
            }
        }).start();
    }

    /** קורא PDF פנימי (PdfRenderer) */
    @PluginMethod
    public void openPdf(PluginCall call) {
        String url = call.getString("url", "");
        if (!dmHost(url)) { call.reject("host"); return; }
        ctx().startActivity(new Intent(ctx(), PdfReaderActivity.class).putExtra("url", url).putExtra("title", call.getString("title", "")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        call.resolve();
    }

    /** הורדה לתיקיית ההורדות; בסיום מנסה לפתוח באפליקציית PDF אם קיימת */
    @PluginMethod
    public void downloadFile(PluginCall call) {
        String url = call.getString("url", "");
        String name = call.getString("name", "dvar-malchus.pdf");
        if (!dmHost(url)) { call.reject("host"); return; }
        PdfReaderActivity.download(ctx(), url, name);
        call.resolve();
    }
}
