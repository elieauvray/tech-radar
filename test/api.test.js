'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');

async function withServer({
  listTechnologies = async () => [],
  createTechnology = async () => { throw new Error('not expected'); },
  deleteTechnology = async () => { throw new Error('not expected'); },
}, fn) {
  const app = createApp({ listTechnologies, createTechnology, deleteTechnology });
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

async function withSilencedConsoleError(fn) {
  const originalError = console.error;
  console.error = () => {};
  try {
    await fn();
  } finally {
    console.error = originalError;
  }
}

const ROWS = [
  { number: 1, title: 'PostgreSQL', description: 'Relational database.', type: 'Datastores', status: 'ADOPT', trend: 'no change' },
  { number: 2, title: 'Flink', description: 'Stream processing.', type: 'Data Management', status: 'ADOPT', trend: 'moved up' },
];

// Fake database insert: records its calls and assigns number = max + 1.
function fakeCreate(rows = ROWS) {
  const calls = [];
  const create = async (data) => {
    calls.push(data);
    const max = rows.reduce((m, r) => Math.max(m, r.number), 0);
    return { number: max + 1, ...data };
  };
  return { create, calls };
}

const VALID = {
  title: 'Kafka',
  description: 'Distributed event streaming platform.',
  type: 'Data Management',
  status: 'TRIAL',
  trend: 'new',
};

function post(base, body, raw = false) {
  return fetch(`${base}/api/technologies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? body : JSON.stringify(body),
  });
}

test('GET /api/technologies returns all technologies in order', async () => {
  await withServer({ listTechnologies: async () => ROWS }, async (base) => {
    const res = await fetch(`${base}/api/technologies`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await res.json(), ROWS);
  });
});

// Fake database list: deliberately out of order, filters by status and sorts
// by number like the real query does. Records the status argument of each call.
const MIXED_ROWS = [
  { number: 4, title: 'Kafka', description: 'Event streaming.', type: 'Data Management', status: 'TRIAL', trend: 'new' },
  { number: 3, title: 'Spark', description: 'Batch processing.', type: 'Data Management', status: 'ADOPT', trend: 'no change' },
  { number: 1, title: 'PostgreSQL', description: 'Relational database.', type: 'Datastores', status: 'ADOPT', trend: 'no change' },
  { number: 5, title: 'Hadoop', description: 'Legacy batch.', type: 'Data Management', status: 'HOLD', trend: 'moved down' },
  { number: 2, title: 'Redis', description: 'In-memory store.', type: 'Datastores', status: 'ASSESS', trend: 'no change' },
];

function fakeList(rows = MIXED_ROWS) {
  const calls = [];
  const list = async (status) => {
    calls.push(status);
    return rows
      .filter((r) => status === undefined || r.status === status)
      .sort((a, b) => a.number - b.number);
  };
  return { list, calls };
}

const ADOPT_ROWS = [MIXED_ROWS[2], MIXED_ROWS[1]];

test('GET /api/technologies?status=ADOPT returns only ADOPT technologies in order', async () => {
  const { list, calls } = fakeList();
  await withServer({ listTechnologies: list }, async (base) => {
    const res = await fetch(`${base}/api/technologies?status=ADOPT`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await res.json(), ADOPT_ROWS);
    assert.deepEqual(calls, ['ADOPT']);
  });
});

test('GET /api/technologies?status is case-insensitive', async () => {
  const { list, calls } = fakeList();
  await withServer({ listTechnologies: list }, async (base) => {
    for (const value of ['adopt', 'Adopt', 'ADOPT']) {
      const res = await fetch(`${base}/api/technologies?status=${value}`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), ADOPT_ROWS);
    }
    assert.deepEqual(calls, ['ADOPT', 'ADOPT', 'ADOPT']);
  });
});

test('GET /api/technologies?status accepts every allowed status', async () => {
  const { list } = fakeList();
  await withServer({ listTechnologies: list }, async (base) => {
    for (const status of ['ADOPT', 'TRIAL', 'ASSESS', 'HOLD']) {
      const res = await fetch(`${base}/api/technologies?status=${status.toLowerCase()}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.length > 0);
      assert.ok(body.every((r) => r.status === status));
    }
  });
});

