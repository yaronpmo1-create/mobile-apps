package com.yaronpmo1.jewishapp;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/** ווידג'ט ריבועי: התאריך העברי של היום. האפליקציה שולחת מראש רשימת ימים, והווידג'ט מתעדכן אחרי חצות. */
public class DateWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, build(c));
        scheduleMidnight(c);
    }

    @Override
    public void onEnabled(Context c) {
        scheduleMidnight(c);
    }

    static RemoteViews build(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_date);
        String key = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String wd = "", day = "", month = "", year = "";
        try {
            JSONArray a = new JSONArray(Store.p(c).getString("w_dates", "[]"));
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                if (key.equals(o.optString("k"))) {
                    wd = o.optString("wd"); day = o.optString("d"); month = o.optString("m"); year = o.optString("y");
                    break;
                }
            }
        } catch (Exception ignored) { }
        if (day.isEmpty()) { wd = "פתחו את"; day = "·"; month = "האפליקציה"; year = ""; }
        v.setTextViewText(R.id.d_wd, wd);
        v.setTextViewText(R.id.d_day, day);
        v.setTextViewText(R.id.d_month, month);
        v.setTextViewText(R.id.d_year, year);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), fl));
        return v;
    }

    static void scheduleMidnight(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            int[] ids = m.getAppWidgetIds(new ComponentName(c, DateWidget.class));
            Intent i = new Intent(c, DateWidget.class).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(c, 77, i, fl);
            Calendar cal = Calendar.getInstance();
            cal.add(Calendar.DAY_OF_YEAR, 1);
            cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 30); cal.set(Calendar.MILLISECOND, 0);
            am.setAndAllowWhileIdle(AlarmManager.RTC, cal.getTimeInMillis(), pi);
        } catch (Exception ignored) { }
    }
}
