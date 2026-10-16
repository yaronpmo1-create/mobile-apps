package com.yaronpmo1.jewishapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** אחרי אתחול המכשיר או עדכון האפליקציה: תזמון מחדש. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Scheduler.channels(c);
        Scheduler.scheduleNext(c);
        WidgetBase.updateAll(c);
    }
}
