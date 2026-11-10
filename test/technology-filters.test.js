'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const filters = require('../docs/technology-filters.js');
const mapping = require('../docs/technology-mapping.js');

const TYPES = ['Datastores', 'Data Management', 'Infrastructure', 'Language'];
const STATUSES = ['ADOPT', 'TRIAL', 'ASSESS', 'HOLD'];

// one technology for every Type / Status pair, plus a second HOLD Datastore
const fixture = [];
TYPES.forEach((type) => {
  STATUSES.forEach((status) => {
    fixture.push({ number: fixture.length + 1, title: type + ' ' + status, type, status });
  });
});
fixture.push({ number: fixture.length + 1, title: 'Extra', type: 'Datastores', status: 'HOLD' });

const ALL = { type: '', status: '' };

test('the option lists match the Type and Status values of the mapping', () => {
  assert.deepEqual(filters.TYPE_OPTIONS, TYPES);
  assert.deepEqual(filters.STATUS_OPTIONS, STATUSES);
  assert.deepEqual(filters.TYPE_OPTIONS.slice().sort(), Object.keys(mapping.TYPES).sort());
  assert.deepEqual(filters.STATUS_OPTIONS.slice().sort(), Object.keys(mapping.STATUSES).sort());
  assert.equal(filters.ALL, '');
});

test('"All" matches every technology', () => {
  assert.equal(filters.countMatching(fixture, ALL), fixture.length);
  assert.equal(filters.countMatching(fixture, {}), fixture.length);
  assert.equal(filters.countMatching(fixture, undefined), fixture.length);
  assert.equal(filters.isActive(ALL), false);
});

test('each Type alone keeps exactly the technologies of that Type', () => {
  TYPES.forEach((type) => {
    const expected = fixture.filter((t) => t.type === type);
    const actual = fixture.filter((t) => filters.matches(t, { type, status: '' }));
    assert.deepEqual(actual, expected);
    assert.equal(filters.countMatching(fixture, { type, status: '' }), expected.length);
    assert.equal(filters.isActive({ type, status: '' }), true);
  });
});

test('each Status alone keeps exactly the technologies of that Status', () => {
  STATUSES.forEach((status) => {
    const expected = fixture.filter((t) => t.status === status);
    const actual = fixture.filter((t) => filters.matches(t, { type: '', status }));
    assert.deepEqual(actual, expected);
    assert.equal(filters.countMatching(fixture, { type: '', status }), expected.length);
    assert.equal(filters.isActive({ type: '', status }), true);
  });
});

test('both filters combine with AND, for all 4x4 combinations', () => {
  TYPES.forEach((type) => {
    STATUSES.forEach((status) => {
      const expected = fixture.filter((t) => t.type === type && t.status === status);
      const actual = fixture.filter((t) => filters.matches(t, { type, status }));
      assert.deepEqual(actual, expected);
      assert.equal(filters.countMatching(fixture, { type, status }), expected.length);
    });
  });
  assert.equal(filters.countMatching(fixture, { type: 'Datastores', status: 'HOLD' }), 2);
});

test('normalizeFilters ignores unknown, wrong-case and non-string values', () => {
  const bad = ['', 'Foo', 'datastores', 'DATASTORES', 'hold', ' HOLD', 'toString', '__proto__',
    'constructor', 'hasOwnProperty', null, undefined, 3, {}, ['HOLD'], true];
  bad.forEach((value) => {
    assert.deepEqual(filters.normalizeFilters({ type: value, status: value }), ALL);
  });
  assert.deepEqual(filters.normalizeFilters(null), ALL);
  assert.deepEqual(filters.normalizeFilters(undefined), ALL);
  assert.deepEqual(
    filters.normalizeFilters({ type: 'Language', status: 'nope' }),
    { type: 'Language', status: '' }
  );
  assert.deepEqual(
    filters.normalizeFilters({ type: 'Data Management', status: 'ASSESS' }),
    { type: 'Data Management', status: 'ASSESS' }
  );
});

