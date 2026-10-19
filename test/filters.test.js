'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const filters = require('../docs/technology-filters.js');
const mapping = require('../docs/technology-mapping.js');
const seedData = require('../db/seed-data.json');

const ALL = { type: null, status: null };

// one row for every type / status combination
const rows = [];
for (const type of filters.TYPE_OPTIONS) {
  for (const status of filters.STATUS_OPTIONS) {
    rows.push({ type, status });
  }
}

test('options list the known types and statuses', () => {
  assert.deepEqual(filters.TYPE_OPTIONS, ['Datastores', 'Data Management', 'Infrastructure', 'Language']);
  assert.deepEqual(filters.STATUS_OPTIONS, ['ADOPT', 'TRIAL', 'ASSESS', 'HOLD']);
});

test('each type alone matches only rows of that type', () => {
  for (const type of filters.TYPE_OPTIONS) {
    const matched = rows.filter((row) => filters.matches(row, { type, status: null }));
    assert.equal(matched.length, filters.STATUS_OPTIONS.length);
    assert.ok(matched.every((row) => row.type === type));
  }
});

test('each status alone matches only rows with that status', () => {
  for (const status of filters.STATUS_OPTIONS) {
    const matched = rows.filter((row) => filters.matches(row, { type: null, status }));
    assert.equal(matched.length, filters.TYPE_OPTIONS.length);
    assert.ok(matched.every((row) => row.status === status));
  }
});

test('type and status combine with AND', () => {
  const f = { type: 'Datastores', status: 'HOLD' };
  assert.equal(filters.matches({ type: 'Datastores', status: 'HOLD' }, f), true);
  assert.equal(filters.matches({ type: 'Datastores', status: 'ADOPT' }, f), false);
  assert.equal(filters.matches({ type: 'Language', status: 'HOLD' }, f), false);
  assert.equal(filters.countMatching(rows, f), 1);
  // no Data Management technology is on HOLD in the seed data
  assert.equal(filters.countMatching(seedData, { type: 'Data Management', status: 'HOLD' }), 0);
});

test('"All" matches everything', () => {
  assert.equal(filters.countMatching(rows, ALL), rows.length);
  assert.equal(filters.countMatching(rows, { type: '', status: '' }), rows.length);
  assert.equal(filters.countMatching(rows, {}), rows.length);
  assert.equal(filters.isActive(ALL), false);
  assert.equal(filters.isActive({ type: '', status: '' }), false);
  assert.equal(filters.isActive({ type: 'Language', status: null }), true);
  assert.equal(filters.isActive({ type: null, status: 'HOLD' }), true);
});

test('normalizeFilters turns unknown values into "All"', () => {
  assert.deepEqual(filters.normalizeFilters({ type: 'Foo', status: 'hold' }), ALL);
  assert.deepEqual(filters.normalizeFilters({ type: 'toString', status: '__proto__' }), ALL);
  assert.deepEqual(filters.normalizeFilters(undefined), ALL);
  assert.deepEqual(filters.normalizeFilters({ type: 'Language', status: 'TRIAL' }), { type: 'Language', status: 'TRIAL' });
});

test('parseFilters reads a valid query string', () => {
  assert.deepEqual(filters.parseFilters('?type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filters.parseFilters('?type=Data+Management'), { type: 'Data Management', status: null });
  assert.deepEqual(filters.parseFilters('?type=Data%20Management'), { type: 'Data Management', status: null });
  assert.deepEqual(filters.parseFilters('status=ASSESS'), { type: null, status: 'ASSESS' });
});

test('parseFilters ignores unknown values', () => {
  assert.deepEqual(filters.parseFilters('?type=Foo&status=hold'), ALL);
  assert.deepEqual(filters.parseFilters('?type=toString&status=constructor'), ALL);
  assert.deepEqual(filters.parseFilters('?type=Foo&status=HOLD'), { type: null, status: 'HOLD' });
  assert.deepEqual(filters.parseFilters('?other=1'), ALL);
});

test('parseFilters handles empty input and repeated parameters', () => {
  assert.deepEqual(filters.parseFilters(''), ALL);
  assert.deepEqual(filters.parseFilters('?'), ALL);
  assert.deepEqual(filters.parseFilters(undefined), ALL);
  // the first occurrence wins
  assert.deepEqual(filters.parseFilters('?status=HOLD&status=ADOPT'), { type: null, status: 'HOLD' });
});

test('toSearch builds the query string and round-trips', () => {
  assert.equal(filters.toSearch(ALL, ''), '');
  assert.equal(filters.toSearch({ type: 'Datastores', status: 'HOLD' }, ''), '?type=Datastores&status=HOLD');
  for (const type of [null].concat(filters.TYPE_OPTIONS)) {
    for (const status of [null].concat(filters.STATUS_OPTIONS)) {
      const search = filters.toSearch({ type, status }, '');
      assert.deepEqual(filters.parseFilters(search), { type, status });
    }
  }
});

test('toSearch keeps unrelated parameters and drops reset filters', () => {
  assert.equal(filters.toSearch({ type: 'Language', status: null }, '?foo=bar&status=HOLD'), '?foo=bar&type=Language');
  assert.equal(filters.toSearch(ALL, '?type=Language&status=HOLD'), '');
  assert.equal(filters.toSearch(ALL, '?foo=bar&type=Language'), '?foo=bar');
  assert.equal(filters.toSearch({ type: 'Foo', status: null }, ''), '');
});

test('entryMatches agrees with matches on radar entries', () => {
  const all = [ALL];
  for (const type of filters.TYPE_OPTIONS) all.push({ type, status: null });
  for (const status of filters.STATUS_OPTIONS) all.push({ type: null, status });
  all.push({ type: 'Datastores', status: 'HOLD' });
  seedData.forEach((row, index) => {
    const entry = mapping.toRadarEntry(Object.assign({ number: index + 1 }, row));
    for (const f of all) {
      assert.equal(filters.entryMatches(entry, f), filters.matches(row, f));
    }
  });
});

test('countMatching and summaryText on the seed data', () => {
  const total = seedData.length;
  assert.equal(filters.summaryText(filters.countMatching(seedData, ALL), total), `Showing ${total} of ${total} technologies`);
  const datastores = seedData.filter((row) => row.type === 'Datastores').length;
  assert.equal(filters.countMatching(seedData, { type: 'Datastores', status: null }), datastores);
  const hold = seedData.filter((row) => row.status === 'HOLD').length;
  assert.equal(filters.countMatching(seedData, { type: null, status: 'HOLD' }), hold);
  const both = seedData.filter((row) => row.type === 'Datastores' && row.status === 'HOLD').length;
  assert.ok(both > 0);
  assert.equal(filters.countMatching(seedData, { type: 'Datastores', status: 'HOLD' }), both);
  assert.equal(filters.summaryText(0, total), `Showing 0 of ${total} technologies`);
});
