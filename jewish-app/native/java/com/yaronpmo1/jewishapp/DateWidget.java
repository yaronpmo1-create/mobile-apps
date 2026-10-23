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

/** ווידג'ט 1x1: התאריך העברי של היום. האפליקציה שולחת מראש רשימת ימים, והווידג'ט מתעדכן אחרי חצות. */
public class DateWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        WidgetBase.updateAll(c);
        scheduleNext(c);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, android.os.Bundle opts) {
        m.updateAppWidget(id, build(c, opts));
    }

    @Override
    public void onEnabled(Context c) {
        scheduleNext(c);
    }

    static RemoteViews build(Context c, android.os.Bundle opts) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_date);
        String key = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String wd = "", day = "", month = "", year = "";
        try {
            JSONArray a = new JSONArray(Store.p(c).getString("w_dates", "[]"));
            long now = System.currentTimeMillis(), bestFrom = Long.MIN_VALUE;
            JSONObject best = null;
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                if (o.has("from")) {
                    long f = (long) o.optDouble("from", 0);
                    if (f <= now && f > bestFrom) { bestFrom = f; best = o; }
                } else if (best == null && key.equals(o.optString("k"))) {
                    best = o;
                }
            }
            if (best != null) { wd = best.optString("wd"); day = best.optString("d"); month = best.optString("m"); year = best.optString("y"); }
        } catch (Exception ignored) { }
        if (day.isEmpty()) { wd = "פתחו את"; day = "·"; month = "האפליקציה"; year = ""; }
        // תא 1x1 שממלא את כל גובה התא (לא ריבוע): הכתב נקבע לפי הרוחב, והגובה הנוסף נותן אוויר בין השורות
        boolean portrait = c.getResources().getConfiguration().orientation != android.content.res.Configuration.ORIENTATION_LANDSCAPE;
        float w = opts == null ? 110 : opts.getInt(portrait ? AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH : AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 110);
        float base = Math.max(40f, w);
        v.setViewPadding(R.id.w_root, 0, 0, 0, 0);
        v.setTextViewTextSize(R.id.d_wd, android.util.TypedValue.COMPLEX_UNIT_DIP, Math.max(9f, base * 0.19f));
        v.setTextViewTextSize(R.id.d_day, android.util.TypedValue.COMPLEX_UNIT_DIP, base * 0.46f);
        v.setTextViewTextSize(R.id.d_month, android.util.TypedValue.COMPLEX_UNIT_DIP, Math.max(10f, base * 0.23f));
        v.setTextViewTextSize(R.id.d_year, android.util.TypedValue.COMPLEX_UNIT_DIP, Math.max(8f, base * 0.17f));
        v.setTextViewText(R.id.d_wd, wd);
        v.setTextViewText(R.id.d_day, day);
        v.setTextViewText(R.id.d_month, month);
        v.setTextViewText(R.id.d_year, year);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), fl));
        return v;
    }

    /** מתזמן עדכון ברגע הבא שבו התאריך מתחלף (לפי הרשימה שהאפליקציה שלחה), ולכל היותר בחצות */
    static void scheduleNext(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            int[] a1 = m.getAppWidgetIds(new ComponentName(c, DateWidget.class));
            int[] ids = a1;
            Intent i = new Intent(c, DateWidget.class).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(c, 77, i, fl);
            long now = System.currentTimeMillis();
            Calendar cal = Calendar.getInstance();
            cal.add(Calendar.DAY_OF_YEAR, 1);
            cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 30); cal.set(Calendar.MILLISECOND, 0);
            long next = cal.getTimeInMillis();
            JSONArray a = new JSONArray(Store.p(c).getString("w_dates", "[]"));
            for (int k = 0; k < a.length(); k++) {
                long f = (long) a.getJSONObject(k).optDouble("from", 0);
                if (f > now && f + 5000 < next) next = f + 5000;
            }
            am.setAndAllowWhileIdle(AlarmManager.RTC, next, pi);
        } catch (Exception ignored) { }
    }
}
