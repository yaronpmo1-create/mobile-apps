// מתאים את פרויקט Android שנוצר ע"י "cap add android": קוד native, מניפסט, אייקונים, חתימה, ערכת נושא
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const app = path.join(root, 'android/app');
const main = path.join(app, 'src/main');
const pkgDir = path.join(main, 'java/com/yaronpmo1/jewishapp');

const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
};

// 1. קוד Java (מחליף גם את MainActivity)
copyDir(path.join(root, 'native/java/com/yaronpmo1/jewishapp'), pkgDir);
// 2. משאבים (ווידג'טים)
copyDir(path.join(root, 'native/res'), path.join(main, 'res'));
// 3. אייקונים: בלי mipmap-anydpi-v26 כדי שהאייקון שלנו יוצג בכל הגרסאות
fs.rmSync(path.join(main, 'res/mipmap-anydpi-v26'), { recursive: true, force: true });
for (const d of fs.readdirSync(path.join(root, 'assets/icons'), { withFileTypes: true })) {
  if (d.isDirectory()) copyDir(path.join(root, 'assets/icons', d.name), path.join(main, 'res', d.name));
}
// 4. מניפסט
let mf = fs.readFileSync(path.join(main, 'AndroidManifest.xml'), 'utf8');
const perms = ['SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM', 'POST_NOTIFICATIONS', 'USE_FULL_SCREEN_INTENT', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'RECEIVE_BOOT_COMPLETED', 'WAKE_LOCK', 'VIBRATE', 'ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', 'SYSTEM_ALERT_WINDOW']
  .filter((p) => !mf.includes('android.permission.' + p))
  .map((p) => '    <uses-permission android:name="android.permission.' + p + '" />\n').join('');
mf = mf.replace('</manifest>', perms + '    <queries><intent><action android:name="android.intent.action.VIEW" /><category android:name="android.intent.category.BROWSABLE" /><data android:scheme="https" /></intent></queries>\n</manifest>');
mf = mf.replace('android:launchMode="singleTask"', 'android:launchMode="singleTask"\n            android:windowSoftInputMode="adjustResize"');
const comps = `
        <activity android:name=".AlarmActivity" android:exported="false" android:showWhenLocked="true" android:turnScreenOn="true"
            android:launchMode="singleInstance" android:excludeFromRecents="true" android:theme="@android:style/Theme.DeviceDefault.NoActionBar" />
        <service android:name=".AlarmService" android:exported="false" android:foregroundServiceType="mediaPlayback" />
        <receiver android:name=".AlarmReceiver" android:exported="false" />
        <receiver android:name=".ActionReceiver" android:exported="false" />
        <receiver android:name=".BootReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
                <action android:name="android.intent.action.TIME_SET" />
            </intent-filter>
        </receiver>
        <receiver android:name=".NextWidget" android:exported="true" android:label="האירועים הבאים">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_next_info" />
        </receiver>
        <receiver android:name=".DateWidget" android:exported="true" android:label="התאריך העברי">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_date_info" />
        </receiver>
        <receiver android:name=".LeftWidget" android:exported="true" android:label="הלימוד שנשאר">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_left_info" />
        </receiver>
`;
mf = mf.replace('</application>', comps + '    </application>');
fs.writeFileSync(path.join(main, 'AndroidManifest.xml'), mf);

// 5. ערכת נושא כהה + מסך פתיחה
fs.writeFileSync(path.join(main, 'res/values/ja_colors.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="jaBg">#0A101B</color>\n</resources>\n');
fs.writeFileSync(path.join(main, 'res/values/styles.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:statusBarColor">@color/jaBg</item>
        <item name="android:navigationBarColor">@color/jaBg</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@color/jaBg</item>
        <item name="android:statusBarColor">@color/jaBg</item>
        <item name="android:navigationBarColor">@color/jaBg</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/jaBg</item>
        <item name="windowSplashScreenAnimatedIcon">@color/jaBg</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
`);

// 6. חתימה: מפתח קבוע מקובץ (KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD)
let g = fs.readFileSync(path.join(app, 'build.gradle'), 'utf8');
if (!g.includes('signingConfigs')) {
  g = g.replace('android {\n', `android {
    signingConfigs {
        ja {
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "../../keystore.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
`);
  g = g.replace('buildTypes {\n', 'buildTypes {\n        debug {\n            signingConfig signingConfigs.ja\n        }\n');
  g = g.replace('release {\n            minifyEnabled false', 'release {\n            signingConfig signingConfigs.ja\n            minifyEnabled false');
  // גרסה לפי משתנה סביבה (מספר ריצה ב-GitHub)
  g = g.replace('versionCode 1', 'versionCode Integer.parseInt(System.getenv("VERSION_CODE") ?: "1")');
  fs.writeFileSync(path.join(app, 'build.gradle'), g);
}
console.log('android patched');
