'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mapping = require('../docs/technology-mapping.js');

test('type maps to quadrant', () => {
  assert.equal(mapping.typeToQuadrant('Language'), 0);
  assert.equal(mapping.typeToQuadrant('Infrastructure'), 1);
  assert.equal(mapping.typeToQuadrant('Datastores'), 2);
  assert.equal(mapping.typeToQuadrant('Data Management'), 3);
});

test('status maps to ring', () => {
  assert.equal(mapping.statusToRing('ADOPT'), 0);
  assert.equal(mapping.statusToRing('TRIAL'), 1);
  assert.equal(mapping.statusToRing('ASSESS'), 2);
  assert.equal(mapping.statusToRing('HOLD'), 3);
});

test('trend maps to moved', () => {
  assert.equal(mapping.trendToMoved('moved up'), 1);
  assert.equal(mapping.trendToMoved('moved down'), -1);
  assert.equal(mapping.trendToMoved('new'), 2);
  assert.equal(mapping.trendToMoved('no change'), 0);
});

test('reverse maps round-trip', () => {
  for (const type of Object.keys(mapping.TYPES)) {
    assert.equal(mapping.quadrantToType(mapping.typeToQuadrant(type)), type);
  }
  for (const status of Object.keys(mapping.STATUSES)) {
    assert.equal(mapping.ringToStatus(mapping.statusToRing(status)), status);
  }
  for (const trend of Object.keys(mapping.TRENDS)) {
    assert.equal(mapping.movedToTrend(mapping.trendToMoved(trend)), trend);
  }
});

test('unknown values throw', () => {
  assert.throws(() => mapping.typeToQuadrant('Languages'), /Unknown type/);
  assert.throws(() => mapping.statusToRing('adopt'), /Unknown status/);
  assert.throws(() => mapping.trendToMoved('up'), /Unknown trend/);
  assert.throws(() => mapping.typeToQuadrant('toString'), /Unknown type/);
  assert.throws(() => mapping.quadrantToType(4), /Unknown quadrant/);
});

test('toRadarEntry builds a radar_visualization entry', () => {
  const entry = mapping.toRadarEntry({
    number: 31,
    title: 'Flink',
    description: 'Stream processing engine.',
    type: 'Data Management',
    status: 'ADOPT',
    trend: 'moved up',
  });
  assert.deepEqual(entry, {
    id: '31',
    label: 'Flink',
    description: 'Stream processing engine.',
    quadrant: 3,
    ring: 0,
    moved: 1,
    active: true,
  });
});

test('compareTechnologies orders by type, then status, then title', () => {
  const cmp = mapping.compareTechnologies;
  // type beats status and title
  assert.ok(cmp(
    { type: 'Datastores', status: 'HOLD', title: 'Z' },
    { type: 'Infrastructure', status: 'ADOPT', title: 'A' }
  ) < 0);
  // status beats title
  assert.ok(cmp(
    { type: 'Language', status: 'ADOPT', title: 'Z' },
    { type: 'Language', status: 'TRIAL', title: 'A' }
  ) < 0);
  // titles alphabetically, case-insensitively
  assert.ok(cmp(
    { type: 'Infrastructure', status: 'ADOPT', title: 'Amazon SageMaker' },
    { type: 'Infrastructure', status: 'ADOPT', title: 'AWS CloudFormation' }
  ) < 0);
  assert.equal(cmp(
    { type: 'Language', status: 'ADOPT', title: 'Go' },
    { type: 'Language', status: 'ADOPT', title: 'Go' }
  ), 0);
  assert.deepEqual(mapping.TYPE_ORDER, ['Datastores', 'Data Management', 'Infrastructure', 'Language']);
});

test('sorting the seed data with compareTechnologies leaves it unchanged', () => {
  const seedData = require('../db/seed-data.json');
  const sorted = seedData.slice().sort(mapping.compareTechnologies);
  assert.deepEqual(sorted.map((row) => row.title), seedData.map((row) => row.title));
});

test('toRadarEntry throws on an unknown enum value', () => {
  assert.throws(() => mapping.toRadarEntry({
    number: 1, title: 'X', description: 'Y', type: 'Other', status: 'ADOPT', trend: 'new',
  }), /Unknown type/);
});
