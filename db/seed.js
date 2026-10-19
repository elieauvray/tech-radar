'use strict';

// Seed the technologies table from db/seed-data.json.
// Idempotent: inserts nothing if the table already has rows or has ever
// issued a number.
const { createPool } = require('../server/db');
const seedData = require('./seed-data.json');

async function seed(pool, rows = seedData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize concurrent seeds so two runs can never both see an empty table.
    await client.query('LOCK TABLE technologies IN EXCLUSIVE MODE');
    // Seed only a never-used table: once the identity sequence has issued a
    // number, seeding again (e.g. after every row was deleted) would hand
    // out numbers 1..N a second time.
    const { rows: existing } = await client.query(
      'SELECT EXISTS (SELECT 1 FROM technologies) AS has_rows, ' +
      "pg_sequence_last_value(pg_get_serial_sequence('technologies', 'number')) " +
      'IS NOT NULL AS numbers_issued'
    );
    if (existing[0].has_rows || existing[0].numbers_issued) {
      console.log('technologies table already has rows or issued numbers, skipping seed');
      await client.query('COMMIT');
      return 0;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      await client.query(
        'INSERT INTO technologies (number, title, description, type, status, trend) ' +
        'OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6)',
        [i + 1, row.title, row.description, row.type, row.status, row.trend]
      );
    }

    // Align the identity sequence with the explicit numbers inserted above.
    await client.query(
      "SELECT setval(pg_get_serial_sequence('technologies', 'number'), " +
      '(SELECT max(number) FROM technologies))'
    );
    await client.query('COMMIT');
    console.log(`Seeded ${rows.length} technologies`);
    return rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const pool = createPool();
  seed(pool)
    .catch((err) => {
      console.error(`Seed failed: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { seed };
