function createGlyphCell({
	char,
	hexCode,
	col,
	row,
	width = '',
	height = '',
	useAtlas = false
}) {
	const cell = document.createElement('div');
	cell.dataset.hex = `0x${hexCode}`;
	cell.dataset.char = char;
	cell.dataset.position = `(${col};${row})`;
	cell.dataset.width = String(width);
	cell.dataset.height = String(height);

	if (useAtlas) {
		setCellAtlasBackground(cell, col, row);
	} else {
		cell.textContent = char;
	}

	return cell;
}

function getSpritePosition(index) {
	return GRID > 1 ? (index / (GRID - 1)) * 100 : 0;
}

function setCellAtlasBackground(cell, col, row) {
	const colIndex = Math.max(0, Number(col) - 1);
	const rowIndex = Math.max(0, Number(row) - 1);

	cell.dataset.spriteCol = String(colIndex);
	cell.dataset.spriteRow = String(rowIndex);
	cell.style.backgroundImage = 'var(--glyph-atlas-url)';
	cell.style.backgroundSize = `${GRID * 100}% ${GRID * 100}%`;
	cell.style.backgroundPosition = `${getSpritePosition(colIndex)}% ${getSpritePosition(rowIndex)}%`;
	cell.style.backgroundRepeat = 'no-repeat';
	cell.textContent = '';
}

function setGlyphOutputAtlas(glyphOutput, atlasUrl) {
	if (!glyphOutput) return;
	const nextVersion = (Number.parseInt(glyphOutput.dataset.atlasVersion, 10) || 0) + 1;
	glyphOutput.dataset.atlasVersion = String(nextVersion);

	if (atlasUrl) {
		glyphOutput.dataset.atlasUrl = atlasUrl;
		glyphOutput.style.setProperty('--glyph-atlas-url', `url("${atlasUrl}")`);
	} else {
		delete glyphOutput.dataset.atlasUrl;
		glyphOutput.style.removeProperty('--glyph-atlas-url');
	}
}

function getCellAtlasUrl(cell) {
	if (!cell) return '';
	const glyphOutput = cell.closest ? cell.closest('#glyph-output') : null;
	return cell.dataset.atlasUrl || (glyphOutput ? glyphOutput.dataset.atlasUrl : '') || '';
}

function updateGlyphCellsAtlas(atlasUrl) {
	const glyphOutput = getElement('glyph-output');
	if (!glyphOutput || !atlasUrl) return;

	setGlyphOutputAtlas(glyphOutput, atlasUrl);
}

function markGlyphOutputReady(glyphOutput) {
	if (!glyphOutput) return;

	glyphOutput.classList.remove('is-loading');
	glyphOutput.removeAttribute('aria-busy');
}

function isTransparentGlyphTile(imageData) {
	for (let index = 3; index < imageData.data.length; index += 4) {
		if (imageData.data[index] !== 0) return false;
	}
	return true;
}

function markTransparentCellsFromAtlas(img, glyphOutput, unicodeSize, atlasWidth, atlasHeight, sourceCanvas = null) {
	if (!img || !glyphOutput || unicodeSize < 1 || atlasWidth < 1 || atlasHeight < 1) return;

	const cells = Array.from(glyphOutput.querySelectorAll('div[data-sprite-col][data-sprite-row]'));
	if (!cells.length) return;

	const atlasVersion = glyphOutput.dataset.atlasVersion || '0';
	const canvas = sourceCanvas || document.createElement('canvas');
	if (!sourceCanvas) {
		canvas.width = atlasWidth;
		canvas.height = atlasHeight;
	}

	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return;

	if (!sourceCanvas) {
		try {
			ctx.drawImage(img, 0, 0, atlasWidth, atlasHeight);
		} catch {
			return;
		}
	}

	const schedule = (callback) => {
		if (window.requestIdleCallback) {
			window.requestIdleCallback(callback);
		} else {
			window.requestAnimationFrame(callback);
		}
	};
	let index = 0;

	const scanChunk = (deadline) => {
		if (glyphOutput.dataset.atlasVersion !== atlasVersion) return;

		const startedAt = performance.now();
		while (index < cells.length) {
			const hasIdleTime = deadline && typeof deadline.timeRemaining === 'function'
				? deadline.timeRemaining() > 1
				: performance.now() - startedAt < 8;
			if (!hasIdleTime) break;

			const cell = cells[index++];
			const col = Number.parseInt(cell.dataset.spriteCol, 10);
			const row = Number.parseInt(cell.dataset.spriteRow, 10);
			const x = col * unicodeSize;
			const y = row * unicodeSize;

			try {
				const imageData = ctx.getImageData(x, y, unicodeSize, unicodeSize);
				cell.classList.toggle('transparent', isTransparentGlyphTile(imageData));
			} catch {
				return;
			}
		}

		if (index < cells.length) {
			schedule(scanChunk);
		}
	};

	schedule(scanChunk);
}

