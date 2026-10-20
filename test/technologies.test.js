'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { listTechnologies, createTechnology, deleteTechnology } = require('../server/technologies');
const seedData = require('../db/seed-data.json');

// Fake pool whose client records every query. `respond(sql, params)` returns
// the query result or throws to simulate a database error.
function fakePool(respond = () => ({ rows: [] })) {
  const queries = [];
  const state = { released: 0 };
  const client = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return respond(sql, params);
    },
    release: () => { state.released++; },
  };
  return { pool: { connect: async () => client }, queries, state };
}

function sqls(queries) {
  return queries.map((q) => q.sql);
}

// Fake pool exposing `pool.query` directly, as listTechnologies uses it.
function fakeQueryPool(rows) {
  const queries = [];
  const pool = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows };
    },
  };
  return { pool, queries };
}

test('listTechnologies without a status runs the unfiltered query', async () => {
  const rows = [{ number: 1 }];
  const { pool, queries } = fakeQueryPool(rows);
  assert.equal(await listTechnologies(pool), rows);
  assert.equal(queries.length, 1);
  assert.equal(
    queries[0].sql,
    'SELECT number, title, description, type, status, trend FROM technologies ORDER BY number'
  );
  assert.equal(queries[0].params, undefined);
});

test('listTechnologies with a status filters with a bound parameter, ordered by number', async () => {
  const rows = [{ number: 1, status: 'ADOPT' }];
  const { pool, queries } = fakeQueryPool(rows);
  assert.equal(await listTechnologies(pool, 'ADOPT'), rows);
  assert.equal(queries.length, 1);
  assert.equal(
    queries[0].sql,
    'SELECT number, title, description, type, status, trend FROM technologies ' +
      'WHERE status = $1 ORDER BY number'
  );
  assert.deepEqual(queries[0].params, ['ADOPT']);
});

test('deleteTechnology deletes, renumbers later rows and realigns the sequence', async () => {
  const { pool, queries, state } = fakePool((sql) => (
    sql.startsWith('DELETE') ? { rows: [{ number: 10 }] } : { rows: [] }
  ));
  assert.equal(await deleteTechnology(pool, 10), true);
  const all = sqls(queries);
  assert.equal(all.length, 7);
  assert.equal(all[0], 'BEGIN');
  assert.equal(all[1], 'LOCK TABLE technologies IN EXCLUSIVE MODE');
  assert.match(all[2], /^DELETE FROM technologies WHERE number = \$1/);
  assert.deepEqual(queries[2].params, [10]);
  assert.match(all[3], /SET number = -\(number - 1\) WHERE number > \$1/);
  assert.deepEqual(queries[3].params, [10]);
  assert.match(all[4], /SET number = -number WHERE number < 0/);
  assert.match(all[5], /setval\(pg_get_serial_sequence\('technologies', 'number'\), max\(number\)\)/);
  assert.match(all[5], /HAVING max\(number\) IS NOT NULL/);
  assert.equal(all[6], 'COMMIT');
  assert.equal(state.released, 1);
});

test('deleteTechnology rolls back and returns false when no row matches', async () => {
  const { pool, queries, state } = fakePool(() => ({ rows: [] }));
  assert.equal(await deleteTechnology(pool, 999), false);
  const all = sqls(queries);
  assert.equal(all[all.length - 1], 'ROLLBACK');
  assert.ok(!all.some((sql) => sql.startsWith('UPDATE')));
  assert.ok(!all.includes('COMMIT'));
  assert.equal(state.released, 1);
});

test('deleteTechnology rolls back, rethrows and releases on a query error', async () => {
  const { pool, queries, state } = fakePool((sql) => {
    if (sql.startsWith('DELETE')) return { rows: [{ number: 3 }] };
    if (sql.includes('-(number - 1)')) throw new Error('boom');
    return { rows: [] };
  });
  await assert.rejects(deleteTechnology(pool, 3), /boom/);
  const all = sqls(queries);
  assert.equal(all[all.length - 1], 'ROLLBACK');
  assert.ok(!all.includes('COMMIT'));
  assert.equal(state.released, 1);
});

