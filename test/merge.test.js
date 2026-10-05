'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isNewer, applyChanges, changesSince } = require('../server/merge');

const rec = (id, updatedAt, updatedBy = 'dev-a', extra = {}) => ({ id, type: 'task', updatedAt, updatedBy, ...extra });

test('later edit wins, device id breaks ties', () => {
  assert.ok(isNewer(rec('x', 2), rec('x', 1)));
  assert.ok(!isNewer(rec('x', 1), rec('x', 2)));
  assert.ok(isNewer(rec('x', 5, 'dev-b'), rec('x', 5, 'dev-a')));
  assert.ok(!isNewer(rec('x', 5, 'dev-a'), rec('x', 5, 'dev-a')));
  assert.ok(isNewer(rec('x', 1), undefined));
});

test('applyChanges stores newer records and assigns sequence numbers', () => {
  const state = { seq: 0, records: {} };
  const r1 = applyChanges(state, [rec('a', 10, 'dev-a', { _dirty: true }), rec('b', 10)]);
  assert.deepStrictEqual(r1.accepted, ['a', 'b']);
  assert.strictEqual(state.seq, 2);
  assert.strictEqual(state.records.a._seq, 1);
  assert.ok(!('_dirty' in state.records.a));
});

test('stale edits are rejected and the current copy is returned', () => {
  const state = { seq: 0, records: {} };
  applyChanges(state, [rec('a', 20, 'dev-b', { title: 'server' })]);
  const r = applyChanges(state, [rec('a', 10, 'dev-a', { title: 'old' })]);
  assert.deepStrictEqual(r.accepted, []);
  assert.strictEqual(r.rejected.length, 1);
  assert.strictEqual(r.rejected[0].title, 'server');
  assert.strictEqual(state.records.a.title, 'server');
});

test('re-sending the same record is a no-op', () => {
  const state = { seq: 0, records: {} };
  applyChanges(state, [rec('a', 10)]);
  const r = applyChanges(state, [rec('a', 10)]);
  assert.deepStrictEqual(r, { accepted: [], rejected: [] });
  assert.strictEqual(state.seq, 1);
});

test('invalid records are ignored', () => {
  const state = { seq: 0, records: {} };
  const r = applyChanges(state, [null, {}, { id: 'a', type: 'task' }, { id: 'b', updatedAt: 1 }, 'x']);
  assert.deepStrictEqual(r.accepted, []);
  assert.deepStrictEqual(applyChanges(state, 'nope').accepted, []);
});

test('changesSince returns records after a sequence number in order', () => {
  const state = { seq: 0, records: {} };
  applyChanges(state, [rec('a', 1), rec('b', 1), rec('c', 1)]);
  applyChanges(state, [rec('a', 2)]);
  assert.deepStrictEqual(changesSince(state, 0).map((r) => r.id), ['b', 'c', 'a']);
  assert.deepStrictEqual(changesSince(state, 3).map((r) => r.id), ['a']);
  assert.deepStrictEqual(changesSince(state, 4), []);
});
