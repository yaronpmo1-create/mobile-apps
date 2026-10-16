# בנייה מקומית של ה-APK (לבדיקה באמולטור). הרצה: powershell -File scripts\build-local.ps1
param([string]$Task = 'assembleRelease', [switch]$Debug)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$sdk = 'C:\Users\yaron\code\android-sdk'
$env:JAVA_HOME = "$sdk\jdk17"
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
foreach ($l in Get-Content "$sdk\keys\jewish-app-credentials.txt") { $p = $l.Split('=', 2); Set-Item -Path ("env:" + $p[0]) -Value $p[1] }
Set-Location $root
node scripts\build.mjs
if (Test-Path android) { Remove-Item android -Recurse -Force }
npx cap add android
node scripts\patch-android.mjs
npx cap sync android
if ($Debug) { $cfgp = 'android\app\src\main\assets\capacitor.config.json'; $j = Get-Content $cfgp -Raw | ConvertFrom-Json; $j.android | Add-Member -NotePropertyName webContentsDebuggingEnabled -NotePropertyValue $true -Force; $j | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $cfgp }
"sdk.dir=$($sdk.Replace('\','/'))" | Set-Content -Encoding ascii android\local.properties
Set-Location android
.\gradlew.bat $Task --no-daemon -q
$apk = Get-ChildItem -Recurse app\build\outputs\apk -Filter *.apk | Select-Object -First 1
Write-Output ("APK: " + $apk.FullName + " (" + $apk.Length + " bytes)")
