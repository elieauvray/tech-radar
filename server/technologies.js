'use strict';

async function listTechnologies(pool) {
  const { rows } = await pool.query(
    'SELECT number, title, description, type, status, trend FROM technologies ORDER BY number'
  );
  return rows;
}

// `number` is an identity column: the database assigns the next value
// (current max + 1, since the seed aligns the sequence and rows are never
// deleted). The client never supplies it.
async function createTechnology(pool, { title, description, type, status, trend }) {
  const { rows } = await pool.query(
    'INSERT INTO technologies (title, description, type, status, trend) VALUES ($1, $2, $3, $4, $5) ' +
      'RETURNING number, title, description, type, status, trend',
    [title, description, type, status, trend]
  );
  return rows[0];
}

module.exports = { listTechnologies, createTechnology };
