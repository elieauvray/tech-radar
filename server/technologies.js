'use strict';

async function listTechnologies(pool) {
  const { rows } = await pool.query(
    'SELECT number, title, description, type, status, trend FROM technologies ORDER BY number'
  );
  return rows;
}

// `number` is an identity column: the database assigns the next value
// (current max + 1, since the seed and deleteTechnology keep the sequence
// aligned with the highest number). The client never supplies it.
async function createTechnology(pool, { title, description, type, status, trend }) {
  const { rows } = await pool.query(
    'INSERT INTO technologies (title, description, type, status, trend) VALUES ($1, $2, $3, $4, $5) ' +
      'RETURNING number, title, description, type, status, trend',
    [title, description, type, status, trend]
  );
  return rows[0];
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
