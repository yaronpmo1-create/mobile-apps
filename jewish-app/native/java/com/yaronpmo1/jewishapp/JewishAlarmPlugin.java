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
            }
        } catch (Exception ignored) { }
        r.put("opened", ok);
        call.resolve(r);
    }

    /** צליל עדין קצר לסימון לימוד: kind=one (קצר מאוד) או all (מעט מלא יותר, כשכל המשימות הושלמו). קובץ WAV מנוגן ב-MediaPlayer בעוצמת מדיה */
    @PluginMethod
    public void playPing(PluginCall call) {
        final boolean all = "all".equals(call.getString("kind", "one"));
        call.resolve();
        new Thread(() -> {
            try {
                int sr = 22050;
                double[][] notes = all ? new double[][]{{659, 0.30, 0.0}, {880, 0.36, 0.14}, {1319, 0.55, 0.30}} : new double[][]{{988, 0.20, 0.0}};
                double total = all ? 0.90 : 0.26, vol = all ? 0.55 : 0.50;
                short[] buf = new short[(int) (sr * total)];
                for (double[] nt : notes) {
                    int start = (int) (nt[2] * sr), len = (int) (nt[1] * sr);
                    for (int k = 0; k < len && start + k < buf.length; k++) {
                        double t = k / (double) sr;
                        double env = Math.min(1.0, t / 0.01) * Math.exp(-4.0 * t / nt[1]);
                        int v = buf[start + k] + (int) (vol * 32767 * env * Math.sin(2 * Math.PI * nt[0] * t));
                        buf[start + k] = (short) Math.max(-32767, Math.min(32767, v));
                    }
                }
                int n = buf.length * 2;
                java.nio.ByteBuffer bb = java.nio.ByteBuffer.allocate(44 + n).order(java.nio.ByteOrder.LITTLE_ENDIAN);
                bb.put("RIFF".getBytes()).putInt(36 + n).put("WAVEfmt ".getBytes()).putInt(16).putShort((short) 1).putShort((short) 1)
                        .putInt(sr).putInt(sr * 2).putShort((short) 2).putShort((short) 16).put("data".getBytes()).putInt(n);
                for (short x : buf) bb.putShort(x);
                java.io.File f = new java.io.File(ctx().getCacheDir(), "ping_" + (all ? "all" : "one") + ".wav");
                try (java.io.FileOutputStream fo = new java.io.FileOutputStream(f)) { fo.write(bb.array()); }
                final android.media.MediaPlayer mp = new android.media.MediaPlayer();
                mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
                mp.setDataSource(f.getAbsolutePath());
                mp.setOnCompletionListener(m -> m.release());
                mp.setOnErrorListener((m, w, e) -> { m.release(); return true; });
                mp.prepare();
                mp.setVolume(1f, 1f);
                mp.start();
            } catch (Exception e) {
                android.util.Log.e("JewishPing", "ping failed", e);
                try {
                    new android.media.ToneGenerator(android.media.AudioManager.STREAM_MUSIC, 80).startTone(android.media.ToneGenerator.TONE_PROP_ACK, 200);
                } catch (Exception ignored) { }
            }
        }).start();
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
}
