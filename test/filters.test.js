'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mapping = require('../docs/technology-mapping.js');
const filters = require('../docs/technology-filters.js');

const ALL = filters.ALL;

const LIST = [
  { type: 'Datastores', status: 'ADOPT' },
  { type: 'Datastores', status: 'HOLD' },
  { type: 'Datastores', status: 'HOLD' },
  { type: 'Language', status: 'HOLD' },
  { type: 'Language', status: 'TRIAL' },
  { type: 'Infrastructure', status: 'ASSESS' }
];

function count(f) {
  return filters.countMatches(LIST, f);
}

test('option lists match the issue and the mapping', () => {
  assert.deepEqual(filters.TYPE_OPTIONS, ['Datastores', 'Data Management', 'Infrastructure', 'Language']);
  assert.deepEqual(filters.STATUS_OPTIONS, ['ADOPT', 'TRIAL', 'ASSESS', 'HOLD']);
  assert.deepEqual([...filters.TYPE_OPTIONS].sort(), Object.keys(mapping.TYPES).sort());
  assert.deepEqual(filters.STATUS_OPTIONS, Object.keys(mapping.STATUSES));
});

test('matches: All / All lets everything through', () => {
  const f = { type: ALL, status: ALL };
  assert.ok(LIST.every((t) => filters.matches(t, f)));
  assert.deepEqual(count(f), { shown: 6, total: 6 });
});

test('matches: Type alone', () => {
  const f = { type: 'Datastores', status: ALL };
  assert.deepEqual(count(f), { shown: 3, total: 6 });
  assert.ok(filters.matches(LIST[0], f));
  assert.ok(!filters.matches(LIST[3], f));
});

test('matches: Status alone', () => {
  const f = { type: ALL, status: 'HOLD' };
  assert.deepEqual(count(f), { shown: 3, total: 6 });
  assert.ok(filters.matches(LIST[3], f));
  assert.ok(!filters.matches(LIST[0], f));
});

test('matches: both filters combine with AND', () => {
  const f = { type: 'Datastores', status: 'HOLD' };
  assert.deepEqual(count(f), { shown: 2, total: 6 });
  assert.ok(filters.matches(LIST[1], f));
  assert.ok(!filters.matches(LIST[0], f));
  assert.ok(!filters.matches(LIST[3], f));
});

test('matches: a combination without result', () => {
  assert.deepEqual(count({ type: 'Data Management', status: 'HOLD' }), { shown: 0, total: 6 });
});

test('matches: unknown filter values behave like All', () => {
  assert.ok(filters.matches(LIST[0], { type: 'Foo', status: 'bar' }));
});

test('countMatches on an empty list', () => {
  assert.deepEqual(filters.countMatches([], { type: 'Language', status: ALL }), { shown: 0, total: 0 });
});

test('counterText', () => {
  assert.equal(filters.counterText(2, 6), 'Showing 2 of 6 technologies');
  assert.equal(filters.counterText(0, 0), 'Showing 0 of 0 technologies');
});

test('isActive', () => {
  assert.equal(filters.isActive({ type: ALL, status: ALL }), false);
  assert.equal(filters.isActive({ type: 'Language', status: ALL }), true);
  assert.equal(filters.isActive({ type: ALL, status: 'HOLD' }), true);
  assert.equal(filters.isActive({ type: 'Language', status: 'HOLD' }), true);
  assert.equal(filters.isActive({ type: 'Foo', status: ALL }), false);
});

test('parseFilters: valid values', () => {
  assert.deepEqual(filters.parseFilters('?type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filters.parseFilters('type=Data%20Management'), { type: 'Data Management', status: ALL });
  assert.deepEqual(filters.parseFilters('?type=Data+Management'), { type: 'Data Management', status: ALL });
});

test('parseFilters: missing, empty or no query string', () => {
  const none = { type: ALL, status: ALL };
  assert.deepEqual(filters.parseFilters(''), none);
  assert.deepEqual(filters.parseFilters('?'), none);
  assert.deepEqual(filters.parseFilters('?type=&status='), none);
  assert.deepEqual(filters.parseFilters(undefined), none);
});

test('parseFilters: unknown values are ignored one by one', () => {
  assert.deepEqual(filters.parseFilters('?type=Foo&status=HOLD'), { type: ALL, status: 'HOLD' });
  assert.deepEqual(filters.parseFilters('?type=Language&status=nope'), { type: 'Language', status: ALL });
});

test('parseFilters: matching is exact and case-sensitive', () => {
  assert.deepEqual(filters.parseFilters('?type=datastores&status=hold'), { type: ALL, status: ALL });
});

test('parseFilters: repeated parameters use the first value', () => {
  assert.deepEqual(filters.parseFilters('?status=HOLD&status=ADOPT'), { type: ALL, status: 'HOLD' });
  assert.deepEqual(filters.parseFilters('?type=Foo&type=Language'), { type: ALL, status: ALL });
});

test('parseFilters: inherited property names are not options', () => {
  assert.deepEqual(filters.parseFilters('?type=constructor&status=__proto__'), { type: ALL, status: ALL });
});

test('serializeFilters omits All', () => {
  assert.equal(filters.serializeFilters({ type: ALL, status: ALL }, ''), '');
  assert.equal(filters.serializeFilters({ type: 'Datastores', status: ALL }, ''), '?type=Datastores');
  assert.equal(filters.serializeFilters({ type: ALL, status: 'HOLD' }, ''), '?status=HOLD');
  assert.equal(
    filters.serializeFilters({ type: 'Datastores', status: 'HOLD' }, ''),
    '?type=Datastores&status=HOLD'
  );
});

test('serializeFilters replaces old values and keeps other parameters', () => {
  assert.equal(
    filters.serializeFilters({ type: ALL, status: 'TRIAL' }, '?foo=1&type=Language&status=HOLD&bar=2'),
    '?foo=1&bar=2&status=TRIAL'
  );
  assert.equal(filters.serializeFilters({ type: ALL, status: ALL }, '?foo=1&type=Language'), '?foo=1');
});

test('serializeFilters encodes values and round-trips with parseFilters', () => {
  const f = { type: 'Data Management', status: 'ASSESS' };
  const query = filters.serializeFilters(f, '');
  assert.ok(!query.includes(' '));
  assert.deepEqual(filters.parseFilters(query), f);
});

test('buildUrl keeps path and hash', () => {
  const location = { pathname: '/radar/', search: '?type=Foo&x=1', hash: '#top' };
  assert.equal(filters.buildUrl({ type: 'Language', status: ALL }, location), '/radar/?x=1&type=Language#top');
  assert.equal(filters.buildUrl({ type: ALL, status: ALL }, { pathname: '/', search: '?type=Foo', hash: '' }), '/');
});

test('index.html has the filter controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  assert.match(html, /<script src="technology-filters\.js"><\/script>/);
  assert.match(html, /<label for="filter-type">Type<\/label>\s*<select id="filter-type"/);
  assert.match(html, /<label for="filter-status">Status<\/label>\s*<select id="filter-status"/);
  assert.match(html, /id="filter-counter"/);
  assert.match(html, /id="filter-reset"/);
});
