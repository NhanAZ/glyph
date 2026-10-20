const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const glyphSource = fs.readFileSync(path.resolve(__dirname, '../js/glyph.js'), 'utf8');

function createAtlas({ canvasError = false, alpha = 255, tileContextUnavailable = false } = {}) {
	const images = [];
	const cleared = [];
	let canvasCount = 0;
	const output = {
		dataset: { atlasVersion: '1', atlasUrl: 'atlas.png' },
		hasChildNodes: () => false
	};
	const context = vm.createContext({
		GRID: 16,
		DEFAULT_GLYPHS: { E0: 'default.png' },
		currentAtlasDataUrl: 'atlas.png',
		currentAtlasLabel: 'glyph_E0.png',
		glyphCache: new Map([['old', {}]]),
		getElement: id => id === 'glyph-output' ? output : null,
		Image: class {
			constructor() {
				this.width = 256;
				this.height = 256;
				images.push(this);
			}
		},
		document: {
			createElement: () => {
				const isTile = ++canvasCount === 2;
				return {
					getContext: () => tileContextUnavailable && isTile ? null : ({
						drawImage() { if (canvasError) throw new Error('Canvas unavailable'); },
						clearRect(...rectangle) { cleared.push(rectangle); },
						getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, alpha]) })
					}),
					toDataURL: () => 'data:image/png;base64,edited'
				};
			}
		}
	});
	vm.runInContext(glyphSource, context);
	const cell = {
		dataset: { spriteCol: '1', spriteRow: '2' },
		closest: () => output,
		getAttribute: name => ({
			'data-position': '(2;3)',
			'data-width': '16',
			'data-height': '16'
		})[name]
	};
	return { context, images, output, cell, cleared };
}

test('transparency depends on alpha, including opaque black and hidden RGB data', () => {
	const { context } = createAtlas();
	assert.equal(context.isTransparentGlyphTile({ data: new Uint8ClampedArray([0, 0, 0, 255]) }), false);
	assert.equal(context.isTransparentGlyphTile({ data: new Uint8ClampedArray([0, 0, 0, 1]) }), false);
	assert.equal(context.isTransparentGlyphTile({ data: new Uint8ClampedArray([255, 32, 16, 0]) }), true);
	assert.equal(context.isTransparentGlyphTile({ data: new Uint8ClampedArray([0, 0, 0, 0]) }), true);
});

for (const operation of ['clearAtlasTile', 'replaceAtlasTile']) {
	const startEdit = (context, cell, isCurrent) => operation === 'clearAtlasTile'
		? context.clearAtlasTile(cell, isCurrent)
		: context.replaceAtlasTile(cell, { width: 16, height: 16 }, isCurrent);

	test(`${operation} does not overwrite a newer atlas`, async () => {
		for (const sameUrl of [false, true]) {
			const { context, images, output, cell } = createAtlas();
			const pending = startEdit(context, cell);
			const nextUrl = sameUrl ? 'atlas.png' : 'new-atlas.png';
			context.currentAtlasDataUrl = nextUrl;
			output.dataset.atlasVersion = '2';
			images[0].onload();
			assert.equal(await pending, null);
			assert.equal(context.currentAtlasDataUrl, nextUrl);
		}
	});

	test(`${operation} settles canvas failures without changing the atlas`, async () => {
		const { context, images, cell } = createAtlas({ canvasError: true });
		const pending = startEdit(context, cell);
		assert.doesNotThrow(() => images[0].onload());
		assert.equal(await pending, null);
		assert.equal(context.currentAtlasDataUrl, 'atlas.png');
		assert.equal(context.glyphCache.size, 1);
	});

	test(`${operation} does not commit after the detail request closes`, async () => {
		const { context, images, cell } = createAtlas();
		let isOpen = true;
		const pending = startEdit(context, cell, () => isOpen);
		isOpen = false;
		images[0].onload();
		assert.equal(await pending, null);
		assert.equal(context.currentAtlasDataUrl, 'atlas.png');
		assert.equal(context.glyphCache.size, 1);
	});
}

test('a newer clear request supersedes a replacement even if the replacement loads first', async () => {
	const { context, images, cell } = createAtlas();
	let requestId = 1;
	const replacement = context.replaceAtlasTile(cell, { width: 16, height: 16 }, () => requestId === 1);
	requestId = 2;
	const clearing = context.clearAtlasTile(cell, () => requestId === 2);

	images[0].onload();
	assert.equal(await replacement, null);
	assert.equal(context.currentAtlasDataUrl, 'atlas.png');
	images[1].onload();
	assert.equal(await clearing, 'data:image/png;base64,edited');
});

test('clearing edits the selected tile and invalidates cached atlases', async () => {
	const { context, images, cell, cleared } = createAtlas();
	const pending = context.clearAtlasTile(cell);
	images[0].onload();
	assert.equal(await pending, 'data:image/png;base64,edited');
	assert.deepEqual(cleared, [[16, 32, 16, 16]]);
	assert.equal(context.currentAtlasDataUrl, 'data:image/png;base64,edited');
	assert.equal(context.glyphCache.size, 0);
});

test('replacement returns the edited tile and its transparency', async () => {
	for (const alpha of [0, 255]) {
		const { context, images, cell } = createAtlas({ alpha });
		const pending = context.replaceAtlasTile(cell, { width: 32, height: 32 });
		images[0].onload();
		const result = await pending;
		assert.equal(result.atlasUrl, context.currentAtlasDataUrl);
		assert.equal(result.tileUrl, 'data:image/png;base64,edited');
		assert.equal(result.tileW, 16);
		assert.equal(result.tileH, 16);
		assert.equal(result.transparent, alpha === 0);
	}
});

test('replacement failure before a preview is ready leaves the atlas and cache intact', async () => {
	const { context, images, cell } = createAtlas({ tileContextUnavailable: true });
	const pending = context.replaceAtlasTile(cell, { width: 16, height: 16 });
	images[0].onload();
	assert.equal(await pending, null);
	assert.equal(context.currentAtlasDataUrl, 'atlas.png');
	assert.equal(context.glyphCache.size, 1);
});

test('a delayed transparency scan cannot mark cells from a newer atlas', () => {
	const { context, images, output } = createAtlas();
	let scanned = false;
	context.markTransparentCellsFromAtlas = () => { scanned = true; };
	context.markTransparentCellsFromAtlasUrl('atlas.png', output, 16, 256, 256);
	output.dataset.atlasVersion = '2';
	images[0].onload();
	assert.equal(scanned, false);
});

test('extracting a glyph settles canvas failures with an empty preview', async () => {
	const { context, images, cell } = createAtlas({ canvasError: true });
	const pending = context.extractGlyphTileUrl(cell);
	assert.doesNotThrow(() => images[0].onload());
	assert.equal(await pending, '');
});

test('an initial default load cannot replace an atlas selected while it was loading', () => {
	for (const event of ['onload', 'onerror']) {
		const { context, images, output } = createAtlas();
		const rendered = [];
		context.processGlyph = () => rendered.push('default');
		context.Glyph = () => rendered.push('fallback');
		context.initializeGlyph();
		output.dataset.atlasVersion = '2';
		output.hasChildNodes = () => true;
		images[0][event]();
		assert.deepEqual(rendered, [], event);
	}
});
