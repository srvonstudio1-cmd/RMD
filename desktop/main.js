'use strict';
// Studio Desk desktop app (Windows, macOS, Linux).
// Shows the same app as the browser version and can run the studio sync
// server built in, so the studio PC needs no other software.

const { app, BrowserWindow, protocol, net, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { createStudioServer, lanAddresses } = require('../server/server');

const APP_DIR = path.join(__dirname, '..', 'app');
const DEFAULT_PORT = 8787;

// A fixed origin (studio://app) keeps each computer's offline data in the same
// place across updates.
protocol.registerSchemesAsPrivileged([
  { scheme: 'studio', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

let win = null;
let studio = null;
let hostError = '';

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const dataDir = () => path.join(app.getPath('userData'), 'studio-server');

function readSettings() {
  try {
    return { hosting: false, key: '', port: DEFAULT_PORT, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) };
  } catch (err) {
    return { hosting: false, key: '', port: DEFAULT_PORT };
  }
}

function writeSettings(next) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2));
}

async function startHosting(settings) {
  await stopHosting();
  hostError = '';
  const s = createStudioServer({ dataDir: dataDir(), appDir: APP_DIR, key: settings.key });
  try {
    await s.listen(settings.port, '0.0.0.0');
    studio = s;
  } catch (err) {
    hostError = err.code === 'EADDRINUSE'
      ? `Port ${settings.port} is busy. Another studio server is probably running on this computer.`
      : `The server could not start: ${err.message}`;
  }
}

async function stopHosting() {
  if (studio) {
    const s = studio;
    studio = null;
    await s.close();
  }
}

function hostInfo() {
  const settings = readSettings();
  return {
    enabled: settings.hosting,
    running: Boolean(studio),
    port: settings.port,
    key: settings.key,
    addresses: lanAddresses(),
    dataDir: dataDir(),
    error: hostError,
  };
}

// ---------- Tailscale: a secure https:// address for iPhones and remote use ----------
// Tailscale links the team's devices privately. `tailscale serve` gives the
// studio server an https://<computer>.<tailnet>.ts.net address with a real
// certificate, which lets iPhones install Studio Desk as a fully offline app.

function tailscaleCandidates() {
  if (process.env.STUDIO_TAILSCALE) return [process.env.STUDIO_TAILSCALE];
  if (process.platform === 'win32') {
    return [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Tailscale', 'tailscale.exe'), 'tailscale'];
  }
  if (process.platform === 'darwin') {
    return ['/Applications/Tailscale.app/Contents/MacOS/Tailscale', '/opt/homebrew/bin/tailscale', '/usr/local/bin/tailscale', 'tailscale'];
  }
  return ['/usr/bin/tailscale', '/usr/local/bin/tailscale', 'tailscale'];
}

function runTailscale(bin, args, timeout) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout || ''), stderr: String(stderr || ''), missing: Boolean(err && err.code === 'ENOENT') });
    });
  });
}

let tailscaleBin = null;
async function findTailscale() {
  if (tailscaleBin) return tailscaleBin;
  for (const c of tailscaleCandidates()) {
    if (path.isAbsolute(c) && !fs.existsSync(c)) continue;
    const r = await runTailscale(c, ['version'], 6000);
    if (r.ok) { tailscaleBin = c; return c; }
  }
  return null;
}

function lastLine(text) {
  const lines = String(text).trim().split(/\r?\n/).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : '';
}

async function tailscaleInfo() {
  const port = readSettings().port;
  const bin = await findTailscale();
  if (!bin) return { installed: false };
  const st = await runTailscale(bin, ['status', '--json'], 8000);
  let status = null;
  try { status = JSON.parse(st.stdout); } catch (err) { /* not running */ }
  if (!status || status.BackendState !== 'Running') {
    return { installed: true, running: false, message: 'Tailscale is installed but not connected. Open Tailscale on this computer and sign in.' };
  }
  const dnsName = String((status.Self && status.Self.DNSName) || '').replace(/\.$/, '');
  const ip = ((status.Self && status.Self.TailscaleIPs) || []).find((a) => a.includes('.')) || '';
  const sv = await runTailscale(bin, ['serve', 'status', '--json'], 8000);
  let serving = false;
  try {
    const web = JSON.stringify(JSON.parse(sv.stdout || '{}').Web || {});
    serving = web.includes(`127.0.0.1:${port}`) || web.includes(`localhost:${port}`);
  } catch (err) { /* older Tailscale */ }
  return {
    installed: true,
    running: true,
    dnsName,
    ip,
    serving,
    httpsUrl: serving && dnsName ? `https://${dnsName}` : '',
    plainUrl: ip ? `http://${ip}:${port}` : '',
  };
}

async function tailscaleEnable() {
  const bin = await findTailscale();
  if (!bin) return { installed: false };
  const port = readSettings().port;
  const r = await runTailscale(bin, ['serve', '--bg', String(port)], 25000);
  const out = `${r.stdout}\n${r.stderr}`;
  const link = out.match(/https:\/\/login\.tailscale\.com\/\S+/);
  const info = await tailscaleInfo();
  if (info.serving) return info;
  if (link) return { ...info, approveUrl: link[0] };
  if (/access denied|permission|operator/i.test(out)) {
    return { ...info, error: 'Tailscale needs permission. On Linux run once in a terminal: sudo tailscale set --operator=$USER' };
  }
  return { ...info, error: lastLine(r.stderr) || lastLine(r.stdout) || 'Tailscale could not share the server.' };
}

async function tailscaleDisable() {
  const bin = await findTailscale();
  if (bin) await runTailscale(bin, ['serve', '--https=443', 'off'], 15000);
  return tailscaleInfo();
}

ipcMain.handle('tailscale:get', () => tailscaleInfo());
ipcMain.handle('tailscale:enable', () => tailscaleEnable());
ipcMain.handle('tailscale:disable', () => tailscaleDisable());
ipcMain.handle('open-external', (_event, url) => {
  if (/^https:\/\//i.test(String(url))) return shell.openExternal(url);
  return false;
});

ipcMain.handle('host:get', () => hostInfo());
ipcMain.handle('host:set', async (_event, opts = {}) => {
  const settings = { ...readSettings(), hosting: Boolean(opts.enabled), key: typeof opts.key === 'string' ? opts.key : '' };
  writeSettings(settings);
  if (settings.hosting) await startHosting(settings);
  else { await stopHosting(); hostError = ''; }
  return hostInfo();
});
ipcMain.handle('host:open-folder', () => {
  fs.mkdirSync(dataDir(), { recursive: true });
  return shell.openPath(dataDir());
});

function serveAppFiles() {
  protocol.handle('studio', (request) => {
    const { pathname } = new URL(request.url);
    let rel;
    try { rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html'; } catch (err) { return new Response('Bad request', { status: 400 }); }
    const file = path.resolve(APP_DIR, rel);
    if (!file.startsWith(APP_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 380,
    minHeight: 560,
    title: 'Studio Desk',
    backgroundColor: '#0e131a',
    autoHideMenuBar: true,
    icon: path.join(APP_DIR, 'icons', 'icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      // Lets the app reach a studio server at http://192.168.x.x on the
      // local network from the secure studio:// page.
      allowRunningInsecureContent: true,
    },
  });

  // Links to websites open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('studio://')) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  win.loadURL('studio://app/index.html');
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(async () => {
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
    serveAppFiles();
    const settings = readSettings();
    if (settings.hosting) await startHosting(settings);
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => { stopHosting(); });
}