test('GET /api/technologies without status does not filter', async () => {
  const { list, calls } = fakeList();
  await withServer({ listTechnologies: list }, async (base) => {
    const res = await fetch(`${base}/api/technologies`);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).map((r) => r.number), [1, 2, 3, 4, 5]);
    assert.deepEqual(calls, [undefined]);
  });
});

const INVALID_STATUS_QUERIES = [
  ['an unknown value', 'status=FOO'],
  ['an empty value', 'status='],
  ['a repeated parameter', 'status=ADOPT&status=TRIAL'],
  ['a nested parameter', 'status[a]=b'],
  ['an inherited object key', 'status=constructor'],
];

for (const [name, query] of INVALID_STATUS_QUERIES) {
  test(`GET /api/technologies rejects ${name} with 400`, async () => {
    const { list, calls } = fakeList();
    await withServer({ listTechnologies: list }, async (base) => {
      const res = await fetch(`${base}/api/technologies?${query}`);
      assert.equal(res.status, 400);
      assert.match(res.headers.get('content-type'), /application\/json/);
      const body = await res.json();
      assert.deepEqual(body, { errors: { status: 'Status must be one of: ADOPT, TRIAL, ASSESS, HOLD' } });
      assert.deepEqual(calls, []);
    });
  });
}

test('GET /api/technologies?status=ADOPT returns 500 when the database fails', async () => {
  await withSilencedConsoleError(async () => {
    await withServer({ listTechnologies: async () => { throw new Error('connection refused'); } }, async (base) => {
      const res = await fetch(`${base}/api/technologies?status=ADOPT`);
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { error: 'Failed to load technologies' });
    });
  });
});

test('GET /api/technologies returns 500 when the database fails', async () => {
  await withSilencedConsoleError(async () => {
    await withServer({ listTechnologies: async () => { throw new Error('connection refused'); } }, async (base) => {
      const res = await fetch(`${base}/api/technologies`);
      assert.equal(res.status, 500);
      const body = await res.json();
      assert.equal(typeof body.error, 'string');
      assert.doesNotMatch(body.error, /connection refused/);
    });
  });
});

test('serves the static front end', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<svg id="radar">/);
  });
});

