const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../js/converter.js'), 'utf8');

function createConverter(copyText = async () => {}) {
	const elements = new Map();
	const element = id => {
		if (!elements.has(id)) {
			const classes = new Set();
			elements.set(id, {
				value: '', textContent: '', disabled: false,
				classList: {
					add: name => classes.add(name),
					remove: name => classes.delete(name),
					toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
					contains: name => classes.has(name)
				},
				closest: () => null,
				querySelector: selector => selector === '.ore-textfield-input' ? element(`${id}-input`) : null
			});
		}
		return elements.get(id);
	};
	const context = vm.createContext({
		getElement: element, copyText,
		setButtonContent: (button, text) => { button.textContent = text; },
		updateCopyButtonState() { element('copyButton').disabled = element('converterOutput').value.length === 0; },
		clearTimeout() {}, setTimeout() {}
	});
	vm.runInContext(source, context);
	return {
		element,
		convert(value) {
			element('converterInput').value = value;
			context.convert();
			return element('converterOutput').value;
		},
		copy: () => context.copyOutput()
	};
}

test('converts valid hex and supplementary-plane characters', () => {
	const app = createConverter();
	assert.equal(app.convert('0x41'), 'A');
	assert.equal(app.convert(' U+1F600 '), '😀');
	assert.equal(app.convert('E000'), '\uE000');
	assert.equal(app.convert('😀'), '0x1F600');
	assert.equal(app.convert('A'), '0x0041');
});

test('rejects malformed explicit hex instead of parsing a valid prefix', () => {
	const app = createConverter();
	for (const value of ['0x41junk', 'U+1F600!', '0x1.5', '0x+41', '0x 41', '0x0x41', '0x', 'U+110000']) {
		assert.equal(app.convert(value), '', value);
		assert.equal(app.element('errorMsg').classList.contains('d-none'), false, value);
	}
});

test('converts a single whitespace character without trimming it away', () => {
	const app = createConverter();
	assert.equal(app.convert(' '), '0x0020');
	assert.equal(app.convert('\u00A0'), '0x00A0');
	assert.equal(app.convert('\u3000'), '0x3000');
	assert.equal(app.convert(''), '');
});

test('shows copy progress while the clipboard write is pending', () => {
	let finishCopy;
	const app = createConverter(() => new Promise(resolve => { finishCopy = resolve; }));
	app.convert('A');
	app.copy();

	assert.equal(app.element('copyButton').textContent, 'Copying');
	assert.equal(app.element('copyButton').disabled, true);
	finishCopy();
});

test('shows green feedback after copying the converter result', async () => {
	let copiedText = '';
	const app = createConverter(async value => { copiedText = value; });
	app.convert('A');
	app.copy();
	await Promise.resolve();
	await Promise.resolve();

	assert.equal(copiedText, '0x0041');
	assert.equal(app.element('successMsg').textContent, 'Copied result to clipboard.');
	assert.equal(app.element('successMsg').classList.contains('d-none'), false);
});

test('shows an error and restores the copy button when clipboard writing fails', async () => {
	const app = createConverter(async () => { throw new Error('Clipboard denied.'); });
	app.convert('A');
	app.copy();
	await Promise.resolve();
	await Promise.resolve();

	assert.equal(app.element('errorMsg').textContent, 'Unable to access the clipboard.');
	assert.equal(app.element('errorMsg').classList.contains('d-none'), false);
	assert.equal(app.element('successMsg').classList.contains('d-none'), true);
	assert.equal(app.element('copyButton').textContent, 'Copy');
	assert.equal(app.element('copyButton').disabled, false);
});

test('an old clipboard request does not overwrite feedback for a new conversion', async () => {
	let finishCopy;
	const app = createConverter(() => new Promise(resolve => { finishCopy = resolve; }));
	app.convert('0x41');
	app.copy();
	app.convert('0x42');
	finishCopy();
	await Promise.resolve();
	await Promise.resolve();
	assert.equal(app.element('converterOutput').value, 'B');
	assert.equal(app.element('successMsg').classList.contains('d-none'), true);
	assert.equal(app.element('converterOutput').label, 'Character');
	assert.equal(app.element('copyButton').disabled, false);
});
