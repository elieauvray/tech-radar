'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const filter = require('../docs/technology-filter.js');
const mapping = require('../docs/technology-mapping.js');

const ROWS = [
  { number: 1, title: 'Postgres', type: 'Datastores', status: 'ADOPT' },
  { number: 2, title: 'Cassandra', type: 'Datastores', status: 'HOLD' },
  { number: 3, title: 'Redis', type: 'Datastores', status: 'TRIAL' },
  { number: 4, title: 'Airflow', type: 'Data Management', status: 'ASSESS' },
  { number: 5, title: 'Kubernetes', type: 'Infrastructure', status: 'ADOPT' },
  { number: 6, title: 'Puppet', type: 'Infrastructure', status: 'HOLD' },
  { number: 7, title: 'Go', type: 'Language', status: 'ADOPT' },
  { number: 8, title: 'Perl', type: 'Language', status: 'HOLD' }
];

function numbers(filters) {
  return ROWS.filter((row) => filter.matches(row, filters)).map((row) => row.number);
}

test('option lists match the mapping tables, in the issue order', () => {
  assert.deepEqual(filter.TYPE_OPTIONS, ['Datastores', 'Data Management', 'Infrastructure', 'Language']);
  assert.deepEqual(filter.STATUS_OPTIONS, ['ADOPT', 'TRIAL', 'ASSESS', 'HOLD']);
  assert.deepEqual([...filter.TYPE_OPTIONS].sort(), Object.keys(mapping.TYPES).sort());
  assert.deepEqual([...filter.STATUS_OPTIONS].sort(), Object.keys(mapping.STATUSES).sort());
  assert.equal(filter.ALL_TYPES, 'All types');
  assert.equal(filter.ALL_STATUSES, 'All statuses');
  assert.deepEqual(filter.EMPTY_FILTERS, { type: '', status: '' });
});

test('matches: "All" for both filters matches everything', () => {
  assert.equal(numbers({ type: '', status: '' }).length, ROWS.length);
  assert.equal(numbers(filter.EMPTY_FILTERS).length, ROWS.length);
});

test('matches: each Type alone', () => {
  assert.deepEqual(numbers({ type: 'Datastores', status: '' }), [1, 2, 3]);
  assert.deepEqual(numbers({ type: 'Data Management', status: '' }), [4]);
  assert.deepEqual(numbers({ type: 'Infrastructure', status: '' }), [5, 6]);
  assert.deepEqual(numbers({ type: 'Language', status: '' }), [7, 8]);
});

test('matches: each Status alone', () => {
  assert.deepEqual(numbers({ type: '', status: 'ADOPT' }), [1, 5, 7]);
  assert.deepEqual(numbers({ type: '', status: 'TRIAL' }), [3]);
  assert.deepEqual(numbers({ type: '', status: 'ASSESS' }), [4]);
  assert.deepEqual(numbers({ type: '', status: 'HOLD' }), [2, 6, 8]);
});

test('matches: Type and Status combine with AND', () => {
  assert.deepEqual(numbers({ type: 'Datastores', status: 'HOLD' }), [2]);
  assert.deepEqual(numbers({ type: 'Language', status: 'ADOPT' }), [7]);
  assert.deepEqual(numbers({ type: 'Data Management', status: 'HOLD' }), []);
});

test('matches: unknown filter values are treated as "All"', () => {
  assert.deepEqual(numbers({ type: 'Foo', status: 'HOLD' }), [2, 6, 8]);
  assert.deepEqual(numbers({ type: 'toString', status: 'hold' }).length, ROWS.length);
  assert.deepEqual(numbers(undefined).length, ROWS.length);
});

test('countMatches and isActive', () => {
  assert.equal(filter.countMatches(ROWS, filter.EMPTY_FILTERS), 8);
  assert.equal(filter.countMatches(ROWS, { type: 'Datastores', status: '' }), 3);
  assert.equal(filter.countMatches(ROWS, { type: 'Datastores', status: 'HOLD' }), 1);
  assert.equal(filter.countMatches(ROWS, { type: 'Data Management', status: 'HOLD' }), 0);
  assert.equal(filter.countMatches([], { type: 'Language', status: '' }), 0);

  assert.equal(filter.isActive({ type: '', status: '' }), false);
  assert.equal(filter.isActive({ type: 'Language', status: '' }), true);
  assert.equal(filter.isActive({ type: '', status: 'HOLD' }), true);
  assert.equal(filter.isActive({ type: 'Foo', status: 'hold' }), false);
});

