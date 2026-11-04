'use strict';

const { compareTechnologies } = require('../docs/technology-mapping');

// List all technologies ordered by number.
async function listTechnologies(pool) {
  const { rows } = await pool.query(
    'SELECT number, title, description, type, status, trend FROM technologies ORDER BY number'
  );
  return rows;
}

// Number to give a new technology: the smallest number among existing rows
// that sort strictly after it in the canonical order (type, status, title),
// or max + 1 (1 for an empty table) when none does.
function insertPosition(rows, technology) {
  let pos = null;
  let max = 0;
  for (const row of rows) {
    const number = Number(row.number);
    if (number > max) max = number;
    if (compareTechnologies(row, technology) > 0 && (pos === null || number < pos)) {
      pos = number;
    }
  }
  return pos === null ? max + 1 : pos;
}

// Insert a technology at its sorted position (type, then status, then title)
// and move every technology from that number onwards up by one, so numbering
// stays contiguous and in order. The client never supplies the number.
async function createTechnology(pool, { title, description, type, status, trend }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize against deletes and other inserts so renumbering never
    // interleaves and the sequence stays in sync.
    await client.query('LOCK TABLE technologies IN EXCLUSIVE MODE');
    const { rows: existing } = await client.query(
      'SELECT number, title, type, status FROM technologies'
    );
    const number = insertPosition(existing, { title, type, status });
    // Shift in two steps: the primary key is checked row by row, so a
    // single `number = number + 1` could collide depending on scan order.
    await client.query(
      'UPDATE technologies SET number = -(number + 1) WHERE number >= $1',
      [number]
    );
    await client.query('UPDATE technologies SET number = -number WHERE number < 0');
    const { rows } = await client.query(
      'INSERT INTO technologies (number, title, description, type, status, trend) ' +
        'OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6) ' +
        'RETURNING number, title, description, type, status, trend',
      [number, title, description, type, status, trend]
    );
    // Point the sequence at the new max so it stays aligned with the table.
    await client.query(
      "SELECT setval(pg_get_serial_sequence('technologies', 'number'), max(number)) " +
      'FROM technologies HAVING max(number) IS NOT NULL'
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Delete the technology with the given number and move every later
// technology down one number, so numbering stays contiguous (1..N).
// Returns false when no technology has that number.
async function deleteTechnology(pool, number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize against other deletes and inserts so renumbering never
    // interleaves and the sequence stays in sync.
    await client.query('LOCK TABLE technologies IN EXCLUSIVE MODE');
    const { rows } = await client.query(
      'DELETE FROM technologies WHERE number = $1 RETURNING number',
      [number]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    // Renumber in two steps: the primary key is checked row by row, so a
    // single `number = number - 1` could collide depending on scan order.
    await client.query(
      'UPDATE technologies SET number = -(number - 1) WHERE number > $1',
      [number]
    );
    await client.query('UPDATE technologies SET number = -number WHERE number < 0');
    // Point the sequence at the new max so the next insert gets max + 1.
    // Left untouched when the table is empty, so the seed does not refill it.
    await client.query(
      "SELECT setval(pg_get_serial_sequence('technologies', 'number'), max(number)) " +
      'FROM technologies HAVING max(number) IS NOT NULL'
    );
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listTechnologies, createTechnology, deleteTechnology };
