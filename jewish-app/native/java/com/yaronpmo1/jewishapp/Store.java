package com.yaronpmo1.jewishapp;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** שמירה מקומית של ההתראות המחושבות, סימוני "בוצע" ונתוני הווידג'ט. */
public class Store {
    static SharedPreferences p(Context c) {
        return c.getSharedPreferences("ja", Context.MODE_PRIVATE);
    }

    static JSONArray arr(Context c, String key) {
        try {
            return new JSONArray(p(c).getString(key, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static JSONObject obj(Context c, String key) {
        try {
            return new JSONObject(p(c).getString(key, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** כל הפריטים: המחושבים מ-JS ועוד נודניקים דינמיים. */
    static List<JSONObject> all(Context c) {
        List<JSONObject> out = new ArrayList<>();
        JSONObject cancelled = obj(c, "cancelled");
        for (String k : new String[]{"items", "snoozes"}) {
            JSONArray a = arr(c, k);
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o != null && !cancelled.has(o.optString("id"))) out.add(o);
            }
        }
        return out;
    }

    /** ביטול מופע בודד של התראה/תזכורת (למשל מכפתור "בטל" בהתראה המקדימה) */
    static void cancelItem(Context c, String id) {
        try {
            JSONObject d = obj(c, "cancelled");
            long now = System.currentTimeMillis();
            java.util.Iterator<String> ks = d.keys();
            List<String> old = new ArrayList<>();
            while (ks.hasNext()) { String k = ks.next(); if (now - d.optLong(k) > 3 * 86400000L * 30) old.add(k); }
            for (String k : old) d.remove(k);
            d.put(id, now);
            p(c).edit().putString("cancelled", d.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    static boolean isDone(Context c, JSONObject it) {
        String dk = it.optString("dk", "");
        String tid = it.optString("tid", "");
        if (dk.isEmpty() || tid.isEmpty()) return false;
        return obj(c, "done").has(dk + "|" + tid);
    }

    static void markDone(Context c, String key, boolean v) {
        try {
            JSONObject d = obj(c, "done");
            if (v) d.put(key, 1);
            else d.remove(key);
            p(c).edit().putString("done", d.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    static void addPendingDone(Context c, String key) {
        try {
            JSONArray a = arr(c, "pendingDone");
            a.put(key);
            p(c).edit().putString("pendingDone", a.toString()).apply();
            markDone(c, key, true);
        } catch (Exception ignored) {
        }
    }

    static void removeTimers(Context c) {
        try {
            JSONArray a = arr(c, "snoozes");
            JSONArray b = new JSONArray();
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o != null && !o.optBoolean("timer", false)) b.put(o);
            }
            p(c).edit().putString("snoozes", b.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    static void addSnooze(Context c, JSONObject it, long at) {
        try {
            JSONObject n = new JSONObject(it.toString());
            n.put("id", "SZ|" + at);
            n.put("t", at);
            if (n.optBoolean("timer", false)) p(c).edit().putLong("timer_end", at).apply();
            JSONArray a = arr(c, "snoozes");
            JSONArray b = new JSONArray();
            long now = System.currentTimeMillis();
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o != null && o.optLong("t") > now - 3600000L) b.put(o);
            }
            b.put(n);
            p(c).edit().putString("snoozes", b.toString()).apply();
        } catch (Exception ignored) {
        }
    }
}
