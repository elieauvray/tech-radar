'use strict';

async function listTechnologies(pool) {
  const { rows } = await pool.query(
    'SELECT number, title, description, type, status, trend FROM technologies ORDER BY number'
  );
  return rows;
}

module.exports = { listTechnologies };
