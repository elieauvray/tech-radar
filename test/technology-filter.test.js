'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mapping = require('../docs/technology-mapping.js');
const filter = require('../docs/technology-filter.js');
const seedData = require('../db/seed-data.json');

const ALL = filter.ALL;

const ROWS = [
  { number: 1, title: 'Postgres', type: 'Datastores', status: 'ADOPT' },
  { number: 2, title: 'Memcached', type: 'Datastores', status: 'HOLD' },
  { number: 3, title: 'Kafka', type: 'Data Management', status: 'TRIAL' },
  { number: 4, title: 'Terraform', type: 'Infrastructure', status: 'ASSESS' },
  { number: 5, title: 'Puppet', type: 'Infrastructure', status: 'HOLD' },
  { number: 6, title: 'Go', type: 'Language', status: 'ADOPT' }
];

function numbers(rows, filters) {
  return rows.filter((row) => filter.matches(row, filters)).map((row) => row.number);
}

test('the option lists follow the domain values of TechnologyMapping', () => {
  assert.deepEqual(filter.TYPE_OPTIONS, ['Datastores', 'Data Management', 'Infrastructure', 'Language']);
  assert.deepEqual(filter.STATUS_OPTIONS, ['ADOPT', 'TRIAL', 'ASSESS', 'HOLD']);
  assert.deepEqual(filter.TYPE_OPTIONS.slice().sort(), Object.keys(mapping.TYPES).sort());
  assert.deepEqual(filter.STATUS_OPTIONS.slice().sort(), Object.keys(mapping.STATUSES).sort());
});

test('"All" for both filters matches everything', () => {
  assert.deepEqual(numbers(ROWS, { type: ALL, status: ALL }), [1, 2, 3, 4, 5, 6]);
  assert.equal(filter.countMatching(ROWS, { type: ALL, status: ALL }), ROWS.length);
});

test('the Type filter alone keeps only that type', () => {
  assert.deepEqual(numbers(ROWS, { type: 'Datastores', status: ALL }), [1, 2]);
  assert.deepEqual(numbers(ROWS, { type: 'Data Management', status: ALL }), [3]);
  assert.deepEqual(numbers(ROWS, { type: 'Infrastructure', status: ALL }), [4, 5]);
  assert.deepEqual(numbers(ROWS, { type: 'Language', status: ALL }), [6]);
});

test('the Status filter alone keeps only that status', () => {
  assert.deepEqual(numbers(ROWS, { type: ALL, status: 'ADOPT' }), [1, 6]);
  assert.deepEqual(numbers(ROWS, { type: ALL, status: 'TRIAL' }), [3]);
  assert.deepEqual(numbers(ROWS, { type: ALL, status: 'ASSESS' }), [4]);
  assert.deepEqual(numbers(ROWS, { type: ALL, status: 'HOLD' }), [2, 5]);
});

test('both filters combine with AND', () => {
  assert.deepEqual(numbers(ROWS, { type: 'Datastores', status: 'HOLD' }), [2]);
  assert.deepEqual(numbers(ROWS, { type: 'Language', status: 'HOLD' }), []);
  assert.equal(filter.countMatching(ROWS, { type: 'Language', status: 'HOLD' }), 0);
});

