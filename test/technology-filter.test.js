'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const filter = require('../docs/technology-filter.js');
const mapping = require('../docs/technology-mapping.js');

const ROWS = [
  { number: 1, title: 'Postgres', type: 'Datastores', status: 'ADOPT' },
  { number: 2, title: 'Redis', type: 'Datastores', status: 'HOLD' },
  { number: 3, title: 'Kafka', type: 'Data Management', status: 'TRIAL' },
  { number: 4, title: 'Terraform', type: 'Infrastructure', status: 'ADOPT' },
  { number: 5, title: 'Docker', type: 'Infrastructure', status: 'HOLD' },
  { number: 6, title: 'Go', type: 'Language', status: 'ASSESS' },
  { number: 7, title: 'PHP', type: 'Language', status: 'HOLD' }
];

function numbers(rows, filters) {
  return rows.filter((row) => filter.matches(row, filters)).map((row) => row.number);
}

test('defaults mean "All" and match every row', () => {
  assert.deepEqual(filter.DEFAULT_FILTERS, { type: '', status: '' });
  assert.deepEqual(numbers(ROWS, filter.DEFAULT_FILTERS), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(numbers(ROWS, undefined), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(filter.isActive(filter.DEFAULT_FILTERS), false);
});

test('type filter alone keeps only that type, for every type', () => {
  const expected = {
    'Datastores': [1, 2],
    'Data Management': [3],
    'Infrastructure': [4, 5],
    'Language': [6, 7]
  };
  mapping.TYPE_ORDER.forEach((type) => {
    assert.deepEqual(numbers(ROWS, { type, status: '' }), expected[type], type);
  });
});

test('status filter alone keeps only that status, for every status', () => {
  const expected = { ADOPT: [1, 4], TRIAL: [3], ASSESS: [6], HOLD: [2, 5, 7] };
  Object.keys(mapping.STATUSES).forEach((status) => {
    assert.deepEqual(numbers(ROWS, { type: '', status }), expected[status], status);
  });
});

test('type and status combine with AND, for every combination', () => {
  Object.keys(mapping.TYPES).forEach((type) => {
    Object.keys(mapping.STATUSES).forEach((status) => {
      const expected = ROWS
        .filter((row) => row.type === type && row.status === status)
        .map((row) => row.number);
      assert.deepEqual(numbers(ROWS, { type, status }), expected, type + ' + ' + status);
    });
  });
  assert.deepEqual(numbers(ROWS, { type: 'Datastores', status: 'HOLD' }), [2]);
  assert.deepEqual(numbers(ROWS, { type: 'Language', status: 'TRIAL' }), []);
});

test('countMatching counts the matching rows', () => {
  assert.equal(filter.countMatching(ROWS, filter.DEFAULT_FILTERS), 7);
  assert.equal(filter.countMatching(ROWS, { type: '', status: 'HOLD' }), 3);
  assert.equal(filter.countMatching(ROWS, { type: 'Datastores', status: 'HOLD' }), 1);
  assert.equal(filter.countMatching(ROWS, { type: 'Language', status: 'TRIAL' }), 0);
  assert.equal(filter.countMatching([], { type: 'Language', status: '' }), 0);
  assert.equal(filter.countMatching(null, filter.DEFAULT_FILTERS), 0);
});

test('isActive is true when at least one filter is set', () => {
  assert.equal(filter.isActive({ type: 'Language', status: '' }), true);
  assert.equal(filter.isActive({ type: '', status: 'HOLD' }), true);
  assert.equal(filter.isActive({ type: 'Language', status: 'HOLD' }), true);
  assert.equal(filter.isActive({ type: 'Nope', status: '' }), false);
});

test('normalizeFilters keeps known values and resets anything else', () => {
  assert.deepEqual(
    filter.normalizeFilters({ type: 'Datastores', status: 'HOLD' }),
    { type: 'Datastores', status: 'HOLD' }
  );
  assert.deepEqual(
    filter.normalizeFilters({ type: 'Foo', status: 'hold' }),
    { type: '', status: '' }
  );
  assert.deepEqual(
    filter.normalizeFilters({ type: 'datastores', status: 'Hold' }),
    { type: '', status: '' }
  );
  assert.deepEqual(
    filter.normalizeFilters({ type: 'Datastores', status: 'nope' }),
    { type: 'Datastores', status: '' }
  );
});

test('normalizeFilters tolerates prototype keys and non-string input', () => {
  ['__proto__', 'constructor', 'toString', 'hasOwnProperty'].forEach((key) => {
    assert.deepEqual(
      filter.normalizeFilters({ type: key, status: key }),
      { type: '', status: '' },
      key
    );
  });
  [null, undefined, 42, 'Datastores', [], true].forEach((input) => {
    assert.deepEqual(filter.normalizeFilters(input), { type: '', status: '' });
  });
  assert.deepEqual(
    filter.normalizeFilters({ type: ['Datastores'], status: 3 }),
    { type: '', status: '' }
  );
  assert.deepEqual(
    filter.normalizeFilters({ type: null, status: {} }),
    { type: '', status: '' }
  );
});

test('parseQuery reads type and status from a query string', () => {
  assert.deepEqual(
    filter.parseQuery('?type=Datastores&status=HOLD'),
    { type: 'Datastores', status: 'HOLD' }
  );
  assert.deepEqual(
    filter.parseQuery('?type=Data%20Management'),
    { type: 'Data Management', status: '' }
  );
  assert.deepEqual(
    filter.parseQuery('?type=Data+Management&status=TRIAL'),
    { type: 'Data Management', status: 'TRIAL' }
  );
  assert.deepEqual(filter.parseQuery(''), { type: '', status: '' });
  assert.deepEqual(filter.parseQuery('?'), { type: '', status: '' });
});

test('parseQuery ignores unknown values per field and keeps the valid one', () => {
  assert.deepEqual(
    filter.parseQuery('?type=Foo&status=HOLD'),
    { type: '', status: 'HOLD' }
  );
  assert.deepEqual(
    filter.parseQuery('?type=Datastores&status=hold'),
    { type: 'Datastores', status: '' }
  );
  assert.deepEqual(filter.parseQuery('?type=__proto__'), { type: '', status: '' });
  assert.deepEqual(filter.parseQuery('?type=constructor&status=toString'), { type: '', status: '' });
  assert.deepEqual(filter.parseQuery('?type=&status='), { type: '', status: '' });
  assert.deepEqual(filter.parseQuery('?other=1'), { type: '', status: '' });
});

test('parseQuery takes the first value when a param is repeated and tolerates non-strings', () => {
  assert.deepEqual(
    filter.parseQuery('?type=Language&type=Datastores'),
    { type: 'Language', status: '' }
  );
  [null, undefined, 42, {}, []].forEach((input) => {
    assert.deepEqual(filter.parseQuery(input), { type: '', status: '' });
  });
});

test('toQuery omits defaults and encodes values', () => {
  assert.equal(filter.toQuery(filter.DEFAULT_FILTERS), '');
  assert.equal(filter.toQuery({ type: 'Datastores', status: '' }), '?type=Datastores');
  assert.equal(filter.toQuery({ type: '', status: 'HOLD' }), '?status=HOLD');
  assert.equal(
    filter.toQuery({ type: 'Datastores', status: 'HOLD' }),
    '?type=Datastores&status=HOLD'
  );
  assert.equal(
    filter.toQuery({ type: 'Data Management', status: '' }),
    '?type=Data+Management'
  );
  assert.equal(filter.toQuery({ type: 'Foo', status: 'bar' }), '');
  assert.equal(filter.toQuery(null), '');
});

test('toQuery and parseQuery round-trip every combination', () => {
  const types = [''].concat(mapping.TYPE_ORDER);
  const statuses = [''].concat(Object.keys(mapping.STATUSES));
  types.forEach((type) => {
    statuses.forEach((status) => {
      const filters = { type, status };
      assert.deepEqual(filter.parseQuery(filter.toQuery(filters)), filters);
    });
  });
});

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');

test('index.html loads the filter module after the mapping module', () => {
  const mappingAt = html.indexOf('technology-mapping.js');
  const filterAt = html.indexOf('technology-filter.js');
  assert.ok(mappingAt !== -1);
  assert.ok(filterAt > mappingAt);
});

test('index.html has two labelled header selects', () => {
  assert.match(html, /<label[^>]*for="filter-type"[^>]*>\s*Type\s*<\/label>/);
  assert.match(html, /<label[^>]*for="filter-status"[^>]*>\s*Status\s*<\/label>/);
  assert.match(html, /<select[^>]*id="filter-type"/);
  assert.match(html, /<select[^>]*id="filter-status"/);
  assert.match(html, /id="filter-count"/);
  assert.match(html, /id="filter-reset"/);
});

test('index.html derives the option lists from TechnologyMapping', () => {
  assert.match(html, /TechnologyMapping\.TYPE_ORDER/);
  assert.match(html, /Object\.keys\(TechnologyMapping\.STATUSES\)/);
  assert.match(html, /All types/);
  assert.match(html, /All statuses/);
});
