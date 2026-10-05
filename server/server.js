'use strict';
// RMD Studio Desk sync server.
// Serves the app to every device on the studio network and keeps the shared
// copy of all projects. No internet, no accounts, no third-party services.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { applyChanges, changesSince } = require('./merge');

const VERSION = require('../package.json').version;
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const TEAM_KEY = process.env.RMD_KEY || '';
const DATA_DIR = path.resolve(process.env.RMD_DATA_DIR || path.join(__dirname, '..', 'data'));
const APP_DIR = path.join(__dirname, '..', 'app');
const DATA_FILE = path.join(DATA_DIR, 'rmd-data.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 30;
const MAX_BODY = 50 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (parsed && typeof parsed.seq === 'number' && parsed.records) return parsed;
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not read data file, starting empty:', err.message);
  }
  return { seq: 0, records: {} };
}

const state = loadState();

function saveState() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, DATA_FILE);
  backupDaily();
}

function backupDaily() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const target = path.join(BACKUP_DIR, `rmd-${day}.json`);
  fs.copyFileSync(DATA_FILE, target);
  const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^rmd-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  for (const f of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) fs.unlinkSync(path.join(BACKUP_DIR, f));
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-rmd-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Request too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleSync(req, res) {
  if (TEAM_KEY && req.headers['x-rmd-key'] !== TEAM_KEY) {
    sendJson(res, 401, { error: 'Team key does not match the key set on the studio PC.' });
    return;
  }
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    sendJson(res, err.status || 400, { error: err.status ? err.message : 'Body is not valid JSON.' });
    return;
  }
  const since = Number(body.since) || 0;
  const { accepted, rejected } = applyChanges(state, body.records);
  if (accepted.length) saveState();
  const out = changesSince(state, since);
  const seen = new Set(out.map((r) => r.id));
  for (const r of rejected) if (!seen.has(r.id)) out.push(r);
  sendJson(res, 200, { seq: state.seq, accepted: accepted.length, records: out });
}

function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch (err) {
    send(res, 400, 'Bad request');
    return;
  }
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.resolve(APP_DIR, rel);
  if (!file.startsWith(APP_DIR + path.sep)) { send(res, 403, 'Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { send(res, 404, 'Not found', { 'Content-Type': 'text/plain' }); return; }
    send(res, 200, data, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { send(res, 204, ''); return; }
  const pathname = req.url.split('?')[0];
  if (pathname === '/api/ping' && req.method === 'GET') {
    sendJson(res, 200, {
      app: 'rmd', version: VERSION, name: os.hostname(), seq: state.seq,
      records: Object.keys(state.records).length, protected: Boolean(TEAM_KEY),
    });
    return;
  }
  if (pathname === '/api/sync' && req.method === 'POST') {
    handleSync(req, res).catch((err) => { console.error(err); sendJson(res, 500, { error: 'Sync failed on the server.' }); });
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') { serveStatic(req, res); return; }
  send(res, 405, 'Method not allowed');
});

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`\nRMD Studio Desk ${VERSION} is running.\n`);
    console.log(`  On this PC:        http://localhost:${PORT}`);
    for (const ip of lanAddresses()) console.log(`  On phones/laptops: http://${ip}:${PORT}`);
    console.log(`\n  Data folder: ${DATA_DIR}`);
    console.log(TEAM_KEY ? '  Team key: ON (devices must enter it in Sync)' : '  Team key: OFF (set RMD_KEY to require one)');
    console.log('\nKeep this window open while the team works. Press Ctrl+C to stop.\n');
  });
}

module.exports = { server, state };
