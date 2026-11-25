'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const filters = require('../docs/radar-filters.js');

const ALL = filters.ALL;

const ROWS = [
  { number: 1, title: 'Postgres', type: 'Datastores', status: 'ADOPT' },
  { number: 2, title: 'Redis', type: 'Datastores', status: 'HOLD' },
  { number: 3, title: 'Mongo', type: 'Datastores', status: 'HOLD' },
  { number: 4, title: 'dbt', type: 'Data Management', status: 'TRIAL' },
  { number: 5, title: 'Kafka', type: 'Data Management', status: 'ASSESS' },
  { number: 6, title: 'Kubernetes', type: 'Infrastructure', status: 'ADOPT' },
  { number: 7, title: 'Nomad', type: 'Infrastructure', status: 'HOLD' },
  { number: 8, title: 'Go', type: 'Language', status: 'ADOPT' },
  { number: 9, title: 'PHP', type: 'Language', status: 'TRIAL' }
];

function numbers(f) {
  return ROWS.filter((row) => filters.matches(row, f)).map((row) => row.number);
}

test('the option lists are the types and statuses of the issue, in order', () => {
  assert.deepEqual(filters.TYPE_OPTIONS, ['Datastores', 'Data Management', 'Infrastructure', 'Language']);
  assert.deepEqual(filters.STATUS_OPTIONS, ['ADOPT', 'TRIAL', 'ASSESS', 'HOLD']);
  assert.equal(ALL, '');
});

