# Installing Studio Desk

Pick **one computer as the studio PC**: the one that stays on in the studio. Everyone else connects to it over the office Wi-Fi. No internet and no accounts needed.

## 1. Get the files

Open the repository on GitHub → **Releases** → the latest *Studio Desk* release, and download the file for each device:

| Device | File |
|---|---|
| Windows (install) | `StudioDesk-<version>-windows-setup.exe` |
| Windows (no install) | `StudioDesk-<version>-windows-portable.exe` |
| Mac (Intel and Apple silicon) | `StudioDesk-<version>-mac.dmg` |
| Android phone / tablet | `StudioDesk-<version>-android.apk` |
| Linux | `.AppImage` or `.deb` |
| iPhone / iPad | No file. See step 4. |

The installers are built automatically by GitHub (the **Actions** tab → *Build apps*). Each finished run also has the files under **Artifacts**.

## 2. Set up the studio PC

1. Install Studio Desk (Windows or Mac file above).
   - **Windows:** if you see *Windows protected your PC*, click **More info → Run anyway**. This appears because the app isn't signed with a paid certificate yet.
   - **Mac:** drag Studio Desk into Applications and open it. If macOS says it can't check it, open **System Settings → Privacy & Security** and click **Open Anyway**.
2. Open **Sync & backup** → **Studio server on this computer** → **Host the studio server here**.
3. Optional: type a **team key** first, so only your team's devices can connect.
4. Note the address it shows under *Other devices connect to*, e.g. `http://192.168.1.20:8787`.
5. When Windows asks whether to allow network access, allow it on **private networks**.

Keep the app open on this PC while the team works (minimising it is fine). If it's closed, everyone keeps working offline and catches up when it opens again.

> Tip: give the studio PC a fixed IP address in your Wi-Fi router settings, so the address never changes.

## 3. Laptops and other computers

Install the Windows or Mac app → **Sync & backup** → enter the studio PC's address (and team key) → **Save and sync now**.

## 4. Phones and tablets

**Android:** download the `.apk` on the phone and open it. Allow *Install unknown apps* for your browser or Files app when asked. Then **More → Sync & backup** → enter the studio PC address → **Save and sync now**.

**iPhone / iPad:** in Safari, open the studio PC's address (e.g. `http://192.168.1.20:8787`), then **Share → Add to Home Screen**. Data is saved on the iPhone and works with no signal. Reopening the app from the home screen needs the studio PC to be reachable. A full App Store / TestFlight app needs an Apple Developer account (see below).

## 5. First run

The app opens with sample projects so you can look around. When ready: **Sync & backup → Clear sample data**, add yourself, then add your real projects. Sample data never syncs to the team.

## Backups

- The studio PC keeps every project in its data folder (**Sync & backup → Open data folder**), with a dated backup copy each day for 30 days and all uploaded files in `files/`.
- Copy that folder to an external drive once a week.
- Any device can also **Download backup** (one `.json` file) and **Import backup** later.

## Without the desktop app

The studio PC can also run the server with [Node.js](https://nodejs.org) installed: double-click `start-windows.bat` or `start-mac.command` in this repository. Other devices then open the address it prints in a browser.

## iPhone app (later)

A native iPhone app is built from the same code with Capacitor. It needs:
1. An Apple Developer account ($99/year).
2. A Mac with Xcode, or a GitHub Actions macOS runner with the signing certificate added as a secret.

Once you have the account, the iOS project is added with `npx cap add ios` and shipped through TestFlight to the team.