test('normalizeFilters keeps only known, exact, string values', () => {
  assert.deepEqual(filter.normalizeFilters({ type: 'Datastores', status: 'HOLD' }), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filter.normalizeFilters({ type: 'datastores', status: 'hold' }), { type: '', status: '' });
  assert.deepEqual(filter.normalizeFilters({ type: 'toString', status: '__proto__' }), { type: '', status: '' });
  assert.deepEqual(filter.normalizeFilters({ type: 2, status: ['HOLD'] }), { type: '', status: '' });
  assert.deepEqual(filter.normalizeFilters({ type: null }), { type: '', status: '' });
  assert.deepEqual(filter.normalizeFilters(null), { type: '', status: '' });
  assert.deepEqual(filter.normalizeFilters(undefined), { type: '', status: '' });
});

test('parseFilters reads valid values, with or without the leading "?"', () => {
  assert.deepEqual(filter.parseFilters('?type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filter.parseFilters('type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filter.parseFilters('?type=Data%20Management'), { type: 'Data Management', status: '' });
  assert.deepEqual(filter.parseFilters('?type=Data+Management'), { type: 'Data Management', status: '' });
  assert.deepEqual(filter.parseFilters('?status=TRIAL'), { type: '', status: 'TRIAL' });
});

test('parseFilters ignores unknown values and params', () => {
  assert.deepEqual(filter.parseFilters(''), { type: '', status: '' });
  assert.deepEqual(filter.parseFilters('?'), { type: '', status: '' });
  assert.deepEqual(filter.parseFilters('?type=Foo'), { type: '', status: '' });
  assert.deepEqual(filter.parseFilters('?status=hold'), { type: '', status: '' });
  assert.deepEqual(filter.parseFilters('?type=toString&status=__proto__'), { type: '', status: '' });
  assert.deepEqual(filter.parseFilters('?type=&status='), { type: '', status: '' });
  assert.deepEqual(filter.parseFilters('?other=1&type=Language'), { type: 'Language', status: '' });
  assert.deepEqual(filter.parseFilters(undefined), { type: '', status: '' });
});

test('parseFilters uses the first value of a repeated param', () => {
  assert.deepEqual(filter.parseFilters('?type=Language&type=Datastores'), { type: 'Language', status: '' });
  assert.deepEqual(filter.parseFilters('?type=Foo&type=Language'), { type: '', status: '' });
});

test('buildSearch adds, replaces and removes the filter params', () => {
  assert.equal(filter.buildSearch({ type: 'Datastores', status: 'HOLD' }, ''), '?type=Datastores&status=HOLD');
  assert.equal(filter.buildSearch({ type: 'Datastores', status: '' }, ''), '?type=Datastores');
  assert.equal(filter.buildSearch({ type: '', status: 'HOLD' }, '?type=Datastores'), '?status=HOLD');
  assert.equal(filter.buildSearch({ type: 'Language', status: 'ADOPT' }, '?type=Datastores&status=HOLD'), '?type=Language&status=ADOPT');
  assert.equal(filter.buildSearch({ type: '', status: '' }, '?type=Datastores&status=HOLD'), '');
  assert.equal(filter.buildSearch(filter.EMPTY_FILTERS), '');
  assert.equal(filter.buildSearch({ type: 'Data Management', status: '' }, ''), '?type=Data+Management');
});

test('buildSearch preserves other params and drops unknown filter values', () => {
  assert.equal(filter.buildSearch({ type: 'Language', status: '' }, '?debug=1'), '?debug=1&type=Language');
  assert.equal(filter.buildSearch({ type: '', status: '' }, '?debug=1&type=Language'), '?debug=1');
  assert.equal(filter.buildSearch({ type: 'Foo', status: 'hold' }, '?debug=1'), '?debug=1');
});

test('parseFilters(buildSearch(f)) round-trips every combination', () => {
  const types = [''].concat(filter.TYPE_OPTIONS);
  const statuses = [''].concat(filter.STATUS_OPTIONS);
  types.forEach((type) => {
    statuses.forEach((status) => {
      const filters = { type, status };
      assert.deepEqual(filter.parseFilters(filter.buildSearch(filters, '?x=1')), filters);
    });
  });
});
