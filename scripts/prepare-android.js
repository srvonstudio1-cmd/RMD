'use strict';
// Prepares the Android project (android/) from the web app in app/:
// creates it with Capacitor if needed, copies the app in, and applies the
// Studio Desk name, version, icons, splash and local-network permission.
// Then build with: cd android && ./gradlew assembleDebug   (needs the Android SDK)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const android = path.join(root, 'android');
const res = path.join(android, 'app', 'src', 'main', 'res');
const pkg = require('../package.json');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

if (!fs.existsSync(android)) run('npx cap add android');
run('npx cap sync android');

// Allow plain http:// to the studio PC on the local network.
const manifestPath = path.join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('usesCleartextTraffic')) {
  manifest = manifest.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
}
fs.writeFileSync(manifestPath, manifest);

// Version from package.json: 0.2.0 -> versionCode 200.
const gradlePath = path.join(android, 'app', 'build.gradle');
const [maj, min, pat] = pkg.version.split('.').map(Number);
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode \d+/, `versionCode ${maj * 10000 + min * 100 + pat}`).replace(/versionName "[^"]*"/, `versionName "${pkg.version}"`);
fs.writeFileSync(gradlePath, gradle);

// Launcher icons.
const iconSrc = path.join(root, 'build', 'android');
for (const dir of fs.readdirSync(iconSrc)) {
  for (const file of fs.readdirSync(path.join(iconSrc, dir))) {
    fs.mkdirSync(path.join(res, dir), { recursive: true });
    fs.copyFileSync(path.join(iconSrc, dir, file), path.join(res, dir, file));
  }
}
fs.writeFileSync(path.join(res, 'values', 'ic_launcher_background.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#151C25</color>\n</resources>\n');

// Splash: dark background with the icon in the middle, instead of the Capacitor logo.
for (const dir of fs.readdirSync(res)) {
  const f = path.join(res, dir, 'splash.png');
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
fs.writeFileSync(path.join(res, 'drawable', 'splash.xml'), `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><color android:color="#0E131A" /></item>
    <item android:gravity="center" android:width="160dp" android:height="160dp" android:drawable="@mipmap/ic_launcher_foreground" />
</layer-list>
`);

// App name.
const stringsPath = path.join(res, 'values', 'strings.xml');
let strings = fs.readFileSync(stringsPath, 'utf8');
strings = strings.replace(/(<string name="app_name">)[^<]*/, '$1Studio Desk').replace(/(<string name="title_activity_main">)[^<]*/, '$1Studio Desk');
fs.writeFileSync(stringsPath, strings);

console.log(`Android project ready (version ${pkg.version}). Build with: cd android && ./gradlew assembleDebug`);
