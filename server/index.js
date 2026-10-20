'use strict';

const { createPool } = require('./db');
const { createApp } = require('./app');
const { listTechnologies, createTechnology, deleteTechnology } = require('./technologies');

const pool = createPool();
// An idle client losing its connection must not crash the process.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
});
const app = createApp({
  listTechnologies: (status) => listTechnologies(pool, status),
  createTechnology: (technology) => createTechnology(pool, technology),
  deleteTechnology: (number) => deleteTechnology(pool, number),
});
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Tech Radar listening on port ${port}`);
});
