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
				closest: () => null
			});
		}
		return elements.get(id);
	};
	const context = vm.createContext({
		getElement: element, copyText,
		setButtonContent: (button, text) => { button.textContent = text; },
		updateCopyButtonState() {}, clearTimeout() {}, setTimeout() {}
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
	assert.equal(app.element('converterResultLabel').textContent, 'Character');
	assert.equal(app.element('copyButton').disabled, false);
});
