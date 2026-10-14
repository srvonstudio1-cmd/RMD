# RMD Studio Desk: product plan

One app to run every project the studio has going: AI shot-generation batches, films, your own IP, ads and music videos. It works on Windows, macOS, Android and iOS. It runs **offline**, uses **no AI**, and keeps your data **on your own devices**.

This document covers what the app is, what it does, how the team will use it day to day, and what gets built in which phase. Phases 1 and 2 are built and in this repository. To install: [INSTALL.md](INSTALL.md).

---

## 1. The problem

- Projects are spread across chats, notes, drives and memory.
- Each kind of project tracks different things. A shot batch needs shot codes, takes and review status. A film needs script, previs and milestones. An IP needs a world bible and pitch material.
- The team uses a mix of Mac, Windows, Android and iPhone.
- You don't want a cloud service holding your projects, and you don't want AI features.

## 2. What we are building

**A studio desk app** with:

| | |
|---|---|
| **Runs on** | Windows, macOS, Linux, Android, iOS (and any modern browser) |
| **Internet needed?** | No. Each device works fully offline. |
| **Shared with team?** | Yes, through a small **studio server** running on your own PC, over your office Wi-Fi. |
| **Cloud / accounts?** | None. No sign-up, no subscription, no third-party servers. |
| **AI?** | None. It is a normal app: forms, lists, boards, search. |
| **Cost to run** | Zero. The studio PC is the only "server". |

### How the pieces fit

```
          ┌──────────────────────────── Studio Wi-Fi / LAN ────────────────────────────┐
          │                                                                             │
  ┌───────┴────────┐        ┌───────────────┐   ┌───────────────┐   ┌───────────────┐   │
  │  Studio PC     │◄──────►│ Your laptop   │   │ Editor's Mac  │   │ Phones        │   │
  │  (Windows/Mac) │  sync  │ full copy of  │   │ full copy of  │   │ (Android/iOS) │◄──┘
  │  studio server │◄──────►│ the data      │   │ the data      │   │ full copy     │
  │  + daily backup│        └───────────────┘   └───────────────┘   └───────────────┘
  └────────────────┘
   Every device keeps its own full copy and works with the network off.
   When it can reach the studio PC, it sends its changes and picks up everyone else's.
```

- **Every device has the complete data.** You can plan shots on a train with no signal. Changes sync the moment you're back on studio Wi-Fi.
- **The studio PC is the meeting point**, not a requirement for working. If it is off, everyone keeps working; they just don't see each other's changes until it is back.
- **Conflict rule:** if two people edit the *same item* while apart, the later edit wins. Different items never conflict (Riya editing a task and Kabir editing a shot both survive).
- **Working from outside the studio** (Phase 2): connect phones/laptops to the studio network with a private VPN like Tailscale or ZeroTier. It's still your own PC; nothing goes to a cloud app.

---

## 3. Features

✅ = built · 🔜 = planned for a later phase

### 3.1 Projects
- ✅ Project types: **Shot generation, Film, Own IP, Ad / brand film, Music video, Other**, each with its own colour throughout the app
- ✅ Stages: **Idea → Pre-production → Production → Post → Delivered**, plus **On hold**
- ✅ Client, delivery deadline with a days-left countdown, brief, tags (e.g. `9:16 · 4K`), team members
- ✅ Pin important projects to the sidebar
- ✅ Filter by type and stage; sort by deadline, recent activity or name
- ✅ Progress bar from finished tasks + approved shots
- ✅ Starter templates per project type (shot batch, film, IP, ad, music video) that add typical tasks and milestones, spread out to the deadline
- ✅ Archive (hide finished projects everywhere without deleting them)
- 🔜 Budget and invoices per project (quote, spent, invoiced, paid)

### 3.2 Tasks (Kanban board)
- ✅ Columns **To do · In progress · Review · Done**; drag and drop on computers, tap to change on phones
- ✅ Priority (Low, Normal, High, Urgent), assignee, due date, notes
- ✅ Overdue, today and tomorrow highlighted in colour
- 🔜 Checklists inside a task, task comments, recurring tasks

