# RMD Studio Desk

Offline project manager for a film and AI-generation studio. Shot batches, films, original IP, ads and music videos in one place, on **Windows, macOS, Linux, Android and iOS**.

- Works with **no internet**. Every device keeps its own full copy.
- The team shares data through a small **studio server on your own PC**, over office Wi-Fi.
- **No AI. No cloud. No accounts.**

Full feature list, workflow and roadmap: [docs/PLAN.md](docs/PLAN.md)

## Quick start

You need [Node.js](https://nodejs.org) (LTS) on the studio PC only. Nothing to install on phones.

1. **Start the studio server**
   - Windows: double-click `start-windows.bat`
   - Mac: double-click `start-mac.command` (first time: right-click → Open)
   - Linux / terminal: `npm start`

   The window shows two addresses, e.g.
   ```
   On this PC:        http://localhost:8787
   On phones/laptops: http://192.168.1.20:8787
   ```
   Keep that window open while the team works.

2. **Open the app**
   - On the studio PC: open `http://localhost:8787`
   - On phones and other computers on the same Wi-Fi: open the second address

3. **Install it as an app** (optional)
   - Chrome / Edge on Windows, macOS, Android: menu → *Install app* / *Add to Home screen*
   - Safari on iPhone / iPad: Share → *Add to Home Screen*
   - Safari on Mac: File → *Add to Dock*

4. **First run**: the app opens with sample projects so you can look around. Go to **Sync** → *Clear sample data*, add yourself, then add your projects. Sample data never syncs to the team.

### Require a team key

```sh
# Windows (Command Prompt)
set RMD_KEY=choose-a-key
node server\server.js
# Mac / Linux
RMD_KEY=choose-a-key npm start
```
Everyone then enters the same key under **Sync**.

### Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Port the studio server listens on |
| `RMD_KEY` | *(none)* | Team key required to sync |
| `RMD_DATA_DIR` | `./data` | Where `rmd-data.json` and `backups/` are kept |

## Single-file version (no server)

```sh
npm run build:single
```
Creates `dist/studio-desk.html`. Double-click it on any computer to use the app on that machine only (no team sync). Handy for a laptop that never joins the studio network; move data with **Download backup / Import backup**.

## Backups

- The studio PC writes `data/rmd-data.json` on every change and a dated copy in `data/backups/` once a day (last 30 days kept).
- Any device: **Sync → Download backup** saves everything to one `.json` file. **Import backup** merges it back, keeping the newest version of each item.

## Project layout

```
app/                 The app (runs in any browser / webview)
  index.html
  styles.css
  app.js             UI, offline storage (IndexedDB), sync client
  sw.js              Offline cache (service worker)
  manifest.webmanifest, icons/
server/
  server.js          Studio server: serves the app, /api/sync, daily backups
  merge.js           Sync merge rule (newest change wins)
test/                node --test suites for merge logic and the server
scripts/             Single-file build
docs/PLAN.md         Product plan, features, workflow, roadmap
```

## Development

```sh
npm test          # merge + server tests
npm start         # run the studio server
```
No dependencies to install.