// Seed data numbered 1..N, as the radar numbers it today.
const seedRows = seedData.map((row, i) => ({
  number: i + 1, title: row.title, type: row.type, status: row.status,
}));

// Fake pool for createTechnology: SELECT returns `existing`, INSERT echoes
// the inserted row back.
function createPool(existing, failOn) {
  return fakePool((sql, params) => {
    if (failOn && sql.includes(failOn)) throw new Error('boom');
    if (sql.startsWith('SELECT number')) return { rows: existing };
    if (sql.startsWith('INSERT')) {
      const [number, title, description, type, status, trend] = params;
      return { rows: [{ number, title, description, type, status, trend }] };
    }
    return { rows: [] };
  });
}

const upsunDispatch = {
  title: 'Upsun Dispatch',
  description: 'Coding agent.',
  type: 'Infrastructure',
  status: 'ADOPT',
  trend: 'new',
};

test('createTechnology inserts at the sorted position and shifts later rows', async () => {
  assert.equal(seedRows[51].title, 'Upsun Cloud Application Platform');
  const { pool, queries, state } = createPool(seedRows);
  const created = await createTechnology(pool, upsunDispatch);
  assert.equal(created.number, 53);
  assert.equal(created.title, 'Upsun Dispatch');
  const all = sqls(queries);
  assert.equal(all.length, 8);
  assert.equal(all[0], 'BEGIN');
  assert.equal(all[1], 'LOCK TABLE technologies IN EXCLUSIVE MODE');
  assert.match(all[2], /^SELECT number, title, type, status FROM technologies/);
  assert.match(all[3], /SET number = -\(number \+ 1\) WHERE number >= \$1/);
  assert.deepEqual(queries[3].params, [53]);
  assert.match(all[4], /SET number = -number WHERE number < 0/);
  assert.match(all[5], /^INSERT INTO technologies \(number, title, description, type, status, trend\) OVERRIDING SYSTEM VALUE/);
  assert.deepEqual(queries[5].params, [53, 'Upsun Dispatch', 'Coding agent.', 'Infrastructure', 'ADOPT', 'new']);
  assert.match(all[6], /setval\(pg_get_serial_sequence\('technologies', 'number'\), max\(number\)\)/);
  assert.match(all[6], /HAVING max\(number\) IS NOT NULL/);
  assert.equal(all[7], 'COMMIT');
  assert.equal(state.released, 1);
});

test('createTechnology inserts at the start of a group', async () => {
  const { pool, queries } = createPool(seedRows);
  const created = await createTechnology(pool, { ...upsunDispatch, title: 'Akamai' });
  assert.equal(seedRows[43].title, 'Amazon SageMaker');
  assert.equal(created.number, 44);
  assert.deepEqual(queries[3].params, [44]);
});

test('createTechnology goes after an equal row', async () => {
  const { pool } = createPool(seedRows);
  const created = await createTechnology(pool, { ...upsunDispatch, title: 'Upsun Cloud Application Platform' });
  assert.equal(created.number, 53);
});

test('createTechnology appends max + 1 when nothing sorts after it', async () => {
  const { pool, queries } = createPool(seedRows);
  const created = await createTechnology(pool, { ...upsunDispatch, type: 'Language', status: 'HOLD', title: 'Zig' });
  assert.equal(created.number, seedRows.length + 1);
  assert.deepEqual(queries[3].params, [seedRows.length + 1]);
});

test('createTechnology gives number 1 on an empty table', async () => {
  const { pool } = createPool([]);
  const created = await createTechnology(pool, upsunDispatch);
  assert.equal(created.number, 1);
});

test('createTechnology rolls back, rethrows and releases on a query error', async () => {
  const { pool, queries, state } = createPool(seedRows, '-(number + 1)');
  await assert.rejects(createTechnology(pool, upsunDispatch), /boom/);
  const all = sqls(queries);
  assert.equal(all[all.length - 1], 'ROLLBACK');
  assert.ok(!all.includes('COMMIT'));
  assert.ok(!all.some((sql) => sql.startsWith('INSERT')));
  assert.equal(state.released, 1);
});
