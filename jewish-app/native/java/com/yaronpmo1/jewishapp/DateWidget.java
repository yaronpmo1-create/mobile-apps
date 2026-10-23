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
        for (int id : ids) m.updateAppWidget(id, build(c, m.getAppWidgetOptions(id)));
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
        // תמיד ריבוע 1:1: הכרטיס הריבועי ממורכז בתוך התא, והכתב גדל עם הגודל
        // אורך ורוחב התא בפועל: במצב אנכי רוחב מינימלי וגובה מקסימלי, ובמצב אופקי להפך
        boolean portrait = c.getResources().getConfiguration().orientation != android.content.res.Configuration.ORIENTATION_LANDSCAPE;
        float w = opts == null ? 110 : opts.getInt(portrait ? AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH : AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 110);
        float hgt = opts == null ? 110 : opts.getInt(portrait ? AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT : AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110);
        float side = Math.max(40f, Math.min(w, hgt));
        float dens = c.getResources().getDisplayMetrics().density;
        int padX = Math.max(0, Math.round((w - side) / 2f * dens)), padY = Math.max(0, Math.round((hgt - side) / 2f * dens));
        v.setViewPadding(R.id.w_root, padX, padY, padX, padY);
        v.setTextViewTextSize(R.id.d_wd, android.util.TypedValue.COMPLEX_UNIT_DIP, Math.max(8f, side * 0.13f));
        v.setTextViewTextSize(R.id.d_day, android.util.TypedValue.COMPLEX_UNIT_DIP, side * 0.34f);
        v.setTextViewTextSize(R.id.d_month, android.util.TypedValue.COMPLEX_UNIT_DIP, Math.max(9f, side * 0.15f));
        v.setTextViewTextSize(R.id.d_year, android.util.TypedValue.COMPLEX_UNIT_DIP, Math.max(7.5f, side * 0.12f));
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
            int[] ids = m.getAppWidgetIds(new ComponentName(c, DateWidget.class));
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
