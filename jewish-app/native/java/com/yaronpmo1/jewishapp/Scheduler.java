package com.yaronpmo1.jewishapp;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

import java.util.List;

/** תזמון ההתראה הבאה עם שעון מעורר מדויק (AlarmManager.setAlarmClock). */
public class Scheduler {
    static final String CH_RING = "ja_ring2";
    static final String CH_LEARN = "ja_learn2";
    static final String CH_INFO = "ja_info2";

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        // ערוצים ישנים (עם נקודת התראה על סמל האפליקציה) נמחקים; החדשים בלי סימון על הסמל
        for (String old : new String[]{"ja_ring", "ja_learn", "ja_info"}) nm.deleteNotificationChannel(old);
        NotificationChannel ring = new NotificationChannel(CH_RING, "צלצול", NotificationManager.IMPORTANCE_HIGH);
        ring.setSound(null, null);
        ring.enableVibration(false);
        ring.setShowBadge(false);
        ring.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ring);
        NotificationChannel learn = new NotificationChannel(CH_LEARN, "תזכורות לימוד", NotificationManager.IMPORTANCE_HIGH);
        learn.setShowBadge(false);
        nm.createNotificationChannel(learn);
        NotificationChannel info = new NotificationChannel(CH_INFO, "תזכורות והתראות", NotificationManager.IMPORTANCE_DEFAULT);
        info.setShowBadge(false);
        nm.createNotificationChannel(info);
    }

    static PendingIntent firePi(Context c) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction("com.yaronpmo1.jewishapp.FIRE");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(c, 1, i, flags);
    }

    static void scheduleNext(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        long now = System.currentTimeMillis();
        long last = Store.p(c).getLong("lastProc", 0);
        long best = Long.MAX_VALUE;
        List<JSONObject> all = Store.all(c);
        for (JSONObject o : all) {
            long t = o.optLong("t");
            if (t > last && t > now - 120000L && t < best) best = t;
        }
        PendingIntent pi = firePi(c);
        am.cancel(pi);
        if (best == Long.MAX_VALUE) return;
        long at = Math.max(best, now + 1000);
        try {
            Intent show = new Intent(c, MainActivity.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent showPi = PendingIntent.getActivity(c, 2, show, flags);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showPi), pi);
        } catch (SecurityException e) {
            // אין הרשאה לשעון מעורר מדויק: הקרוב ביותר שאפשר
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    static void cancel(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.cancel(firePi(c));
    }
}
