package com.yaronpmo1.jewishapp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(JewishAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
