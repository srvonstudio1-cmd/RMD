'use strict';
// Last-writer-wins merge used by the studio sync server.
// The browser app carries an identical copy of `isNewer` in app/app.js.

function isNewer(a, b) {
  if (!b) return true;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt;
  return String(a.updatedBy || '') > String(b.updatedBy || '');
}

function isValidRecord(rec) {
  return rec && typeof rec.id === 'string' && rec.id.length > 0 && rec.id.length <= 64 &&
    typeof rec.type === 'string' && typeof rec.updatedAt === 'number';
}

// Applies incoming records to `state` ({ seq, records }) and returns
// { accepted: [ids], rejected: [current server copies] }.
function applyChanges(state, incoming) {
  const accepted = [];
  const rejected = [];
  for (const rec of Array.isArray(incoming) ? incoming : []) {
    if (!isValidRecord(rec)) continue;
    const current = state.records[rec.id];
    if (current && !isNewer(rec, current)) {
      if (current.updatedAt !== rec.updatedAt || current.updatedBy !== rec.updatedBy) rejected.push(current);
      continue;
    }
    state.seq += 1;
    const stored = { ...rec, _seq: state.seq };
    delete stored._dirty;
    state.records[rec.id] = stored;
    accepted.push(rec.id);
  }
  return { accepted, rejected };
}

function changesSince(state, since) {
  const from = Number(since) || 0;
  return Object.values(state.records)
    .filter((r) => r._seq > from)
    .sort((a, b) => a._seq - b._seq);
}

module.exports = { isNewer, isValidRecord, applyChanges, changesSince };