### 3.3 Shot list (built for AI shot generation and film)
- ✅ Shot code (e.g. `SC01_SH010`), auto-suggested next code
- ✅ Scene, length in seconds, aspect ratio (16:9, 9:16, 1:1, 4:5, 2.39:1, 4:3)
- ✅ **"Made with"** field: camera, Kling, Seedance, Flow, Higgsfield… (just a label, the app does not connect to them)
- ✅ Status pipeline: **Planned → Generating → In review → Approved → Final**, plus **Redo**
- ✅ **Take counter** with +/− buttons
- ✅ Prompt / camera notes and review notes kept as plain text
- ✅ Reference frame image per shot (stored small so it syncs fast)
- ✅ Filter by status; studio-wide "Shots" page across all projects
- ✅ **Export shot list to CSV** (opens in Excel, Numbers, Google Sheets)
- ✅ **Import a shot list from CSV** (Excel / Sheets); matching shot codes are updated, not duplicated
- 🔜 Storyboard grid view, shot reordering
- 🔜 Version history per shot (v1, v2, v3 with their own frames)

### 3.4 Timeline
- ✅ Milestones with dates and a done tick, ending with the delivery deadline
- ✅ **Calendar**: month view of due tasks, milestones and delivery dates across all projects
- 🔜 Gantt-style bar view

### 3.5 Notes and files
- ✅ Notes per project: briefs, client feedback, scripts, world-building
- ✅ **Files & links**: store where files actually live (`\\STUDIO-PC\Projects\…`, `/Volumes/…`, drive or review links), with copy and open buttons
- ✅ **Attach files** (briefs, references, frames, scripts, up to 2 GB each). They upload to the studio PC and any device can download them; downloaded copies stay available offline
- 🔜 Rich text notes (headings, lists)

### 3.6 People and "My work"
- ✅ Team list with roles, colours and workload (open tasks, overdue, shots in progress)
- ✅ Each device chooses who is using it; every change records who made it
- ✅ **My work**: one list of your open tasks across all projects, grouped Overdue / Today / This week / Later
- 🔜 Roles and permissions (e.g. freelancers see only their projects)

### 3.7 Dashboard
- ✅ Active projects, open tasks, overdue, shots waiting for review
- ✅ **Coming up**: tasks, milestones and deadlines for the next 7–14 days
- ✅ **Pipeline**: every project by stage
- ✅ **Recently changed**: who changed what, and when

### 3.8 Search
- ✅ One search box across projects, tasks, shots (code, description, prompt), notes and links. Press `/` to jump to it.

