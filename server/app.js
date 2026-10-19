'use strict';

const path = require('path');
const express = require('express');
const { validateTechnology } = require('../docs/technology-validation');

const DOCS_DIR = path.join(__dirname, '..', 'docs');

// Build the Express app. `listTechnologies` and `createTechnology` are
// injected so tests can replace the database with a fake.
function createApp({ listTechnologies, createTechnology }) {
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

  app.post('/api/technologies', express.json({ limit: '10kb', strict: false }), async (req, res) => {
    // `number` and any other extra key are dropped by the validator.
    const { value, errors } = validateTechnology(req.body);
    if (Object.keys(errors).length > 0) {
      res.status(400).json({ errors });
      return;
    }
    try {
      const technology = await createTechnology(value);
      res.status(201).json(technology);
    } catch (err) {
      console.error('Failed to create technology', err);
      res.status(500).json({ error: 'Failed to create technology' });
    }
  });

  // Turn malformed JSON bodies into a clear 400 instead of Express' default
  // HTML error page.
  app.use('/api', (err, req, res, next) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      res.status(400).json({ errors: { body: 'Request body must be valid JSON' } });
      return;
    }
    next(err);
  });

  // Short cache lifetime so updates show up quickly.
  app.use(express.static(DOCS_DIR, { maxAge: '5m' }));

  return app;
}

module.exports = { createApp };