test('"All" for both filters matches every row', () => {
  assert.deepEqual(numbers({ type: ALL, status: ALL }), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(filters.countMatching(ROWS, { type: ALL, status: ALL }), ROWS.length);
  assert.deepEqual(numbers({}), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('each Type alone matches only that type', () => {
  assert.deepEqual(numbers({ type: 'Datastores', status: ALL }), [1, 2, 3]);
  assert.deepEqual(numbers({ type: 'Data Management', status: ALL }), [4, 5]);
  assert.deepEqual(numbers({ type: 'Infrastructure', status: ALL }), [6, 7]);
  assert.deepEqual(numbers({ type: 'Language', status: ALL }), [8, 9]);
});

test('each Status alone matches only that status', () => {
  assert.deepEqual(numbers({ type: ALL, status: 'ADOPT' }), [1, 6, 8]);
  assert.deepEqual(numbers({ type: ALL, status: 'TRIAL' }), [4, 9]);
  assert.deepEqual(numbers({ type: ALL, status: 'ASSESS' }), [5]);
  assert.deepEqual(numbers({ type: ALL, status: 'HOLD' }), [2, 3, 7]);
});

test('Type and Status combine with AND', () => {
  assert.deepEqual(numbers({ type: 'Datastores', status: 'HOLD' }), [2, 3]);
  assert.deepEqual(numbers({ type: 'Language', status: 'ADOPT' }), [8]);
  assert.equal(filters.countMatching(ROWS, { type: 'Datastores', status: 'HOLD' }), 2);
});

test('a combination without any technology matches nothing', () => {
  assert.deepEqual(numbers({ type: 'Language', status: 'HOLD' }), []);
  assert.equal(filters.countMatching(ROWS, { type: 'Language', status: 'HOLD' }), 0);
});

test('countMatching of an empty list is 0', () => {
  assert.equal(filters.countMatching([], { type: 'Datastores', status: ALL }), 0);
});

test('normalizeFilters keeps exact known values', () => {
  assert.deepEqual(
    filters.normalizeFilters({ type: 'Data Management', status: 'ASSESS' }),
    { type: 'Data Management', status: 'ASSESS' }
  );
});

test('normalizeFilters turns unknown values into "All"', () => {
  const unknown = ['Foo', 'datastores', 'hold', 'Hold', ' HOLD', '', '__proto__', 'toString', 'constructor', 'hasOwnProperty'];
  unknown.forEach((value) => {
    assert.deepEqual(filters.normalizeFilters({ type: value, status: value }), { type: ALL, status: ALL }, value);
  });
});

test('normalizeFilters turns non-strings and missing input into "All"', () => {
  const nonStrings = [null, undefined, 0, 1, true, {}, [], ['Datastores'], { toString: () => 'Datastores' }];
  nonStrings.forEach((value) => {
    assert.deepEqual(filters.normalizeFilters({ type: value, status: value }), { type: ALL, status: ALL });
  });
  assert.deepEqual(filters.normalizeFilters(undefined), { type: ALL, status: ALL });
  assert.deepEqual(filters.normalizeFilters(null), { type: ALL, status: ALL });
  assert.deepEqual(filters.normalizeFilters('Datastores'), { type: ALL, status: ALL });
});

test('a type is not accepted as a status, nor the other way round', () => {
  assert.deepEqual(filters.normalizeFilters({ type: 'HOLD', status: 'Datastores' }), { type: ALL, status: ALL });
});

test('parseFilters reads both parameters, with or without the leading "?"', () => {
  assert.deepEqual(filters.parseFilters('?type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filters.parseFilters('type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
});

test('parseFilters decodes encoded values', () => {
  assert.deepEqual(filters.parseFilters('?type=Data%20Management'), { type: 'Data Management', status: ALL });
  assert.deepEqual(filters.parseFilters('?type=Data+Management'), { type: 'Data Management', status: ALL });
});

test('parseFilters with an empty or missing search gives "All"', () => {
  assert.deepEqual(filters.parseFilters(''), { type: ALL, status: ALL });
  assert.deepEqual(filters.parseFilters('?'), { type: ALL, status: ALL });
  assert.deepEqual(filters.parseFilters(undefined), { type: ALL, status: ALL });
  assert.deepEqual(filters.parseFilters(null), { type: ALL, status: ALL });
});

test('parseFilters ignores unknown values and keeps the valid parameter', () => {
  assert.deepEqual(filters.parseFilters('?type=Foo&status=HOLD'), { type: ALL, status: 'HOLD' });
  assert.deepEqual(filters.parseFilters('?type=Language&status=hold'), { type: 'Language', status: ALL });
  assert.deepEqual(filters.parseFilters('?type=__proto__&status=toString'), { type: ALL, status: ALL });
  assert.deepEqual(filters.parseFilters('?type=&status='), { type: ALL, status: ALL });
});

test('parseFilters uses the first value of a repeated parameter', () => {
  assert.deepEqual(filters.parseFilters('?type=Language&type=Datastores'), { type: 'Language', status: ALL });
  assert.deepEqual(filters.parseFilters('?type=Foo&type=Datastores'), { type: ALL, status: ALL });
});

test('parseFilters ignores unrelated parameters', () => {
  assert.deepEqual(filters.parseFilters('?foo=bar&status=TRIAL'), { type: ALL, status: 'TRIAL' });
});

test('buildSearch sets both parameters', () => {
  assert.equal(
    filters.buildSearch('', { type: 'Datastores', status: 'HOLD' }),
    '?type=Datastores&status=HOLD'
  );
});

test('buildSearch sets one parameter and encodes the value', () => {
  assert.equal(filters.buildSearch('', { type: ALL, status: 'HOLD' }), '?status=HOLD');
  assert.equal(filters.buildSearch('', { type: 'Data Management', status: ALL }), '?type=Data+Management');
});

test('buildSearch returns "" when no filter is active', () => {
  assert.equal(filters.buildSearch('', { type: ALL, status: ALL }), '');
  assert.equal(filters.buildSearch('?type=Datastores&status=HOLD', { type: ALL, status: ALL }), '');
});

test('buildSearch removes only the parameter that went back to "All"', () => {
  assert.equal(
    filters.buildSearch('?type=Datastores&status=HOLD', { type: ALL, status: 'HOLD' }),
    '?status=HOLD'
  );
});

test('buildSearch replaces existing values', () => {
  assert.equal(
    filters.buildSearch('?type=Language&status=ADOPT', { type: 'Datastores', status: 'HOLD' }),
    '?type=Datastores&status=HOLD'
  );
});

test('buildSearch keeps unrelated parameters', () => {
  assert.equal(
    filters.buildSearch('?foo=bar&type=Language', { type: ALL, status: 'HOLD' }),
    '?foo=bar&status=HOLD'
  );
  assert.equal(filters.buildSearch('?foo=bar&type=Language', { type: ALL, status: ALL }), '?foo=bar');
});

test('buildSearch never writes an unknown value', () => {
  assert.equal(filters.buildSearch('', { type: 'Foo', status: 'hold' }), '');
});

test('buildSearch and parseFilters round-trip', () => {
  const state = { type: 'Data Management', status: 'ASSESS' };
  assert.deepEqual(filters.parseFilters(filters.buildSearch('', state)), state);
});

test('isActive is true when at least one filter is set', () => {
  assert.equal(filters.isActive({ type: ALL, status: ALL }), false);
  assert.equal(filters.isActive({}), false);
  assert.equal(filters.isActive({ type: 'Foo', status: 'bar' }), false);
  assert.equal(filters.isActive({ type: 'Language', status: ALL }), true);
  assert.equal(filters.isActive({ type: ALL, status: 'HOLD' }), true);
  assert.equal(filters.isActive({ type: 'Language', status: 'HOLD' }), true);
});

test('summary gives the counter text', () => {
  assert.equal(filters.summary(2, 9), 'Showing 2 of 9 technologies');
  assert.equal(filters.summary(0, 0), 'Showing 0 of 0 technologies');
});

test('the page has labelled Type and Status dropdowns, a hidden Reset link and loads the module', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  assert.match(html, /<label for="filter-type"[^>]*>Type<\/label>/);
  assert.match(html, /<label for="filter-status"[^>]*>Status<\/label>/);
  assert.match(html, /<select id="filter-type"/);
  assert.match(html, /<select id="filter-status"/);
  assert.match(html, /<a id="filter-reset"[^>]*href="#"[^>]*hidden[^>]*>Reset<\/a>/);
  assert.match(html, /<script src="radar-filters\.js"><\/script>/);
});
