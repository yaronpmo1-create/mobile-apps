package com.yaronpmo1.jewishapp;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

/** שירות קדמי שמנגן צלצול (USAGE_ALARM) בלולאה עם עוצמה עולה, רטט ומסך צלצול מלא. */
public class AlarmService extends Service {
    static final String ACT_START = "com.yaronpmo1.jewishapp.START";
    static final String ACT_STOP = "com.yaronpmo1.jewishapp.STOP";
    static final String ACT_SNOOZE = "com.yaronpmo1.jewishapp.SNOOZE";
    static final String BROADCAST_STOPPED = "com.yaronpmo1.jewishapp.RING_STOPPED";
    static final int NID = 4242;

    private MediaPlayer player;
    private Vibrator vib;
    private final Handler h = new Handler(Looper.getMainLooper());
    private JSONObject item;
    private float vol = 1f;
    private boolean ramp;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String act = intent == null ? ACT_STOP : intent.getAction();
        if (ACT_STOP.equals(act)) {
            finish();
            return START_NOT_STICKY;
        }
        if (ACT_SNOOZE.equals(act)) {
            JSONObject it = item;
            if (it == null && intent.getStringExtra("item") != null) {
                try { it = new JSONObject(intent.getStringExtra("item")); } catch (Exception ignored) { }
            }
            if (it != null) {
                int m = it.optInt("snooze", 9);
                Store.addSnooze(this, it, System.currentTimeMillis() + m * 60000L);
                Scheduler.scheduleNext(this);
            }
            finish();
            return START_NOT_STICKY;
        }
        try {
            item = new JSONObject(intent.getStringExtra("item"));
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        // צלצול חדש מחליף צלצול קודם שעדיין פעיל
        h.removeCallbacksAndMessages(null);
        try { if (player != null) { player.stop(); player.release(); } } catch (Exception ignored) { }
        player = null;
        try { if (vib != null) vib.cancel(); } catch (Exception ignored) { }
        Scheduler.channels(this);
        Notification n = buildNotification();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(NID, n);
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startSound();
        // ללא "חוזרת עד כיבוי": נעצר אחרי דקה; עם: עד 10 דקות
        h.postDelayed(this::finish, item.optBoolean("rep", false) ? 10 * 60000L : 60000L);
        return START_NOT_STICKY;
    }

    private Notification buildNotification() {
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        Intent full = new Intent(this, AlarmActivity.class).putExtra("item", item.toString())
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        PendingIntent fullPi = PendingIntent.getActivity(this, 10, full, fl);
        PendingIntent stopPi = PendingIntent.getService(this, 11, new Intent(this, AlarmService.class).setAction(ACT_STOP), fl);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, Scheduler.CH_RING)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(item.optString("title"))
                .setContentText(item.optString("text"))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setContentIntent(fullPi)
                .setFullScreenIntent(fullPi, true)
                .addAction(0, "כיבוי", stopPi);
        if (item.optInt("snooze", 9) > 0) {
            PendingIntent snPi = PendingIntent.getService(this, 12, new Intent(this, AlarmService.class).setAction(ACT_SNOOZE), fl);
            b.addAction(0, "נודניק " + item.optInt("snooze", 9) + " דקות", snPi);
        }
        return b.build();
    }

    private void startSound() {
        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            player.setDataSource(this, uri);
            player.setLooping(true);
            player.prepare();
            ramp = item.optBoolean("ramp", true);
            vol = ramp ? 0.08f : 1f;
            player.setVolume(vol, vol);
            player.start();
            if (ramp) h.postDelayed(rampUp, 1500);
        } catch (Exception ignored) {
        }
        if (item.optBoolean("vib", true)) {
            vib = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            long[] pat = {0, 700, 600};
            try {
                if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createWaveform(pat, 0));
                else vib.vibrate(pat, 0);
            } catch (Exception ignored) {
            }
        }
    }

    private final Runnable rampUp = new Runnable() {
        @Override
        public void run() {
            if (player == null) return;
            vol = Math.min(1f, vol + 0.06f);
            try { player.setVolume(vol, vol); } catch (Exception ignored) { }
            if (vol < 1f) h.postDelayed(this, 1500);
        }
    };

    private void finish() {
        h.removeCallbacksAndMessages(null);
        try { if (player != null) { player.stop(); player.release(); } } catch (Exception ignored) { }
        player = null;
        try { if (vib != null) vib.cancel(); } catch (Exception ignored) { }
        sendBroadcast(new Intent(BROADCAST_STOPPED).setPackage(getPackageName()));
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        h.removeCallbacksAndMessages(null);
        try { if (player != null) { player.release(); } } catch (Exception ignored) { }
        try { if (vib != null) vib.cancel(); } catch (Exception ignored) { }
        super.onDestroy();
    }
}
