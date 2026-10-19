'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateTechnology,
  TITLE_MAX,
  DESCRIPTION_MAX,
} = require('../docs/technology-validation');

const VALID = {
  title: 'Kafka',
  description: 'Distributed event streaming platform.',
  type: 'Data Management',
  status: 'TRIAL',
  trend: 'new',
};

const ALL_FIELDS = ['description', 'status', 'title', 'trend', 'type'];

test('exports the length limits used by the UI', () => {
  assert.equal(TITLE_MAX, 60);
  assert.equal(DESCRIPTION_MAX, 280);
});

test('accepts a valid technology', () => {
  assert.deepEqual(validateTechnology(VALID), { value: VALID, errors: {} });
});

test('accepts every allowed type, status and trend', () => {
  const types = ['Datastores', 'Data Management', 'Infrastructure', 'Language'];
  const statuses = ['ADOPT', 'TRIAL', 'ASSESS', 'HOLD'];
  const trends = ['moved up', 'moved down', 'new', 'no change'];
  for (const type of types) assert.deepEqual(validateTechnology({ ...VALID, type }).errors, {});
  for (const status of statuses) assert.deepEqual(validateTechnology({ ...VALID, status }).errors, {});
  for (const trend of trends) assert.deepEqual(validateTechnology({ ...VALID, trend }).errors, {});
});

test('trims title and description', () => {
  const { value, errors } = validateTechnology({ ...VALID, title: '  Kafka ', description: '\n Streaming. ' });
  assert.deepEqual(errors, {});
  assert.equal(value.title, 'Kafka');
  assert.equal(value.description, 'Streaming.');
});

test('drops number and any other extra key', () => {
  const { value, errors } = validateTechnology({ ...VALID, number: 999, extra: 'x' });
  assert.deepEqual(errors, {});
  assert.deepEqual(value, VALID);
  assert.equal('number' in value, false);
});

test('title must be 1 to 60 characters', () => {
  assert.equal(validateTechnology({ ...VALID, title: '' }).errors.title, 'Title is required');
  assert.equal(validateTechnology({ ...VALID, title: '   ' }).errors.title, 'Title is required');
  assert.equal(validateTechnology({ ...VALID, title: 7 }).errors.title, 'Title is required');
  assert.deepEqual(validateTechnology({ ...VALID, title: 'a'.repeat(60) }).errors, {});
  assert.equal(validateTechnology({ ...VALID, title: 'a'.repeat(61) }).errors.title, 'Title must be at most 60 characters');
});

test('description must be 1 to 280 characters', () => {
  assert.equal(validateTechnology({ ...VALID, description: '' }).errors.description, 'Description is required');
  assert.deepEqual(validateTechnology({ ...VALID, description: 'b'.repeat(280) }).errors, {});
  assert.equal(
    validateTechnology({ ...VALID, description: 'b'.repeat(281) }).errors.description,
    'Description must be at most 280 characters'
  );
});

test('lengths are counted in code points, like PostgreSQL char_length', () => {
  assert.deepEqual(validateTechnology({ ...VALID, description: '😀'.repeat(280) }).errors, {});
  assert.ok(validateTechnology({ ...VALID, description: '😀'.repeat(281) }).errors.description);
  assert.deepEqual(validateTechnology({ ...VALID, title: '😀'.repeat(60) }).errors, {});
});

test('type, status and trend must be allowed values', () => {
  const { errors } = validateTechnology({ ...VALID, type: 'Frameworks', status: 'adopt', trend: 'sideways' });
  assert.deepEqual(Object.keys(errors).sort(), ['status', 'trend', 'type']);
  assert.match(errors.type, /^Type must be one of: /);
  assert.match(errors.type, /Datastores/);
  assert.match(errors.status, /^Status must be one of: /);
  assert.match(errors.trend, /^Trend must be one of: /);
});

test('rejects inherited object keys such as toString', () => {
  const { errors } = validateTechnology({ ...VALID, type: 'toString', status: 'constructor', trend: '__proto__' });
  assert.deepEqual(Object.keys(errors).sort(), ['status', 'trend', 'type']);
});

test('a non-object body gives an error for every field', () => {
  for (const body of [undefined, null, 'Kafka', 42, [VALID]]) {
    const { value, errors } = validateTechnology(body);
    assert.deepEqual(Object.keys(errors).sort(), ALL_FIELDS);
    assert.deepEqual(value, {});
  }
});
