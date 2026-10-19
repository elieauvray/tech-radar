'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDbConfig } = require('../server/db');

test('prefers the Upsun relationship variables', () => {
  const config = getDbConfig({
    DATABASE_HOST: 'database.internal',
    DATABASE_PORT: '5432',
    DATABASE_USERNAME: 'main',
    DATABASE_PASSWORD: 'secret',
    DATABASE_PATH: 'main',
    DATABASE_URL: 'pgsql://main:secret@database.internal:5432/main',
  });
  assert.deepEqual(config, {
    host: 'database.internal',
    port: 5432,
    user: 'main',
    password: 'secret',
    database: 'main',
  });
});

test('falls back to DATABASE_URL', () => {
  const url = 'postgres://radar:radar@localhost:5432/techradar';
  assert.deepEqual(getDbConfig({ DATABASE_URL: url }), { connectionString: url });
});

test('throws when no configuration is present', () => {
  assert.throws(() => getDbConfig({}), /DATABASE_URL/);
});
