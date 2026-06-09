const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const utilsPath = path.resolve(__dirname, '..', 'js', 'utils.js');
const utilsSource = fs.readFileSync(utilsPath, 'utf8');
const context = vm.createContext({});

vm.runInContext(
	`${utilsSource}\nthis.getGlyphPrefixFromFileName = getGlyphPrefixFromFileName;`,
	context,
	{ filename: utilsPath }
);

const parseFileName = context.getGlyphPrefixFromFileName;

test('reads a normal glyph atlas filename', () => {
	assert.equal(parseFileName('glyph_E8.png'), 'E8');
	assert.equal(parseFileName('glyph_e8.PNG'), 'E8');
});

test('normalizes filename characters used by mobile file providers', () => {
	assert.equal(parseFileName(' glyph_E8.png '), 'E8');
	assert.equal(parseFileName('glyph_\u200BE8.png'), 'E8');
	assert.equal(parseFileName('\u202Aglyph_E8.png\u202C'), 'E8');
	assert.equal(parseFileName('glyph＿Ｅ８．ｐｎｇ'), 'E8');
});

test('accepts the same hexadecimal range as the glyph input', () => {
	assert.equal(parseFileName('glyph_0.png'), '0');
	assert.equal(parseFileName('glyph_10FF.png'), '10FF');
});

test('rejects unrelated or out-of-range filenames', () => {
	assert.equal(parseFileName('image_E8.png'), null);
	assert.equal(parseFileName('glyph_G8.png'), null);
	assert.equal(parseFileName('glyph_1100.png'), null);
	assert.equal(parseFileName('glyph_E8.png.exe'), null);
	assert.equal(parseFileName('glyph_E8 (1).png'), null);
});
