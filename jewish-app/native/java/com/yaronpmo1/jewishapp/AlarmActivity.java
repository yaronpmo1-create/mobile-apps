package com.yaronpmo1.jewishapp;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** מסך צלצול מלא על הנעילה: כיבוי ונודניק. */
public class AlarmActivity extends Activity {
    private String itemJson = "{}";
    private final BroadcastReceiver stopped = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            finish();
        }
    };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        itemJson = getIntent().getStringExtra("item");
        JSONObject it;
        try { it = new JSONObject(itemJson); } catch (Exception e) { it = new JSONObject(); }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#0A101B"));
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setPadding(48, 48, 48, 48);

        TextView lbl = tv("התראה", 20, "#AEB9CC", false);
        TextView time = tv(new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date()), 72, "#E8C26A", true);
        TextView title = tv(it.optString("title"), 28, "#F3EFE8", true);
        TextView text = tv(it.optString("text"), 20, "#AEB9CC", false);
        root.addView(lbl);
        root.addView(time);
        root.addView(title);
        root.addView(text);

        Button stop = btn("כיבוי", "#E8C26A", "#0A101B");
        stop.setOnClickListener(v -> {
            startService(new Intent(this, AlarmService.class).setAction(AlarmService.ACT_STOP));
            finish();
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 190);
        lp.topMargin = 80;
        root.addView(stop, lp);
        int sn = it.optInt("snooze", 9);
        if (sn > 0) {
            Button snooze = btn("נודניק " + sn + " דקות", "#243149", "#F3EFE8");
            snooze.setOnClickListener(v -> {
                startService(new Intent(this, AlarmService.class).setAction(AlarmService.ACT_SNOOZE).putExtra("item", itemJson));
                finish();
            });
            LinearLayout.LayoutParams lp2 = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 150);
            lp2.topMargin = 24;
            root.addView(snooze, lp2);
        }
        setContentView(root);
        IntentFilter f = new IntentFilter(AlarmService.BROADCAST_STOPPED);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(stopped, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(stopped, f);
    }

    private TextView tv(String s, int sp, String color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(Color.parseColor(color));
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(0, 12, 0, 12);
        return t;
    }

    private Button btn(String s, String bg, String fg) {
        Button b = new Button(this);
        b.setText(s);
        b.setTextSize(24);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(Color.parseColor(fg));
        GradientDrawable d = new GradientDrawable();
        d.setColor(Color.parseColor(bg));
        d.setCornerRadius(40);
        b.setBackground(d);
        return b;
    }

    @Override
    protected void onDestroy() {
        try { unregisterReceiver(stopped); } catch (Exception ignored) { }
        super.onDestroy();
    }
}