### 3.9 Sync, backup and safety
- ✅ Works fully offline on each device (stored in the device's own database)
- ✅ Studio server on your PC; devices sync automatically every 20 seconds and on every change
- ✅ Optional **team key** so only your team's devices can sync
- ✅ Studio PC saves a **dated backup every day** (keeps 30 days)
- ✅ **Download backup** file from any device; **import** merges by newest change
- ✅ Sample projects never sync to the team server
- ✅ **Desktop app hosts the studio server** with one switch; no Node.js needed
- 🔜 Encrypted connection (HTTPS) inside the studio network
- 🔜 Restore-from-backup screen on the studio PC

### 3.10 Look and feel
- ✅ Light and dark mode (follows the system or set manually)
- ✅ Desktop layout with sidebar; phone layout with bottom tabs
- ✅ Installable apps: Windows, Mac, Linux, Android; iPhone via Add to Home Screen
- ✅ Fonts and icons ship inside the app: it makes no internet requests at all

---

## 4. How we will manage everything (the workflow)

### A project's life
1. **New project** → pick the type, client, deadline, team. Pin it if it's hot.
2. **Plan**: add milestones (review rounds, picture lock, delivery) and the first tasks.
3. **Shot generation / production**: build the shot list. Each shot moves Planned → Generating → In review. Increment takes as you generate. Paste the prompt you used into the shot so it's never lost.
4. **Review**: the director filters **Shots → In review**, sets each to *Approved* or *Redo* with a review note.
5. **Delivery**: export the shot list CSV for the client or editor, move the project to **Delivered**.
6. **After delivery**: invoice task stays open until paid; the project leaves the active views.

### Daily routine (5 minutes)
- **Morning:** open **Home**. Check *Overdue* (red) and *Coming up*.
- **During the day:** work from **My work**; tick tasks off. Update shot status and takes as you go.
- **Evening:** director checks **Shots → In review** and clears the queue.

### Weekly routine
- Monday: walk the **Pipeline** together, move stages, set the week's deadlines.
- Friday: **Download backup** to an external drive (the studio PC also keeps its own daily copies).

### Naming conventions (suggested)
- Shot codes: `SC<scene>_SH<shot>` in steps of 10 (`SC01_SH010`, `SC01_SH020`) so you can insert shots later.
- Folder paths in Files & links mirror the project name: `\\STUDIO-PC\Projects\<Project>\00_Brief`, `01_Script`, `02_Generations`, `03_Approved`, `04_Delivery`.

---

## 5. Data model

Every item is a small record with an id, a type, who changed it last and when. That's what makes offline sync simple and safe.

| Type | Main fields |
|---|---|
| **project** | name, kind, stage, client, deadline, description, tags, members, pinned |
| **task** | projectId, title, status, priority, assignee, due, notes |
| **shot** | projectId, code, scene, status, takes, tool, duration, aspect, assignee, description, prompt, thumb, notes |
| **milestone** | projectId, title, date, done |
| **note** | projectId, title, body |
| **link** | projectId, label, target, note |
| **file** | projectId, name, size, type, content hash on the studio PC, small preview |
| **member** | name, role, colour |

Every record also has `createdAt`, `updatedAt`, `updatedBy` (device), `editedBy` (person), `deleted`. Deleting leaves a small "deleted" marker so the deletion syncs to every device.

---

## 6. Technology (and why)

| Part | Choice | Why |
|---|---|---|
| App | HTML + JavaScript, no framework | One codebase runs on every platform; tiny; no build step |
| Storage on each device | IndexedDB (built into every browser/webview) | Works offline, holds thousands of items easily |
| Offline loading | Service worker + web app manifest | Installs as an app; opens with no network |
| Studio server | Node.js, **zero dependencies** | Runs on any Windows/Mac PC; nothing to break or update |
| Server storage | One JSON file + daily backups | Easy to back up, copy and inspect |
| Desktop apps | **Electron** wrapping the same app, with the studio server running inside it | Real installers; Node.js is built in, so the server needs nothing else |
| Phone apps | **Capacitor** wrapping the same app | Android `.apk` now, iOS later, no rewrite |
| Builds | GitHub Actions | Windows, Mac, Linux and Android built on GitHub's machines on every push |

---

## 7. Phases

### Phase 1: working sample ✅
Projects, tasks, shots, timeline, notes, links, team, dashboard, search, offline storage, studio sync server, backups.

### Phase 2: proper installs everywhere ✅
- ✅ Windows installer + portable `.exe`, macOS `.dmg`, Linux `.AppImage`/`.deb` (Electron) with the studio server built in
- ✅ Android `.apk` (Capacitor)
- ✅ File attachments synced through the studio PC
- ✅ Project templates, archive, calendar, CSV shot list import
- ✅ Bundled fonts, zero internet requests
- 🔜 iPhone app via TestFlight (needs an Apple Developer account)
- 🔜 Signed installers (removes the Windows/Mac "unknown developer" warning; needs code-signing certificates)

### Phase 3: studio extras
- Budgets, quotes and invoices per project
- Client review page on the studio network (approve/redo without giving clients the app)
- Roles and permissions for freelancers
- Shot versions with frame history, storyboard grid
- Reports: time per stage, shots per day, takes per approved shot

---

## 8. Known limits

- **iPhone:** iPhones install Studio Desk from Safari (Add to Home Screen). Opened from the studio PC's secure Tailscale address it works fully offline; opened from the plain Wi-Fi address it needs the studio PC reachable to open. An App Store app needs an Apple Developer account.
- **Unsigned installers:** Windows and macOS show a one-time warning on first open (see INSTALL.md) until the apps are signed with paid certificates.
- Attached files are not included in the one-file backup; they live in the studio PC's `files/` folder, which should be copied with the rest of its data folder.
- If two people edit the same item while both are offline, the later save wins for the whole item.
- Clock differences between devices can affect which edit is "later". Keep device clocks on automatic time.

## 9. Questions for you

1. Which machine will be the studio PC (Windows or Mac)? Is it on most of the day?
2. How many people, and do any work remotely?
3. Should freelancers see all projects, or only their own?
4. Do you want budgets/invoices in the app, or is that handled elsewhere?
5. Any fields missing from the shot list (e.g. seed, model version, LUT, music cue)?
