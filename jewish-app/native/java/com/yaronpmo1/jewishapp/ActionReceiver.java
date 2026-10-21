package com.yaronpmo1.jewishapp;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** כפתורי ההתראה: "למדתי" ו"הזכר בעוד שעה". */
public class ActionReceiver extends BroadcastReceiver {
    static final String ACT_LEARNED = "com.yaronpmo1.jewishapp.LEARNED";
    static final String ACT_CANCEL = "com.yaronpmo1.jewishapp.CANCEL";
    static final String ACT_LATER = "com.yaronpmo1.jewishapp.LATER";

    @Override
    public void onReceive(Context c, Intent i) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        int nid = i.getIntExtra("nid", 0);
        if (nid != 0) nm.cancel(nid);
        if (ACT_LEARNED.equals(i.getAction())) {
            String key = i.getStringExtra("key");
            if (key != null) Store.addPendingDone(c, key);
        } else if (ACT_CANCEL.equals(i.getAction())) {
            String id = i.getStringExtra("cancels");
            if (id != null && !id.isEmpty()) Store.cancelItem(c, id);
            if (i.getBooleanExtra("timer", false)) {
                Store.removeTimers(c);
                Store.p(c).edit().putLong("timer_end", 0L).putBoolean("timerDismissed", true).apply();
            }
            Scheduler.scheduleNext(c);
        } else if (ACT_LATER.equals(i.getAction())) {
            try {
                JSONObject it = new JSONObject(i.getStringExtra("item"));
                Store.addSnooze(c, it, System.currentTimeMillis() + 60 * 60000L);
                Scheduler.scheduleNext(c);
            } catch (Exception ignored) {
            }
        }
    }
}
