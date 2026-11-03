'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const themes = require('../docs/theme-switcher.js');

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

function memoryStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); }
  };
}

const throwingStorage = {
  getItem() { throw new Error('storage denied'); },
  setItem() { throw new Error('storage denied'); }
};

test('the default theme is Société Générale and both themes are listed', () => {
  assert.deepEqual(themes.THEMES, ['societe-generale', 'upsun']);
  assert.equal(themes.DEFAULT_THEME, 'societe-generale');
});

test('normalizeTheme keeps known themes and falls back to the default otherwise', () => {
  assert.equal(themes.normalizeTheme('upsun'), 'upsun');
  assert.equal(themes.normalizeTheme('societe-generale'), 'societe-generale');
  for (const value of ['', 'dark', 'UPSUN', 'toString', '__proto__', null, undefined, 3, {}, ['upsun']]) {
    assert.equal(themes.normalizeTheme(value), 'societe-generale');
  }
});

test('nextTheme cycles between the two themes', () => {
  assert.equal(themes.nextTheme('societe-generale'), 'upsun');
  assert.equal(themes.nextTheme('upsun'), 'societe-generale');
  assert.equal(themes.nextTheme('garbage'), 'upsun');
  assert.equal(themes.nextTheme(undefined), 'upsun');
});

test('the Société Générale options are the values the radar always had', () => {
  assert.deepEqual(themes.radarOptions('societe-generale'), {
    colors: { background: '#fff', grid: '#dddde0', inactive: '#ddd' },
    font_family: 'Arial, Helvetica',
    ring_colors: ['#5ba300', '#009eb0', '#c7ba00', '#e09b96'],
    title_banner: { height: 51, from: '#000000', to: '#e9041e', text_color: '#fff' },
    title: 'Société Générale Tech Radar',
    title_logo: { url: 'images/societe-generale-logo.svg', width: 198, height: 39 },
    title_suffix: 'Tech Radar'
  });
});

test('the Upsun options have valid colours, four rings and a flat banner', () => {
  const options = themes.radarOptions('upsun');
  for (const color of Object.values(options.colors)) {
    assert.match(color, HEX);
  }
  assert.equal(options.ring_colors.length, 4);
  for (const color of options.ring_colors) {
    assert.match(color, HEX);
  }
  assert.ok(options.font_family.length > 0);
  assert.ok(options.title_banner.height > 0);
  assert.match(options.title_banner.from, HEX);
  assert.equal(options.title_banner.from, options.title_banner.to);
  assert.match(options.title_banner.text_color, HEX);
  assert.equal(options.title, 'Upsun Tech Radar');
  assert.equal(options.title_logo.url, 'images/upsun-logo.svg');
  assert.ok(options.title_logo.width > 0);
  assert.ok(options.title_logo.height > 0);
  assert.equal(options.title_suffix, 'Tech Radar');
});

test('the Upsun title does not mention Société Générale', () => {
  assert.doesNotMatch(themes.radarOptions('upsun').title, /Soci[ée]t[ée]/i);
});

test('the logo file of each theme exists under docs/', () => {
  for (const theme of themes.THEMES) {
    const logo = themes.radarOptions(theme).title_logo;
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'docs', logo.url)), theme);
  }
});

test('the page title is "Tech Radar"', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  assert.match(html, /<title>Tech Radar<\/title>/);
});

test('the favicon is the Upsun icon', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
  assert.match(html, /<link rel="icon"[^>]*href="images\/favicon\.svg"/);
  const favicon = fs.readFileSync(path.join(__dirname, '..', 'docs', 'images', 'favicon.svg'), 'utf8');
  assert.match(favicon, /#6046ff/i);
  assert.doesNotMatch(favicon, /Soci[ée]t[ée]/i);
});

test('an unknown theme gets the default options', () => {
  assert.deepEqual(themes.radarOptions('nope'), themes.radarOptions('societe-generale'));
});

test('radarOptions returns a copy that can be mutated safely', () => {
  const options = themes.radarOptions('upsun');
  options.colors.background = '#000';
  options.ring_colors.pop();
  assert.equal(themes.radarOptions('upsun').colors.background, '#0b0b1e');
  assert.equal(themes.radarOptions('upsun').ring_colors.length, 4);
});

test('saveTheme and loadTheme round-trip through the storage', () => {
  const storage = memoryStorage();
  assert.equal(themes.loadTheme(storage), 'societe-generale');
  assert.equal(themes.saveTheme('upsun', storage), true);
  assert.equal(storage.getItem(themes.STORAGE_KEY), 'upsun');
  assert.equal(themes.loadTheme(storage), 'upsun');
});

test('loadTheme ignores a garbage stored value', () => {
  const storage = memoryStorage({ [themes.STORAGE_KEY]: 'hotpink' });
  assert.equal(themes.loadTheme(storage), 'societe-generale');
});

test('saveTheme only stores known themes', () => {
  const storage = memoryStorage();
  themes.saveTheme('hotpink', storage);
  assert.equal(storage.getItem(themes.STORAGE_KEY), 'societe-generale');
});

test('loadTheme and saveTheme tolerate a storage that throws', () => {
  assert.equal(themes.loadTheme(throwingStorage), 'societe-generale');
  assert.equal(themes.saveTheme('upsun', throwingStorage), false);
});

test('loadTheme and saveTheme tolerate a missing storage', () => {
  // no localStorage in Node: the default storage is null
  assert.equal(themes.loadTheme(), 'societe-generale');
  assert.equal(themes.saveTheme('upsun'), false);
});
