const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../js/main.js'), 'utf8');

function createApp(options = {}) {
	const elements = new Map();
	const downloads = [];
	const replacements = [];
	const toasts = [];
	const readyHandlers = [];
	const images = [];
	const glyphs = [];
	const timers = new Map();
	let nextTimerId = 1;
	class TestImage {
		constructor() { images.push(this); }
		set src(value) { this.source = value; }
	}
	class Element {
		constructor() {
			this.handlers = {};
			this.dataset = {};
			this.value = '';
			this.label = '';
			this.children = [];
			this.isConnected = true;
			this.open = false;
			this.style = { setProperty() {}, removeProperty() {} };
			const classes = new Set();
			this.classList = {
				add: (...names) => names.forEach(name => classes.add(name)),
				remove: (...names) => names.forEach(name => classes.delete(name)),
				contains: name => classes.has(name),
				toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
			};
		}
		addEventListener(event, handler) { this.handlers[event] = handler; }
		show() { this.open = true; }
		close() { this.open = false; }
		querySelector() { return null; }
		querySelectorAll(selector) {
			return selector === 'button[data-char]' ? this.children : [];
		}
		getAttribute(name) { return this[name]; }
		setAttribute(name, value) { this[name] = value; }
		removeAttribute(name) { delete this[name]; }
		closest() { return this; }
	}
	const element = id => {
		if (!elements.has(id)) elements.set(id, new Element());
		return elements.get(id);
	};
	const context = vm.createContext({
		Element,
		document: {
			readyState: options.readyState || 'loading',
			addEventListener: (event, handler) => { if (event === 'DOMContentLoaded') readyHandlers.push(handler); },
			querySelector: selector => selector === '.detail-meta' ? element('detailMeta') : null,
			createElement: () => ({ toDataURL: () => 'cleared.png' })
		},
		window: { innerWidth: 1024, addEventListener() {} },
		getElement: element,
		listen: (target, event, handler) => target.addEventListener(event, handler),
		initializeGlyph() {}, copyOutput() {}, convert() {},
		clearTimeout: timerId => timers.delete(timerId),
		setTimeout: callback => {
			const timerId = nextTimerId++;
			timers.set(timerId, callback);
			return timerId;
		},
		GRID: 16, DEFAULT_GLYPHS: { E0: 'default.png' }, Image: TestImage,
		isValidGlyphPrefix: value => /^(?:[0-9a-f]{1,4}|10[0-9a-f]{0,2})$/i.test(value),
		Glyph: prefix => glyphs.push(prefix),
		copyText: async () => {},
		processGlyph: () => true,
		currentAtlasDataUrl: 'atlas.png',
		getGlyphPrefix: (value, fallback) => /^[0-9a-f]+$/i.test(value) ? value.toUpperCase() : fallback,
		extractGlyphTileUrl: async () => 'tile.png',
		setButtonContent: (target, text) => { target.textContent = text; },
		downloadUrl: (url, fileName) => downloads.push({ url, fileName }),
		downloadFile: (content, fileName) => downloads.push({ content, fileName }),
		showToast: message => toasts.push(message),
		clearAtlasTile: options.clearAtlasTile || (async () => null),
		updateGlyphCellsAtlas() {},
		replaceAtlasTile: options.replaceAtlasTile || (async (cell, image) => { replacements.push({ cell, image }); return null; }),
		loadPngFile: options.loadPngFile || (async file => file),
		alert() {}
	});
	vm.runInContext(source, context);
	if (context.document.readyState === 'loading') readyHandlers.forEach(handler => handler());
	const cell = hex => {
		const result = new Element();
		result['data-hex'] = `0x${hex}`;
		result['data-char'] = String.fromCodePoint(Number.parseInt(hex, 16));
		result['data-position'] = '(1;1)';
		result['data-width'] = '16';
		result['data-height'] = '16';
		return result;
	};
	const open = async target => {
		element('glyph-output').handlers.click({ target, preventDefault() {} });
		await new Promise(setImmediate);
	};
	const setGlyphPrefix = value => {
		const input = element('glyph-input');
		input.value = value;
		input.handlers.input.call(input);
	};
	return {
		element, cell, open, downloads, replacements, toasts, images, glyphs, setGlyphPrefix,
		runTimers: () => {
			const callbacks = Array.from(timers.values());
			timers.clear();
			callbacks.forEach(callback => callback());
		}
	};
}

test('clearing the E0 prefix keeps the input empty after pending images finish loading', () => {
	const app = createApp();
	app.setGlyphPrefix('E0');
	app.setGlyphPrefix('E');
	app.setGlyphPrefix('');
	for (const image of app.images) image.onload();

	assert.equal(app.element('glyph-input').value, '');
});

