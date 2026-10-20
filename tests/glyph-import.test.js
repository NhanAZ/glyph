const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const utilsSource = fs.readFileSync(path.resolve(__dirname, '../js/utils.js'), 'utf8');
const mainSource = fs.readFileSync(path.resolve(__dirname, '../js/main.js'), 'utf8');

function createApp(loadImage = async file => ({ file })) {
	const elements = new Map();
	const processed = [];
	const alerts = [];
	const images = [];
	const element = id => {
		if (!elements.has(id)) {
			const classes = new Set(['d-none']);
			elements.set(id, {
				value: '', textContent: '', disabled: false, focused: false, open: false,
				handlers: {},
				classList: {
					add: name => classes.add(name),
					remove: name => classes.delete(name),
					contains: name => classes.has(name)
				},
				addEventListener(name, handler) { this.handlers[name] = handler; },
				showModal() { this.open = true; },
				close() { this.open = false; },
				focus() { this.focused = true; }
			});
		}
		return elements.get(id);
	};
	const context = vm.createContext({
		document: {
			readyState: 'loading',
			addEventListener() {},
			getElementById: element,
			querySelector: () => element('upload-zone')
		},
		window: { addEventListener() {} },
		Image: class { constructor() { images.push(this); } },
		GRID: 16, DEFAULT_GLYPHS: { E0: 'default.png' },
		clearTimeout() {}, initializeGlyph() {}, copyOutput() {}, convert() {}, toggleDarkMode() {},
		processGlyph: (image, prefix, options) => { processed.push({ image, prefix, options }); return true; },
		alert: message => alerts.push(message),
		loadImage
	});
	vm.runInContext(utilsSource + '\nloadPngFile = loadImage; showToast = () => {};', context);
	vm.runInContext(mainSource, context);
	const dispatch = (id, event, details = {}) => element(id).handlers[event].call(element(id), {
		preventDefault() {}, ...details
	});
	return {
		element, processed, alerts, images, dispatch,
		importFile: (file, input = element('glyphUpload')) => context.importGlyphFile(file, input),
		setPrefix: async prefix => {
			element('uploadPrefix').value = prefix;
			await dispatch('uploadPrefix', 'input');
		},
		confirm: () => dispatch('glyphPrefixForm', 'submit'),
		loadPreset: () => context.loadPreset('E0', 'E0', 'E0_DEFAULT', 'glyph_E0.png')
	};
}

test('imports a named atlas using its filename prefix', async () => {
	const app = createApp();
	app.element('glyph-input').value = 'E1';
	await app.importFile({ name: 'glyph_E8.png' });
	assert.equal(app.processed[0].prefix, 'E8');
	assert.equal(app.element('glyph-input').value, 'E8');
	assert.equal(app.element('glyphPrefixDialog').open, false);
});

test('unknown and invalid filename prefixes require explicit input, even with an existing HEX code', async () => {
	for (const name of ['photo.png', 'RUID12345.png', 'glyph_E8 (1).png', 'glyph_1100.png', 'glyph_G8.png']) {
		const app = createApp();
		app.element('glyph-input').value = 'E0';
		app.element('glyphUpload').value = name;
		await app.importFile({ name });
		assert.equal(app.processed.length, 0, name);
		assert.equal(app.element('glyphUpload').value, name);
		assert.equal(app.element('uploadLabel').textContent, name);
		assert.equal(app.element('glyphPrefixDialog').open, true);
		assert.equal(app.element('uploadPrefix').value, '');
		assert.equal(app.element('uploadPrefix').focused, true);
		assert.equal(app.element('confirmGlyphImport').disabled, true);
	}
});

test('keeps the selected file while typing and imports only after confirmation', async () => {
	const app = createApp();
	const file = { name: 'photo.png' };
	await app.importFile(file);
	await app.setPrefix('E');
	await app.setPrefix('e8');
	assert.equal(app.processed.length, 0);
	assert.equal(app.element('confirmGlyphImport').disabled, false);
	await app.confirm();
	assert.equal(app.processed[0].image.file, file);
	assert.equal(app.processed[0].prefix, 'E8');
	assert.equal(app.element('glyph-input').value, 'E8');
	assert.equal(app.element('glyphPrefixDialog').open, false);
});

