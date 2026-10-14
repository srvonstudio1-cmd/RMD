# RMD Studio Desk

Offline project manager for a film and AI-generation studio. Shot batches, films, original IP, ads and music videos in one place, on **Windows, macOS, Linux, Android and iPhone**.

- Works with **no internet**. Every device keeps its own full copy.
- The team shares projects and files through a **studio server on your own PC**, over office Wi-Fi. The desktop app has it built in.
- **No AI. No cloud. No accounts.**

**Install it:** [docs/INSTALL.md](docs/INSTALL.md) · **What it does and how to run the studio with it:** [docs/PLAN.md](docs/PLAN.md)

## Apps

| Platform | What you get | Built by |
|---|---|---|
| Windows | Installer `.exe` and portable `.exe` | GitHub Actions (`windows-latest`) |
| macOS | Universal `.dmg` (Intel + Apple silicon) | GitHub Actions (`macos-latest`) |
| Linux | `.AppImage` and `.deb` | GitHub Actions (`ubuntu-latest`) |
| Android | `.apk` | GitHub Actions (Capacitor + Gradle) |
| iPhone / iPad | Add to Home Screen from the studio PC; native app needs an Apple Developer account | |
| Any browser | Open the studio PC's address | |

Every push builds all of them (**Actions → Build apps**; downloads under *Artifacts*). Run the workflow by hand with **Publish as a release** ticked to put them on the Releases page.

## Features

Projects by type and stage, starter task templates, Kanban tasks, shot lists with takes and review status, CSV shot list import/export, calendar, milestones, notes, file attachments, links to file locations, team and "My work", dashboard, search, archive, light/dark mode, phone and desktop layouts, daily backups. Full list in [docs/PLAN.md](docs/PLAN.md).

## Run from source

No dependencies are needed for the studio server and the browser app:

```sh
npm start          # studio server on http://localhost:8787 (needs Node.js 18+)
npm test           # merge + server tests
```

Or double-click `start-windows.bat` / `start-mac.command`. Settings:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Port the studio server listens on |
| `RMD_KEY` | *(none)* | Team key required to sync |
| `RMD_DATA_DIR` | `./data` | Where `rmd-data.json`, `backups/` and `files/` are kept |

Desktop and Android builds need `npm install` first:

```sh
npm run desktop            # run the desktop app
npm run dist:win           # or dist:mac / dist:linux → release/
npm run android:prepare    # create android/ (then: cd android && ./gradlew assembleDebug)
npm run build:single       # dist/studio-desk.html, the whole app in one file
```

## Project layout

```
app/                  The app (same code on every platform)
  index.html, styles.css
  app.js              UI, offline storage (IndexedDB), sync client, attachments
  sw.js               Offline cache for the browser version
  fonts/, icons/      Bundled fonts (OFL) and icons; no web requests
server/
  server.js           Studio server: serves the app, /api/sync, /api/files, daily backups
  merge.js            Sync merge rule (newest change wins)
desktop/              Electron shell for Windows, macOS, Linux (hosts the server built in)
scripts/              Android project preparation, single-file build
build/                Icons for installers and Android
capacitor.config.json Android (and later iOS) app settings
.github/workflows/    Builds every app on GitHub
test/                 node --test suites
docs/                 PLAN.md, INSTALL.md
```
