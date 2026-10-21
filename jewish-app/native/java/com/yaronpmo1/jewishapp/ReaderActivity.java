package com.yaronpmo1.jewishapp;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.http.SslError;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/** חלון קריאה פנימי לקישורי הלימוד כשאין דפדפן במכשיר: מוגבל לאתרי הלימוד בלבד. */
public class ReaderActivity extends Activity {
    private WebView web;

    static boolean allowed(String url) {
        try {
            Uri u = Uri.parse(url);
            String h = u.getHost() == null ? "" : u.getHost().toLowerCase();
            if (!"https".equals(u.getScheme())) return false;
            for (String d : new String[]{"sefaria.org", "sefaria.org.il", "chabad.org"}) {
                if (h.equals(d) || h.endsWith("." + d)) return true;
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        String url = getIntent().getStringExtra("url");
        if (url == null || !allowed(url)) {
            finish();
            return;
        }
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#0A101B"));
        root.setFitsSystemWindows(true);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setLayoutDirection(LinearLayout.LAYOUT_DIRECTION_RTL);
        bar.setPadding(12, 6, 12, 6);
        Button back = new Button(this);
        back.setText("חזרה");
        back.setOnClickListener(v -> finish());
        Button copy = new Button(this);
        copy.setText("העתק קישור");
        copy.setOnClickListener(v -> {
            String cur = web.getUrl() == null ? url : web.getUrl();
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            cm.setPrimaryClip(ClipData.newPlainText("link", cur));
            Toast.makeText(this, "הקישור הועתק", Toast.LENGTH_SHORT).show();
        });
        TextView title = new TextView(this);
        title.setText("קריאה");
        title.setTextColor(Color.parseColor("#E8C26A"));
        title.setTextSize(18);
        title.setGravity(Gravity.CENTER);
        bar.addView(back);
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        bar.addView(copy);
        root.addView(bar);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !allowed(r.getUrl().toString());
            }

            @Override
            public void onReceivedSslError(WebView v, SslErrorHandler h, SslError e) {
                h.cancel();
            }
        });
        root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
        web.loadUrl(url);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else finish();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
