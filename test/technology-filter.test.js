'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const filter = require('../docs/technology-filter.js');
const mapping = require('../docs/technology-mapping.js');
const seedData = require('../db/seed-data.json');

const ALL = { type: '', status: '' };

const rows = [
  { type: 'Datastores', status: 'HOLD' },
  { type: 'Datastores', status: 'ADOPT' },
  { type: 'Language', status: 'HOLD' },
  { type: 'Infrastructure', status: 'TRIAL' }
];

test('option lists come from the mapping', () => {
  assert.deepEqual(filter.TYPES, ['Datastores', 'Data Management', 'Infrastructure', 'Language']);
  assert.deepEqual(filter.STATUSES, ['ADOPT', 'TRIAL', 'ASSESS', 'HOLD']);
  assert.deepEqual([...filter.TYPES].sort(), Object.keys(mapping.TYPES).sort());
  assert.deepEqual(filter.STATUSES, Object.keys(mapping.STATUSES));
  assert.equal(filter.ALL, '');
});

test('matches: "All" matches every row', () => {
  assert.equal(rows.filter((row) => filter.matches(row, ALL)).length, rows.length);
});

test('matches: type alone', () => {
  const result = rows.filter((row) => filter.matches(row, { type: 'Datastores', status: '' }));
  assert.deepEqual(result, [rows[0], rows[1]]);
});

test('matches: status alone', () => {
  const result = rows.filter((row) => filter.matches(row, { type: '', status: 'HOLD' }));
  assert.deepEqual(result, [rows[0], rows[2]]);
});

test('matches: type and status combine with AND', () => {
  const both = { type: 'Datastores', status: 'HOLD' };
  assert.deepEqual(rows.filter((row) => filter.matches(row, both)), [rows[0]]);
  assert.equal(filter.matches(rows[3], { type: 'Infrastructure', status: 'HOLD' }), false);
});

test('matches: ignores unknown filter values (treated as All)', () => {
  assert.equal(filter.matches(rows[0], { type: 'nope', status: '' }), true);
});

test('normalizeFilters rejects everything that is not an allowed string', () => {
  const bad = ['__proto__', 'toString', 'constructor', 'datastores', 'hold', 'foo', ['Datastores'], {}, null, undefined, 3, true];
  bad.forEach((value) => {
    assert.deepEqual(filter.normalizeFilters({ type: value, status: value }), ALL, String(value));
  });
  assert.deepEqual(filter.normalizeFilters(null), ALL);
  assert.deepEqual(filter.normalizeFilters(undefined), ALL);
  assert.deepEqual(filter.normalizeFilters('type'), ALL);
  assert.deepEqual(
    filter.normalizeFilters({ type: 'Language', status: 'ASSESS', extra: 1 }),
    { type: 'Language', status: 'ASSESS' }
  );
});

test('parseFilters: valid values', () => {
  assert.deepEqual(filter.parseFilters('?type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filter.parseFilters('?type=Data%20Management'), { type: 'Data Management', status: '' });
  assert.deepEqual(filter.parseFilters('?type=Data+Management'), { type: 'Data Management', status: '' });
  assert.deepEqual(filter.parseFilters('status=TRIAL'), { type: '', status: 'TRIAL' });
});

test('parseFilters: unknown values are ignored', () => {
  assert.deepEqual(filter.parseFilters('?type=foo&status=hold'), ALL);
  assert.deepEqual(filter.parseFilters('?type=datastores'), ALL);
  assert.deepEqual(filter.parseFilters('?type=__proto__&status=toString'), ALL);
  assert.deepEqual(filter.parseFilters('?type=&status='), ALL);
  assert.deepEqual(filter.parseFilters('?type=foo&status=HOLD'), { type: '', status: 'HOLD' });
});

test('parseFilters: first value of a repeated parameter wins; bad input is safe', () => {
  assert.deepEqual(filter.parseFilters('?type=Language&type=Datastores'), { type: 'Language', status: '' });
  assert.deepEqual(filter.parseFilters('?type=foo&type=Language'), ALL);
  assert.deepEqual(filter.parseFilters(''), ALL);
  assert.deepEqual(filter.parseFilters(undefined), ALL);
  assert.deepEqual(filter.parseFilters(null), ALL);
});

test('buildSearch adds, replaces and removes only type and status', () => {
  assert.equal(filter.buildSearch({ type: 'Datastores', status: 'HOLD' }, ''), '?type=Datastores&status=HOLD');
  assert.equal(filter.buildSearch({ type: '', status: 'HOLD' }, ''), '?status=HOLD');
  assert.equal(
    filter.buildSearch({ type: 'Language', status: '' }, '?type=Datastores&status=HOLD'),
    '?type=Language'
  );
  assert.equal(filter.buildSearch({ type: 'Data Management', status: '' }, ''), '?type=Data+Management');
});

test('buildSearch preserves unrelated parameters and returns "" when nothing is left', () => {
  assert.equal(filter.buildSearch(ALL, '?type=Datastores&status=HOLD'), '');
  assert.equal(filter.buildSearch(ALL, '?foo=1&type=Datastores'), '?foo=1');
  assert.equal(filter.buildSearch({ type: 'Language', status: '' }, '?foo=1'), '?foo=1&type=Language');
  assert.equal(filter.buildSearch({ type: 'bogus', status: '' }, '?foo=1'), '?foo=1');
});

test('buildSearch output round-trips through parseFilters', () => {
  const filters = { type: 'Data Management', status: 'ASSESS' };
  assert.deepEqual(filter.parseFilters(filter.buildSearch(filters, '?a=b')), filters);
});

test('isActive', () => {
  assert.equal(filter.isActive(ALL), false);
  assert.equal(filter.isActive({ type: 'Language', status: '' }), true);
  assert.equal(filter.isActive({ type: '', status: 'HOLD' }), true);
  assert.equal(filter.isActive({ type: 'bogus', status: 'bogus' }), false);
});

test('countMatches against the seed data adds up', () => {
  assert.equal(filter.countMatches(seedData, ALL), seedData.length);

  let byType = 0;
  filter.TYPES.forEach((type) => {
    byType += filter.countMatches(seedData, { type, status: '' });
  });
  assert.equal(byType, seedData.length);

  let byStatus = 0;
  filter.STATUSES.forEach((status) => {
    byStatus += filter.countMatches(seedData, { type: '', status });
  });
  assert.equal(byStatus, seedData.length);

  let combined = 0;
  filter.TYPES.forEach((type) => {
    filter.STATUSES.forEach((status) => {
      const n = filter.countMatches(seedData, { type, status });
      assert.equal(n, seedData.filter((row) => row.type === type && row.status === status).length);
      combined += n;
    });
  });
  assert.equal(combined, seedData.length);
});

test('counterText', () => {
  assert.equal(filter.counterText(3, 40), 'Showing 3 of 40 technologies');
  assert.equal(filter.counterText(0, 40), 'Showing 0 of 40 technologies');
});

test('index.html wires the filters', () => {
  const html = fs.readFileSync(path.join(__dirname, '../docs/index.html'), 'utf8');
  assert.match(html, /<script src="technology-filter\.js"><\/script>/);
  assert.match(html, /<span class="radar-filter-label">Type<\/span>\s*<select id="filter-type"/);
  assert.match(html, /<span class="radar-filter-label">Status<\/span>\s*<select id="filter-status"/);
  assert.match(html, /id="filter-counter"/);
  assert.match(html, /id="filter-reset"/);
});
