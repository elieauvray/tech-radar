'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const filter = require('../docs/technology-filter.js');
const mapping = require('../docs/technology-mapping.js');
const seed = require('../db/seed-data.json');

const ALL = filter.ALL;

function manual(rows, type, status) {
  return rows.filter((row) => (type === ALL || row.type === type) && (status === ALL || row.status === status));
}

test('the option lists are the requested values, in order, and known to the mapping', () => {
  assert.deepEqual(filter.TYPE_OPTIONS, ['Datastores', 'Data Management', 'Infrastructure', 'Language']);
  assert.deepEqual(filter.STATUS_OPTIONS, ['ADOPT', 'TRIAL', 'ASSESS', 'HOLD']);
  filter.TYPE_OPTIONS.forEach((type) => assert.ok(type in mapping.TYPES));
  filter.STATUS_OPTIONS.forEach((status) => assert.ok(status in mapping.STATUSES));
  assert.equal(ALL, '');
});

test('"All" matches everything and is not active', () => {
  const all = { type: ALL, status: ALL };
  assert.equal(filter.isActive(all), false);
  assert.equal(filter.matches({ type: 'Language', status: 'HOLD' }, all), true);
  assert.equal(filter.countMatching(seed, all), seed.length);
});

test('each filter alone matches only its value', () => {
  const byType = { type: 'Datastores', status: ALL };
  assert.equal(filter.matches({ type: 'Datastores', status: 'HOLD' }, byType), true);
  assert.equal(filter.matches({ type: 'Language', status: 'HOLD' }, byType), false);
  const byStatus = { type: ALL, status: 'HOLD' };
  assert.equal(filter.matches({ type: 'Language', status: 'HOLD' }, byStatus), true);
  assert.equal(filter.matches({ type: 'Language', status: 'ADOPT' }, byStatus), false);
  assert.equal(filter.isActive(byType), true);
  assert.equal(filter.isActive(byStatus), true);
});

test('both filters combine with AND', () => {
  const both = { type: 'Datastores', status: 'HOLD' };
  assert.equal(filter.matches({ type: 'Datastores', status: 'HOLD' }, both), true);
  assert.equal(filter.matches({ type: 'Datastores', status: 'ADOPT' }, both), false);
  assert.equal(filter.matches({ type: 'Language', status: 'HOLD' }, both), false);
});

test('every Type x Status combination matches exactly the manual filter on the seed data', () => {
  const types = [ALL].concat(filter.TYPE_OPTIONS);
  const statuses = [ALL].concat(filter.STATUS_OPTIONS);
  types.forEach((type) => {
    statuses.forEach((status) => {
      const expected = manual(seed, type, status);
      const actual = seed.filter((row) => filter.matches(row, { type, status }));
      assert.deepEqual(actual, expected, `${type || 'All'} / ${status || 'All'}`);
      assert.equal(filter.countMatching(seed, { type, status }), expected.length);
    });
  });
});

test('a combination with no technology counts zero', () => {
  assert.equal(filter.countMatching([{ type: 'Language', status: 'ADOPT' }], { type: 'Datastores', status: 'HOLD' }), 0);
  assert.equal(filter.countMatching([], { type: ALL, status: ALL }), 0);
});

test('normalizeFilters rejects unknown, wrongly cased and non-string values', () => {
  assert.deepEqual(filter.normalizeFilters({ type: 'Datastores', status: 'HOLD' }), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filter.normalizeFilters({ type: 'datastores', status: 'hold' }), { type: ALL, status: ALL });
  for (const value of ['Foo', 'toString', '__proto__', 'constructor', 3, null, undefined, {}, ['HOLD']]) {
    assert.deepEqual(filter.normalizeFilters({ type: value, status: value }), { type: ALL, status: ALL });
  }
  assert.deepEqual(filter.normalizeFilters(null), { type: ALL, status: ALL });
  assert.deepEqual(filter.normalizeFilters(undefined), { type: ALL, status: ALL });
  assert.deepEqual(filter.normalizeFilters('HOLD'), { type: ALL, status: ALL });
});

test('parseFilters reads valid values from a query string', () => {
  assert.deepEqual(filter.parseFilters('?type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filter.parseFilters('?type=Data%20Management'), { type: 'Data Management', status: ALL });
  assert.deepEqual(filter.parseFilters('?type=Data+Management'), { type: 'Data Management', status: ALL });
  assert.deepEqual(filter.parseFilters('?status=TRIAL'), { type: ALL, status: 'TRIAL' });
  assert.deepEqual(filter.parseFilters(''), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters(undefined), { type: ALL, status: ALL });
});

test('parseFilters ignores unknown values and keeps the valid ones', () => {
  assert.deepEqual(filter.parseFilters('?type=Foo&status=HOLD'), { type: ALL, status: 'HOLD' });
  assert.deepEqual(filter.parseFilters('?type=Datastores&status=hold'), { type: 'Datastores', status: ALL });
  assert.deepEqual(filter.parseFilters('?type=__proto__&status=toString'), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters('?type=&status='), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters('?type=datastores'), { type: ALL, status: ALL });
});

test('parseFilters uses the first occurrence of a repeated parameter', () => {
  assert.deepEqual(filter.parseFilters('?type=Language&type=Datastores'), { type: 'Language', status: ALL });
  assert.deepEqual(filter.parseFilters('?type=Foo&type=Language'), { type: ALL, status: ALL });
});

test('buildSearch sets, removes and round-trips the filters', () => {
  assert.equal(filter.buildSearch({ type: 'Datastores', status: 'HOLD' }, ''), '?type=Datastores&status=HOLD');
  assert.equal(filter.buildSearch({ type: ALL, status: 'HOLD' }, '?type=Datastores&status=ADOPT'), '?status=HOLD');
  assert.equal(filter.buildSearch({ type: 'Datastores', status: ALL }, '?status=HOLD'), '?type=Datastores');
  assert.equal(filter.buildSearch({ type: ALL, status: ALL }, '?type=Datastores&status=HOLD'), '');
  const both = { type: 'Data Management', status: 'ASSESS' };
  assert.deepEqual(filter.parseFilters(filter.buildSearch(both, '')), both);
});

test('buildSearch preserves unrelated parameters and drops invalid filter values', () => {
  assert.equal(filter.buildSearch({ type: 'Language', status: ALL }, '?debug=1&type=Foo'), '?debug=1&type=Language');
  assert.equal(filter.buildSearch({ type: ALL, status: ALL }, '?debug=1&type=Foo'), '?debug=1');
  assert.equal(filter.buildSearch({ type: 'Foo', status: 'hold' }, '?type=Language'), '');
});

test('index.html has two labelled selects, the counter, the reset link and the script', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  assert.match(html, /<label[^>]*for="filter-type"[^>]*>Type<\/label>/);
  assert.match(html, /<label[^>]*for="filter-status"[^>]*>Status<\/label>/);
  assert.match(html, /<select id="filter-type"/);
  assert.match(html, /<select id="filter-status"/);
  assert.match(html, /id="filter-count"[^>]*aria-live="polite"/);
  assert.match(html, /<a href="\?" id="filter-reset"[^>]*hidden>Reset<\/a>/);
  assert.match(html, /<script src="technology-filter\.js"><\/script>/);
  assert.ok(html.indexOf('technology-mapping.js') < html.indexOf('technology-filter.js'));
});
