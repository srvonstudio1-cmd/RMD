'use strict';
// RMD Studio Desk sync server.
// Serves the app to every device on the studio network, keeps the shared copy
// of all projects and stores attached files. No internet, no accounts, no
// third-party services. Runs on its own (`npm start`) or inside the desktop app.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { applyChanges, changesSince } = require('./merge');

const VERSION = require('../package.json').version;
const KEEP_BACKUPS = 30;
const MAX_BODY = 50 * 1024 * 1024;
const MAX_FILE = 2 * 1024 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

function createStudioServer(options = {}) {
  const dataDir = path.resolve(options.dataDir || path.join(__dirname, '..', 'data'));
  const appDir = path.resolve(options.appDir || path.join(__dirname, '..', 'app'));
  const teamKey = options.key || '';
  const dataFile = path.join(dataDir, 'rmd-data.json');
  const backupDir = path.join(dataDir, 'backups');
  const filesDir = path.join(dataDir, 'files');

  function loadState() {
    try {
      const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      if (parsed && typeof parsed.seq === 'number' && parsed.records) return parsed;
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('Could not read data file, starting empty:', err.message);
    }
    return { seq: 0, records: {} };
  }

  const state = loadState();

  function saveState() {
    fs.mkdirSync(dataDir, { recursive: true });
    const tmp = dataFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, dataFile);
    backupDaily();
  }

  function backupDaily() {
    fs.mkdirSync(backupDir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    fs.copyFileSync(dataFile, path.join(backupDir, `rmd-${day}.json`));
    const old = fs.readdirSync(backupDir).filter((f) => /^rmd-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const f of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) fs.unlinkSync(path.join(backupDir, f));
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

  function authorized(req, url) {
    if (!teamKey) return true;
    return req.headers['x-rmd-key'] === teamKey || url.searchParams.get('key') === teamKey;
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

  // Files are stored by the SHA-256 of their content, so the same file uploaded
  // twice is kept once.
  function handleUpload(req, res) {
    fs.mkdirSync(filesDir, { recursive: true });
    const tmp = path.join(filesDir, `upload-${process.pid}-${crypto.randomBytes(6).toString('hex')}.part`);
    const out = fs.createWriteStream(tmp);
    const hash = crypto.createHash('sha256');
    let size = 0;
    let failed = false;
    const fail = (status, message) => {
      if (failed) return;
      failed = true;
      out.destroy();
      fs.rm(tmp, { force: true }, () => {});
      sendJson(res, status, { error: message });
    };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_FILE) { fail(413, 'File is larger than 2 GB.'); req.destroy(); return; }
      hash.update(chunk);
      if (!out.write(chunk)) req.pause();
    });
    out.on('drain', () => req.resume());
    req.on('error', () => fail(400, 'Upload was interrupted.'));
    out.on('error', () => fail(500, 'The studio PC could not save the file.'));
    req.on('end', () => {
      if (failed) return;
      out.end(() => {
        const digest = hash.digest('hex');
        const target = path.join(filesDir, digest);
        fs.rename(tmp, target, (err) => {
          if (err) { fail(500, 'The studio PC could not save the file.'); return; }
          sendJson(res, 200, { hash: digest, size });
        });
      });
    });
  }

  function handleDownload(req, res, url, digest) {
    if (!/^[a-f0-9]{64}$/.test(digest)) { sendJson(res, 400, { error: 'Bad file id.' }); return; }
    const file = path.join(filesDir, digest);
    fs.stat(file, (err, st) => {
      if (err) { sendJson(res, 404, { error: 'File not found on the studio PC.' }); return; }
      const type = url.searchParams.get('type') || '';
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Private-Network': 'true',
        'Content-Type': /^[\w.+-]+\/[\w.+-]+$/.test(type) ? type : 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': 'private, max-age=31536000, immutable',
      });
      fs.createReadStream(file).pipe(res);
    });
  }

  function serveStatic(req, res, url) {
    let urlPath;
    try {
      urlPath = decodeURIComponent(url.pathname);
    } catch (err) {
      send(res, 400, 'Bad request');
      return;
    }
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const file = path.resolve(appDir, rel);
    if (!file.startsWith(appDir + path.sep)) { send(res, 403, 'Forbidden'); return; }
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
    let url;
    try {
      url = new URL(req.url, 'http://studio');
    } catch (err) {
      send(res, 400, 'Bad request');
      return;
    }
    const p = url.pathname;
    if (p === '/api/ping' && req.method === 'GET') {
      sendJson(res, 200, {
        app: 'rmd', version: VERSION, name: options.name || os.hostname(), seq: state.seq,
        records: Object.keys(state.records).length, protected: Boolean(teamKey),
      });
      return;
    }
    if (p.startsWith('/api/')) {
      if (!authorized(req, url)) { sendJson(res, 401, { error: 'Team key does not match the key set on the studio PC.' }); return; }
      if (p === '/api/sync' && req.method === 'POST') {
        handleSync(req, res).catch((err) => { console.error(err); sendJson(res, 500, { error: 'Sync failed on the server.' }); });
        return;
      }
      if (p === '/api/files' && req.method === 'POST') { handleUpload(req, res); return; }
      if (p.startsWith('/api/files/') && req.method === 'GET') { handleDownload(req, res, url, p.slice('/api/files/'.length)); return; }
      sendJson(res, 404, { error: 'Unknown API route.' });
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') { serveStatic(req, res, url); return; }
    send(res, 405, 'Method not allowed');
  });

  return {
    server,
    state,
    dataDir,
    listen(port, host) {
      return new Promise((resolve, reject) => {
        const onError = (err) => { server.off('listening', onListening); reject(err); };
        const onListening = () => { server.off('error', onError); resolve(server.address().port); };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });
    },
    close() {
      return new Promise((resolve) => {
        server.close(() => resolve());
        if (server.closeAllConnections) server.closeAllConnections();
      });
    },
  };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8787;
  const key = process.env.RMD_KEY || '';
  const studio = createStudioServer({ dataDir: process.env.RMD_DATA_DIR, key });
  studio.listen(port, process.env.HOST || '0.0.0.0').then(() => {
    console.log(`\nRMD Studio Desk ${VERSION} is running.\n`);
    console.log(`  On this PC:        http://localhost:${port}`);
    for (const ip of lanAddresses()) console.log(`  On phones/laptops: http://${ip}:${port}`);
    console.log(`\n  Data folder: ${studio.dataDir}`);
    console.log(key ? '  Team key: ON (devices must enter it in Sync)' : '  Team key: OFF (set RMD_KEY to require one)');
    console.log('\nKeep this window open while the team works. Press Ctrl+C to stop.\n');
  }).catch((err) => {
    console.error(err.code === 'EADDRINUSE'
      ? `Port ${port} is already in use. Is the studio server already running? Close it, or set PORT to another number.`
      : err.message);
    process.exit(1);
  });
}

module.exports = { createStudioServer, lanAddresses, VERSION };
