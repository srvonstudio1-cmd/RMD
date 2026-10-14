'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rmd-test-'));
let proc;

test.before(async () => {
  proc = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', RMD_DATA_DIR: dataDir, RMD_KEY: 'secret' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/ping'); return; } catch (e) { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('server did not start');
});
test.after(() => { proc.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const sync = (body, key = 'secret') => fetch(BASE + '/api/sync', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-rmd-key': key }, body: JSON.stringify(body),
});

test('serves the app', async () => {
  const res = await fetch(BASE + '/');
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /Studio Desk/);
  for (const probe of ['/../package.json', '/%2e%2e/package.json', '/..%2fpackage.json']) {
    const r = await fetch(BASE + probe);
    assert.notStrictEqual(r.status, 200, probe);
  }
  assert.strictEqual((await fetch(BASE + '/%E0%A4%A')).status, 400);
  assert.strictEqual((await fetch(BASE + '/api/ping')).status, 200, 'server survived bad URLs');
});

test('ping reports the server', async () => {
  const info = await (await fetch(BASE + '/api/ping')).json();
  assert.strictEqual(info.app, 'rmd');
  assert.strictEqual(info.protected, true);
});

test('wrong team key is refused', async () => {
  assert.strictEqual((await sync({ since: 0, records: [] }, 'wrong')).status, 401);
});

test('two devices exchange changes and data is saved to disk', async () => {
  const a = await (await sync({ since: 0, records: [{ id: 'p1', type: 'project', name: 'Film', updatedAt: 100, updatedBy: 'dev-a' }] })).json();
  assert.strictEqual(a.accepted, 1);
  const b = await (await sync({ since: 0, records: [{ id: 't1', type: 'task', projectId: 'p1', title: 'Edit', updatedAt: 200, updatedBy: 'dev-b' }] })).json();
  assert.deepStrictEqual(b.records.map((r) => r.id).sort(), ['p1', 't1']);
  const a2 = await (await sync({ since: a.seq, records: [] })).json();
  assert.deepStrictEqual(a2.records.map((r) => r.id), ['t1']);
  // Device A sends an older edit of t1: it is refused and gets the server copy back.
  const a3 = await (await sync({ since: a2.seq, records: [{ id: 't1', type: 'task', title: 'Stale', updatedAt: 150, updatedBy: 'dev-a' }] })).json();
  assert.strictEqual(a3.accepted, 0);
  assert.strictEqual(a3.records[0].title, 'Edit');
  const disk = JSON.parse(fs.readFileSync(path.join(dataDir, 'rmd-data.json'), 'utf8'));
  assert.strictEqual(disk.records.t1.title, 'Edit');
  assert.ok(fs.readdirSync(path.join(dataDir, 'backups')).length === 1);
});

test('files upload once per content and download with the team key', async () => {
  const body = Buffer.from('frame data for SC01_SH010');
  const up = await fetch(BASE + '/api/files', { method: 'POST', headers: { 'x-rmd-key': 'secret' }, body });
  assert.strictEqual(up.status, 200);
  const { hash, size } = await up.json();
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.strictEqual(size, body.length);
  const again = await (await fetch(BASE + '/api/files', { method: 'POST', headers: { 'x-rmd-key': 'secret' }, body })).json();
  assert.strictEqual(again.hash, hash);
  assert.deepStrictEqual(fs.readdirSync(path.join(dataDir, 'files')), [hash]);
  const down = await fetch(`${BASE}/api/files/${hash}?type=image/png`, { headers: { 'x-rmd-key': 'secret' } });
  assert.strictEqual(down.status, 200);
  assert.strictEqual(down.headers.get('content-type'), 'image/png');
  assert.strictEqual(Buffer.from(await down.arrayBuffer()).toString(), body.toString());
  assert.strictEqual((await fetch(`${BASE}/api/files/${hash}`)).status, 401);
  assert.strictEqual((await fetch(`${BASE}/api/files/${'0'.repeat(64)}`, { headers: { 'x-rmd-key': 'secret' } })).status, 404);
  assert.strictEqual((await fetch(`${BASE}/api/files/..%2f..%2fpackage.json`, { headers: { 'x-rmd-key': 'secret' } })).status, 400);
});

test('bad JSON is a 400', async () => {
  const res = await fetch(BASE + '/api/sync', { method: 'POST', headers: { 'x-rmd-key': 'secret' }, body: '{nope' });
  assert.strictEqual(res.status, 400);
});
