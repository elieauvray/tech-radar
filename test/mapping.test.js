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

test('toRadarEntry throws on an unknown enum value', () => {
  assert.throws(() => mapping.toRadarEntry({
    number: 1, title: 'X', description: 'Y', type: 'Other', status: 'ADOPT', trend: 'new',
  }), /Unknown type/);
});
