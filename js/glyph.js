function createGlyphCell({
	char,
	hexCode,
	col,
	row,
	width = '',
	height = '',
	imageUrl = '',
	useAtlas = false,
	transparent = false
}) {
	const cell = document.createElement('div');
	cell.dataset.hex = `0x${hexCode}`;
	cell.dataset.char = char;
	cell.dataset.position = `(${col};${row})`;
	cell.dataset.width = String(width);
	cell.dataset.height = String(height);

	if (transparent) cell.classList.add('transparent');
	if (useAtlas) {
		setCellAtlasBackground(cell, col, row);
	} else if (imageUrl) {
		cell.style.backgroundImage = `url("${imageUrl}")`;
		cell.style.backgroundSize = '100% 100%';
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
	Array.from(glyphOutput.querySelectorAll('div[data-sprite-col][data-sprite-row]')).forEach(cell => {
		const col = Number.parseInt(cell.dataset.spriteCol, 10) + 1;
		const row = Number.parseInt(cell.dataset.spriteRow, 10) + 1;
		setCellAtlasBackground(cell, col, row);
	});
}

function markGlyphOutputReady(glyphOutput) {
	if (!glyphOutput) return;

	glyphOutput.classList.remove('is-loading');
	glyphOutput.removeAttribute('aria-busy');
}

function isTransparentGlyphTile(imageData) {
	return imageData.data.every((value, index) => (index + 1) % 4 === 0 || value === 0);
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
	if (!atlasUrl) return;

	const img = new Image();
	if (!atlasUrl.startsWith('data:')) img.crossOrigin = 'anonymous';
	img.onload = function () {
		markTransparentCellsFromAtlas(img, glyphOutput, unicodeSize, atlasWidth, atlasHeight);
	};
	img.src = atlasUrl;
}

function getBackgroundImageUrl(element) {
	if (!element) return '';
	if (element.dataset.originalBg) return element.dataset.originalBg;
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

			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(img, tile.x, tile.y, tile.tileW, tile.tileH, 0, 0, tile.tileW, tile.tileH);
			resolve(canvas.toDataURL('image/png'));
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

	removeZoomEvents();
	zoomEnabled = false;
	hideZoomWindow();

	setAtlasInfo(null, null, `${filename}.png`);
	return true;
}

function initializeGlyph() {
	const glyphOutput = getElement('glyph-output');
	if (!glyphOutput) return;

	if (!glyphOutput.hasChildNodes()) {
		if (DEFAULT_GLYPHS.E0) {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = function () {
				processGlyph(img, 'E0', {
					cacheKey: 'E0_DEFAULT',
					label: 'glyph_E0.png',
					atlasUrl: DEFAULT_GLYPHS.E0
				});
			};
			img.onerror = function () {
				Glyph('E0');
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
	removeZoomEvents();
	zoomEnabled = false;
	hideZoomWindow();

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

function renderGlyphs() {
	const glyphOutput = getElement('glyph-output');
	if (!glyphOutput) return;
	if (glyphOutput.dataset.atlasUrl) return;

	const glyphs = Array.from(glyphOutput.querySelectorAll('div[data-hex]'));
	const themeKey = isDarkMode ? 'dark' : 'light';
	const schedule = window.requestIdleCallback || window.requestAnimationFrame;
	let index = 0;

	const processChunk = () => {
		const start = performance.now();
		for (; index < glyphs.length && performance.now() - start < 8; index++) {
			const glyph = glyphs[index];
			if (glyph.dataset.spriteCol) continue;
			const bgUrl = getBackgroundImageUrl(glyph);

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
			ctx.drawImage(img, 0, 0, atlasCanvas.width, atlasCanvas.height);
		} catch {
			return false;
		}

		atlasUrl = atlasCanvas.toDataURL('image/png');
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

	removeZoomEvents();
	zoomEnabled = false;
	hideZoomWindow();

	currentAtlasDataUrl = atlasUrl;
	glyphOutput.replaceChildren(fragment);
	markGlyphOutputReady(glyphOutput);
	setGlyphOutputAtlas(glyphOutput, currentAtlasDataUrl);
	markTransparentCellsFromAtlas(img, glyphOutput, unicodeSize, atlasWidth, atlasHeight, atlasCanvas);

	currentAtlasLabel = label;
	setAtlasInfo(imageWidth, imageHeight, label);

	if (themedKey) {
		glyphCache.set(themedKey, {
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
			glyphCache.clear();
			setAtlasInfo(img.width, img.height, currentAtlasLabel || 'Atlas');
			resolve(currentAtlasDataUrl);
		};
		img.onerror = () => resolve(null);
		img.src = currentAtlasDataUrl;
	});
}

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
				atlasUrl: currentAtlasDataUrl,
				tileUrl: tileCanvas.toDataURL('image/png'),
				tileW: tile.tileW,
				tileH: tile.tileH
			});
		};
		atlasImg.onerror = () => resolve(null);
		atlasImg.src = currentAtlasDataUrl;
	});
}
