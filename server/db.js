'use strict';

const { Pool } = require('pg');

// Build the pg connection config from the environment.
// On Upsun, the `database` relationship exposes discrete DATABASE_* variables;
// they are preferred because Upsun's DATABASE_URL uses the `pgsql://` scheme.
// For local development, DATABASE_URL (postgres://...) is used.
function getDbConfig(env = process.env) {
  if (env.DATABASE_HOST) {
    return {
      host: env.DATABASE_HOST,
      port: env.DATABASE_PORT ? Number(env.DATABASE_PORT) : 5432,
      user: env.DATABASE_USERNAME,
      password: env.DATABASE_PASSWORD,
      database: env.DATABASE_PATH,
    };
  }
  if (env.DATABASE_URL) {
    return { connectionString: env.DATABASE_URL };
  }
  throw new Error(
    'No database configuration found: set DATABASE_URL (e.g. postgres://user:pass@localhost:5432/techradar) ' +
    'or the DATABASE_HOST/DATABASE_PORT/DATABASE_USERNAME/DATABASE_PASSWORD/DATABASE_PATH variables.'
  );
}

function createPool(env = process.env) {
  return new Pool(getDbConfig(env));
}

module.exports = { getDbConfig, createPool };
