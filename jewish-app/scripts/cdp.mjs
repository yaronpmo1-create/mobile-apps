// מריץ JavaScript בתוך ה-WebView של האפליקציה באמולטור (רק בגרסת בדיקה): node scripts/cdp.mjs "<expr>"
import { execSync } from 'node:child_process';
const adb = 'C:/Users/yaron/code/android-sdk/platform-tools/adb.exe';
const sock = execSync(adb + ' shell cat /proc/net/unix').toString().match(/@(webview_devtools_remote_\d+)/);
if (!sock) { console.error('no webview'); process.exit(2); }
execSync(adb + ' forward tcp:9333 localabstract:' + sock[1]);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find((p) => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: process.argv[2], awaitPromise: true, returnByValue: true } }));
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) { console.log(JSON.stringify(d.result.result.value ?? d.result, null, 1)); ws.close(); process.exit(0); } };
