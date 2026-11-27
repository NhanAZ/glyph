const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const utilsSource = fs.readFileSync(path.resolve(__dirname, '../js/utils.js'), 'utf8');
const mainSource = fs.readFileSync(path.resolve(__dirname, '../js/main.js'), 'utf8');

function createApp(loadImage = async file => ({ file }), options = {}) {
	const elements = new Map();
	const processed = [];
	const alerts = [];
	const images = [];
	const element = id => {
		if (!elements.has(id)) {
			const classes = new Set(['d-none']);
			elements.set(id, {
				value: '', textContent: '', disabled: false, focused: false, open: false,
				attributes: new Map(),
				handlers: {},
				classList: {
					add: name => classes.add(name),
					remove: name => classes.delete(name),
					toggle: (name, force) => {
						if (force === undefined ? !classes.has(name) : force) classes.add(name);
					else classes.delete(name);
					return classes.has(name);
					},
					contains: name => classes.has(name)
				},
				addEventListener(name, handler) { this.handlers[name] = handler; },
				setAttribute(name, value) { this.attributes.set(name, value); },
				removeAttribute(name) { this.attributes.delete(name); },
				getAttribute(name) { return this.attributes.get(name) ?? null; },
				show() { this.open = true; },
				close() {
					this.open = false;
					if (options.emitModalCloseOnClose) {
						queueMicrotask(() => this.handlers['modal-close']?.({}));
					}
				},
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
		clearTimeout() {}, initializeGlyph() {}, copyOutput() {}, convert() {},
		processGlyph: (image, prefix, options) => {
			processed.push({ image, prefix, options });
			const output = element('glyph-output');
			output.classList.remove('is-loading');
			output.removeAttribute('aria-busy');
			return true;
		},
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

test('imports glyph_E5.png and reports the loaded atlas dimensions', async () => {
	const app = createApp(async file => ({ file, naturalWidth: 2048, naturalHeight: 2048 }));
	const file = { name: 'glyph_E5.png' };
	await app.importFile(file);

	assert.equal(app.processed[0].prefix, 'E5');
	assert.equal(app.processed[0].image.file, file);
	assert.equal(app.element('uploadStatus').textContent, 'Loaded glyph_E5.png (2048 x 2048px).');
	assert.equal(app.element('uploadStatus').classList.contains('is-success'), true);
	assert.equal(app.alerts.length, 0);
});

test('shows PNG validation errors inline instead of an alert', async () => {
	const app = createApp(async () => { throw new Error('The selected file is not a valid PNG image.'); });
	await app.importFile({ name: 'glyph_E5.png' });

	assert.equal(app.processed.length, 0);
	assert.equal(app.element('uploadStatus').textContent, 'The selected file is not a valid PNG image.');
	assert.equal(app.element('uploadStatus').classList.contains('is-error'), true);
	assert.equal(app.alerts.length, 0);
});

test('validates the PNG before asking for a missing filename prefix', async () => {
	const app = createApp(async () => { throw new Error('Please select a valid PNG file.'); });
	await app.importFile({ name: 'photo.png' });

	assert.equal(app.processed.length, 0);
	assert.equal(app.element('glyphPrefixDialog').open, false);
	assert.equal(app.element('uploadStatus').textContent, 'Please select a valid PNG file.');
	assert.equal(app.element('uploadStatus').classList.contains('is-error'), true);
	assert.equal(app.alerts.length, 0);
});

test('page size dropdown exposes the OreUI selected-label hook', () => {
	const htmlSource = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
	const dropdown = htmlSource.match(/<ore-dropdown id="vanillaPageSizeDropdown"[\s\S]*?<\/ore-dropdown>/);
	assert.ok(dropdown, 'page size dropdown should exist');
	assert.match(dropdown[0], /class="[^"]*ore-dropdown-trigger-label[^"]*"[^>]*>36<\/span>/);
	assert.deepEqual(
		Array.from(dropdown[0].matchAll(/data-value="([^"]+)"/g), match => match[1]),
		['36', '100', '200', '300', '500', 'all']
	);
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

test('shows the OreUI textfield error for invalid prefixes and clears it when corrected', async () => {
	const app = createApp();
	await app.importFile({ name: 'photo.png' });
	await app.setPrefix('E555');

	assert.equal(app.element('uploadPrefix').error, 'Enter a hexadecimal prefix from 0 to 10FF.');
	assert.equal(app.element('confirmGlyphImport').disabled, true);

	await app.setPrefix('E5');
	assert.equal(app.element('uploadPrefix').error, '');
	assert.equal(app.element('confirmGlyphImport').disabled, false);
});

test('shows the English OreUI validation message when an invalid prefix is submitted', async () => {
	const app = createApp();
	const file = { name: 'photo.png' };
	await app.importFile(file);
	await app.setPrefix('G8');
	await app.confirm();

	assert.equal(app.element('uploadPrefix').error, 'Enter a hexadecimal prefix from 0 to 10FF.');
	assert.equal(app.element('uploadPrefix').focused, true);
	assert.equal(app.element('confirmGlyphImport').disabled, true);
	assert.equal(app.processed.length, 0);
	assert.equal(app.element('glyphPrefixDialog').open, true);
});

test('closing the OreUI prefix modal cancels the pending file', async () => {
	const app = createApp();
	await app.importFile({ name: 'photo.png' });
	await app.setPrefix('E8');
	await app.dispatch('glyphPrefixDialog', 'modal-close', { detail: { reason: 'close' } });
	await app.confirm();

	assert.equal(app.element('glyphPrefixDialog').open, false);
	assert.equal(app.element('glyphUpload').value, '');
	assert.equal(app.processed.length, 0);
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
	const finishLoads = [];
	const app = createApp(() => new Promise(resolve => { finishLoads.push(resolve); }));
	const loading = app.importFile({ name: 'glyph_E8.png' });
	const replacement = app.importFile({ name: 'glyph_E9.png' });
	finishLoads[1]({ file: 'new' });
	await replacement;
	finishLoads[0]({ file: 'old' });
	await loading;
	assert.equal(app.processed.length, 1);
	assert.equal(app.processed[0].prefix, 'E9');
	assert.equal(app.element('uploadLabel').textContent, 'glyph_E9.png');
});

test('selecting a preset cancels a pending file; a pending file also supersedes an older preset load', async () => {
	const app = createApp();
	await app.importFile({ name: 'photo.png' });
	app.loadPreset();
	assert.equal(app.element('glyph-output').classList.contains('is-loading'), true);
	assert.equal(app.element('glyphPrefixDialog').open, false);
	await app.importFile({ name: 'new.png' });
	assert.equal(app.element('glyph-output').classList.contains('is-loading'), false);
	assert.equal(app.element('glyph-output').getAttribute('aria-busy'), null);
	app.images[0].onload();
	assert.equal(app.processed.length, 0);
});

test('a successfully loaded preset synchronizes the prefix and clears stale validation errors', async () => {
	const app = createApp();
	app.element('glyph-input').value = 'invalid';
	app.element('glyph-input').classList.add('is-invalid');
	app.element('glyphErrorMsg').classList.remove('d-none');
	app.element('inputValidation').classList.remove('d-none');
	app.loadPreset();
	await app.images[0].onload();
	assert.equal(app.processed[0].prefix, 'E0');
	assert.equal(app.element('glyph-input').value, 'E0');
	assert.equal(app.element('glyph-input').classList.contains('is-invalid'), false);
	assert.equal(app.element('glyphErrorMsg').classList.contains('d-none'), true);
	assert.equal(app.element('inputValidation').classList.contains('d-none'), true);
});

test('shows pending feedback while a preset image is loading', async () => {
	const app = createApp();
	app.loadPreset();

	assert.equal(app.element('uploadStatus').textContent, 'Loading glyph_E0.png...');
	assert.equal(app.element('uploadStatus').classList.contains('is-pending'), true);
	assert.equal(app.element('glyph-output').classList.contains('is-loading'), true);
	assert.equal(app.element('glyph-output').getAttribute('aria-busy'), 'true');

	await app.images[0].onload();

	assert.equal(app.element('uploadStatus').textContent, '');
	assert.equal(app.element('uploadStatus').classList.contains('is-pending'), false);
	assert.equal(app.element('glyph-output').classList.contains('is-loading'), false);
	assert.equal(app.element('glyph-output').getAttribute('aria-busy'), null);
});

test('confirming a manual atlas prefix is not cancelled by the modal close event', async () => {
	const app = createApp(undefined, { emitModalCloseOnClose: true });
	const file = { name: 'CubeCraft_glyph_E1.png' };
	await app.importFile(file);
	await app.setPrefix('E1');
	await app.confirm();
	await new Promise(setImmediate);

	assert.equal(app.processed.length, 1);
	assert.equal(app.element('uploadLabel').textContent, file.name);
	assert.equal(app.element('uploadStatus').textContent, `Loaded ${file.name}.`);
	assert.equal(app.element('uploadStatus').classList.contains('is-success'), true);
});

test('clears pending feedback when a preset image fails to load', () => {
	const app = createApp();
	app.loadPreset();

	app.images[0].onerror();

	assert.equal(app.element('uploadStatus').textContent, '');
	assert.equal(app.element('uploadStatus').classList.contains('is-pending'), false);
	assert.equal(app.element('glyph-output').classList.contains('is-loading'), false);
	assert.equal(app.element('glyph-output').getAttribute('aria-busy'), null);
});
