// Glyph related functions
function createGlyphCell({
	char,
	hexCode,
	col,
	row,
	width = '',
	height = '',
	imageUrl = '',
	transparent = false
}) {
	const cell = document.createElement('div');
	cell.dataset.hex = `0x${hexCode}`;
	cell.dataset.char = char;
	cell.dataset.position = `(${col};${row})`;
	cell.dataset.width = String(width);
	cell.dataset.height = String(height);

	if (transparent) cell.classList.add('transparent');
	if (imageUrl) {
		cell.style.backgroundImage = `url("${imageUrl}")`;
		cell.style.backgroundSize = '100% 100%';
	} else {
		cell.textContent = char;
	}

	return cell;
}

function getBackgroundImageUrl(element) {
	if (!element) return '';
	if (element.dataset.originalBg) return element.dataset.originalBg;

	const backgroundImage = element.style.backgroundImage;
	const match = backgroundImage.match(/^url\((['"]?)(.*)\1\)$/);
	return match ? match[2] : '';
}

function getAtlasTileRect(cell, imageWidth, imageHeight) {
	if (!cell || !Number.isFinite(imageWidth) || !Number.isFinite(imageHeight)) return null;

	const position = cell.getAttribute('data-position');
	const match = position ? position.match(/^\((\d+);(\d+)\)$/) : null;
	if (!match) return null;

	const col = Number.parseInt(match[1], 10);
	const row = Number.parseInt(match[2], 10);
	if (col < 1 || col > GRID || row < 1 || row > GRID) return null;

	const widthAttr = Number.parseInt(cell.getAttribute('data-width'), 10);
	const heightAttr = Number.parseInt(cell.getAttribute('data-height'), 10);
	const tileW = widthAttr > 0 ? widthAttr : Math.floor(imageWidth / GRID);
	const tileH = heightAttr > 0 ? heightAttr : Math.floor(imageHeight / GRID);
	const x = (col - 1) * tileW;
	const y = (row - 1) * tileH;

	if (tileW < 1 || tileH < 1 || x + tileW > imageWidth || y + tileH > imageHeight) {
		return null;
	}

	return { tileW, tileH, x, y };
}

function setAtlasInfo(width, height, label) {
	const infoEl = getElement('atlasInfo');
	if (!infoEl) return;

	if (label) currentAtlasLabel = label;

	if (width && height) {
		infoEl.textContent = `${label || 'Atlas'} - ${width}px x ${height}px`;
	} else {
		infoEl.textContent = label ? `${label} - no image` : 'Atlas: not loaded';
	}
}

function Glyph(glyph = "E0") {
	const normalizedGlyph = getGlyphPrefix(glyph, null);
	const glyphOutput = getElement('glyph-output');
	if (!normalizedGlyph || !glyphOutput) return false;

	const filename = `glyph_${normalizedGlyph}`;
	const startChar = Number.parseInt(`${normalizedGlyph}00`, 16);
	const fragment = document.createDocumentFragment();
	currentAtlasDataUrl = null;
	currentAtlasLabel = `${filename}.png`;

	for (let i = 0; i < GRID * GRID; i++) {
		const row = Math.floor(i / GRID) + 1;
		const col = (i % GRID) + 1;
		const charCode = startChar + i;
		const char = String.fromCodePoint(charCode);
		const hexCode = charCode.toString(16).toUpperCase().padStart(4, '0');

		fragment.appendChild(createGlyphCell({ char, hexCode, col, row }));
	}

	glyphOutput.replaceChildren(fragment);

	if (typeof removeZoomEvents === 'function') {
		removeZoomEvents();
		zoomEnabled = false;
		if (typeof hideZoomWindow === 'function') hideZoomWindow();
	}

	setAtlasInfo(null, null, `${filename}.png`);
	return true;
}

function initializeGlyph() {
	const glyphOutput = getElement('glyph-output');
	if (!glyphOutput) return;

	if (!glyphOutput.hasChildNodes()) {
		if (typeof DEFAULT_GLYPHS !== 'undefined' && DEFAULT_GLYPHS["E0"]) {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = function() {
				processGlyph(img, "E0", { cacheKey: "E0_DEFAULT", label: "glyph_E0.png" });
			};
			img.onerror = function() {
				Glyph("E0");
			};
			img.src = DEFAULT_GLYPHS["E0"];
		} else {
			Glyph("E0");
		}
	}
}


function applyCachedGlyph(entry) {
	const glyphOutput = getElement('glyph-output');
	if (!glyphOutput || !entry || !Array.isArray(entry.cells)) return false;

	const cells = entry.cells.map(cell => cell.cloneNode(true));
	glyphOutput.replaceChildren(...cells);
	if (typeof removeZoomEvents === 'function') removeZoomEvents();
	zoomEnabled = false;
	if (typeof hideZoomWindow === 'function') {
		hideZoomWindow();
	}

	currentAtlasDataUrl = entry.atlasDataUrl || null;
	currentAtlasLabel = entry.label || currentAtlasLabel;
	setAtlasInfo(entry.width, entry.height, entry.label);
	renderGlyphs();
	return true;
}

function renderGlyphs() {
	const glyphOutput = getElement('glyph-output');
	if (!glyphOutput) return;

	const glyphs = Array.from(glyphOutput.querySelectorAll('div[data-hex]'));
	const themeKey = isDarkMode ? 'dark' : 'light';
	const schedule = window.requestIdleCallback || window.requestAnimationFrame;
	let index = 0;

	const processChunk = () => {
		const start = performance.now();
		for (; index < glyphs.length && performance.now() - start < 8; index++) {
			const glyph = glyphs[index];
			const bgUrl = getBackgroundImageUrl(glyph);

			// Skip if nothing to process or already tinted for the current theme
			if (!bgUrl || (glyph.dataset.tintTheme === themeKey && glyph.dataset.displayBg)) continue;

			const img = new Image();
			glyph.dataset.pendingTintTheme = themeKey;
			img.onload = function () {
				const activeTheme = isDarkMode ? 'dark' : 'light';
				if (
					activeTheme !== themeKey ||
					glyph.dataset.pendingTintTheme !== themeKey ||
					getBackgroundImageUrl(glyph) !== bgUrl
				) {
					return;
				}

				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				if (!ctx || img.width < 1 || img.height < 1) return;
				canvas.width = img.width;
				canvas.height = img.height;

				let imageData;
				try {
					ctx.drawImage(img, 0, 0);
					imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				} catch {
					return;
				}
				const data = imageData.data;

				for (let i = 0; i < data.length; i += 4) {
					if (data[i + 3] === 0) {
						const tint = themeKey === 'dark' ? 50 : 200;
						const alpha = themeKey === 'dark' ? 128 : 64;
						data[i] = tint;
						data[i + 1] = tint;
						data[i + 2] = tint;
						data[i + 3] = alpha;
					}
				}

				ctx.putImageData(imageData, 0, 0);
				const processedUrl = canvas.toDataURL();
				glyph.style.backgroundImage = `url(${processedUrl})`;
				glyph.dataset.originalBg = bgUrl;
				glyph.dataset.displayBg = processedUrl;
				glyph.dataset.tintTheme = themeKey;
				delete glyph.dataset.pendingTintTheme;
			};
			img.onerror = () => {
				if (glyph.dataset.pendingTintTheme === themeKey) {
					delete glyph.dataset.pendingTintTheme;
				}
			};
			img.crossOrigin = 'anonymous';
			img.src = bgUrl;
		}

		if (index < glyphs.length) {
			schedule(processChunk);
		}
	};

	processChunk();
}

function processGlyph(img, hexValue, options = {}) {
	const normalizedHex = getGlyphPrefix(hexValue, null);
	const glyphOutput = getElement('glyph-output');
	const imageWidth = img ? (img.naturalWidth || img.width) : 0;
	const imageHeight = img ? (img.naturalHeight || img.height) : 0;
	if (!normalizedHex || !glyphOutput || imageWidth < GRID || imageHeight < GRID) return false;

	const cacheKey = options.cacheKey;
	const label = options.label || `glyph_${normalizedHex}.png`;
	const themedKey = cacheKey ? `${cacheKey}__${isDarkMode ? 'dark' : 'light'}` : null;

	if (themedKey && glyphCache.has(themedKey)) {
		return applyCachedGlyph(glyphCache.get(themedKey));
	}

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return false;

	const unicodeSize = Math.floor(Math.min(imageWidth, imageHeight) / GRID);
	if (unicodeSize < 1) return false;
	canvas.width = unicodeSize * GRID;
	canvas.height = unicodeSize * GRID;

	try {
		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
	} catch {
		return false;
	}

	const fragment = document.createDocumentFragment();
	const startChar = Number.parseInt(`${normalizedHex}00`, 16);

	for (let i = 0; i < GRID * GRID; i++) {
		const row = Math.floor(i / GRID) + 1;
		const col = (i % GRID) + 1;
		const charCode = startChar + i;
		const char = String.fromCodePoint(charCode);
		const hexCode = charCode.toString(16).toUpperCase().padStart(4, '0');

		const x = (i % GRID) * unicodeSize;
		const y = Math.floor(i / GRID) * unicodeSize;
		const unicodeCanvas = document.createElement('canvas');
		unicodeCanvas.width = unicodeSize;
		unicodeCanvas.height = unicodeSize;
		const unicodeCtx = unicodeCanvas.getContext('2d');
		if (!unicodeCtx) return false;
		unicodeCtx.imageSmoothingEnabled = false;
		unicodeCtx.drawImage(canvas, x, y, unicodeSize, unicodeSize, 0, 0, unicodeSize, unicodeSize);

		let imageData;
		try {
			imageData = unicodeCtx.getImageData(0, 0, unicodeSize, unicodeSize);
		} catch {
			return false;
		}
		const isTransparent = imageData.data.every((value, index) => (index + 1) % 4 === 0 || value === 0);

		fragment.appendChild(createGlyphCell({
			char,
			hexCode,
			col,
			row,
			width: unicodeSize,
			height: unicodeSize,
			imageUrl: unicodeCanvas.toDataURL('image/png'),
			transparent: isTransparent
		}));
	}

	if (typeof removeZoomEvents === 'function') removeZoomEvents();
	zoomEnabled = false;
	if (typeof hideZoomWindow === 'function') hideZoomWindow();

	glyphOutput.replaceChildren(fragment);
	renderGlyphs();

	currentAtlasDataUrl = canvas.toDataURL('image/png');
	currentAtlasLabel = label;
	setAtlasInfo(imageWidth, imageHeight, label);

	if (themedKey) {
		glyphCache.set(themedKey, {
			cells: Array.from(glyphOutput.children, cell => cell.cloneNode(true)),
			unicodeSize,
			width: imageWidth,
			height: imageHeight,
			label,
			atlasDataUrl: currentAtlasDataUrl
		});

		// Prevent unbounded memory growth when users load many atlases
		const cacheLimit = (typeof GLYPH_CACHE_LIMIT !== 'undefined') ? GLYPH_CACHE_LIMIT : 6;
		if (glyphCache.size > cacheLimit) {
			const oldestKey = glyphCache.keys().next().value;
			glyphCache.delete(oldestKey);
		}
	}

	return true;
}

// Clear a single glyph cell from the current atlas (makes it transparent) and update the cached atlas DataURL
function clearAtlasTile(cell) {
	return new Promise((resolve) => {
		if (!currentAtlasDataUrl || !cell) {
			resolve(null);
			return;
		}

		const img = new Image();
		img.onload = function () {
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d');
			const tile = getAtlasTileRect(cell, img.width, img.height);
			if (!ctx || !tile) return resolve(null);
			ctx.drawImage(img, 0, 0);

			ctx.clearRect(tile.x, tile.y, tile.tileW, tile.tileH);

			currentAtlasDataUrl = canvas.toDataURL('image/png');
			glyphCache.clear(); // force regen next time to reflect cleared tile
			setAtlasInfo(img.width, img.height, currentAtlasLabel || 'Atlas');
			resolve(currentAtlasDataUrl);
		};
		img.onerror = () => resolve(null);
		img.src = currentAtlasDataUrl;
	});
}

// Replace a single glyph cell with a provided image; updates atlas and cache
function replaceAtlasTile(cell, newImage) {
	return new Promise((resolve) => {
		if (!currentAtlasDataUrl || !cell || !newImage) {
			resolve(null);
			return;
		}

		const atlasImg = new Image();
		atlasImg.onload = function () {
			const canvas = document.createElement('canvas');
			canvas.width = atlasImg.width;
			canvas.height = atlasImg.height;
			const ctx = canvas.getContext('2d');
			const tile = getAtlasTileRect(cell, atlasImg.width, atlasImg.height);
			if (!ctx || !tile || newImage.width < 1 || newImage.height < 1) return resolve(null);
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(atlasImg, 0, 0);

			ctx.clearRect(tile.x, tile.y, tile.tileW, tile.tileH);
			ctx.drawImage(
				newImage,
				0,
				0,
				newImage.width,
				newImage.height,
				tile.x,
				tile.y,
				tile.tileW,
				tile.tileH
			);

			currentAtlasDataUrl = canvas.toDataURL('image/png');
			glyphCache.clear();
			setAtlasInfo(atlasImg.width, atlasImg.height, currentAtlasLabel || 'Atlas');

			const tileCanvas = document.createElement('canvas');
			tileCanvas.width = tile.tileW;
			tileCanvas.height = tile.tileH;
			const tileCtx = tileCanvas.getContext('2d');
			if (!tileCtx) return resolve(null);
			tileCtx.imageSmoothingEnabled = false;
			tileCtx.drawImage(
				newImage,
				0,
				0,
				newImage.width,
				newImage.height,
				0,
				0,
				tile.tileW,
				tile.tileH
			);

			resolve({
				tileUrl: tileCanvas.toDataURL('image/png'),
				tileW: tile.tileW,
				tileH: tile.tileH
			});
		};
		atlasImg.onerror = () => resolve(null);
		atlasImg.src = currentAtlasDataUrl;
	});
}
