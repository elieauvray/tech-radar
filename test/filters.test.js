'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const filters = require('../docs/technology-filters.js');
const mapping = require('../docs/technology-mapping.js');

const ALL = filters.ALL;

const FIXTURE = [
  { type: 'Datastores', status: 'ADOPT' },
  { type: 'Datastores', status: 'HOLD' },
  { type: 'Datastores', status: 'HOLD' },
  { type: 'Data Management', status: 'HOLD' },
  { type: 'Infrastructure', status: 'TRIAL' },
  { type: 'Language', status: 'ASSESS' }
];

test('option lists match the mapping keys', () => {
  assert.deepEqual([...filters.TYPE_OPTIONS].sort(), Object.keys(mapping.TYPES).sort());
  assert.deepEqual([...filters.STATUS_OPTIONS].sort(), Object.keys(mapping.STATUSES).sort());
});

test('matches: type alone', () => {
  const f = { type: 'Datastores', status: ALL };
  assert.equal(filters.matches(FIXTURE[0], f), true);
  assert.equal(filters.matches(FIXTURE[3], f), false);
  assert.equal(filters.countMatching(FIXTURE, f), 3);
});

test('matches: status alone', () => {
  const f = { type: ALL, status: 'HOLD' };
  assert.equal(filters.matches(FIXTURE[1], f), true);
  assert.equal(filters.matches(FIXTURE[0], f), false);
  assert.equal(filters.countMatching(FIXTURE, f), 3);
});

test('matches: type and status are combined with AND', () => {
  const f = { type: 'Datastores', status: 'HOLD' };
  assert.equal(filters.matches(FIXTURE[1], f), true);
  assert.equal(filters.matches(FIXTURE[0], f), false);
  assert.equal(filters.matches(FIXTURE[3], f), false);
  assert.equal(filters.countMatching(FIXTURE, f), 2);
});

test('matches: All means no constraint', () => {
  const f = { type: ALL, status: ALL };
  assert.equal(filters.countMatching(FIXTURE, f), FIXTURE.length);
  assert.equal(filters.countMatching(FIXTURE, undefined), FIXTURE.length);
});

test('countMatching: a combination without technology returns 0', () => {
  assert.equal(filters.countMatching(FIXTURE, { type: 'Language', status: 'HOLD' }), 0);
  assert.equal(filters.countMatching([], { type: ALL, status: ALL }), 0);
});

test('parseFilters: valid params', () => {
  assert.deepEqual(filters.parseFilters('?type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filters.parseFilters('?type=Datastores'), { type: 'Datastores', status: ALL });
  assert.deepEqual(filters.parseFilters('?status=TRIAL'), { type: ALL, status: 'TRIAL' });
});

test('parseFilters: encoded values', () => {
  assert.deepEqual(filters.parseFilters('?type=Data%20Management'), { type: 'Data Management', status: ALL });
  assert.deepEqual(filters.parseFilters('?type=Data+Management'), { type: 'Data Management', status: ALL });
});

test('parseFilters: unknown values are ignored', () => {
  assert.deepEqual(filters.parseFilters('?type=Foo&status=bar'), { type: ALL, status: ALL });
  assert.deepEqual(filters.parseFilters('?type=Foo&status=HOLD'), { type: ALL, status: 'HOLD' });
});

test('parseFilters: values are case-sensitive', () => {
  assert.deepEqual(filters.parseFilters('?type=datastores&status=hold'), { type: ALL, status: ALL });
});

test('parseFilters: empty, missing and non-string input', () => {
  assert.deepEqual(filters.parseFilters(''), { type: ALL, status: ALL });
  assert.deepEqual(filters.parseFilters('?'), { type: ALL, status: ALL });
  assert.deepEqual(filters.parseFilters(undefined), { type: ALL, status: ALL });
  assert.deepEqual(filters.parseFilters(null), { type: ALL, status: ALL });
});

test('parseFilters: extra params are ignored and the first repeated param wins', () => {
  assert.deepEqual(filters.parseFilters('?foo=1&type=Language&bar=2'), { type: 'Language', status: ALL });
  assert.deepEqual(filters.parseFilters('?type=Language&type=Datastores'), { type: 'Language', status: ALL });
});

test('normalizeFilters: non-string and missing input becomes All', () => {
  assert.deepEqual(filters.normalizeFilters({ type: 42, status: null }), { type: ALL, status: ALL });
  assert.deepEqual(filters.normalizeFilters({ type: ['Datastores'], status: {} }), { type: ALL, status: ALL });
  assert.deepEqual(filters.normalizeFilters(undefined), { type: ALL, status: ALL });
  assert.deepEqual(filters.normalizeFilters({ type: 'Language', status: 'ADOPT' }), { type: 'Language', status: 'ADOPT' });
});

test('serializeFilters: omits All values', () => {
  assert.equal(filters.serializeFilters({ type: ALL, status: ALL }), '');
  assert.equal(filters.serializeFilters({ type: 'Datastores', status: ALL }), '?type=Datastores');
  assert.equal(filters.serializeFilters({ type: ALL, status: 'HOLD' }), '?status=HOLD');
  assert.equal(filters.serializeFilters({ type: 'Datastores', status: 'HOLD' }), '?type=Datastores&status=HOLD');
});

test('serializeFilters: encodes spaces', () => {
  const query = filters.serializeFilters({ type: 'Data Management', status: ALL });
  assert.ok(!query.includes(' '));
  assert.deepEqual(filters.parseFilters(query), { type: 'Data Management', status: ALL });
});

test('serializeFilters: round-trips with parseFilters for every option', () => {
  const all = [ALL];
  filters.TYPE_OPTIONS.forEach((type) => {
    all.forEach((status) => {
      assert.deepEqual(filters.parseFilters(filters.serializeFilters({ type, status })), { type, status });
    });
    filters.STATUS_OPTIONS.forEach((status2) => {
      const f = { type, status: status2 };
      assert.deepEqual(filters.parseFilters(filters.serializeFilters(f)), f);
    });
  });
  filters.STATUS_OPTIONS.forEach((status) => {
    const f = { type: ALL, status };
    assert.deepEqual(filters.parseFilters(filters.serializeFilters(f)), f);
  });
});

test('isActive', () => {
  assert.equal(filters.isActive({ type: ALL, status: ALL }), false);
  assert.equal(filters.isActive({ type: 'Language', status: ALL }), true);
  assert.equal(filters.isActive({ type: ALL, status: 'HOLD' }), true);
  assert.equal(filters.isActive({ type: 'Foo', status: 'bar' }), false);
});
