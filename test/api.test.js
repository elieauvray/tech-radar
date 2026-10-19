'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');

async function withServer(listTechnologies, fn) {
  const app = createApp({ listTechnologies });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const ROWS = [
  { number: 1, title: 'PostgreSQL', description: 'Relational database.', type: 'Datastores', status: 'ADOPT', trend: 'no change' },
  { number: 2, title: 'Flink', description: 'Stream processing.', type: 'Data Management', status: 'ADOPT', trend: 'moved up' },
];

test('GET /api/technologies returns all technologies in order', async () => {
  await withServer(async () => ROWS, async (base) => {
    const res = await fetch(`${base}/api/technologies`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await res.json(), ROWS);
  });
});

test('GET /api/technologies returns 500 when the database fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    await withServer(async () => { throw new Error('connection refused'); }, async (base) => {
      const res = await fetch(`${base}/api/technologies`);
      assert.equal(res.status, 500);
      const body = await res.json();
      assert.equal(typeof body.error, 'string');
      assert.doesNotMatch(body.error, /connection refused/);
    });
  } finally {
    console.error = originalError;
  }
});

test('serves the static front end', async () => {
  await withServer(async () => [], async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<svg id="radar">/);
  });
});
