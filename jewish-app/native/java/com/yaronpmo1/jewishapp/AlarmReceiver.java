package com.yaronpmo1.jewishapp;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.util.List;

/** מקבל את הגעת זמן ההתראה: מצלצל, מתריע, או מדלג (תזכורת לימוד שכבר סומנה). */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        Scheduler.channels(c);
        long now = System.currentTimeMillis();
        long last = Store.p(c).getLong("lastProc", 0);
        long maxT = last;
        JSONObject ring = null;
        List<JSONObject> all = Store.all(c);
        for (JSONObject it : all) {
            long t = it.optLong("t");
            if (t <= last || t > now + 2000 || now - t > 10 * 60000L) continue;
            if (t > maxT) maxT = t;
            if (Store.isDone(c, it)) continue;
            String kind = it.optString("kind", "notify");
            if (kind.equals("ring")) ring = it;
            else notify(c, it, kind.equals("learn"));
        }
        Store.p(c).edit().putLong("lastProc", maxT).apply();
        if (ring != null) {
            Intent s = new Intent(c, AlarmService.class).setAction(AlarmService.ACT_START).putExtra("item", ring.toString());
            try {
                if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(s);
                else c.startService(s);
            } catch (Exception e) {
                notify(c, ring, false);
            }
        }
        Scheduler.scheduleNext(c);
    }

    static int nid(JSONObject it) {
        return (int) (it.optLong("t") % 1000000) + 100;
    }

    static void notify(Context c, JSONObject it, boolean learn) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        int id = nid(it);
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent openPi = PendingIntent.getActivity(c, id, open, fl);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, learn ? Scheduler.CH_LEARN : Scheduler.CH_INFO)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(it.optString("title"))
                .setContentText(it.optString("text"))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(it.optString("text")))
                .setContentIntent(openPi)
                .setAutoCancel(true)
                .setPriority(learn ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        // התראה מקדימה (פינג): נעלמת מהוילון ברגע שההתראה עצמה מגיעה
        long until = it.optLong("until", 0L);
        if (until > 0) b.setTimeoutAfter(Math.max(1000L, until - System.currentTimeMillis()));
        if (it.optBoolean("pre", false) && (!it.optString("cancels").isEmpty() || it.optBoolean("timer", false))) {
            Intent cancel = new Intent(c, ActionReceiver.class).setAction(ActionReceiver.ACT_CANCEL)
                    .putExtra("cancels", it.optString("cancels")).putExtra("timer", it.optBoolean("timer", false)).putExtra("nid", id);
            b.addAction(0, it.optBoolean("timer", false) ? "בטל את הטיימר" : "בטל את התזכורת", PendingIntent.getBroadcast(c, id + 3, cancel, fl));
        }
        if (learn && !it.optString("tid").isEmpty()) {
            Intent done = new Intent(c, ActionReceiver.class).setAction(ActionReceiver.ACT_LEARNED)
                    .putExtra("key", it.optString("dk") + "|" + it.optString("tid")).putExtra("nid", id);
            Intent later = new Intent(c, ActionReceiver.class).setAction(ActionReceiver.ACT_LATER)
                    .putExtra("item", it.toString()).putExtra("nid", id);
            b.addAction(0, "למדתי", PendingIntent.getBroadcast(c, id + 1, done, fl));
            b.addAction(0, "הזכר בעוד שעה", PendingIntent.getBroadcast(c, id + 2, later, fl));
        }
        try {
            nm.notify(id, b.build());
        } catch (SecurityException ignored) {
        }
    }
}
