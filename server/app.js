'use strict';

const path = require('path');
const express = require('express');

const DOCS_DIR = path.join(__dirname, '..', 'docs');

// Build the Express app. `listTechnologies` is injected so tests can replace
// the database with a fake.
function createApp({ listTechnologies }) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.get('/api/technologies', async (req, res) => {
    try {
      const technologies = await listTechnologies();
      res.json(technologies);
    } catch (err) {
      console.error('Failed to list technologies', err);
      res.status(500).json({ error: 'Failed to load technologies' });
    }
  });

  // Short cache lifetime so updates show up quickly.
  app.use(express.static(DOCS_DIR, { maxAge: '5m' }));

  return app;
}

module.exports = { createApp };