test('rejects blank, nonhex and out-of-range manual prefixes without losing the file', async () => {
	const app = createApp();
	await app.importFile({ name: 'photo.png' });
	for (const prefix of ['', ' ', 'G8', '1100']) {
		await app.setPrefix(prefix);
		assert.equal(app.element('confirmGlyphImport').disabled, true);
		await app.confirm();
		assert.equal(app.processed.length, 0);
	}
	await app.setPrefix('10ff');
	await app.confirm();
	assert.equal(app.processed[0].prefix, '10FF');
});

test('accepts prefix zero when explicitly entered', async () => {
	const app = createApp();
	await app.importFile({ name: 'photo.png' });
	await app.setPrefix('0');
	await app.confirm();
	assert.equal(app.processed[0].prefix, '0');
});

test('cancel releases the pending file and prevents a later submit from importing it', async () => {
	const app = createApp();
	await app.importFile({ name: 'photo.png' });
	await app.setPrefix('E8');
	await app.dispatch('cancelGlyphImport', 'click');
	await app.confirm();
	assert.equal(app.processed.length, 0);
	assert.equal(app.element('glyphPrefixDialog').open, false);
	assert.equal(app.element('glyphUpload').value, '');
});

test('a replacement file supersedes the previous pending file and prefix', async () => {
	const app = createApp();
	await app.importFile({ name: 'old.png' });
	await app.setPrefix('E8');
	const file = { name: 'new.png' };
	await app.importFile(file);
	assert.equal(app.element('uploadPrefix').value, '');
	await app.setPrefix('E9');
	await app.confirm();
	assert.equal(app.processed[0].image.file, file);
	assert.equal(app.processed[0].prefix, 'E9');
});

test('drag and drop retains the file for manual prefix confirmation', async () => {
	const app = createApp();
	const file = { name: 'dropped.png' };
	await app.dispatch('upload-zone', 'drop', { dataTransfer: { types: ['Files'], files: [file] } });
	await app.setPrefix('E8');
	await app.confirm();
	assert.equal(app.processed[0].image.file, file);
});

test('a superseded image load cannot overwrite the next pending upload', async () => {
	let finishLoad;
	const app = createApp(() => new Promise(resolve => { finishLoad = resolve; }));
	const loading = app.importFile({ name: 'glyph_E8.png' });
	await app.importFile({ name: 'new.png' });
	finishLoad({});
	await loading;
	assert.equal(app.processed.length, 0);
	assert.equal(app.element('uploadLabel').textContent, 'new.png');
});

test('selecting a preset cancels a pending file; a pending file also supersedes an older preset load', async () => {
	const app = createApp();
	await app.importFile({ name: 'photo.png' });
	app.loadPreset();
	assert.equal(app.element('glyphPrefixDialog').open, false);
	await app.importFile({ name: 'new.png' });
	app.images[0].onload();
	assert.equal(app.processed.length, 0);
});

test('a successfully loaded preset synchronizes the prefix and clears stale validation errors', () => {
	const app = createApp();
	app.element('glyph-input').value = 'invalid';
	app.element('glyph-input').classList.add('is-invalid');
	app.element('glyphErrorMsg').classList.remove('d-none');
	app.element('inputValidation').classList.remove('d-none');
	app.loadPreset();
	app.images[0].onload();
	assert.equal(app.processed[0].prefix, 'E0');
	assert.equal(app.element('glyph-input').value, 'E0');
	assert.equal(app.element('glyph-input').classList.contains('is-invalid'), false);
	assert.equal(app.element('glyphErrorMsg').classList.contains('d-none'), true);
	assert.equal(app.element('inputValidation').classList.contains('d-none'), true);
});