test('parseFilters reads valid type and status params', () => {
  assert.deepEqual(filters.parseFilters('?type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filters.parseFilters('type=Data%20Management'), { type: 'Data Management', status: '' });
  assert.deepEqual(filters.parseFilters('?type=Data+Management&status=TRIAL'), { type: 'Data Management', status: 'TRIAL' });
  assert.deepEqual(filters.parseFilters('?status=ADOPT'), { type: '', status: 'ADOPT' });
});

test('parseFilters ignores unknown values per filter and keeps the valid ones', () => {
  assert.deepEqual(filters.parseFilters(''), ALL);
  assert.deepEqual(filters.parseFilters('?'), ALL);
  assert.deepEqual(filters.parseFilters(undefined), ALL);
  assert.deepEqual(filters.parseFilters('?type=Foo&status=hold'), ALL);
  assert.deepEqual(filters.parseFilters('?type=Foo&status=HOLD'), { type: '', status: 'HOLD' });
  assert.deepEqual(filters.parseFilters('?type=Language&status=__proto__'), { type: 'Language', status: '' });
  assert.deepEqual(filters.parseFilters('?type=toString&status=constructor'), ALL);
  assert.deepEqual(filters.parseFilters('?type=&status='), ALL);
});

test('parseFilters takes the first value of a duplicated param', () => {
  assert.deepEqual(
    filters.parseFilters('?type=Language&type=Datastores&status=HOLD&status=TRIAL'),
    { type: 'Language', status: 'HOLD' }
  );
  assert.deepEqual(filters.parseFilters('?type=Foo&type=Language'), ALL);
});

test('buildSearch sets, removes and preserves params', () => {
  assert.equal(filters.buildSearch({ type: 'Datastores', status: 'HOLD' }, ''), '?type=Datastores&status=HOLD');
  assert.equal(filters.buildSearch({ type: 'Data Management', status: '' }, ''), '?type=Data+Management');
  assert.equal(filters.buildSearch(ALL, ''), '');
  assert.equal(filters.buildSearch(ALL, '?type=Datastores&status=HOLD'), '');
  assert.equal(
    filters.buildSearch({ type: '', status: 'HOLD' }, '?type=Datastores&status=TRIAL'),
    '?status=HOLD'
  );
  assert.equal(
    filters.buildSearch({ type: 'Language', status: '' }, '?foo=bar&status=HOLD'),
    '?foo=bar&type=Language'
  );
  assert.equal(filters.buildSearch(ALL, '?foo=bar'), '?foo=bar');
  assert.equal(filters.buildSearch({ type: 'Foo', status: 'hold' }, '?type=Language'), '');
  assert.equal(filters.buildSearch(ALL, undefined), '');
});

test('parseFilters and buildSearch round-trip', () => {
  TYPES.concat('').forEach((type) => {
    STATUSES.concat('').forEach((status) => {
      const search = filters.buildSearch({ type, status }, '?foo=bar');
      assert.deepEqual(filters.parseFilters(search), { type, status });
      assert.equal(new URLSearchParams(search).get('foo'), 'bar');
    });
  });
});

test('counterText', () => {
  assert.equal(filters.counterText(3, 12), 'Showing 3 of 12 technologies');
  assert.equal(filters.counterText(0, 0), 'Showing 0 of 0 technologies');
  assert.equal(filters.counterText(1, 1), 'Showing 1 of 1 technologies');
});

test('index.html has both labelled selects and loads the filters after the mapping', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  assert.match(html, /<label for="filter-type"[^>]*>Type<\/label>/);
  assert.match(html, /<label for="filter-status"[^>]*>Status<\/label>/);
  assert.match(html, /<select id="filter-type"/);
  assert.match(html, /<select id="filter-status"/);
  assert.match(html, /id="filter-reset"/);
  assert.match(html, /id="filter-counter"/);
  const mappingAt = html.indexOf('<script src="technology-mapping.js">');
  const filtersAt = html.indexOf('<script src="technology-filters.js">');
  assert.ok(mappingAt !== -1 && filtersAt > mappingAt);
});
