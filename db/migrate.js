'use strict';

// Run every SQL file in db/migrations in name order, each in its own
// transaction. The migrations are idempotent, so no tracking table is needed.
const fs = require('fs');
const path = require('path');
const { createPool } = require('../server/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate(pool) {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`Running migration ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const pool = createPool();
  migrate(pool)
    .then(() => console.log('Migrations complete'))
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { migrate };
