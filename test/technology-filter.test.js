'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const filter = require('../docs/technology-filter.js');
const mapping = require('../docs/technology-mapping.js');
const seedData = require('../db/seed-data.json');

const ALL = filter.ALL;

test('option lists match the technology mapping', () => {
  assert.deepEqual(filter.TYPE_OPTIONS, mapping.TYPE_ORDER);
  assert.deepEqual([...filter.TYPE_OPTIONS].sort(), Object.keys(mapping.TYPES).sort());
  assert.deepEqual(filter.STATUS_OPTIONS, Object.keys(mapping.STATUSES));
});

test('ALL is the empty string', () => {
  assert.equal(ALL, '');
});

test('no filter matches everything', () => {
  assert.equal(filter.countMatching(seedData, { type: ALL, status: ALL }), seedData.length);
});

test('each type alone matches exactly that type', () => {
  for (const type of filter.TYPE_OPTIONS) {
    const expected = seedData.filter((t) => t.type === type).length;
    assert.ok(expected > 0, type);
    assert.equal(filter.countMatching(seedData, { type, status: ALL }), expected);
    for (const t of seedData) {
      assert.equal(filter.matches(t, { type, status: ALL }), t.type === type);
    }
  }
});

test('each status alone matches exactly that status', () => {
  for (const status of filter.STATUS_OPTIONS) {
    const expected = seedData.filter((t) => t.status === status).length;
    assert.ok(expected > 0, status);
    assert.equal(filter.countMatching(seedData, { type: ALL, status }), expected);
    for (const t of seedData) {
      assert.equal(filter.matches(t, { type: ALL, status }), t.status === status);
    }
  }
});

test('type and status combine with AND', () => {
  for (const type of filter.TYPE_OPTIONS) {
    for (const status of filter.STATUS_OPTIONS) {
      const expected = seedData.filter((t) => t.type === type && t.status === status).length;
      assert.equal(filter.countMatching(seedData, { type, status }), expected);
    }
  }
  const list = [
    { type: 'Datastores', status: 'HOLD' },
    { type: 'Datastores', status: 'ADOPT' },
    { type: 'Language', status: 'HOLD' }
  ];
  assert.equal(filter.countMatching(list, { type: 'Datastores', status: 'HOLD' }), 1);
  assert.equal(filter.countMatching(list, { type: 'Language', status: 'ADOPT' }), 0);
});

test('countMatching handles empty and missing lists', () => {
  assert.equal(filter.countMatching([], { type: ALL, status: ALL }), 0);
  assert.equal(filter.countMatching(undefined, { type: ALL, status: ALL }), 0);
});

test('isActive is true when at least one filter is set', () => {
  assert.equal(filter.isActive({ type: ALL, status: ALL }), false);
  assert.equal(filter.isActive({ type: 'Language', status: ALL }), true);
  assert.equal(filter.isActive({ type: ALL, status: 'HOLD' }), true);
  assert.equal(filter.isActive({ type: 'Language', status: 'HOLD' }), true);
});

test('counterText formats the counter', () => {
  assert.equal(filter.counterText(3, 81), 'Showing 3 of 81 technologies');
  assert.equal(filter.counterText(0, 0), 'Showing 0 of 0 technologies');
});

test('parseFilters reads valid parameters', () => {
  assert.deepEqual(filter.parseFilters('?type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filter.parseFilters('type=Data%20Management'), { type: 'Data Management', status: ALL });
  assert.deepEqual(filter.parseFilters('?type=Data+Management&status=ADOPT'), { type: 'Data Management', status: 'ADOPT' });
  assert.deepEqual(filter.parseFilters('?status=TRIAL'), { type: ALL, status: 'TRIAL' });
});

test('parseFilters ignores unknown, empty, missing and badly cased values', () => {
  assert.deepEqual(filter.parseFilters('?type=Foo&status=hold'), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters('?type=datastores&status=Hold'), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters('?type=&status='), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters(''), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters('?other=1'), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters('?type=Language&status=nope'), { type: 'Language', status: ALL });
});

test('parseFilters tolerates non-string input', () => {
  for (const value of [undefined, null, 42, {}, []]) {
    assert.deepEqual(filter.parseFilters(value), { type: ALL, status: ALL });
  }
});

test('parseFilters uses the first value of a repeated parameter', () => {
  assert.deepEqual(filter.parseFilters('?type=Language&type=Datastores'), { type: 'Language', status: ALL });
  assert.deepEqual(filter.parseFilters('?type=Foo&type=Language'), { type: ALL, status: ALL });
});

test('buildSearch builds the query string', () => {
  assert.equal(filter.buildSearch({ type: 'Datastores', status: 'HOLD' }, ''), '?type=Datastores&status=HOLD');
  assert.equal(filter.buildSearch({ type: 'Datastores', status: ALL }, ''), '?type=Datastores');
  assert.equal(filter.buildSearch({ type: ALL, status: 'HOLD' }, ''), '?status=HOLD');
  assert.equal(filter.buildSearch({ type: 'Data Management', status: ALL }, ''), '?type=Data+Management');
});

test('buildSearch returns an empty string when both filters are ALL', () => {
  assert.equal(filter.buildSearch({ type: ALL, status: ALL }, ''), '');
  assert.equal(filter.buildSearch({ type: ALL, status: ALL }, '?type=Datastores&status=HOLD'), '');
});

test('buildSearch drops a filter that went back to ALL', () => {
  assert.equal(filter.buildSearch({ type: ALL, status: 'HOLD' }, '?type=Datastores&status=HOLD'), '?status=HOLD');
});

test('buildSearch preserves unrelated parameters', () => {
  assert.equal(filter.buildSearch({ type: 'Language', status: ALL }, '?foo=bar'), '?foo=bar&type=Language');
  assert.equal(filter.buildSearch({ type: ALL, status: ALL }, '?foo=bar&type=Language'), '?foo=bar');
});

test('buildSearch ignores invalid values', () => {
  assert.equal(filter.buildSearch({ type: 'Foo', status: 'hold' }, ''), '');
  assert.equal(filter.buildSearch(undefined, ''), '');
  assert.equal(filter.buildSearch({ type: 'Language' }, undefined), '?type=Language');
});

test('parseFilters and buildSearch round-trip', () => {
  for (const type of [ALL, ...filter.TYPE_OPTIONS]) {
    for (const status of [ALL, ...filter.STATUS_OPTIONS]) {
      const search = filter.buildSearch({ type, status }, '');
      assert.deepEqual(filter.parseFilters(search), { type, status });
    }
  }
});
