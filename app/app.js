'use strict';
// RMD Studio Desk — offline-first project manager.
// Everything lives in this device's IndexedDB. If a studio sync server is
// configured (server/server.js on the studio PC), changes are exchanged with
// it over the local network. No AI, no cloud services.
(function () {
  const APP_VERSION = '0.1.0';

  // ---------- vocabularies ----------
  const KINDS = {
    shot: { label: 'Shot generation', color: 'var(--k-shot)' },
    film: { label: 'Film', color: 'var(--k-film)' },
    ip: { label: 'Own IP', color: 'var(--k-ip)' },
    ad: { label: 'Ad / brand film', color: 'var(--k-ad)' },
    music: { label: 'Music video', color: 'var(--k-music)' },
    other: { label: 'Other', color: 'var(--k-other)' },
  };
  const STAGES = {
    idea: { label: 'Idea', tone: '' },
    pre: { label: 'Pre-production', tone: 'info' },
    production: { label: 'Production', tone: 'accent' },
    post: { label: 'Post', tone: 'warn' },
    delivered: { label: 'Delivered', tone: 'ok' },
    hold: { label: 'On hold', tone: 'bad' },
  };
  const TASK_STATUS = {
    todo: { label: 'To do' },
    doing: { label: 'In progress' },
    review: { label: 'Review' },
    done: { label: 'Done' },
  };
  const PRIORITY = {
    urgent: { label: 'Urgent', tone: 'bad', rank: 0 },
    high: { label: 'High', tone: 'warn', rank: 1 },
    normal: { label: 'Normal', tone: 'info', rank: 2 },
    low: { label: 'Low', tone: '', rank: 3 },
  };
  const SHOT_STATUS = {
    planned: { label: 'Planned', tone: '' },
    generating: { label: 'Generating', tone: 'info' },
    review: { label: 'In review', tone: 'warn' },
    approved: { label: 'Approved', tone: 'ok' },
    final: { label: 'Final', tone: 'accent' },
    redo: { label: 'Redo', tone: 'bad' },
  };
  const ASPECTS = ['16:9', '9:16', '1:1', '4:5', '2.39:1', '4:3'];
  const MEMBER_COLORS = ['#b85d0b', '#2b65a8', '#0f7f73', '#6a48c0', '#b8366a', '#8a5a12', '#3d7a2a', '#5a6678'];
  const CHILD_TYPES = ['task', 'shot', 'note', 'link', 'milestone'];
  const DAY = 86400000;

  const ICONS = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    projects: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 7l2-3h5l2 3"/>',
    mywork: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    shots: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 5.8"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  // ---------- small helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 20) : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const options = (map, selected) => Object.entries(map).map(([k, v]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${esc(v.label)}</option>`).join('');
  const pill = (map, key) => { const v = map[key]; return v ? `<span class="pill ${v.tone || ''}">${esc(v.label)}</span>` : ''; };
  const kindTag = (k) => { const v = KINDS[k] || KINDS.other; return `<span class="kind" style="color:${v.color}"><i></i>${esc(v.label)}</span>`; };
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function isoDay(d) {
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d); }
  function parseDay(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); }
  function daysUntil(s) {
    if (!s) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((parseDay(s) - now) / DAY);
  }
  function fmtDate(s) {
    if (!s) return '';
    const d = parseDay(s);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function dueHtml(s, done) {
    if (!s) return '';
    const n = daysUntil(s);
    if (done) return `<span class="due">${fmtDate(s)}</span>`;
    if (n < 0) return `<span class="due over">${-n}d overdue</span>`;
    if (n === 0) return '<span class="due soon">Today</span>';
    if (n === 1) return '<span class="due soon">Tomorrow</span>';
    if (n < 7) return `<span class="due">In ${n} days</span>`;
    return `<span class="due">${fmtDate(s)}</span>`;
  }
  // Countdown for a delivery deadline, shown next to the date itself.
  function countdownHtml(s) {
    if (!s) return '';
    const n = daysUntil(s);
    if (n < 0) return `<span class="due over">${-n}d overdue</span>`;
    if (n === 0) return '<span class="due soon">Due today</span>';
    return `<span class="due${n <= 3 ? ' soon' : ''}">${n === 1 ? '1 day left' : `${n} days left`}</span>`;
  }
  function ago(ms) {
    if (!ms) return 'never';
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }
  // Same rule as server/merge.js: later updatedAt wins, device id breaks ties.
  function isNewer(a, b) {
    if (!b) return true;
    if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt;
    return String(a.updatedBy || '') > String(b.updatedBy || '');
  }

  // ---------- storage (IndexedDB, with in-memory fallback) ----------
  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('rmd-studio-desk', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('records', { keyPath: 'id' });
        req.result.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function idbTx(db, store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const out = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(out && out.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  let storageWarned = false;
  function warnStorage() {
    if (storageWarned) return;
    storageWarned = true;
    toast('This browser is not saving data. Changes last until you close the page.');
  }

  const Store = {
    db: null,
    records: new Map(),
    meta: {},
    async open() {
      try {
        this.db = await idbOpen();
        const [recs, metas] = await Promise.all([
          idbTx(this.db, 'records', 'readonly', (s) => s.getAll()),
          idbTx(this.db, 'meta', 'readonly', (s) => s.getAll()),
        ]);
        for (const r of recs || []) this.records.set(r.id, r);
        for (const m of metas || []) this.meta[m.key] = m.value;
      } catch (err) {
        this.db = null;
        setTimeout(warnStorage, 800);
      }
    },
    put(recs) {
      const list = Array.isArray(recs) ? recs : [recs];
      for (const r of list) this.records.set(r.id, r);
      if (this.db) idbTx(this.db, 'records', 'readwrite', (s) => { for (const r of list) s.put(r); }).catch(warnStorage);
    },
    setMeta(key, value) {
      this.meta[key] = value;
      if (this.db) idbTx(this.db, 'meta', 'readwrite', (s) => s.put({ key, value })).catch(warnStorage);
    },
    async wipe() {
      this.records.clear();
      if (this.db) await idbTx(this.db, 'records', 'readwrite', (s) => s.clear()).catch(warnStorage);
      this.setMeta('lastSeq', 0);
      this.setMeta('sample', false);
      this.setMeta('me', null);
    },
  };

  // ---------- model ----------
  function deviceId() {
    if (!Store.meta.deviceId) Store.setMeta('deviceId', 'dev-' + uid().slice(0, 10));
    return Store.meta.deviceId;
  }
  const get = (id) => { const r = id && Store.records.get(id); return r && !r.deleted ? r : null; };
  const live = (type) => { const out = []; for (const r of Store.records.values()) if (r.type === type && !r.deleted) out.push(r); return out; };
  // Children whose project still exists (a project may be deleted on another device).
  const liveIn = (type) => live(type).filter((r) => get(r.projectId));
  const byProject = (type, pid) => live(type).filter((r) => r.projectId === pid);
  const me = () => get(Store.meta.me);
  const meName = () => (me() ? me().name : 'Someone');
  const members = () => live('member').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  function stamp(prev) {
    return Math.max(Date.now(), prev ? prev.updatedAt + 1 : 0);
  }

  function save(type, data, opts = {}) {
    const prev = data.id ? Store.records.get(data.id) : null;
    const now = Date.now();
    const rec = {
      ...(prev && !prev.deleted ? prev : {}),
      ...data,
      id: data.id || uid(),
      type,
      createdAt: prev && prev.createdAt ? prev.createdAt : now,
      updatedAt: stamp(prev),
      updatedBy: deviceId(),
      editedBy: meName(),
      deleted: false,
      _dirty: true,
    };
    Store.put(rec);
    if (!opts.quiet) afterChange();
    return rec;
  }

  function tombstone(rec) {
    return {
      id: rec.id, type: rec.type, projectId: rec.projectId, deleted: true,
      createdAt: rec.createdAt, updatedAt: stamp(rec), updatedBy: deviceId(), editedBy: meName(), _dirty: true,
    };
  }

  function remove(id) {
    const rec = Store.records.get(id);
    if (!rec) return;
    const out = [tombstone(rec)];
    if (rec.type === 'project') {
      for (const r of Store.records.values()) if (CHILD_TYPES.includes(r.type) && r.projectId === id && !r.deleted) out.push(tombstone(r));
    }
    Store.put(out);
    afterChange();
  }

  function afterChange() {
    render();
    Sync.schedule();
  }

  function memberById(id) { return get(id); }
  function avatar(m, size) {
    if (!m) return '';
    const initials = m.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
    const st = size ? `;width:${size}px;height:${size}px` : '';
    return `<span class="avatar" style="background:${esc(m.color || MEMBER_COLORS[0])}${st}" title="${esc(m.name)}">${esc(initials)}</span>`;
  }

  function nextShotCode(pid) {
    const codes = byProject('shot', pid).map((s) => s.code || '').sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const last = codes[codes.length - 1];
    if (!last) return 'SC01_SH010';
    const m = last.match(/(\d+)(\D*)$/);
    if (!m) return last + '_2';
    const n = String(Number(m[1]) + 10).padStart(m[1].length, '0');
    return last.slice(0, m.index) + n + m[2];
  }
  const byCode = (a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true });
  const byTask = (a, b) => (PRIORITY[a.priority] || PRIORITY.normal).rank - (PRIORITY[b.priority] || PRIORITY.normal).rank || String(a.due || '9999').localeCompare(String(b.due || '9999'));

  // ---------- UI state ----------
  const ui = {
    view: 'dashboard', prevView: 'dashboard', projectId: null, tab: 'board',
    kind: 'all', stage: 'active', sort: 'deadline',
    shotStatus: 'review', shotProject: 'all', projShot: 'all',
    workMember: null, search: '',
  };

  const NAV = [
    ['dashboard', 'Home', 'home'],
    ['projects', 'Projects', 'projects'],
    ['mywork', 'My work', 'mywork'],
    ['shots', 'Shots', 'shots'],
    ['team', 'Team', 'team'],
    ['sync', 'Sync', 'sync'],
  ];

  function go(view, extra) {
    Object.assign(ui, { view }, extra || {});
    if (view !== 'search') { ui.search = ''; const s = $('#search'); if (s) s.value = ''; }
    render();
    window.scrollTo(0, 0);
  }

  function navCounts() {
    const mine = Store.meta.me;
    return {
      projects: live('project').filter((p) => !['delivered', 'hold'].includes(p.stage)).length,
      mywork: liveIn('task').filter((t) => t.assignee === mine && t.status !== 'done').length,
      shots: liveIn('shot').filter((s) => s.status === 'review').length,
    };
  }

  function renderNav() {
    const counts = navCounts();
    const current = ui.view === 'project' ? 'projects' : ui.view;
    $('#side-nav').innerHTML = NAV.map(([v, label, ic]) => `
      <button class="nav-btn" data-action="go" data-view="${v}"${current === v ? ' aria-current="page"' : ''}>
        ${icon(ic)}<span>${label}</span>${counts[v] ? `<span class="nav-count">${counts[v]}</span>` : ''}
      </button>`).join('');
    $('#tab-nav').innerHTML = NAV.map(([v, label, ic]) => `
      <button data-action="go" data-view="${v}"${current === v ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`).join('');
    const pinned = live('project').filter((p) => p.pinned).sort((a, b) => a.name.localeCompare(b.name));
    $('#side-projects').innerHTML = pinned.length
      ? pinned.map((p) => `<button class="nav-btn" data-action="open-project" data-id="${p.id}"${ui.view === 'project' && ui.projectId === p.id ? ' aria-current="page"' : ''}>
          <i class="dot" style="background:${(KINDS[p.kind] || KINDS.other).color}"></i><span class="name">${esc(p.name)}</span></button>`).join('')
      : '<p class="muted" style="padding:0 10px;font-size:.82rem">Pin a project to keep it here.</p>';
  }

  function render() {
    renderNav();
    const view = VIEWS[ui.view] || VIEWS.dashboard;
    $('#view').innerHTML = view();
    updateSyncBadge();
  }

  // ---------- views ----------
  const VIEWS = {};

  function sampleBanner() {
    if (!Store.meta.sample) return '';
    return `<div class="sample-note"><span><b>These are sample projects.</b> Look around, then clear them and add your own.</span>
      <button class="btn sm" data-action="clear-sample">Clear sample data</button></div>`;
  }

  VIEWS.dashboard = function () {
    const projects = live('project');
    const active = projects.filter((p) => !['delivered', 'hold'].includes(p.stage));
    const tasks = liveIn('task');
    const open = tasks.filter((t) => t.status !== 'done');
    const overdue = open.filter((t) => t.due && daysUntil(t.due) < 0);
    const inReview = liveIn('shot').filter((s) => s.status === 'review');
    const weekDue = open.filter((t) => t.due && daysUntil(t.due) <= 7);

    const upcoming = [
      ...weekDue.map((t) => ({ kind: 'task', rec: t, due: t.due })),
      ...liveIn('milestone').filter((m) => !m.done && m.date && daysUntil(m.date) <= 14).map((m) => ({ kind: 'milestone', rec: m, due: m.date })),
      ...active.filter((p) => p.deadline && daysUntil(p.deadline) <= 14 && daysUntil(p.deadline) >= -30).map((p) => ({ kind: 'deadline', rec: p, due: p.deadline })),
    ].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 12);

    const upcomingRows = upcoming.map(({ kind, rec, due }) => {
      const p = kind === 'deadline' ? rec : get(rec.projectId);
      const color = (KINDS[p.kind] || KINDS.other).color;
      const title = kind === 'deadline' ? `Deadline: ${p.name}` : kind === 'milestone' ? `Milestone: ${rec.title}` : rec.title;
      const action = kind === 'task' ? `data-action="edit-task" data-id="${rec.id}"` : `data-action="open-project" data-id="${p.id}"${kind === 'milestone' ? ' data-tab="timeline"' : ''}`;
      const who = kind === 'task' ? avatar(memberById(rec.assignee), 22) : '';
      return `<div class="row link" ${action} tabindex="0"><i class="dot" style="background:${color}"></i>
        <div class="grow"><div class="title">${esc(title)}</div><div class="sub">${esc(p.name)}</div></div>${who}${dueHtml(due)}</div>`;
    }).join('');

    const pipeline = ['idea', 'pre', 'production', 'post', 'delivered'].map((st) => {
      const list = projects.filter((p) => p.stage === st);
      return `<div class="stage"><div class="stage-name"><span>${STAGES[st].label}</span><span class="num">${list.length}</span></div>
        <div class="stage-items">${list.map((p) => `<button class="stage-item" style="border-left-color:${(KINDS[p.kind] || KINDS.other).color}" data-action="open-project" data-id="${p.id}" title="${esc(p.name)}">${esc(p.name)}</button>`).join('') || '<span class="muted">None</span>'}</div></div>`;
    }).join('');

    const recent = [...Store.records.values()]
      .filter((r) => !r.deleted && r.type !== 'member' && (r.type === 'project' || get(r.projectId)))
      .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8)
      .map((r) => {
        const p = r.type === 'project' ? r : get(r.projectId);
        const label = r.type === 'project' ? 'Project' : r.type === 'shot' ? `Shot ${r.code || ''}` : r.type[0].toUpperCase() + r.type.slice(1);
        const name = r.type === 'project' ? r.name : (r.title || r.label || r.description || '');
        return `<div class="row link" data-action="open-record" data-id="${r.id}" tabindex="0"><i class="dot" style="background:${(KINDS[p.kind] || KINDS.other).color}"></i>
          <div class="grow"><div class="title">${esc(label)} · ${esc(name)}</div><div class="sub">${esc(r.editedBy || 'Someone')} · ${esc(p.name)}</div></div>
          <span class="due">${ago(r.updatedAt)}</span></div>`;
      }).join('');

    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    return `
      ${sampleBanner()}
      <div class="page-head"><div><div class="eyebrow">${esc(today)}</div><h1>Studio overview</h1>
        <p class="lede">${plural(active.length, 'active project')}, ${plural(weekDue.length, 'task')} due within a week.</p></div></div>
      <div class="stats">
        <button class="stat" data-action="go" data-view="projects"><b>${active.length}</b><span>Active projects</span></button>
        <button class="stat" data-action="go" data-view="mywork"><b>${open.length}</b><span>Open tasks</span></button>
        <button class="stat${overdue.length ? ' alert' : ''}" data-action="go" data-view="mywork" data-all="1"><b>${overdue.length}</b><span>Overdue</span></button>
        <button class="stat" data-action="shots-review"><b>${inReview.length}</b><span>Shots waiting for review</span></button>
      </div>
      <div class="dash-grid">
        <div class="dash-col">
          <section class="panel"><div class="panel-head"><h2>Coming up</h2><span class="muted" style="font-size:.82rem">next 7–14 days</span></div>
            <div class="panel-body"><div class="list">${upcomingRows || '<div class="empty">Nothing due in the next two weeks.</div>'}</div></div></section>
        </div>
        <div class="dash-col">
          <section class="panel"><div class="panel-head"><h2>Pipeline</h2><button class="btn ghost sm" data-action="go" data-view="projects">All projects</button></div>
            <div class="panel-body"><div class="pipeline">${pipeline}</div></div></section>
          <section class="panel"><div class="panel-head"><h2>Recently changed</h2></div>
            <div class="panel-body"><div class="list">${recent || '<div class="empty">No activity yet.</div>'}</div></div></section>
        </div>
      </div>`;
  };

  function projectCard(p) {
    const tasks = byProject('task', p.id);
    const done = tasks.filter((t) => t.status === 'done').length;
    const shots = byProject('shot', p.id);
    const approved = shots.filter((s) => s.status === 'approved' || s.status === 'final').length;
    const total = tasks.length + shots.length;
    const pct = total ? Math.round(((done + approved) / total) * 100) : 0;
    const team = (p.members || []).map(memberById).filter(Boolean);
    return `<article class="card" data-action="open-project" data-id="${p.id}" tabindex="0">
      <div class="card-top">${kindTag(p.kind)}${pill(STAGES, p.stage)}</div>
      <h3>${p.pinned ? '<span class="pin" title="Pinned">●</span> ' : ''}${esc(p.name)}</h3>
      <div class="meta">${p.client ? `<span>${esc(p.client)}</span>` : ''}${p.deadline ? `<span>Due ${fmtDate(p.deadline)}</span>${p.stage !== 'delivered' ? countdownHtml(p.deadline) : ''}` : '<span>No deadline</span>'}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="card-foot"><span class="num">Tasks ${done}/${tasks.length}</span><span class="num">${shots.length ? `Shots ${approved}/${shots.length} approved` : ''}</span></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </div>
      <div class="card-foot"><div class="avatars">${team.map((m) => avatar(m)).join('')}</div><span>Updated ${ago(p.updatedAt)}</span></div>
    </article>`;
  }

  VIEWS.projects = function () {
    const all = live('project');
    let list = all.filter((p) => ui.kind === 'all' || p.kind === ui.kind);
    if (ui.stage === 'active') list = list.filter((p) => !['delivered', 'hold'].includes(p.stage));
    else if (ui.stage !== 'all') list = list.filter((p) => p.stage === ui.stage);
    const sorters = {
      deadline: (a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')),
      recent: (a, b) => b.updatedAt - a.updatedAt,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || sorters[ui.sort](a, b));
    const kindChips = [['all', 'All', all.length], ...Object.entries(KINDS).map(([k, v]) => [k, v.label, all.filter((p) => p.kind === k).length]).filter((c) => c[2])]
      .map(([k, label, n]) => `<button class="chip" data-action="kind" data-kind="${k}" aria-pressed="${ui.kind === k}">${esc(label)} <span class="n">${n}</span></button>`).join('');
    return `
      ${sampleBanner()}
      <div class="page-head"><div><h1>Projects</h1><p class="lede">Every job in one place: shot batches, films, your own IP, ads and music videos.</p></div>
        <div class="actions"><button class="btn primary" data-action="new-project">${icon('plus')}New project</button></div></div>
      <div class="toolbar"><div class="chips">${kindChips}</div>
        <div class="actions">
          <select class="inline" data-change="stage-filter" aria-label="Stage filter">
            <option value="active"${ui.stage === 'active' ? ' selected' : ''}>Active</option>
            <option value="all"${ui.stage === 'all' ? ' selected' : ''}>All stages</option>${options(STAGES, ui.stage)}</select>
          <select class="inline" data-change="sort" aria-label="Sort">
            <option value="deadline"${ui.sort === 'deadline' ? ' selected' : ''}>By deadline</option>
            <option value="recent"${ui.sort === 'recent' ? ' selected' : ''}>Recently updated</option>
            <option value="name"${ui.sort === 'name' ? ' selected' : ''}>By name</option></select>
        </div></div>
      ${list.length ? `<div class="cards">${list.map(projectCard).join('')}</div>`
        : `<div class="panel empty"><p>No projects match these filters.</p><button class="btn primary" data-action="new-project">${icon('plus')}New project</button></div>`}`;
  };

  function taskCard(t, showProject) {
    const p = showProject ? get(t.projectId) : null;
    const pr = PRIORITY[t.priority];
    return `<article class="task${t.status === 'done' ? ' done' : ''}" draggable="true" data-drag="${t.id}" data-action="edit-task" data-id="${t.id}" tabindex="0">
      <div class="t">${esc(t.title)}</div>
      ${p ? `<div class="sub muted" style="font-size:.78rem">${esc(p.name)}</div>` : ''}
      <div class="f">${pr && (t.priority === 'urgent' || t.priority === 'high') ? pill(PRIORITY, t.priority) : ''}${dueHtml(t.due, t.status === 'done')}${avatar(memberById(t.assignee))}</div>
    </article>`;
  }

  function shotRow(s, showProject) {
    const p = showProject ? get(s.projectId) : null;
    const who = memberById(s.assignee);
    return `<div class="shot">
      <div class="thumb" data-action="edit-shot" data-id="${s.id}">${s.thumb ? `<img src="${esc(s.thumb)}" alt="Frame for ${esc(s.code)}">` : esc(s.aspect || '16:9')}</div>
      <div class="shot-main" data-action="edit-shot" data-id="${s.id}" tabindex="0">
        <div class="shot-code">${esc(s.code || 'Untitled shot')} ${pill(SHOT_STATUS, s.status)}${p ? `<span class="muted" style="font-family:var(--font-body);font-weight:500">${esc(p.name)}</span>` : ''}</div>
        <div class="shot-desc">${esc(s.description || 'No description yet')}</div>
        <div class="shot-meta">${s.scene ? `<span>Scene ${esc(s.scene)}</span>` : ''}${s.tool ? `<span>${esc(s.tool)}</span>` : ''}${s.duration ? `<span class="num">${esc(s.duration)} s</span>` : ''}${s.aspect ? `<span>${esc(s.aspect)}</span>` : ''}${who ? `<span>${esc(who.name)}</span>` : ''}</div>
      </div>
      <div class="shot-side">
        <div class="takes"><button data-action="take" data-id="${s.id}" data-d="-1" aria-label="Remove a take">−</button><span>${plural(s.takes || 0, 'take')}</span><button data-action="take" data-id="${s.id}" data-d="1" aria-label="Add a take">+</button></div>
        <select class="inline" data-change="shot-status" data-id="${s.id}" aria-label="Status of ${esc(s.code)}">${options(SHOT_STATUS, s.status)}</select>
      </div>
    </div>`;
  }

  function shotChips(shots, current, action) {
    const counts = {};
    for (const s of shots) counts[s.status] = (counts[s.status] || 0) + 1;
    return [['all', 'All', shots.length], ...Object.entries(SHOT_STATUS).map(([k, v]) => [k, v.label, counts[k] || 0])]
      .map(([k, label, n]) => `<button class="chip" data-action="${action}" data-status="${k}" aria-pressed="${current === k}">${esc(label)} <span class="n">${n}</span></button>`).join('');
  }

  VIEWS.project = function () {
    const p = get(ui.projectId);
    if (!p) { ui.view = 'projects'; return VIEWS.projects(); }
    const tasks = byProject('task', p.id);
    const shots = byProject('shot', p.id).sort(byCode);
    const notes = byProject('note', p.id).sort((a, b) => b.updatedAt - a.updatedAt);
    const links = byProject('link', p.id).sort((a, b) => String(a.label).localeCompare(String(b.label)));
    const milestones = byProject('milestone', p.id).sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
    const team = (p.members || []).map(memberById).filter(Boolean);
    const tabs = [['board', 'Tasks', tasks.length], ['shots', 'Shots', shots.length], ['timeline', 'Timeline', milestones.length], ['notes', 'Notes', notes.length], ['links', 'Files & links', links.length]];

    let body = '';
    if (ui.tab === 'board') {
      body = `<div class="board-wrap"><div class="board">${Object.entries(TASK_STATUS).map(([k, v]) => {
        const list = tasks.filter((t) => t.status === k).sort(byTask);
        return `<section class="col" data-drop="${k}"><div class="col-head"><span>${v.label}<span class="n">${list.length}</span></span>
          <button class="icon-btn" data-action="new-task" data-status="${k}" aria-label="Add task to ${v.label}">${icon('plus')}</button></div>
          ${list.map((t) => taskCard(t)).join('')}</section>`;
      }).join('')}</div></div>
      <p class="muted" style="font-size:.82rem">Drag cards between columns on a computer, or tap a card to change its status.</p>`;
    } else if (ui.tab === 'shots') {
      const filtered = ui.projShot === 'all' ? shots : shots.filter((s) => s.status === ui.projShot);
      body = `<div class="toolbar"><div class="chips">${shotChips(shots, ui.projShot, 'proj-shot-filter')}</div>
        <div class="actions"><button class="btn" data-action="export-csv" data-scope="${p.id}">${icon('download')}Shot list CSV</button>
        <button class="btn primary" data-action="new-shot">${icon('plus')}Add shot</button></div></div>
        ${filtered.length ? `<div class="shots">${filtered.map((s) => shotRow(s)).join('')}</div>` : `<div class="panel empty"><p>No shots here yet.</p><button class="btn primary" data-action="new-shot">${icon('plus')}Add shot</button></div>`}`;
    } else if (ui.tab === 'timeline') {
      const items = milestones.map((m) => {
        const over = !m.done && m.date && daysUntil(m.date) < 0;
        return `<div class="ms${m.done ? ' done' : ''}${over ? ' over' : ''}"><span class="date">${m.date ? fmtDate(m.date) : 'No date'}</span>
          <label class="check" data-action="stop"><input type="checkbox" data-change="ms-done" data-id="${m.id}"${m.done ? ' checked' : ''} aria-label="Mark ${esc(m.title)} done"></label>
          <div class="grow"><div class="title"${m.done ? ' style="text-decoration:line-through;color:var(--muted)"' : ''}>${esc(m.title)}</div></div>
          ${dueHtml(m.date, m.done)}<button class="icon-btn" data-action="edit-milestone" data-id="${m.id}" aria-label="Edit milestone">${icon('edit')}</button></div>`;
      }).join('');
      const final = p.deadline ? `<div class="ms final"><span class="date">${fmtDate(p.deadline)}</span><div class="grow"><b>Final delivery</b></div>${p.stage === 'delivered' ? pill(STAGES, 'delivered') : dueHtml(p.deadline)}</div>` : '';
      body = `<div class="toolbar"><p class="muted">Key dates for this project, ending with the delivery deadline.</p>
        <button class="btn primary" data-action="new-milestone">${icon('plus')}Add milestone</button></div>
        <section class="panel"><div class="panel-body" style="padding-top:12px">${items || final ? `<div class="timeline">${items}${final}</div>` : '<div class="empty">No milestones yet.</div>'}</div></section>`;
    } else if (ui.tab === 'notes') {
      body = `<div class="toolbar"><p class="muted">Briefs, client feedback, scripts, world-building, anything in writing.</p>
        <button class="btn primary" data-action="new-note">${icon('plus')}Add note</button></div>
        ${notes.length ? `<div class="notes">${notes.map((n) => `<article class="note" data-action="edit-note" data-id="${n.id}" tabindex="0"><h3>${esc(n.title || 'Untitled')}</h3><p>${esc(n.body)}</p><span class="sub">${esc(n.editedBy || '')} · ${ago(n.updatedAt)}</span></article>`).join('')}</div>` : '<div class="panel empty">No notes yet.</div>'}`;
    } else {
      body = `<div class="toolbar"><p class="muted">Where the files live: drive links, NAS folders, local paths, review links.</p>
        <button class="btn primary" data-action="new-link">${icon('plus')}Add link</button></div>
        <section class="panel"><div class="panel-body" style="padding-top:8px"><div class="list">${links.map((l) => {
          const isUrl = /^https?:\/\//i.test(l.target || '');
          return `<div class="row"><div class="grow"><div class="title">${esc(l.label)}</div><div class="sub mono">${esc(l.target)}</div>${l.note ? `<div class="sub">${esc(l.note)}</div>` : ''}</div>
            ${isUrl ? `<a class="icon-btn" href="${esc(l.target)}" target="_blank" rel="noopener" aria-label="Open link">${icon('open')}</a>` : ''}
            <button class="icon-btn" data-action="copy" data-text="${esc(l.target)}" aria-label="Copy">${icon('copy')}</button>
            <button class="icon-btn" data-action="edit-link" data-id="${l.id}" aria-label="Edit">${icon('edit')}</button></div>`;
        }).join('') || '<div class="empty">No links yet.</div>'}</div></div></section>`;
    }

    return `
      <div class="proj-head">
        <div><button class="back" data-action="go" data-view="projects">${icon('back')}All projects</button></div>
        <div class="page-head"><div style="min-width:0">
          <div class="eyebrow">${kindTag(p.kind)}</div>
          <h1>${esc(p.name)}</h1>
          ${p.description ? `<p class="lede">${esc(p.description)}</p>` : ''}
        </div>
        <div class="actions">
          <select class="inline" data-change="project-stage" data-id="${p.id}" aria-label="Stage">${options(STAGES, p.stage)}</select>
          <button class="btn" data-action="toggle-pin" data-id="${p.id}">${icon('pin')}${p.pinned ? 'Unpin' : 'Pin'}</button>
          <button class="btn" data-action="edit-project" data-id="${p.id}">${icon('edit')}Edit</button>
        </div></div>
        <div class="proj-meta">
          ${pill(STAGES, p.stage)}
          ${p.client ? `<span>Client <b>${esc(p.client)}</b></span>` : ''}
          <span>Deadline <b>${p.deadline ? fmtDate(p.deadline) : 'not set'}</b></span>
          ${p.deadline && p.stage !== 'delivered' ? countdownHtml(p.deadline) : ''}
          ${p.tags ? `<span>${esc(p.tags)}</span>` : ''}
          ${team.length ? `<span class="avatars">${team.map((m) => avatar(m)).join('')}</span>` : ''}
        </div>
      </div>
      <div class="tabs" role="tablist">${tabs.map(([k, label, n]) => `<button class="tab" role="tab" data-action="tab" data-tab="${k}" aria-selected="${ui.tab === k}">${label}<span class="n">${n}</span></button>`).join('')}</div>
      ${body}`;
  };

  VIEWS.mywork = function () {
    const people = members();
    const who = ui.workMember === 'all' ? null : (memberById(ui.workMember) || me() || people[0]);
    const tasks = liveIn('task').filter((t) => t.status !== 'done' && (ui.workMember === 'all' || (who && t.assignee === who.id)));
    const groups = [
      ['Overdue', (t) => t.due && daysUntil(t.due) < 0],
      ['Today', (t) => t.due && daysUntil(t.due) === 0],
      ['This week', (t) => t.due && daysUntil(t.due) > 0 && daysUntil(t.due) <= 7],
      ['Later', (t) => t.due && daysUntil(t.due) > 7],
      ['No date', (t) => !t.due],
    ];
    const rows = (list) => list.sort(byTask).map((t) => {
      const p = get(t.projectId);
      return `<div class="row link" data-action="edit-task" data-id="${t.id}" tabindex="0">
        <label class="check" data-action="stop"><input type="checkbox" data-change="task-done" data-id="${t.id}" aria-label="Mark ${esc(t.title)} done"></label>
        <i class="dot" style="background:${(KINDS[p.kind] || KINDS.other).color}"></i>
        <div class="grow"><div class="title">${esc(t.title)}</div><div class="sub">${esc(p.name)} · ${TASK_STATUS[t.status].label}</div></div>
        ${t.priority === 'urgent' || t.priority === 'high' ? pill(PRIORITY, t.priority) : ''}${ui.workMember === 'all' ? avatar(memberById(t.assignee), 22) : ''}${dueHtml(t.due)}</div>`;
    }).join('');
    const sections = groups.map(([label, test]) => {
      const list = tasks.filter(test);
      if (!list.length) return '';
      return `<section class="panel"><div class="panel-head"><h2>${label}</h2><span class="muted num">${list.length}</span></div><div class="panel-body"><div class="list">${rows(list)}</div></div></section>`;
    }).join('');
    const shots = who && ui.workMember !== 'all' ? liveIn('shot').filter((s) => s.assignee === who.id && !['approved', 'final'].includes(s.status)).sort(byCode) : [];
    return `
      <div class="page-head"><div><h1>My work</h1><p class="lede">Open tasks across every project, sorted by when they are due. Tick one to mark it done.</p></div>
        <div class="actions"><select class="inline" data-change="work-member" aria-label="Whose work">
          <option value="all"${ui.workMember === 'all' ? ' selected' : ''}>Everyone</option>
          ${people.map((m) => `<option value="${m.id}"${who && ui.workMember !== 'all' && who.id === m.id ? ' selected' : ''}>${esc(m.name)}${Store.meta.me === m.id ? ' (this device)' : ''}</option>`).join('')}
        </select></div></div>
      ${sections || '<div class="panel empty"><p>No open tasks. Nice.</p></div>'}
      ${shots.length ? `<section style="display:flex;flex-direction:column;gap:10px"><h2>Shots assigned to ${esc(who.name)}</h2><div class="shots">${shots.map((s) => shotRow(s, true)).join('')}</div></section>` : ''}`;
  };

  VIEWS.shots = function () {
    const projects = live('project').filter((p) => byProject('shot', p.id).length).sort((a, b) => a.name.localeCompare(b.name));
    let shots = liveIn('shot');
    if (ui.shotProject !== 'all') shots = shots.filter((s) => s.projectId === ui.shotProject);
    const filtered = (ui.shotStatus === 'all' ? shots : shots.filter((s) => s.status === ui.shotStatus))
      .sort((a, b) => String(get(a.projectId).name).localeCompare(get(b.projectId).name) || byCode(a, b));
    return `
      <div class="page-head"><div><h1>Shots</h1><p class="lede">Every shot from every project. Filter to what needs review, what needs a redo, or what is final.</p></div>
        <div class="actions"><button class="btn" data-action="export-csv" data-scope="all">${icon('download')}All shots CSV</button>
        <button class="btn primary" data-action="new-shot">${icon('plus')}Add shot</button></div></div>
      <div class="toolbar"><div class="chips">${shotChips(shots, ui.shotStatus, 'shot-filter')}</div>
        <select class="inline" data-change="shot-project" aria-label="Project"><option value="all">All projects</option>
          ${projects.map((p) => `<option value="${p.id}"${ui.shotProject === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      ${filtered.length ? `<div class="shots">${filtered.map((s) => shotRow(s, true)).join('')}</div>` : '<div class="panel empty">No shots with this status.</div>'}`;
  };

  VIEWS.team = function () {
    const people = members();
    const tasks = liveIn('task');
    const shots = liveIn('shot');
    return `
      <div class="page-head"><div><h1>Team</h1><p class="lede">Everyone who works on your projects. Each device picks who is using it, so edits show the right name.</p></div>
        <div class="actions"><button class="btn primary" data-action="new-member">${icon('plus')}Add person</button></div></div>
      <section class="panel"><div class="panel-body" style="padding-top:14px;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center">
        <label class="field" style="flex:1;min-width:220px"><span>This device is used by</span>
          <select id="me-select" data-change="me"><option value="">Choose a person</option>${people.map((m) => `<option value="${m.id}"${Store.meta.me === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      </div></section>
      <div class="team">${people.map((m) => {
        const open = tasks.filter((t) => t.assignee === m.id && t.status !== 'done');
        const late = open.filter((t) => t.due && daysUntil(t.due) < 0).length;
        const sh = shots.filter((s) => s.assignee === m.id && !['approved', 'final'].includes(s.status)).length;
        return `<article class="panel" style="padding:14px;display:flex;flex-direction:column;gap:12px">
          <div class="member">${avatar(m)}<div class="grow" style="min-width:0"><h3>${esc(m.name)}${Store.meta.me === m.id ? ' <span class="pill accent plain">this device</span>' : ''}</h3><div class="muted" style="font-size:.85rem">${esc(m.role || 'No role set')}</div></div>
            <button class="icon-btn" data-action="edit-member" data-id="${m.id}" aria-label="Edit ${esc(m.name)}">${icon('edit')}</button></div>
          <div class="card-foot"><button class="btn ghost sm" data-action="member-work" data-id="${m.id}">${plural(open.length, 'open task')}</button>
            <span>${late ? `<span class="due over">${late} overdue</span> · ` : ''}${plural(sh, 'shot')} in progress</span></div>
        </article>`;
      }).join('') || '<div class="panel empty">No people yet. Add yourself first.</div>'}</div>`;
  };

  VIEWS.sync = function () {
    const pending = [...Store.records.values()].filter((r) => r._dirty).length;
    const st = Sync.state;
    const url = Store.meta.serverUrl || '';
    return `
      <div class="page-head"><div><h1>Sync & backup</h1><p class="lede">Your data lives on this device and works with no internet. Connect to the studio PC to share it with the team.</p></div></div>
      <div class="settings">
        <section class="panel"><div class="panel-head"><h2>Studio sync</h2></div><div class="panel-body">
          <div class="status-line"><i class="sync-dot ${st.status === 'ok' ? 'ok' : st.status === 'busy' || st.status === 'paused' ? 'busy' : st.status === 'err' ? 'err' : ''}"></i>
            <span>${url ? (st.status === 'err' || st.status === 'paused' ? esc(st.message) : st.status === 'ok' ? `Connected to ${esc(st.server || 'studio PC')}. Last sync ${ago(Store.meta.lastSyncAt)}.` : st.status === 'busy' ? 'Syncing…' : 'Not synced yet.') : 'Not connected. Everything stays on this device.'}</span></div>
          <p class="muted num" style="font-size:.85rem">${plural(pending, 'change')} waiting to be sent.</p>
          <label class="field"><span>Studio PC address</span><input id="sync-url" type="url" inputmode="url" placeholder="http://192.168.1.20:8787" value="${esc(url)}">
            <span class="hint">Shown in the window of the studio PC when the server starts.</span></label>
          <label class="field"><span>Team key</span><input id="sync-key" type="password" autocomplete="off" placeholder="Leave empty if the server has none" value="${esc(Store.meta.syncKey || '')}"></label>
          <label class="check"><input type="checkbox" data-change="auto-sync"${Store.meta.autoSync !== false ? ' checked' : ''}> Sync automatically every 20 seconds</label>
          <div class="actions"><button class="btn primary" data-action="sync-save">${icon('sync')}Save and sync now</button>${url ? '<button class="btn" data-action="sync-disconnect">Disconnect</button>' : ''}</div>
          <ol class="steps"><li>On the studio PC, double-click <b>start-windows.bat</b> or <b>start-mac.command</b>.</li>
            <li>Connect phones and laptops to the same Wi-Fi.</li><li>Enter the address it shows here, on every device.</li></ol>
        </div></section>
        <section class="panel"><div class="panel-head"><h2>Backup</h2></div><div class="panel-body">
          <p class="muted">Download everything as one file. Keep it on a drive, or move it to a device with no network. Importing merges by newest change, nothing is overwritten blindly.</p>
          <div class="actions"><button class="btn" data-action="export-backup">${icon('download')}Download backup</button>
            <button class="btn" data-action="import-backup">Import backup</button>
            <button class="btn" data-action="export-csv" data-scope="all">All shots CSV</button></div>
          <input type="file" id="import-file" accept="application/json,.json" data-change="import-file" hidden>
          <p class="muted" style="font-size:.85rem">The studio PC also keeps a dated copy every day in its <span class="mono">data/backups</span> folder.</p>
        </div></section>
        <section class="panel"><div class="panel-head"><h2>This device</h2></div><div class="panel-body">
          <label class="field"><span>Appearance</span><select data-change="theme" id="theme-select">
            ${[['system', 'Match system'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<option value="${k}"${(Store.meta.theme || 'system') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <p class="muted" style="font-size:.85rem">Device ID <span class="mono">${esc(deviceId())}</span> · version ${APP_VERSION} · ${Store.db ? 'saving to this device' : 'not saving (private window?)'}</p>
          <div class="actions">${Store.meta.sample ? '<button class="btn" data-action="clear-sample">Clear sample data</button>' : '<button class="btn" data-action="load-sample">Load sample projects</button>'}
            <button class="btn danger" data-action="wipe">Erase this device</button></div>
          <p class="muted" style="font-size:.85rem">No AI, no accounts, no cloud. Data only moves between your own devices and the studio PC.</p>
        </div></section>
      </div>`;
  };

  VIEWS.search = function () {
    const q = ui.search.trim().toLowerCase();
    const hit = (...vals) => vals.some((v) => v && String(v).toLowerCase().includes(q));
    const projects = live('project').filter((p) => hit(p.name, p.client, p.tags, p.description));
    const tasks = liveIn('task').filter((t) => hit(t.title, t.notes));
    const shots = liveIn('shot').filter((s) => hit(s.code, s.description, s.prompt, s.notes, s.tool, s.scene)).sort(byCode);
    const notes = liveIn('note').filter((n) => hit(n.title, n.body));
    const links = liveIn('link').filter((l) => hit(l.label, l.target, l.note));
    const row = (action, id, title, sub, extra = '') => `<div class="row link" data-action="${action}" data-id="${id}" tabindex="0"><div class="grow"><div class="title">${esc(title)}</div><div class="sub">${esc(sub)}</div></div>${extra}</div>`;
    const pname = (r) => get(r.projectId).name;
    const group = (title, list, fn) => list.length ? `<section class="panel"><div class="panel-head"><h2>${title}</h2><span class="muted num">${list.length}</span></div><div class="panel-body"><div class="list">${list.slice(0, 30).map(fn).join('')}</div></div></section>` : '';
    const total = projects.length + tasks.length + shots.length + notes.length + links.length;
    return `<div class="page-head"><div><h1>Search</h1><p class="lede">${plural(total, 'result')} for “${esc(ui.search)}”</p></div></div>
      ${group('Projects', projects, (p) => row('open-project', p.id, p.name, `${(KINDS[p.kind] || KINDS.other).label} · ${STAGES[p.stage] ? STAGES[p.stage].label : ''}`))}
      ${group('Tasks', tasks, (t) => row('edit-task', t.id, t.title, `${pname(t)} · ${TASK_STATUS[t.status].label}`, dueHtml(t.due, t.status === 'done')))}
      ${group('Shots', shots, (s) => row('edit-shot', s.id, `${s.code} — ${s.description || ''}`, pname(s), pill(SHOT_STATUS, s.status)))}
      ${group('Notes', notes, (n) => row('edit-note', n.id, n.title || 'Untitled', pname(n)))}
      ${group('Files & links', links, (l) => row('edit-link', l.id, l.label, `${pname(l)} · ${l.target}`))}
      ${total ? '' : '<div class="panel empty">Nothing found. Try a shot code, a client or a word from a note.</div>'}`;
  };

  // ---------- modal forms ----------
  let modalCleanup = null;

  function closeModal() {
    $('#modal-root').innerHTML = '';
    if (modalCleanup) { modalCleanup(); modalCleanup = null; }
  }

  function fieldHtml(f, value) {
    const id = `f-${f.name}`;
    const req = f.required ? ' required' : '';
    const cls = `field${f.wide ? ' wide' : ''}`;
    const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
    switch (f.type) {
      case 'textarea':
        return `<label class="${cls}"><span>${esc(f.label)}</span><textarea id="${id}" name="${f.name}" rows="${f.rows || 4}"${ph}${req}>${esc(value)}</textarea>${hint}</label>`;
      case 'select':
        return `<label class="${cls}"><span>${esc(f.label)}</span><select id="${id}" name="${f.name}"${req}>${f.options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value == null ? '' : value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${hint}</label>`;
      case 'checkbox':
        return `<label class="check ${f.wide ? 'wide' : ''}"><input type="checkbox" id="${id}" name="${f.name}"${value ? ' checked' : ''}> ${esc(f.label)}</label>`;
      case 'members':
        return `<div class="${cls}"><span>${esc(f.label)}</span><div class="member-picks">${members().map((m) => `<label class="check"><input type="checkbox" name="${f.name}" value="${m.id}"${(value || []).includes(m.id) ? ' checked' : ''}> ${esc(m.name)}</label>`).join('') || '<span class="muted">Add people on the Team page first.</span>'}</div></div>`;
      case 'image':
        return `<div class="${cls}"><span>${esc(f.label)}</span><div class="img-pick"><div class="thumb" id="${id}-preview">${value ? `<img src="${esc(value)}" alt="">` : 'No frame'}</div>
          <div class="actions"><label class="btn sm">Choose image<input type="file" accept="image/*" id="${id}" hidden></label><button type="button" class="btn sm ghost" id="${id}-clear">Remove</button></div></div>${hint}</div>`;
      default:
        return `<label class="${cls}"><span>${esc(f.label)}</span><input id="${id}" name="${f.name}" type="${f.type || 'text'}"${f.type === 'number' ? ' min="0" step="any"' : ''} value="${esc(value)}"${ph}${req}>${hint}</label>`;
    }
  }

  function formModal({ title, fields, values = {}, onSave, onDelete, saveLabel = 'Save' }) {
    const images = {};
    for (const f of fields) if (f.type === 'image') images[f.name] = values[f.name] || '';
    $('#modal-root').innerHTML = `<div class="overlay" id="overlay"><form class="modal" id="modal-form" role="dialog" aria-modal="true" aria-labelledby="modal-title" novalidate>
      <div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="modal-body">${fields.map((f) => fieldHtml(f, values[f.name] != null ? values[f.name] : f.default)).join('')}</div>
      <div class="modal-foot">${onDelete ? '<button type="button" class="btn danger left" id="modal-delete">Delete</button>' : ''}
        <button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">${esc(saveLabel)}</button></div>
    </form></div>`;
    const form = $('#modal-form');
    const overlay = $('#overlay');
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) closeModal(); });
    for (const f of fields) {
      if (f.type !== 'image') continue;
      const input = $(`#f-${f.name}`);
      const preview = $(`#f-${f.name}-preview`);
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          images[f.name] = await shrinkImage(file);
          preview.innerHTML = `<img src="${images[f.name]}" alt="">`;
        } catch (err) { toast('That image could not be read. Try a JPG or PNG.'); }
      });
      $(`#f-${f.name}-clear`).addEventListener('click', () => { images[f.name] = ''; preview.textContent = 'No frame'; });
    }
    if (onDelete) {
      $('#modal-delete').addEventListener('click', () => confirmModal(onDelete.message, onDelete.label || 'Delete', onDelete.run));
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const out = {};
      for (const f of fields) {
        if (f.type === 'image') { out[f.name] = images[f.name]; continue; }
        if (f.type === 'members') { out[f.name] = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map((i) => i.value); continue; }
        const el = form.elements[f.name];
        if (f.type === 'checkbox') { out[f.name] = el.checked; continue; }
        let v = el.value.trim();
        if (f.required && !v) { el.focus(); toast(`${f.label} is required.`); return; }
        if (f.type === 'number') v = v === '' ? '' : Number(v);
        out[f.name] = v;
      }
      if (onSave(out) !== false) closeModal();
    });
    const first = form.querySelector('input:not([type=file]):not([type=checkbox]), textarea, select');
    if (first && window.matchMedia('(min-width: 861px)').matches) first.focus();
  }

  function confirmModal(message, yesLabel, onYes) {
    $('#modal-root').innerHTML = `<div class="overlay" id="overlay"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-msg">
      <div class="modal-head"><h2 id="confirm-msg" style="font-size:1.05rem">${esc(message)}</h2></div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="confirm-yes">${esc(yesLabel)}</button></div></div></div>`;
    $('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay' || e.target.closest('[data-close]')) closeModal(); });
    $('#confirm-yes').addEventListener('click', () => { closeModal(); onYes(); });
    $('#confirm-yes').focus();
  }

  function shrinkImage(file, max = 480) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.75));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const projectOptions = () => live('project').sort((a, b) => a.name.localeCompare(b.name)).map((p) => [p.id, p.name]);
  const memberOptions = () => [['', 'Unassigned'], ...members().map((m) => [m.id, m.name])];
  const mapOptions = (map) => Object.entries(map).map(([k, v]) => [k, v.label]);
  const contextProject = () => (ui.view === 'project' ? ui.projectId : null);

  function needProject(fn) {
    if (!live('project').length) { toast('Create a project first.'); editProject(); return; }
    fn();
  }

  function editProject(p) {
    formModal({
      title: p ? 'Edit project' : 'New project',
      values: p || { kind: 'shot', stage: 'idea', members: Store.meta.me ? [Store.meta.me] : [] },
      fields: [
        { name: 'name', label: 'Project name', required: true, wide: true, placeholder: 'e.g. Monsoon ad — shot batch' },
        { name: 'kind', label: 'Type', type: 'select', options: mapOptions(KINDS) },
        { name: 'stage', label: 'Stage', type: 'select', options: mapOptions(STAGES) },
        { name: 'client', label: 'Client', placeholder: 'Leave empty for own IP' },
        { name: 'deadline', label: 'Delivery deadline', type: 'date' },
        { name: 'description', label: 'Brief', type: 'textarea', wide: true, placeholder: 'What is it, what is being delivered, any formats' },
        { name: 'tags', label: 'Tags', wide: true, placeholder: 'e.g. 9:16, 4K, Hindi' },
        { name: 'members', label: 'Team on this project', type: 'members', wide: true },
        { name: 'pinned', label: 'Pin to sidebar', type: 'checkbox', wide: true },
      ],
      onSave: (v) => {
        const rec = save('project', { ...(p ? { id: p.id } : {}), ...v }, { quiet: true });
        if (!p) go('project', { projectId: rec.id, tab: 'board' }); else afterChange();
        toast(p ? 'Project saved' : 'Project created');
      },
      onDelete: p && {
        message: `Delete “${p.name}” with all its tasks, shots, notes and links?`,
        run: () => { remove(p.id); go('projects'); toast('Project deleted'); },
      },
    });
  }

  function editTask(t, preset = {}) {
    needProject(() => {
      const pid = (t && t.projectId) || preset.projectId || contextProject();
      formModal({
        title: t ? 'Edit task' : 'New task',
        values: t || { status: preset.status || 'todo', priority: 'normal', projectId: pid || projectOptions()[0][0], assignee: Store.meta.me || '' },
        fields: [
          ...(pid && !t ? [] : [{ name: 'projectId', label: 'Project', type: 'select', options: projectOptions(), wide: true }]),
          { name: 'title', label: 'Task', required: true, wide: true, placeholder: 'e.g. Client review round 1' },
          { name: 'status', label: 'Status', type: 'select', options: mapOptions(TASK_STATUS) },
          { name: 'priority', label: 'Priority', type: 'select', options: mapOptions(PRIORITY) },
          { name: 'assignee', label: 'Assigned to', type: 'select', options: memberOptions() },
          { name: 'due', label: 'Due', type: 'date' },
          { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
        ],
        onSave: (v) => { save('task', { ...(t ? { id: t.id } : { projectId: pid }), ...v }); toast(t ? 'Task saved' : 'Task added'); },
        onDelete: t && { message: `Delete the task “${t.title}”?`, run: () => { remove(t.id); toast('Task deleted'); } },
      });
    });
  }

  function editShot(s) {
    needProject(() => {
      const pid = (s && s.projectId) || contextProject();
      const firstPid = pid || projectOptions()[0][0];
      formModal({
        title: s ? `Shot ${s.code}` : 'New shot',
        values: s || { status: 'planned', takes: 0, aspect: '16:9', code: nextShotCode(firstPid), projectId: firstPid, assignee: Store.meta.me || '' },
        fields: [
          ...(pid && !s ? [] : [{ name: 'projectId', label: 'Project', type: 'select', options: projectOptions(), wide: true }]),
          { name: 'code', label: 'Shot code', required: true, placeholder: 'SC01_SH010' },
          { name: 'scene', label: 'Scene', placeholder: 'e.g. 01 or Opening' },
          { name: 'status', label: 'Status', type: 'select', options: mapOptions(SHOT_STATUS) },
          { name: 'takes', label: 'Takes so far', type: 'number' },
          { name: 'tool', label: 'Made with', placeholder: 'Camera, Kling, Seedance, Flow…' },
          { name: 'duration', label: 'Length (seconds)', type: 'number' },
          { name: 'aspect', label: 'Aspect ratio', type: 'select', options: ASPECTS.map((a) => [a, a]) },
          { name: 'assignee', label: 'Assigned to', type: 'select', options: memberOptions() },
          { name: 'description', label: 'What happens in the shot', type: 'textarea', wide: true, rows: 3 },
          { name: 'prompt', label: 'Prompt or camera notes', type: 'textarea', wide: true, rows: 4, hint: 'Plain text you keep for reference. The app never sends it anywhere.' },
          { name: 'thumb', label: 'Reference frame', type: 'image', wide: true, hint: 'Stored small (480 px) so it syncs quickly.' },
          { name: 'notes', label: 'Review notes', type: 'textarea', wide: true, rows: 3 },
        ],
        onSave: (v) => { save('shot', { ...(s ? { id: s.id } : { projectId: pid }), ...v }); toast(s ? 'Shot saved' : 'Shot added'); },
        onDelete: s && { message: `Delete shot ${s.code}?`, run: () => { remove(s.id); toast('Shot deleted'); } },
      });
    });
  }

  function editSimple(type, rec, cfg) {
    needProject(() => {
      const pid = (rec && rec.projectId) || contextProject();
      formModal({
        title: rec ? cfg.editTitle : cfg.newTitle,
        values: rec || { projectId: pid || projectOptions()[0][0], ...(cfg.defaults || {}) },
        fields: [...(pid && !rec ? [] : [{ name: 'projectId', label: 'Project', type: 'select', options: projectOptions(), wide: true }]), ...cfg.fields],
        onSave: (v) => { save(type, { ...(rec ? { id: rec.id } : { projectId: pid }), ...v }); toast(cfg.saved); },
        onDelete: rec && { message: cfg.deleteMsg(rec), run: () => { remove(rec.id); toast('Deleted'); } },
      });
    });
  }
  const editNote = (n) => editSimple('note', n, {
    newTitle: 'New note', editTitle: 'Edit note', saved: 'Note saved',
    fields: [{ name: 'title', label: 'Title', required: true, wide: true }, { name: 'body', label: 'Note', type: 'textarea', wide: true, rows: 12 }],
    deleteMsg: (r) => `Delete the note “${r.title}”?`,
  });
  const editLink = (l) => editSimple('link', l, {
    newTitle: 'New file or link', editTitle: 'Edit link', saved: 'Link saved',
    fields: [
      { name: 'label', label: 'Name', required: true, wide: true, placeholder: 'e.g. Final renders folder' },
      { name: 'target', label: 'Link or folder path', required: true, wide: true, placeholder: 'https://… or \\\\STUDIO-PC\\Projects\\… or /Volumes/…' },
      { name: 'note', label: 'Note', wide: true },
    ],
    deleteMsg: (r) => `Delete the link “${r.label}”?`,
  });
  const editMilestone = (m) => editSimple('milestone', m, {
    newTitle: 'New milestone', editTitle: 'Edit milestone', saved: 'Milestone saved',
    fields: [
      { name: 'title', label: 'Milestone', required: true, wide: true, placeholder: 'e.g. Client review round 1' },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'done', label: 'Done', type: 'checkbox' },
    ],
    deleteMsg: (r) => `Delete the milestone “${r.title}”?`,
  });

  function editMember(m) {
    formModal({
      title: m ? 'Edit person' : 'Add person',
      values: m || { color: MEMBER_COLORS[members().length % MEMBER_COLORS.length] },
      fields: [
        { name: 'name', label: 'Name', required: true },
        { name: 'role', label: 'Role', placeholder: 'Director, editor, prompt artist…' },
        { name: 'color', label: 'Colour', type: 'select', options: MEMBER_COLORS.map((c, i) => [c, ['Amber', 'Blue', 'Teal', 'Violet', 'Rose', 'Ochre', 'Green', 'Slate'][i]]) },
        ...(m ? [] : [{ name: 'isMe', label: 'This is me, on this device', type: 'checkbox', wide: true, default: !Store.meta.me }]),
      ],
      onSave: (v) => {
        const { isMe, ...data } = v;
        const rec = save('member', { ...(m ? { id: m.id } : {}), ...data }, { quiet: true });
        if (isMe) Store.setMeta('me', rec.id);
        afterChange();
        toast(m ? 'Saved' : `${rec.name} added`);
      },
      onDelete: m && {
        message: `Remove ${m.name} from the team? Their tasks stay, unassigned.`,
        run: () => {
          remove(m.id);
          if (Store.meta.me === m.id) Store.setMeta('me', null);
          toast('Removed');
        },
      },
    });
  }

  function newMenu() {
    const items = [
      ['new-project', 'Project', 'A shot batch, film, IP, ad or music video'],
      ['new-task', 'Task', 'Something someone needs to do'],
      ['new-shot', 'Shot', 'One line on a shot list'],
      ['new-note', 'Note', 'Brief, feedback, script, world-building'],
      ['new-milestone', 'Milestone', 'A key date on the timeline'],
      ['new-link', 'File or link', 'Where the files live'],
      ['new-member', 'Person', 'Someone on the team'],
    ];
    $('#modal-root').innerHTML = `<div class="overlay" id="overlay"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="new-title">
      <div class="modal-head"><h2 id="new-title">Add new</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="panel-body"><div class="list">${items.map(([a, t, d]) => `<div class="row link" data-action="${a}" tabindex="0"><div class="grow"><div class="title">${t}</div><div class="sub">${d}</div></div>${icon('plus').replace('<svg', '<svg width="18" height="18"')}</div>`).join('')}</div>
      ${contextProject() ? `<p class="muted" style="font-size:.82rem;padding-top:8px">Tasks, shots and notes go into ${esc(get(contextProject()).name)}.</p>` : ''}</div></div></div>`;
    $('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay' || e.target.closest('[data-close]')) closeModal(); });
  }

  // ---------- export / import ----------
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function exportBackup() {
    const records = [...Store.records.values()].map(({ _dirty, ...r }) => r);
    download(`studio-desk-backup-${isoDay(new Date())}.json`, JSON.stringify({ app: 'rmd', version: APP_VERSION, exportedAt: new Date().toISOString(), records }, null, 1), 'application/json');
    toast(`Backup with ${records.length} records downloaded`);
  }

  async function importBackup(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== 'rmd' || !Array.isArray(data.records)) throw new Error('not a backup');
      const changed = [];
      for (const r of data.records) {
        if (!r || typeof r.id !== 'string' || typeof r.updatedAt !== 'number') continue;
        if (isNewer(r, Store.records.get(r.id))) changed.push({ ...r, _dirty: true });
      }
      Store.put(changed);
      if (changed.length) Store.setMeta('sample', false);
      afterChange();
      toast(changed.length ? `Imported ${changed.length} newer records` : 'Everything in that backup is already here');
    } catch (err) {
      toast('That file is not a Studio Desk backup.');
    }
  }

  function exportCsv(scope) {
    const shots = liveIn('shot').filter((s) => scope === 'all' || s.projectId === scope)
      .sort((a, b) => get(a.projectId).name.localeCompare(get(b.projectId).name) || byCode(a, b));
    const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['Project', 'Shot', 'Scene', 'Status', 'Takes', 'Made with', 'Seconds', 'Aspect', 'Assigned to', 'Description', 'Prompt / notes', 'Review notes'];
    const lines = shots.map((s) => [get(s.projectId).name, s.code, s.scene, (SHOT_STATUS[s.status] || {}).label, s.takes, s.tool, s.duration, s.aspect, (memberById(s.assignee) || {}).name, s.description, s.prompt, s.notes].map(cell).join(','));
    const name = scope === 'all' ? 'all-shots' : get(scope).name.replace(/[^\w-]+/g, '-').toLowerCase();
    download(`${name}-${isoDay(new Date())}.csv`, '﻿' + [head.map(cell).join(','), ...lines].join('\r\n'), 'text/csv');
    toast(`${plural(shots.length, 'shot')} exported`);
  }

  // ---------- sync with the studio PC ----------
  const Sync = {
    state: { status: 'off', message: '', server: '' },
    timer: null,
    busy: false,
    url() { return (Store.meta.serverUrl || '').replace(/\/+$/, ''); },
    schedule() {
      if (!this.url()) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.run(), 1500);
    },
    async run() {
      const url = this.url();
      if (!url || this.busy) return;
      if (Store.meta.sample) {
        // Sample projects never leave this device.
        this.state.status = 'paused';
        this.state.message = 'Sample projects are loaded. Clear them to start syncing with the studio PC.';
        updateSyncBadge();
        return;
      }
      this.busy = true;
      this.state.status = 'busy';
      updateSyncBadge();
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeout = setTimeout(() => ctrl && ctrl.abort(), 20000);
      try {
        const pending = [...Store.records.values()].filter((r) => r._dirty);
        const res = await fetch(url + '/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-RMD-Key': Store.meta.syncKey || '' },
          body: JSON.stringify({ since: Store.meta.lastSeq || 0, device: deviceId(), records: pending.map(({ _dirty, ...r }) => r) }),
          signal: ctrl ? ctrl.signal : undefined,
        });
        if (res.status === 401) throw new Error('The team key does not match the studio PC.');
        if (!res.ok) throw new Error(`The studio PC answered with an error (${res.status}).`);
        const data = await res.json();
        const sent = [];
        for (const p of pending) {
          const cur = Store.records.get(p.id);
          if (cur && cur._dirty && cur.updatedAt === p.updatedAt) sent.push({ ...cur, _dirty: false });
        }
        Store.put(sent);
        const incoming = [];
        for (const r of data.records || []) {
          const { _seq, ...rec } = r;
          const local = Store.records.get(rec.id);
          if (isNewer(rec, local)) incoming.push({ ...rec, _dirty: false });
        }
        Store.put(incoming);
        Store.setMeta('lastSeq', data.seq || 0);
        Store.setMeta('lastSyncAt', Date.now());
        this.state.status = 'ok';
        this.state.message = '';
        if (incoming.length) render();
      } catch (err) {
        this.state.status = 'err';
        this.state.message = err.name === 'AbortError' || err instanceof TypeError
          ? 'Cannot reach the studio PC. Check that it is on and on the same Wi-Fi.'
          : err.message;
      } finally {
        clearTimeout(timeout);
        this.busy = false;
        updateSyncBadge();
        if (ui.view === 'sync' && !document.querySelector('#view input:focus')) render();
      }
    },
    async ping(url) {
      const res = await fetch(url.replace(/\/+$/, '') + '/api/ping', { cache: 'no-store' });
      const data = await res.json();
      if (data.app !== 'rmd') throw new Error('not rmd');
      return data;
    },
  };

  function updateSyncBadge() {
    const el = $('#side-sync');
    if (!el) return;
    const pending = [...Store.records.values()].filter((r) => r._dirty).length;
    const st = Sync.state;
    const dot = el.querySelector('.sync-dot');
    dot.className = 'sync-dot ' + (!Sync.url() ? '' : st.status === 'ok' ? 'ok' : st.status === 'busy' || st.status === 'paused' ? 'busy' : st.status === 'err' ? 'err' : '');
    el.querySelector('span').textContent = !Sync.url() ? 'This device only'
      : st.status === 'busy' ? 'Syncing…'
        : st.status === 'paused' ? 'Sync paused: sample data'
        : st.status === 'err' ? 'Studio PC not reachable'
          : `Synced ${ago(Store.meta.lastSyncAt)}${pending ? ` · ${pending} unsent` : ''}`;
  }

  // ---------- toast & theme ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function applyTheme() {
    const t = Store.meta.theme || 'system';
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  // ---------- actions ----------
  const ACTIONS = {
    stop: () => {},
    go: (el) => go(el.dataset.view, el.dataset.view === 'mywork' && el.dataset.all ? { workMember: 'all' } : {}),
    'open-project': (el) => go('project', { projectId: el.dataset.id, tab: el.dataset.tab || 'board' }),
    'open-record': (el) => {
      const r = get(el.dataset.id);
      if (!r) return;
      const editors = { task: editTask, shot: editShot, note: editNote, link: editLink, milestone: editMilestone };
      if (r.type === 'project') go('project', { projectId: r.id, tab: 'board' });
      else if (editors[r.type]) editors[r.type](r);
    },
    tab: (el) => { ui.tab = el.dataset.tab; render(); },
    kind: (el) => { ui.kind = el.dataset.kind; render(); },
    'shot-filter': (el) => { ui.shotStatus = el.dataset.status; render(); },
    'proj-shot-filter': (el) => { ui.projShot = el.dataset.status; render(); },
    'shots-review': () => go('shots', { shotStatus: 'review', shotProject: 'all' }),
    'member-work': (el) => go('mywork', { workMember: el.dataset.id }),
    'new-menu': newMenu,
    'new-project': () => editProject(),
    'new-task': (el) => editTask(null, { status: el.dataset.status }),
    'new-shot': () => editShot(),
    'new-note': () => editNote(),
    'new-link': () => editLink(),
    'new-milestone': () => editMilestone(),
    'new-member': () => editMember(),
    'edit-project': (el) => editProject(get(el.dataset.id)),
    'edit-task': (el) => editTask(get(el.dataset.id)),
    'edit-shot': (el) => editShot(get(el.dataset.id)),
    'edit-note': (el) => editNote(get(el.dataset.id)),
    'edit-link': (el) => editLink(get(el.dataset.id)),
    'edit-milestone': (el) => editMilestone(get(el.dataset.id)),
    'edit-member': (el) => editMember(get(el.dataset.id)),
    'toggle-pin': (el) => { const p = get(el.dataset.id); save('project', { id: p.id, pinned: !p.pinned }); toast(p.pinned ? 'Unpinned' : 'Pinned to sidebar'); },
    take: (el) => { const s = get(el.dataset.id); save('shot', { id: s.id, takes: Math.max(0, (Number(s.takes) || 0) + Number(el.dataset.d)) }); },
    copy: (el) => {
      const text = el.dataset.text;
      const fallback = () => toast(text);
      try { navigator.clipboard.writeText(text).then(() => toast('Copied'), fallback); } catch (err) { fallback(); }
    },
    'sync-save': async () => {
      const url = $('#sync-url').value.trim().replace(/\/+$/, '');
      Store.setMeta('syncKey', $('#sync-key').value);
      if (url && !/^https?:\/\//i.test(url)) { toast('The address starts with http:// — for example http://192.168.1.20:8787'); return; }
      Store.setMeta('serverUrl', url);
      Store.setMeta('declinedAuto', !url);
      if (!url) { Sync.state = { status: 'off', message: '', server: '' }; render(); return; }
      try {
        const info = await Sync.ping(url);
        Sync.state.server = info.name;
      } catch (err) { /* run() reports the problem */ }
      await Sync.run();
      toast(Sync.state.status === 'ok' ? 'Synced with the studio PC' : 'Could not sync. See the message above.');
      render();
    },
    'sync-disconnect': () => { Store.setMeta('serverUrl', ''); Store.setMeta('declinedAuto', true); Sync.state = { status: 'off', message: '', server: '' }; render(); toast('Disconnected. This device keeps its copy.'); },
    'export-backup': exportBackup,
    'import-backup': () => $('#import-file').click(),
    'export-csv': (el) => exportCsv(el.dataset.scope),
    'clear-sample': () => confirmModal('Remove all sample projects and people from this device?', 'Clear sample data', async () => {
      await Store.wipe();
      go('team');
      toast('Sample data cleared. Add yourself first.');
      setTimeout(() => editMember(), 300);
    }),
    'load-sample': () => { seedSample(); go('dashboard'); toast('Sample projects loaded'); },
    wipe: () => confirmModal('Erase every project on this device? Download a backup first if you need one. Data on the studio PC is not touched.', 'Erase this device', async () => {
      await Store.wipe();
      Store.setMeta('serverUrl', '');
      go('dashboard');
      toast('This device is empty');
    }),
  };

  const CHANGES = {
    'project-stage': (el) => { save('project', { id: el.dataset.id, stage: el.value }); toast(`Stage: ${STAGES[el.value].label}`); },
    'shot-status': (el) => { save('shot', { id: el.dataset.id, status: el.value }); },
    'task-done': (el) => { save('task', { id: el.dataset.id, status: 'done' }); toast('Marked done'); },
    'ms-done': (el) => { save('milestone', { id: el.dataset.id, done: el.checked }); },
    'stage-filter': (el) => { ui.stage = el.value; render(); },
    sort: (el) => { ui.sort = el.value; render(); },
    'shot-project': (el) => { ui.shotProject = el.value; render(); },
    'work-member': (el) => { ui.workMember = el.value; render(); },
    me: (el) => { Store.setMeta('me', el.value || null); render(); toast(el.value ? `This device now edits as ${get(el.value).name}` : 'No person chosen'); },
    'auto-sync': (el) => { Store.setMeta('autoSync', el.checked); },
    theme: (el) => { Store.setMeta('theme', el.value); applyTheme(); },
    'import-file': (el) => { if (el.files && el.files[0]) importBackup(el.files[0]); el.value = ''; },
  };

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const fn = ACTIONS[el.dataset.action];
      if (!fn) return;
      if (el.closest('#modal-root') && el.dataset.action.startsWith('new-')) closeModal();
      fn(el, e);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#modal-root').innerHTML) { closeModal(); return; }
      const el = e.target;
      if ((e.key === 'Enter' || e.key === ' ') && el.dataset && el.dataset.action && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA|LABEL)$/.test(el.tagName)) {
        e.preventDefault();
        el.click();
      }
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !$('#modal-root').innerHTML) {
        e.preventDefault();
        $('#search').focus();
      }
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-change]');
      if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el);
    });
    $('#search').addEventListener('input', (e) => {
      const v = e.target.value;
      if (v.trim()) {
        if (ui.view !== 'search') ui.prevView = ui.view;
        ui.view = 'search';
        ui.search = v;
      } else {
        ui.view = ui.prevView === 'search' ? 'dashboard' : ui.prevView;
        ui.search = '';
      }
      renderNav();
      $('#view').innerHTML = VIEWS[ui.view]();
    });

    // Drag tasks between board columns (desktop browsers).
    let dragId = null;
    document.addEventListener('dragstart', (e) => {
      const card = e.target.closest && e.target.closest('[data-drag]');
      if (!card) return;
      dragId = card.dataset.drag;
      card.classList.add('dragging');
      try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (err) { /* ignore */ }
    });
    document.addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.dragging, .drop').forEach((n) => n.classList.remove('dragging', 'drop')); });
    document.addEventListener('dragover', (e) => {
      const col = e.target.closest && e.target.closest('[data-drop]');
      if (!col || !dragId) return;
      e.preventDefault();
      document.querySelectorAll('.drop').forEach((n) => n !== col && n.classList.remove('drop'));
      col.classList.add('drop');
    });
    document.addEventListener('drop', (e) => {
      const col = e.target.closest && e.target.closest('[data-drop]');
      if (!col || !dragId) return;
      e.preventDefault();
      const t = get(dragId);
      if (t && t.status !== col.dataset.drop) save('task', { id: t.id, status: col.dataset.drop });
      dragId = null;
    });

    window.addEventListener('online', () => Sync.run());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Sync.run(); });
    setInterval(() => { if (Store.meta.autoSync !== false) Sync.run(); }, 20000);
    setInterval(updateSyncBadge, 30000);
  }

  // ---------- sample data ----------
  function seedSample() {
    const now = Date.now();
    let tick = 0;
    const recs = [];
    const add = (type, data, hoursAgo, by) => {
      const t = now - hoursAgo * 3600000 + (tick++);
      const rec = { id: uid(), type, createdAt: t - 86400000 * 3, updatedAt: t, updatedBy: deviceId(), editedBy: by, deleted: false, _dirty: true, ...data };
      recs.push(rec);
      return rec;
    };
    const you = add('member', { name: 'You', role: 'Director · owner', color: MEMBER_COLORS[0] }, 200, 'You');
    const riya = add('member', { name: 'Riya Kapoor', role: 'Producer', color: MEMBER_COLORS[1] }, 200, 'You');
    const kabir = add('member', { name: 'Kabir Shah', role: 'Prompt artist', color: MEMBER_COLORS[3] }, 200, 'You');
    const meera = add('member', { name: 'Meera Iyer', role: 'Editor · colourist', color: MEMBER_COLORS[2] }, 200, 'You');
    const all = [you.id, riya.id, kabir.id, meera.id];

    const perfume = add('project', { name: 'Aurelle perfume launch', kind: 'shot', stage: 'production', client: 'Aurelle Parfums', deadline: addDays(9), pinned: true, members: [you.id, kabir.id, meera.id], tags: '9:16 · 4K · 24 shots', description: 'Product and mood shots for the launch reels. Two client review rounds, final delivery as 4K vertical and square.' }, 1, 'Kabir Shah');
    const film = add('project', { name: 'Night Train to Jaisalmer', kind: 'film', stage: 'pre', client: '', deadline: addDays(75), pinned: true, members: all, tags: 'Feature · 110 min', description: 'Feature film. Script lock and previs this month, then location recce and casting.' }, 5, 'Riya Kapoor');
    const ip = add('project', { name: 'Clockwork Gods', kind: 'ip', stage: 'idea', client: '', deadline: '', pinned: true, members: [you.id, kabir.id], tags: 'Animated series · original IP', description: 'Our own animated series: world bible, six lead characters and a pilot episode for pitching.' }, 26, 'You');
    const music = add('project', { name: 'Neon Mandi', kind: 'music', stage: 'post', client: 'Indie label: Raag Records', deadline: addDays(4), members: [you.id, meera.id], tags: '16:9 + 9:16 cut', description: 'Music video, 3:40. Edit locked, now colour and the vertical cut.' }, 3, 'Meera Iyer');
    const tea = add('project', { name: 'Monsoon tea commercial', kind: 'ad', stage: 'delivered', client: 'Chai Ghar', deadline: addDays(-10), members: [riya.id, meera.id], tags: '30 s · TV + social', description: 'Delivered. Waiting on payment.' }, 60, 'Riya Kapoor');

    const task = (p, title, status, extra, h, by) => add('task', { projectId: p.id, title, status, priority: 'normal', ...extra }, h, by);
    task(perfume, 'Lock moodboard with client', 'done', { assignee: you.id, due: addDays(-5) }, 120, 'You');
    task(perfume, 'Generate hero bottle shots (SC01)', 'doing', { assignee: kabir.id, due: addDays(1), priority: 'high' }, 2, 'Kabir Shah');
    task(perfume, 'Client review round 1', 'review', { assignee: you.id, due: addDays(2), priority: 'high' }, 4, 'You');
    task(perfume, 'Upscale approved shots to 4K', 'todo', { assignee: meera.id, due: addDays(6) }, 30, 'You');
    task(perfume, 'Deliver final reels (9:16 + 1:1)', 'todo', { assignee: you.id, due: addDays(9), priority: 'urgent' }, 30, 'You');
    task(film, 'Script lock, draft 6', 'doing', { assignee: you.id, due: addDays(12), priority: 'high' }, 8, 'You');
    task(film, 'Location recce list: Jaisalmer, Pokaran', 'todo', { assignee: riya.id, due: addDays(20) }, 48, 'Riya Kapoor');
    task(film, 'Previs: train corridor sequence', 'todo', { assignee: kabir.id, due: addDays(30) }, 48, 'You');
    task(film, 'Casting shortlist for Meher', 'review', { assignee: riya.id, due: addDays(0) }, 6, 'Riya Kapoor');
    task(film, 'Budget v2', 'done', { assignee: riya.id }, 90, 'Riya Kapoor');
    task(ip, 'World bible v1', 'doing', { assignee: you.id, due: addDays(14) }, 26, 'You');
    task(ip, 'Character sheets: six leads', 'todo', { assignee: kabir.id, due: addDays(21) }, 40, 'You');
    task(ip, 'Register title and trademark', 'todo', { assignee: you.id, priority: 'high', due: addDays(7) }, 40, 'You');
    task(ip, 'Pitch deck', 'todo', { assignee: you.id }, 40, 'You');
    task(music, 'Colour pass', 'doing', { assignee: meera.id, due: addDays(1), priority: 'high' }, 3, 'Meera Iyer');
    task(music, 'Lyric subtitles (Hindi + English)', 'todo', { assignee: meera.id, due: addDays(3) }, 20, 'You');
    task(music, 'Final export: 4K and vertical cut', 'todo', { assignee: meera.id, due: addDays(4), priority: 'urgent' }, 20, 'You');
    task(tea, 'Final delivery to channel', 'done', { assignee: meera.id }, 300, 'Meera Iyer');
    task(tea, 'Send invoice and usage licence', 'todo', { assignee: riya.id, due: addDays(-3), priority: 'high' }, 70, 'Riya Kapoor');

    const shot = (p, code, scene, status, takes, tool, description, extra, h, by) =>
      add('shot', { projectId: p.id, code, scene, status, takes, tool, description, aspect: '9:16', duration: 5, ...extra }, h, by);
    shot(perfume, 'SC01_SH010', '01', 'final', 6, 'Kling 3.0', 'Bottle rises out of still black water, slow push in, gold rim light.', { assignee: kabir.id, prompt: 'Macro, 100mm, black glossy water, single gold rim light from camera left, slow dolly in, droplets settle.' }, 50, 'Kabir Shah');
    shot(perfume, 'SC01_SH020', '01', 'approved', 4, 'Kling 3.0', 'Petals fall past the bottle in slow motion.', { assignee: kabir.id }, 30, 'You');
    shot(perfume, 'SC01_SH030', '01', 'review', 9, 'Seedance 2.5', 'Label close-up, light sweeps across the embossed logo.', { assignee: kabir.id, notes: 'Client: logo must stay sharp for the full 5 s.' }, 2, 'Kabir Shah');
    shot(perfume, 'SC02_SH010', '02', 'review', 3, 'Higgsfield', 'Model turns toward camera, wind in hair, golden hour.', { assignee: kabir.id }, 5, 'Kabir Shah');
    shot(perfume, 'SC02_SH020', '02', 'redo', 7, 'Seedance 2.5', 'Hand lifts the bottle off marble, mist spray.', { assignee: kabir.id, notes: 'Fingers warp at 3 s. Regenerate with a tighter crop.' }, 7, 'You');
    shot(perfume, 'SC02_SH030', '02', 'generating', 2, 'Kling 3.0', 'Top-down: bottle in a ring of jasmine.', { assignee: kabir.id }, 1, 'Kabir Shah');
    shot(perfume, 'SC03_SH010', '03', 'planned', 0, '', 'End card: bottle and logo on black, 2 s hold.', { assignee: meera.id }, 30, 'You');
    shot(film, 'PV_SH010', 'Train corridor', 'planned', 0, 'Previs', 'Long dolly down the corridor as lights flicker.', { aspect: '2.39:1', duration: 12, assignee: kabir.id }, 48, 'You');
    shot(film, 'PV_SH020', 'Train corridor', 'planned', 0, 'Previs', 'Meher looks back; reverse on the empty corridor.', { aspect: '2.39:1', duration: 6, assignee: kabir.id }, 48, 'You');
    shot(music, 'MV_SH040', 'Chorus', 'final', 2, 'Camera', 'Neon market, crane down to singer.', { aspect: '16:9', duration: 8, assignee: meera.id }, 70, 'Meera Iyer');
    shot(music, 'MV_SH050', 'Chorus', 'approved', 3, 'Camera', 'Rain on the tin roof, rack focus to dancers.', { aspect: '16:9', duration: 6, assignee: meera.id }, 70, 'Meera Iyer');

    const ms = (p, title, d, done, h) => add('milestone', { projectId: p.id, title, date: addDays(d), done }, h, 'You');
    ms(perfume, 'Moodboard locked', -5, true, 120);
    ms(perfume, 'Client review round 1', 2, false, 30);
    ms(perfume, 'Client review round 2', 6, false, 30);
    ms(film, 'Script lock', 12, false, 48);
    ms(film, 'Previs complete', 40, false, 48);
    ms(film, 'Shoot starts', 75, false, 48);
    ms(music, 'Picture lock', -2, true, 40);

    add('note', { projectId: ip.id, title: 'Logline', body: 'In a city that runs on a giant clock, a repair girl discovers the gods are just broken machines, and she is the only one who can fix them.' }, 26, 'You');
    add('note', { projectId: ip.id, title: 'Rules of the world', body: '1. Every god is a mechanism with one job.\n2. When a god stops, its job stops for the whole city.\n3. Nobody alive remembers how they were built.' }, 50, 'You');
    add('note', { projectId: perfume.id, title: 'Client feedback, call 2', body: 'Warmer gold, less pink. Logo must be readable in every product shot. No slow motion on the final card.' }, 9, 'Riya Kapoor');
    add('note', { projectId: film.id, title: 'Tone', body: 'Quiet, warm, and lonely. Long takes. The train is a character; it should feel like it breathes.' }, 60, 'You');

    add('link', { projectId: perfume.id, label: 'Approved shots', target: '\\\\STUDIO-PC\\Projects\\Aurelle\\03_Approved', note: 'Only final picks go here' }, 30, 'Meera Iyer');
    add('link', { projectId: perfume.id, label: 'Client brief PDF', target: '\\\\STUDIO-PC\\Projects\\Aurelle\\00_Brief\\brief_v3.pdf' }, 90, 'Riya Kapoor');
    add('link', { projectId: ip.id, label: 'Pitch deck folder', target: '/Volumes/Studio/ClockworkGods/Pitch' }, 40, 'You');
    add('link', { projectId: film.id, label: 'Script, draft 6', target: '\\\\STUDIO-PC\\Projects\\NightTrain\\Script\\NT_draft6.fdx' }, 8, 'You');

    Store.put(recs);
    Store.setMeta('me', you.id);
    Store.setMeta('sample', true);
    Store.setMeta('seeded', true);
  }

  // ---------- boot ----------
  async function boot() {
    await Store.open();
    deviceId();
    applyTheme();
    if (!Store.meta.seeded && Store.records.size === 0) seedSample();
    bindEvents();
    render();
    // When the app is opened from the studio PC itself, connect to it automatically.
    if (!Store.meta.serverUrl && /^https?:$/.test(location.protocol) && !Store.meta.declinedAuto) {
      try {
        const info = await Sync.ping(location.origin);
        Store.setMeta('serverUrl', location.origin);
        Sync.state.server = info.name;
        if (Store.meta.sample && info.records > 0) {
          await Store.wipe();
          Store.setMeta('serverUrl', location.origin);
        }
        Sync.run();
      } catch (err) { /* not served by a studio PC */ }
    }
    if (Sync.url()) Sync.run();
    if ('serviceWorker' in navigator && window.isSecureContext && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  boot();
})();