function markTransparentCellsFromAtlasUrl(atlasUrl, glyphOutput, unicodeSize, atlasWidth, atlasHeight) {
	if (!atlasUrl || !glyphOutput) return;

	const atlasVersion = glyphOutput.dataset.atlasVersion;
	const img = new Image();
	if (!atlasUrl.startsWith('data:')) img.crossOrigin = 'anonymous';
	img.onload = function () {
		if (glyphOutput.dataset.atlasVersion !== atlasVersion) return;
		markTransparentCellsFromAtlas(img, glyphOutput, unicodeSize, atlasWidth, atlasHeight);
	};
	img.src = atlasUrl;
}

function getBackgroundImageUrl(element) {
	if (!element) return '';
	const atlasUrl = getCellAtlasUrl(element);
	if (atlasUrl && element.dataset.spriteCol) return atlasUrl;

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

function extractGlyphTileUrl(cell) {
	return new Promise((resolve) => {
		if (!cell) {
			resolve('');
			return;
		}

		const atlasUrl = getCellAtlasUrl(cell);
		const backgroundUrl = getBackgroundImageUrl(cell);
		const sourceUrl = atlasUrl || backgroundUrl;
		if (!sourceUrl) {
			resolve('');
			return;
		}

		if (!atlasUrl) {
			resolve(sourceUrl);
			return;
		}

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = function () {
			const tile = getAtlasTileRect(cell, img.naturalWidth || img.width, img.naturalHeight || img.height);
			if (!tile) {
				resolve('');
				return;
			}

			const canvas = document.createElement('canvas');
			canvas.width = tile.tileW;
			canvas.height = tile.tileH;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				resolve('');
				return;
			}

			try {
				ctx.imageSmoothingEnabled = false;
				ctx.drawImage(img, tile.x, tile.y, tile.tileW, tile.tileH, 0, 0, tile.tileW, tile.tileH);
				resolve(canvas.toDataURL('image/png'));
			} catch {
				resolve('');
			}
		};
		img.onerror = () => resolve('');
		img.src = sourceUrl;
	});
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

function Glyph(glyph = 'E0') {
	const normalizedGlyph = getGlyphPrefix(glyph, null);
	const glyphOutput = getElement('glyph-output');
	if (!normalizedGlyph || !glyphOutput) return false;

	const filename = `glyph_${normalizedGlyph}`;
	const startChar = Number.parseInt(`${normalizedGlyph}00`, 16);
	const fragment = document.createDocumentFragment();
	currentAtlasDataUrl = null;
	currentAtlasLabel = `${filename}.png`;
	setGlyphOutputAtlas(glyphOutput, '');

	for (let i = 0; i < GRID * GRID; i++) {
		const row = Math.floor(i / GRID) + 1;
		const col = (i % GRID) + 1;
		const charCode = startChar + i;
		const char = String.fromCodePoint(charCode);
		const hexCode = charCode.toString(16).toUpperCase().padStart(4, '0');

		fragment.appendChild(createGlyphCell({ char, hexCode, col, row }));
	}

	glyphOutput.replaceChildren(fragment);
	markGlyphOutputReady(glyphOutput);

	setAtlasInfo(null, null, `${filename}.png`);
	return true;
}

function initializeGlyph() {
	const glyphOutput = getElement('glyph-output');
	if (!glyphOutput) return;

	if (!glyphOutput.hasChildNodes()) {
		if (DEFAULT_GLYPHS.E0) {
			const atlasVersion = glyphOutput.dataset.atlasVersion;
			const isCurrent = () => !glyphOutput.hasChildNodes() &&
				glyphOutput.dataset.atlasVersion === atlasVersion;
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = function () {
				if (!isCurrent()) return;
				processGlyph(img, 'E0', {
					cacheKey: 'E0_DEFAULT',
					label: 'glyph_E0.png',
					atlasUrl: DEFAULT_GLYPHS.E0
				});
			};
			img.onerror = function () {
				if (isCurrent()) Glyph('E0');
			};
			img.src = DEFAULT_GLYPHS.E0;
		} else {
			Glyph('E0');
		}
	}
}

function applyCachedGlyph(entry) {
	const glyphOutput = getElement('glyph-output');
	if (!glyphOutput || !entry || !Array.isArray(entry.cells)) return false;

	const cells = entry.cells.map(cell => cell.cloneNode(true));
	glyphOutput.replaceChildren(...cells);
	markGlyphOutputReady(glyphOutput);

	currentAtlasDataUrl = entry.atlasDataUrl || null;
	currentAtlasLabel = entry.label || currentAtlasLabel;
	setGlyphOutputAtlas(glyphOutput, currentAtlasDataUrl);
	setAtlasInfo(entry.width, entry.height, entry.label);
	markTransparentCellsFromAtlasUrl(
		currentAtlasDataUrl,
		glyphOutput,
		entry.unicodeSize,
		entry.atlasWidth || entry.width,
		entry.atlasHeight || entry.height
	);
	return true;
}

function processGlyph(img, hexValue, options = {}) {
	const normalizedHex = getGlyphPrefix(hexValue, null);
	const glyphOutput = getElement('glyph-output');
	const imageWidth = img ? (img.naturalWidth || img.width) : 0;
	const imageHeight = img ? (img.naturalHeight || img.height) : 0;
	if (!normalizedHex || !glyphOutput || imageWidth < GRID || imageHeight < GRID) return false;

	const cacheKey = options.cacheKey;
	const label = options.label || `glyph_${normalizedHex}.png`;

	if (cacheKey && glyphCache.has(cacheKey)) {
		return applyCachedGlyph(glyphCache.get(cacheKey));
	}

	const unicodeSize = Math.floor(Math.min(imageWidth, imageHeight) / GRID);
	if (unicodeSize < 1) return false;
	const atlasWidth = unicodeSize * GRID;
	const atlasHeight = unicodeSize * GRID;
	const sourceAtlasUrl = options.atlasUrl || '';
	const canUseSourceAtlas = sourceAtlasUrl && imageWidth === atlasWidth && imageHeight === atlasHeight;
	let atlasUrl = sourceAtlasUrl;
	let atlasCanvas = null;

	if (!canUseSourceAtlas) {
		atlasCanvas = document.createElement('canvas');
		const ctx = atlasCanvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return false;

		atlasCanvas.width = atlasWidth;
		atlasCanvas.height = atlasHeight;

		try {
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(img, 0, 0, atlasCanvas.width, atlasCanvas.height);
			atlasUrl = atlasCanvas.toDataURL('image/png');
		} catch {
			return false;
		}
	}

	const fragment = document.createDocumentFragment();
	const startChar = Number.parseInt(`${normalizedHex}00`, 16);

	for (let i = 0; i < GRID * GRID; i++) {
		const row = Math.floor(i / GRID) + 1;
		const col = (i % GRID) + 1;
		const charCode = startChar + i;
		const char = String.fromCodePoint(charCode);
		const hexCode = charCode.toString(16).toUpperCase().padStart(4, '0');

		fragment.appendChild(createGlyphCell({
			char,
			hexCode,
			col,
			row,
			width: unicodeSize,
			height: unicodeSize,
			useAtlas: true
		}));
	}

	currentAtlasDataUrl = atlasUrl;
	glyphOutput.replaceChildren(fragment);
	markGlyphOutputReady(glyphOutput);
	setGlyphOutputAtlas(glyphOutput, currentAtlasDataUrl);
	markTransparentCellsFromAtlas(img, glyphOutput, unicodeSize, atlasWidth, atlasHeight, atlasCanvas);

	currentAtlasLabel = label;
	setAtlasInfo(imageWidth, imageHeight, label);

	if (cacheKey) {
		glyphCache.set(cacheKey, {
			cells: Array.from(glyphOutput.children, cell => cell.cloneNode(true)),
			unicodeSize,
			width: imageWidth,
			height: imageHeight,
			atlasWidth,
			atlasHeight,
			label,
			atlasDataUrl: currentAtlasDataUrl
		});

		if (glyphCache.size > GLYPH_CACHE_LIMIT) {
			const oldestKey = glyphCache.keys().next().value;
			glyphCache.delete(oldestKey);
		}
	}

	return true;
}

function editAtlasTile(cell, newImage = null, isCurrent = () => true) {
	return new Promise((resolve) => {
		if (!currentAtlasDataUrl || !cell || !isCurrent()) {
			resolve(null);
			return;
		}

		const atlasUrl = currentAtlasDataUrl;
		const glyphOutput = getElement('glyph-output');
		const atlasVersion = glyphOutput?.dataset.atlasVersion;
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = function () {
			if (!isCurrent() || currentAtlasDataUrl !== atlasUrl || glyphOutput?.dataset.atlasVersion !== atlasVersion) {
				resolve(null);
				return;
			}

			try {
				const canvas = document.createElement('canvas');
				canvas.width = img.width;
				canvas.height = img.height;
				const ctx = canvas.getContext('2d');
				const tile = getAtlasTileRect(cell, img.width, img.height);
				if (!ctx || !tile) return resolve(null);
				ctx.imageSmoothingEnabled = false;
				ctx.drawImage(img, 0, 0);
				ctx.clearRect(tile.x, tile.y, tile.tileW, tile.tileH);

				let tileUrl = '';
				let transparent = true;
				if (newImage) {
					if (newImage.width < 1 || newImage.height < 1) return resolve(null);
					const tileCanvas = document.createElement('canvas');
					tileCanvas.width = tile.tileW;
					tileCanvas.height = tile.tileH;
					const tileCtx = tileCanvas.getContext('2d');
					if (!tileCtx) return resolve(null);
					tileCtx.imageSmoothingEnabled = false;
					tileCtx.drawImage(newImage, 0, 0, tile.tileW, tile.tileH);
					tileUrl = tileCanvas.toDataURL('image/png');
					transparent = isTransparentGlyphTile(tileCtx.getImageData(0, 0, tile.tileW, tile.tileH));
					ctx.drawImage(tileCanvas, tile.x, tile.y);
				}

				const editedAtlasUrl = canvas.toDataURL('image/png');
				if (!isCurrent()) return resolve(null);
				currentAtlasDataUrl = editedAtlasUrl;
				glyphCache.clear();
				setAtlasInfo(img.width, img.height, currentAtlasLabel || 'Atlas');
				resolve({ atlasUrl: currentAtlasDataUrl, tileUrl, tileW: tile.tileW, tileH: tile.tileH, transparent });
			} catch {
				resolve(null);
			}
		};
		img.onerror = () => resolve(null);
		img.src = atlasUrl;
	});
}

async function clearAtlasTile(cell, isCurrent) {
	const result = await editAtlasTile(cell, null, isCurrent);
	return result ? result.atlasUrl : null;
}

function replaceAtlasTile(cell, newImage, isCurrent) {
	return newImage ? editAtlasTile(cell, newImage, isCurrent) : Promise.resolve(null);
}