test('serves the shared validation script', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/technology-validation.js`);
    assert.equal(res.status, 200);
  });
});

test('POST /api/technologies creates a technology and returns 201', async () => {
  const { create, calls } = fakeCreate();
  await withServer({ createTechnology: create }, async (base) => {
    const res = await post(base, { ...VALID, title: '  Kafka  ', number: 999 });
    assert.equal(res.status, 201);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await res.json(), { number: 3, ...VALID });
    // only the five trimmed fields reach the database; `number` is ignored
    assert.deepEqual(calls, [VALID]);
  });
});

test('POST /api/technologies accepts boundary lengths', async () => {
  const { create, calls } = fakeCreate();
  await withServer({ createTechnology: create }, async (base) => {
    const cases = [
      { title: 'a'.repeat(60), description: 'b'.repeat(280) },
      { title: '😀'.repeat(60), description: '😀'.repeat(280) },
    ];
    for (const fields of cases) {
      const res = await post(base, { ...VALID, ...fields });
      assert.equal(res.status, 201);
    }
    assert.equal(calls.length, 2);
  });
});

const INVALID_CASES = [
  ['missing title', { title: undefined }, 'title', /Title is required/],
  ['empty title', { title: '' }, 'title', /Title is required/],
  ['whitespace-only title', { title: '   ' }, 'title', /Title is required/],
  ['non-string title', { title: 42 }, 'title', /Title is required/],
  ['title of 61 characters', { title: 'a'.repeat(61) }, 'title', /at most 60 characters/],
  ['empty description', { description: '' }, 'description', /Description is required/],
  ['description of 281 characters', { description: 'b'.repeat(281) }, 'description', /at most 280 characters/],
  ['unknown type', { type: 'Frameworks' }, 'type', /Type must be one of/],
  ['missing type', { type: undefined }, 'type', /Type must be one of/],
  ['unknown status', { status: 'ADOPTED' }, 'status', /Status must be one of/],
  ['unknown trend', { trend: 'sideways' }, 'trend', /Trend must be one of/],
  ['prototype key as trend', { trend: 'toString' }, 'trend', /Trend must be one of/],
];

for (const [name, override, field, message] of INVALID_CASES) {
  test(`POST /api/technologies rejects ${name} with 400`, async () => {
    const { create, calls } = fakeCreate();
    await withServer({ createTechnology: create }, async (base) => {
      const res = await post(base, { ...VALID, ...override });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.deepEqual(Object.keys(body.errors), [field]);
      assert.match(body.errors[field], message);
      assert.equal(calls.length, 0);
    });
  });
}

test('POST /api/technologies returns one message per invalid field', async () => {
  const { create, calls } = fakeCreate();
  await withServer({ createTechnology: create }, async (base) => {
    const res = await post(base, { title: '', description: 'x'.repeat(281), type: 'x', status: 'y', trend: 'z' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.deepEqual(Object.keys(body.errors).sort(), ['description', 'status', 'title', 'trend', 'type']);
    for (const message of Object.values(body.errors)) {
      assert.equal(typeof message, 'string');
    }
    assert.equal(calls.length, 0);
  });
});

test('POST /api/technologies rejects malformed JSON with 400', async () => {
  const { create, calls } = fakeCreate();
  await withServer({ createTechnology: create }, async (base) => {
    const res = await post(base, '{"title": ', true);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.errors.body, 'Request body must be valid JSON');
    assert.equal(calls.length, 0);
  });
});

test('POST /api/technologies rejects a non-object body with 400', async () => {
  const { create, calls } = fakeCreate();
  await withServer({ createTechnology: create }, async (base) => {
    for (const body of [[VALID], 'Kafka', null]) {
      const res = await post(base, body);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.deepEqual(Object.keys(json.errors).sort(), ['description', 'status', 'title', 'trend', 'type']);
    }
    assert.equal(calls.length, 0);
  });
});

test('POST /api/technologies returns 500 when the database fails', async () => {
  await withSilencedConsoleError(async () => {
    await withServer({ createTechnology: async () => { throw new Error('connection refused'); } }, async (base) => {
      const res = await post(base, VALID);
      assert.equal(res.status, 500);
      const body = await res.json();
      assert.equal(body.error, 'Failed to create technology');
      assert.doesNotMatch(JSON.stringify(body), /connection refused/);
    });
  });
});

// Fake database delete: records its calls and returns `result`.
function fakeDelete(result = true) {
  const calls = [];
  const del = async (number) => {
    calls.push(number);
    return result;
  };
  return { del, calls };
}

function del(base, number) {
  return fetch(`${base}/api/technologies/${number}`, { method: 'DELETE' });
}

test('DELETE /api/technologies/:number deletes and returns 204', async () => {
  const { del: deleteTechnology, calls } = fakeDelete(true);
  await withServer({ deleteTechnology }, async (base) => {
    const res = await del(base, 10);
    assert.equal(res.status, 204);
    assert.equal(await res.text(), '');
    assert.deepEqual(calls, [10]);
  });
});

test('DELETE /api/technologies/:number returns 404 when the technology does not exist', async () => {
  const { del: deleteTechnology, calls } = fakeDelete(false);
  await withServer({ deleteTechnology }, async (base) => {
    const res = await del(base, 999);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Technology not found' });
    assert.deepEqual(calls, [999]);
  });
});

for (const param of ['abc', '0', '-1', '1.5', '01', '1e3', '99999999999', '2147483648']) {
  test(`DELETE /api/technologies/${param} returns 400`, async () => {
    const { del: deleteTechnology, calls } = fakeDelete(true);
    await withServer({ deleteTechnology }, async (base) => {
      const res = await del(base, param);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.errors.number, 'Number must be a positive integer');
      assert.equal(calls.length, 0);
    });
  });
}

test('DELETE /api/technologies/:number returns 500 when the database fails', async () => {
  await withSilencedConsoleError(async () => {
    await withServer({ deleteTechnology: async () => { throw new Error('connection refused'); } }, async (base) => {
      const res = await del(base, 3);
      assert.equal(res.status, 500);
      const body = await res.json();
      assert.equal(body.error, 'Failed to delete technology');
      assert.doesNotMatch(JSON.stringify(body), /connection refused/);
    });
  });
});

test('GET /healthz returns 404', async () => {
  await withServer({}, async (base) => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 404);
  });
});
