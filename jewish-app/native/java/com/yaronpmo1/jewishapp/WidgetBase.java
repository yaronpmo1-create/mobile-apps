package com.yaronpmo1.jewishapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

/** ווידג'טים: "הזמן הבא" ו"הלימוד שנשאר". הטקסט נשלח מהאפליקציה. */
public class WidgetBase extends AppWidgetProvider {
    protected String key() { return "w_next"; }
    protected String title() { return "הזמן הבא"; }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, build(c));
    }

    RemoteViews build(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_text);
        String t = Store.p(c).getString(key(), "");
        v.setTextViewText(R.id.w_title, title());
        v.setTextViewText(R.id.w_text, t.isEmpty() ? "פתחו את האפליקציה" : t);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), fl);
        v.setOnClickPendingIntent(R.id.w_root, pi);
        return v;
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> k : new Class<?>[]{NextWidget.class, LeftWidget.class, DateWidget.class, DateTallWidget.class}) {
            int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
            if (ids.length == 0) continue;
            if (k == DateWidget.class || k == DateTallWidget.class) { for (int id : ids) m.updateAppWidget(id, DateWidget.build(c, m.getAppWidgetOptions(id), k == DateTallWidget.class)); continue; }
            WidgetBase w = k == NextWidget.class ? new NextWidget() : new LeftWidget();
            for (int id : ids) m.updateAppWidget(id, w.build(c));
        }
    }
}