test('exports use the displayed atlas prefix while the input contains another or invalid value', () => {
	const app = createApp();
	app.element('glyph-output').children = [app.cell('E800')];
	for (const input of ['invalid', 'E0', '']) {
		app.element('glyph-input').value = input;
		app.element('btnDownloadAtlas').handlers.click();
		app.element('btnDownloadFullJson').handlers.click();
		assert.equal(app.downloads.at(-2).fileName, 'glyph_e8.png');
		const metadata = JSON.parse(app.downloads.at(-1).content).metadata;
		assert.equal(metadata.hex_range, 'E800 - E8FF');
	}
});

test('metadata exports include glyphs from the OreUI button grid', () => {
	const app = createApp();
	app.element('glyph-output').children = [app.cell('E800')];
	app.element('btnDownloadFullJson').handlers.click();

	const metadata = JSON.parse(app.downloads.at(-1).content);
	assert.equal(metadata.metadata.total, 1);
	assert.equal(metadata.glyphs[0].hex, '0xE800');
});

test('initializes interface handlers when scripts load after DOMContentLoaded', async () => {
	const app = createApp({ readyState: 'complete' });
	const cell = app.cell('E800');

	await app.open(cell);

	assert.equal(app.element('glyphDetailModal').open, true);
	assert.equal(app.element('glyphDetailHex').textContent, '0xE800');
});

test('copy feedback clears after its timer and when glyph details close', async () => {
	const app = createApp();
	const cell = app.cell('E800');
	await app.open(cell);
	const field = app.cell('E800');
	field.setAttribute('data-copy-target', 'glyphDetailCharText');
	field.setAttribute('data-label', 'character');
	const copy = () => app.element('detailMeta').handlers.click({ target: field });

	copy();
	await new Promise(setImmediate);
	assert.equal(app.element('glyphDetailNotice').textContent, 'Copied character to clipboard');
	app.runTimers();
	assert.equal(app.element('glyphDetailNotice').textContent, '');
	assert.equal(app.element('glyphDetailNotice').classList.contains('visible'), false);

	copy();
	await new Promise(setImmediate);
	app.element('glyphDetailModal').handlers['modal-close']();
	assert.equal(app.element('glyphDetailNotice').textContent, '');
	app.runTimers();
	assert.equal(app.element('glyphDetailNotice').textContent, '');
});

test('a failed clear leaves the existing preview and cell intact', async () => {
	const app = createApp();
	const cell = app.cell('E800');
	await app.open(cell);
	await app.element('glyphDetailClearBtn').onclick();
	assert.equal(cell.classList.contains('transparent'), false);
	assert.equal(app.element('glyphDetailImage').src, 'tile.png');
	assert.match(app.toasts.at(-1), /Unable to clear/);
});

test('a replacement that finishes loading after another detail is opened cannot edit that cell', async () => {
	let finishLoad;
	const app = createApp({ loadPngFile: () => new Promise(resolve => { finishLoad = resolve; }) });
	const first = app.cell('E800');
	const second = app.cell('E801');
	await app.open(first);
	const pending = app.element('glyphDetailReplaceInput').onchange({ target: { files: [{ name: 'tile.png' }] } });
	await app.open(second);
	finishLoad({});
	await pending;
	assert.equal(app.replacements.length, 0);
});

test('closing details cancels a pending replacement image', async () => {
	let finishLoad;
	const app = createApp({ loadPngFile: () => new Promise(resolve => { finishLoad = resolve; }) });
	await app.open(app.cell('E800'));
	const pending = app.element('glyphDetailReplaceInput').onchange({ target: { files: [{ name: 'tile.png' }] } });
	const onHidden = app.element('glyphDetailModal').handlers['modal-close'];
	if (onHidden) onHidden();
	finishLoad({});
	await pending;
	assert.equal(app.replacements.length, 0);
});

test('newer edits and closing details invalidate an atlas edit before it commits', async () => {
	let replaceIsCurrent;
	let clearIsCurrent;
	let finishReplace;
	const app = createApp({
		replaceAtlasTile: (_cell, _image, isCurrent) => {
			replaceIsCurrent = isCurrent;
			return new Promise(resolve => { finishReplace = resolve; });
		},
		clearAtlasTile: async (_cell, isCurrent) => {
			clearIsCurrent = isCurrent;
			return null;
		}
	});
	await app.open(app.cell('E800'));
	const pending = app.element('glyphDetailReplaceInput').onchange({ target: { files: [{ name: 'tile.png' }] } });
	await new Promise(setImmediate);
	assert.equal(replaceIsCurrent(), true);
	await app.element('glyphDetailClearBtn').onclick();
	assert.equal(replaceIsCurrent(), false);
	assert.equal(clearIsCurrent(), true);
	app.element('glyphDetailModal').handlers['modal-close']();
	assert.equal(clearIsCurrent(), false);
	finishReplace(null);
	await pending;
});
