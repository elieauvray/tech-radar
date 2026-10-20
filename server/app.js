'use strict';

const path = require('path');
const express = require('express');
const { validateTechnology } = require('../docs/technology-validation');
const TechnologyMapping = require('../docs/technology-mapping');

const DOCS_DIR = path.join(__dirname, '..', 'docs');

const MAX_INT4 = 2147483647;

const ALLOWED_STATUSES = Object.keys(TechnologyMapping.STATUSES);

// Build the Express app. `listTechnologies`, `createTechnology` and
// `deleteTechnology` are injected so tests can replace the database with a fake.
function createApp({ listTechnologies, createTechnology, deleteTechnology }) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });

  // Optional `status` query parameter (case-insensitive) restricts the list to
  // one status. Without it the full list is returned.
  app.get('/api/technologies', async (req, res) => {
    let status;
    if (req.query.status !== undefined) {
      const raw = req.query.status;
      // A repeated or nested parameter arrives as an array or object: invalid.
      status = typeof raw === 'string' ? raw.toUpperCase() : null;
      if (status === null || !ALLOWED_STATUSES.includes(status)) {
        res.status(400).json({
          errors: { status: `Status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
        });
        return;
      }
    }
    try {
      const technologies = status === undefined
        ? await listTechnologies()
        : await listTechnologies(status);
      res.json(technologies);
    } catch (err) {
      console.error('Failed to list technologies', err);
      res.status(500).json({ error: 'Failed to load technologies' });
    }
  });

  app.post('/api/technologies', express.json({ limit: '10kb', strict: false }), async (req, res) => {
    // `number` and any other extra key are dropped by the validator. The new
    // technology is numbered at its sorted position (type, status, title) and
    // every later technology moves up one number; the response carries the
    // assigned number.
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

  // Delete a technology; every later technology moves down one number.
  app.delete('/api/technologies/:number', async (req, res) => {
    const param = req.params.number;
    const number = Number(param);
    if (!/^[1-9]\d*$/.test(param) || !Number.isSafeInteger(number) || number > MAX_INT4) {
      res.status(400).json({ errors: { number: 'Number must be a positive integer' } });
      return;
    }
    try {
      const deleted = await deleteTechnology(number);
      if (!deleted) {
        res.status(404).json({ error: 'Technology not found' });
        return;
      }
      res.status(204).end();
    } catch (err) {
      console.error('Failed to delete technology', err);
      res.status(500).json({ error: 'Failed to delete technology' });
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
