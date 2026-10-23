package com.yaronpmo1.jewishapp;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.util.DisplayMetrics;
import android.util.LruCache;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** קורא PDF פנימי לחוברות דבר מלכות: מוריד לזיכרון המטמון ומציג בעמודים (PdfRenderer), עם הגדלה, הורדה והעתקת קישור. */
public class PdfReaderActivity extends Activity {
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService pool = Executors.newSingleThreadExecutor();
    private PdfRenderer renderer;
    private ParcelFileDescriptor pfd;
    private ListView list;
    private PageAdapter adapter;
    private TextView status;
    private HorizontalScrollView hsv;
    private int screenW;
    private int zoomIdx = 0;
    private static final float[] ZOOM = {1f, 1.5f, 2f, 2.5f, 3f};
    private String url;
    private String title;
    private final LruCache<String, Bitmap> cache = new LruCache<>(8);

    /** הורדה ל"הורדות" והודעה בסיום; פותח באפליקציית PDF אם יש */
    static void download(final Context app, String url, String name) {
        try {
            String safe = name.replaceAll("[\\\\/:*?\"<>|]", "_");
            if (!safe.toLowerCase().endsWith(".pdf")) safe += ".pdf";
            final DownloadManager dm = (DownloadManager) app.getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Request rq = new DownloadManager.Request(Uri.parse(url));
            rq.setTitle(safe);
            rq.setMimeType("application/pdf");
            rq.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            rq.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safe);
            final long id = dm.enqueue(rq);
            final String shown = safe;
            BroadcastReceiver rc = new BroadcastReceiver() {
                @Override
                public void onReceive(Context c, Intent i) {
                    if (i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != id) return;
                    try { app.getApplicationContext().unregisterReceiver(this); } catch (Exception ignored) { }
                    Uri u = dm.getUriForDownloadedFile(id);
                    if (u == null) {
                        Toast.makeText(app, "ההורדה נכשלה", Toast.LENGTH_LONG).show();
                        return;
                    }
                    Toast.makeText(app, "הורד לתיקיית ההורדות: " + shown, Toast.LENGTH_LONG).show();
                    try {
                        app.startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(u, "application/pdf").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION));
                    } catch (Exception ignored) { /* אין אפליקציית PDF: הקובץ נשמר */ }
                }
            };
            ContextCompat.registerReceiver(app.getApplicationContext(), rc, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), ContextCompat.RECEIVER_EXPORTED);
            Toast.makeText(app, "מתחילה הורדה", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(app, "ההורדה נכשלה", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        url = getIntent().getStringExtra("url");
        title = getIntent().getStringExtra("title");
        if (url == null || !(url.startsWith("https://dvarmalchus.com/") || url.startsWith("https://www.dvarmalchus.com/"))) { finish(); return; }
        DisplayMetrics dm = getResources().getDisplayMetrics();
        screenW = dm.widthPixels;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#0A101B"));
        root.setFitsSystemWindows(true);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setLayoutDirection(LinearLayout.LAYOUT_DIRECTION_RTL);
        bar.setPadding(8, 6, 8, 6);
        Button back = btn("חזרה");
        back.setOnClickListener(v -> finish());
        Button plus = btn("+");
        plus.setOnClickListener(v -> zoom(1));
        Button minus = btn("-");
        minus.setOnClickListener(v -> zoom(-1));
        Button dl = btn("הורדה");
        dl.setOnClickListener(v -> download(this, url, title == null || title.isEmpty() ? "dvar-malchus" : title));
        Button copy = btn("קישור");
        copy.setOnClickListener(v -> {
            ((ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("link", url));
            Toast.makeText(this, "הקישור הועתק", Toast.LENGTH_SHORT).show();
        });
        TextView tt = new TextView(this);
        tt.setText(title == null ? "" : title);
        tt.setTextColor(Color.parseColor("#E8C26A"));
        tt.setTextSize(15);
        tt.setGravity(Gravity.CENTER);
        tt.setMaxLines(2);
        bar.addView(back);
        bar.addView(tt, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        bar.addView(plus);
        bar.addView(minus);
        bar.addView(dl);
        bar.addView(copy);
        root.addView(bar);

        status = new TextView(this);
        status.setTextColor(Color.WHITE);
        status.setGravity(Gravity.CENTER);
        status.setTextSize(16);
        status.setText("טוען את החוברת...");
        status.setPadding(0, 40, 0, 40);
        root.addView(status);

        hsv = new HorizontalScrollView(this);
        hsv.setFillViewport(true);
        list = new ListView(this);
        list.setDividerHeight(12);
        list.setDivider(new android.graphics.drawable.ColorDrawable(Color.parseColor("#0A101B")));
        hsv.addView(list, new ViewGroup.LayoutParams(screenW, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(hsv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        hsv.setVisibility(View.GONE);
        setContentView(root);
        load();
    }

    private Button btn(String t) {
        Button x = new Button(this);
        x.setText(t);
        x.setAllCaps(false);
        x.setMinWidth(0);
        x.setMinimumWidth(0);
        x.setPadding(18, 0, 18, 0);
        return x;
    }

    private void zoom(int d) {
        int n = Math.max(0, Math.min(ZOOM.length - 1, zoomIdx + d));
        if (n == zoomIdx || adapter == null) return;
        zoomIdx = n;
        ViewGroup.LayoutParams lp = list.getLayoutParams();
        lp.width = (int) (screenW * ZOOM[zoomIdx]);
        list.setLayoutParams(lp);
        adapter.notifyDataSetChanged();
    }

    private void load() {
        pool.execute(() -> {
            try {
                File f = new File(getCacheDir(), "dm-" + Math.abs(url.hashCode()) + ".pdf");
                if (!f.exists() || f.length() < 1000) {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(30000);
                    c.setRequestProperty("User-Agent", "Mozilla/5.0");
                    InputStream in = c.getInputStream();
                    File tmp = new File(f.getPath() + ".part");
                    FileOutputStream out = new FileOutputStream(tmp);
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    out.close();
                    in.close();
                    if (!tmp.renameTo(f)) throw new Exception("rename");
                }
                pfd = ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
                renderer = new PdfRenderer(pfd);
                ui.post(() -> {
                    status.setVisibility(View.GONE);
                    hsv.setVisibility(View.VISIBLE);
                    adapter = new PageAdapter();
                    list.setAdapter(adapter);
                });
            } catch (Exception e) {
                ui.post(() -> status.setText("לא ניתן לפתוח את החוברת. אפשר ללחוץ על \"קישור\" או על \"הורדה\"."));
            }
        });
    }

    private class PageAdapter extends BaseAdapter {
        @Override
        public int getCount() { return renderer == null ? 0 : renderer.getPageCount(); }

        @Override
        public Object getItem(int i) { return i; }

        @Override
        public long getItemId(int i) { return i; }

        @Override
        public View getView(final int pos, View v, ViewGroup parent) {
            ImageView iv = v instanceof ImageView ? (ImageView) v : new ImageView(PdfReaderActivity.this);
            final int w = (int) (screenW * ZOOM[zoomIdx]);
            final String key = pos + "@" + w;
            iv.setTag(key);
            iv.setBackgroundColor(Color.WHITE);
            iv.setAdjustViewBounds(true);
            iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
            iv.setLayoutParams(new ListView.LayoutParams(w, (int) (w * 1.414f)));
            Bitmap hit = cache.get(key);
            if (hit != null) {
                iv.setImageBitmap(hit);
                iv.setLayoutParams(new ListView.LayoutParams(w, ViewGroup.LayoutParams.WRAP_CONTENT));
                return iv;
            }
            iv.setImageDrawable(null);
            final ImageView target = iv;
            pool.execute(() -> {
                if (!key.equals(target.getTag())) return;
                try {
                    Bitmap bm;
                    synchronized (PdfReaderActivity.this) {
                        if (renderer == null) return;
                        PdfRenderer.Page pg = renderer.openPage(pos);
                        int h = Math.max(1, (int) ((float) pg.getHeight() * w / pg.getWidth()));
                        bm = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
                        bm.eraseColor(Color.WHITE);
                        pg.render(bm, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                        pg.close();
                    }
                    cache.put(key, bm);
                    ui.post(() -> {
                        if (key.equals(target.getTag())) {
                            target.setImageBitmap(bm);
                            target.setLayoutParams(new ListView.LayoutParams(w, ViewGroup.LayoutParams.WRAP_CONTENT));
                        }
                    });
                } catch (Throwable ignored) { }
            });
            return iv;
        }
    }

    @Override
    protected void onDestroy() {
        synchronized (this) {
            try { if (renderer != null) renderer.close(); } catch (Exception ignored) { }
            renderer = null;
        }
        try { if (pfd != null) pfd.close(); } catch (Exception ignored) { }
        pool.shutdownNow();
        super.onDestroy();
    }
}
