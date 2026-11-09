'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mapping = require('../docs/technology-mapping.js');
const filter = require('../docs/technology-filter.js');
const seed = require('../db/seed-data.json');

const none = { type: '', status: '' };

const rows = [
  { type: 'Datastores', status: 'HOLD' },
  { type: 'Datastores', status: 'ADOPT' },
  { type: 'Language', status: 'HOLD' },
  { type: 'Infrastructure', status: 'TRIAL' },
  { type: 'Data Management', status: 'ASSESS' }
];

test('dropdown options follow the mapping order', () => {
  assert.deepEqual(filter.TYPE_OPTIONS, ['Datastores', 'Data Management', 'Infrastructure', 'Language']);
  assert.deepEqual(filter.STATUS_OPTIONS, ['ADOPT', 'TRIAL', 'ASSESS', 'HOLD']);
});

test('"All" matches everything', () => {
  rows.forEach((row) => assert.equal(filter.matches(row, none), true));
  assert.equal(filter.countMatches(rows, none), rows.length);
  assert.equal(filter.isActive(none), false);
});

test('type filter alone', () => {
  filter.TYPE_OPTIONS.forEach((type) => {
    rows.concat(seed).forEach((row) => {
      assert.equal(filter.matches(row, { type, status: '' }), row.type === type);
    });
  });
  assert.equal(filter.countMatches(rows, { type: 'Datastores', status: '' }), 2);
  assert.equal(filter.isActive({ type: 'Datastores', status: '' }), true);
});

test('status filter alone', () => {
  filter.STATUS_OPTIONS.forEach((status) => {
    rows.concat(seed).forEach((row) => {
      assert.equal(filter.matches(row, { type: '', status }), row.status === status);
    });
  });
  assert.equal(filter.countMatches(rows, { type: '', status: 'HOLD' }), 2);
  assert.equal(filter.isActive({ type: '', status: 'HOLD' }), true);
});

test('type and status combine with AND', () => {
  const both = { type: 'Datastores', status: 'HOLD' };
  assert.equal(filter.matches({ type: 'Datastores', status: 'HOLD' }, both), true);
  assert.equal(filter.matches({ type: 'Datastores', status: 'ADOPT' }, both), false);
  assert.equal(filter.matches({ type: 'Language', status: 'HOLD' }, both), false);
  assert.equal(filter.countMatches(rows, both), 1);
  assert.equal(filter.countMatches(rows, { type: 'Language', status: 'ADOPT' }), 0);
});

test('counts over the seed data are consistent', () => {
  let byType = 0;
  filter.TYPE_OPTIONS.forEach((type) => {
    let byTypeAndStatus = 0;
    filter.STATUS_OPTIONS.forEach((status) => {
      byTypeAndStatus += filter.countMatches(seed, { type, status });
    });
    assert.equal(byTypeAndStatus, filter.countMatches(seed, { type, status: '' }));
    byType += byTypeAndStatus;
  });
  assert.equal(byType, seed.length);
});

test('matches works on radar entries via the mapping', () => {
  const entry = { quadrant: mapping.typeToQuadrant('Datastores'), ring: mapping.statusToRing('HOLD') };
  const row = { type: mapping.quadrantToType(entry.quadrant), status: mapping.ringToStatus(entry.ring) };
  assert.equal(filter.matches(row, { type: 'Datastores', status: 'HOLD' }), true);
  assert.equal(filter.matches(row, { type: 'Datastores', status: 'TRIAL' }), false);
});

test('parseQuery reads valid values', () => {
  assert.deepEqual(filter.parseQuery('?type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filter.parseQuery('type=Language'), { type: 'Language', status: '' });
  assert.deepEqual(filter.parseQuery('?status=ADOPT'), { type: '', status: 'ADOPT' });
  assert.deepEqual(filter.parseQuery(''), none);
  assert.deepEqual(filter.parseQuery(undefined), none);
});

test('parseQuery decodes encoded values', () => {
  assert.equal(filter.parseQuery('?type=Data%20Management').type, 'Data Management');
  assert.equal(filter.parseQuery('?type=Data+Management').type, 'Data Management');
});

test('parseQuery ignores unknown values per parameter', () => {
  assert.deepEqual(filter.parseQuery('?type=Foo&status=HOLD'), { type: '', status: 'HOLD' });
  assert.deepEqual(filter.parseQuery('?type=Datastores&status=Foo'), { type: 'Datastores', status: '' });
  assert.deepEqual(filter.parseQuery('?type=Foo&status=Bar'), none);
});

test('parseQuery is case-sensitive and ignores empty values', () => {
  assert.deepEqual(filter.parseQuery('?type=datastores&status=hold'), none);
  assert.deepEqual(filter.parseQuery('?type=&status='), none);
});

test('parseQuery is safe against prototype keys', () => {
  assert.deepEqual(filter.parseQuery('?type=__proto__&status=constructor'), none);
  assert.deepEqual(filter.parseQuery('?type=toString&status=hasOwnProperty'), none);
  assert.deepEqual(filter.normalizeFilters({ type: 5, status: null }), none);
  assert.deepEqual(filter.normalizeFilters(null), none);
});

test('toQuery omits "All" and round-trips with parseQuery', () => {
  assert.equal(filter.toQuery(none), '');
  assert.equal(filter.toQuery({ type: 'Datastores', status: '' }), '?type=Datastores');
  assert.equal(filter.toQuery({ type: '', status: 'HOLD' }), '?status=HOLD');
  assert.equal(filter.toQuery({ type: 'Datastores', status: 'HOLD' }), '?type=Datastores&status=HOLD');
  filter.TYPE_OPTIONS.forEach((type) => {
    filter.STATUS_OPTIONS.concat(['']).forEach((status) => {
      const filters = { type, status };
      assert.deepEqual(filter.parseQuery(filter.toQuery(filters)), filters);
    });
  });
});

test('counterText', () => {
  assert.equal(filter.counterText(3, 10), 'Showing 3 of 10 technologies');
  assert.equal(filter.counterText(0, 10), 'Showing 0 of 10 technologies');
});
