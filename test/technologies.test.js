'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deleteTechnology } = require('../server/technologies');

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
