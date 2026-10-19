'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mapping = require('../docs/technology-mapping.js');
const seedData = require('../db/seed-data.json');

test('contains every entry from the former config.json', () => {
  assert.equal(seedData.length, 81);
});

test('every entry has valid enum values and lengths', () => {
  for (const row of seedData) {
    assert.deepEqual(Object.keys(row).sort(), ['description', 'status', 'title', 'trend', 'type']);
    assert.ok(row.title.length >= 1 && row.title.length <= 60, `title length: ${row.title}`);
    assert.ok(row.description.length >= 1 && row.description.length <= 280, `description length: ${row.title}`);
    assert.doesNotThrow(() => mapping.typeToQuadrant(row.type), row.title);
    assert.doesNotThrow(() => mapping.statusToRing(row.status), row.title);
    assert.doesNotThrow(() => mapping.trendToMoved(row.trend), row.title);
  }
});

test('titles are unique', () => {
  const titles = seedData.map((row) => row.title);
  assert.equal(new Set(titles).size, titles.length);
});

test('type/status/trend counts match the former config.json', () => {
  const counts = {};
  for (const row of seedData) {
    const key = `${row.type}|${row.status}|${row.trend}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  assert.deepEqual(counts, {
    'Datastores|ADOPT|no change': 6,
    'Datastores|TRIAL|no change': 5,
    'Datastores|ASSESS|no change': 2,
    'Datastores|HOLD|no change': 11,
    'Data Management|ADOPT|no change': 9,
    'Data Management|ADOPT|moved up': 1,
    'Data Management|TRIAL|no change': 6,
    'Data Management|ASSESS|no change': 3,
    'Infrastructure|ADOPT|no change': 8,
    'Infrastructure|ADOPT|moved up': 1,
    'Infrastructure|TRIAL|new': 1,
    'Infrastructure|TRIAL|moved up': 2,
    'Infrastructure|TRIAL|no change': 6,
    'Infrastructure|ASSESS|no change': 4,
    'Infrastructure|HOLD|no change': 1,
    'Language|ADOPT|no change': 10,
    'Language|TRIAL|no change': 1,
    'Language|ASSESS|no change': 1,
    'Language|HOLD|no change': 3,
  });
});

test('order follows the former radar numbering (quadrants 2, 3, 1, 0, then ring)', () => {
  const quadrantOrder = [2, 3, 1, 0];
  for (let i = 1; i < seedData.length; i++) {
    const prev = seedData[i - 1];
    const cur = seedData[i];
    const prevKey = quadrantOrder.indexOf(mapping.typeToQuadrant(prev.type)) * 4 + mapping.statusToRing(prev.status);
    const curKey = quadrantOrder.indexOf(mapping.typeToQuadrant(cur.type)) * 4 + mapping.statusToRing(cur.status);
    assert.ok(prevKey <= curKey, `${cur.title} is out of order`);
  }
});