test('matches ignores unknown filter values like "All"', () => {
  assert.deepEqual(numbers(ROWS, { type: 'Foo', status: 'hold' }), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(numbers(ROWS, null), [1, 2, 3, 4, 5, 6]);
});

test('every Type and Status value of the seed data counts consistently', () => {
  let byType = 0;
  filter.TYPE_OPTIONS.forEach((type) => {
    byType += filter.countMatching(seedData, { type, status: ALL });
  });
  assert.equal(byType, seedData.length);
  let byStatus = 0;
  filter.STATUS_OPTIONS.forEach((status) => {
    byStatus += filter.countMatching(seedData, { type: ALL, status });
  });
  assert.equal(byStatus, seedData.length);
  let byBoth = 0;
  filter.TYPE_OPTIONS.forEach((type) => {
    filter.STATUS_OPTIONS.forEach((status) => {
      byBoth += filter.countMatching(seedData, { type, status });
    });
  });
  assert.equal(byBoth, seedData.length);
});

test('normalizeFilters keeps valid values and drops the others', () => {
  assert.deepEqual(filter.normalizeFilters({ type: 'Datastores', status: 'HOLD' }), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filter.normalizeFilters({ type: 'datastores', status: 'hold' }), { type: ALL, status: ALL });
  assert.deepEqual(filter.normalizeFilters({ type: 42, status: null }), { type: ALL, status: ALL });
  assert.deepEqual(filter.normalizeFilters({ type: 'toString', status: '__proto__' }), { type: ALL, status: ALL });
  assert.deepEqual(filter.normalizeFilters(undefined), { type: ALL, status: ALL });
  assert.deepEqual(filter.normalizeFilters('Datastores'), { type: ALL, status: ALL });
});

test('normalizeFilters ignores inherited properties', () => {
  const inherited = Object.create({ type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filter.normalizeFilters(inherited), { type: ALL, status: ALL });
});

test('parseFilters reads valid type and status, with or without the leading "?"', () => {
  assert.deepEqual(filter.parseFilters('?type=Datastores&status=HOLD'), { type: 'Datastores', status: 'HOLD' });
  assert.deepEqual(filter.parseFilters('type=Language'), { type: 'Language', status: ALL });
  assert.deepEqual(filter.parseFilters('?status=TRIAL'), { type: ALL, status: 'TRIAL' });
});

test('parseFilters decodes "Data Management" written with %20 or +', () => {
  assert.equal(filter.parseFilters('?type=Data%20Management').type, 'Data Management');
  assert.equal(filter.parseFilters('?type=Data+Management').type, 'Data Management');
});

test('parseFilters ignores unknown, wrong-case, repeated and missing values', () => {
  assert.deepEqual(filter.parseFilters('?type=Foo&status=hold'), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters('?type=__proto__&status=toString'), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters('?type=Datastores&type=Language'), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters('?type=&status='), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters('?other=1'), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters(''), { type: ALL, status: ALL });
  assert.deepEqual(filter.parseFilters(undefined), { type: ALL, status: ALL });
});

test('a valid parameter is kept next to an invalid one', () => {
  assert.deepEqual(filter.parseFilters('?type=Foo&status=HOLD'), { type: ALL, status: 'HOLD' });
});

test('serializeFilters only writes the filters that are set', () => {
  assert.equal(filter.serializeFilters({ type: ALL, status: ALL }), '');
  assert.equal(filter.serializeFilters({ type: 'Datastores', status: ALL }), '?type=Datastores');
  assert.equal(filter.serializeFilters({ type: ALL, status: 'HOLD' }), '?status=HOLD');
  assert.equal(filter.serializeFilters({ type: 'Datastores', status: 'HOLD' }), '?type=Datastores&status=HOLD');
  assert.equal(filter.serializeFilters({ type: 'Bogus', status: 'HOLD' }), '?status=HOLD');
});

test('serializeFilters and parseFilters round-trip every combination', () => {
  const types = [ALL].concat(filter.TYPE_OPTIONS);
  const statuses = [ALL].concat(filter.STATUS_OPTIONS);
  types.forEach((type) => {
    statuses.forEach((status) => {
      const filters = { type, status };
      assert.deepEqual(filter.parseFilters(filter.serializeFilters(filters)), filters);
    });
  });
});

test('serializeFilters encodes the space of "Data Management"', () => {
  const query = filter.serializeFilters({ type: 'Data Management', status: ALL });
  assert.doesNotMatch(query, / /);
  assert.equal(filter.parseFilters(query).type, 'Data Management');
});

test('isActive is true when at least one filter is set', () => {
  assert.equal(filter.isActive({ type: ALL, status: ALL }), false);
  assert.equal(filter.isActive({ type: 'Language', status: ALL }), true);
  assert.equal(filter.isActive({ type: ALL, status: 'HOLD' }), true);
  assert.equal(filter.isActive({ type: 'Language', status: 'HOLD' }), true);
  assert.equal(filter.isActive({ type: 'Foo', status: 'bar' }), false);
});

test('counterText reads "Showing N of M technologies"', () => {
  assert.equal(filter.counterText(3, 12), 'Showing 3 of 12 technologies');
  assert.equal(filter.counterText(0, 12), 'Showing 0 of 12 technologies');
  assert.equal(filter.counterText(1, 1), 'Showing 1 of 1 technologies');
});

test('index.html has both labelled filter selects and loads the filter module', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  assert.match(html, /<label for="filter-type"[^>]*>Type<\/label>/);
  assert.match(html, /<select id="filter-type"/);
  assert.match(html, /<label for="filter-status"[^>]*>Status<\/label>/);
  assert.match(html, /<select id="filter-status"/);
  assert.match(html, /<script src="technology-filter\.js"><\/script>/);
});
