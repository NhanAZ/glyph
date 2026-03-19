// Glyph related functions
function setAtlasInfo(width, height, label) {
	const infoEl = document.getElementById('atlasInfo');
	if (!infoEl) return;

	if (label) currentAtlasLabel = label;

	if (width && height) {
		infoEl.textContent = `${label || 'Atlas'} — ${width}px x ${height}px`;
	} else {
		infoEl.textContent = label ? `${label} — no image` : 'Atlas: not loaded';
	}
}

function Glyph(glyph = "E0") {
	const filename = `glyph_${glyph}`;
	const startChar = parseInt(filename.split("_").pop() + "00", 16);
	let markdownContent = ``;
	currentAtlasDataUrl = null;
	currentAtlasLabel = `${filename}.png`;

	for (let i = 0; i < GRID * GRID; i++) {
		const row = Math.floor(i / GRID) + 1;
		const col = (i % GRID) + 1;
		const charCode = startChar + i;
		const char = String.fromCodePoint(charCode);
		const hexCode = charCode.toString(16).toUpperCase().padStart(4, '0');
		
		markdownContent += `<div data-hex="0x${hexCode}" data-char="${char}" data-position="(${col};${row})" data-width="" data-height="">${char}</div>`;
	}

	document.getElementById('glyph-output').innerHTML = markdownContent;
	
	if (typeof removeZoomEvents === 'function') {
		removeZoomEvents();
		zoomEnabled = false;
		if (typeof hideZoomWindow === 'function') hideZoomWindow();
	}

	setAtlasInfo(null, null, `${filename}.png`);
}

function initializeGlyph() {
	const glyphOutput = document.getElementById('glyph-output');
	if (glyphOutput.innerHTML.trim() === '') {
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
	document.getElementById('glyph-output').innerHTML = entry.markup;
	removeZoomEvents();
	zoomEnabled = false;
	if (typeof hideZoomWindow === 'function') {
		hideZoomWindow();
	}

	currentAtlasDataUrl = entry.atlasDataUrl || null;
	currentAtlasLabel = entry.label || currentAtlasLabel;
	setAtlasInfo(entry.width, entry.height, entry.label);
}

function renderGlyphs() {
	const glyphOutput = document.getElementById('glyph-output');
	const glyphs = glyphOutput.querySelectorAll('div');

	glyphs.forEach(glyph => {
		const backgroundImage = glyph.style.backgroundImage;
		if (backgroundImage) {
			const img = new Image();
			img.onload = function () {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				canvas.width = img.width;
				canvas.height = img.height;

				ctx.drawImage(img, 0, 0);
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const data = imageData.data;

				for (let i = 0; i < data.length; i += 4) {
					if (data[i + 3] === 0) { // If pixel is transparent
						if (isDarkMode) {
							data[i] = 50;	 // R
							data[i + 1] = 50; // G
							data[i + 2] = 50; // B
							data[i + 3] = 128; // A (semi-transparent)
						} else {
							data[i] = 200;	// R
							data[i + 1] = 200; // G
							data[i + 2] = 200; // B
							data[i + 3] = 64;  // A (semi-transparent)
						}
					}
				}

				ctx.putImageData(imageData, 0, 0);
				const processedUrl = canvas.toDataURL();
				glyph.style.backgroundImage = `url(${processedUrl})`;
				glyph.dataset.originalBg = processedUrl;
			};
			img.crossOrigin = 'anonymous';
			img.src = backgroundImage.slice(5, -2); // Remove 'url("")' from backgroundImage
		}
	});
}

function processGlyph(img, hexValue, options = {}) {
	const cacheKey = options.cacheKey;
	const label = options.label || `glyph_${hexValue.toUpperCase()}.png`;
	const themedKey = cacheKey ? `${cacheKey}__${isDarkMode ? 'dark' : 'light'}` : null;

	if (themedKey && glyphCache.has(themedKey)) {
		applyCachedGlyph(glyphCache.get(themedKey));
		return;
	}

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	const unicodeSize = Math.floor(Math.min(img.width, img.height) / 16);
	canvas.width = unicodeSize * 16;
	canvas.height = unicodeSize * 16;

	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

	let markdownContent = '';
	const startChar = parseInt(hexValue + "00", 16);

	for (let i = 0; i < 256; i++) {
		const row = Math.floor(i / 16) + 1;
		const col = (i % 16) + 1;
		const charCode = startChar + i;
		const char = String.fromCodePoint(charCode);
		const hexCode = charCode.toString(16).toUpperCase().padStart(4, '0');

		const x = (i % 16) * unicodeSize;
		const y = Math.floor(i / 16) * unicodeSize;
		const unicodeCanvas = document.createElement('canvas');
		unicodeCanvas.width = unicodeSize;
		unicodeCanvas.height = unicodeSize;
		const unicodeCtx = unicodeCanvas.getContext('2d');
		unicodeCtx.imageSmoothingEnabled = false;
		unicodeCtx.drawImage(canvas, x, y, unicodeSize, unicodeSize, 0, 0, unicodeSize, unicodeSize);

		const imageData = unicodeCtx.getImageData(0, 0, unicodeSize, unicodeSize);
		const isTransparent = imageData.data.every((value, index) => (index + 1) % 4 === 0 || value === 0);

		const transparentClass = isTransparent ? 'transparent' : '';

		markdownContent += `<div class="${transparentClass}" data-hex="0x${hexCode}" data-char="${char}" 
			data-position="(${col};${row})" data-width="${unicodeSize}" data-height="${unicodeSize}"
			style="background-image: url(${unicodeCanvas.toDataURL()}); background-size: 100% 100%;"></div>`;
	}

	removeZoomEvents();
	zoomEnabled = false;
	hideZoomWindow();

	document.getElementById('glyph-output').innerHTML = markdownContent;
	renderGlyphs();

	currentAtlasDataUrl = canvas.toDataURL('image/png');
	currentAtlasLabel = label;
	setAtlasInfo(img.width, img.height, label);

	if (themedKey) {
		glyphCache.set(themedKey, {
			markup: document.getElementById('glyph-output').innerHTML,
			unicodeSize,
			width: img.width,
			height: img.height,
			label,
			atlasDataUrl: currentAtlasDataUrl
		});
	}
}

// Clear a single glyph cell from the current atlas (makes it transparent) and update the cached atlas DataURL
function clearAtlasTile(cell) {
	return new Promise((resolve) => {
		if (!currentAtlasDataUrl || !cell) return resolve(null);

		const pos = cell.getAttribute('data-position');
		const match = pos ? pos.match(/\((\d+);(\d+)\)/) : null;
		if (!match) return resolve(null);
		const col = parseInt(match[1], 10);
		const row = parseInt(match[2], 10);

		const widthAttr = parseInt(cell.getAttribute('data-width'), 10);
		const heightAttr = parseInt(cell.getAttribute('data-height'), 10);

		const img = new Image();
		img.onload = function () {
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, 0, 0);

			const tileW = widthAttr || Math.floor(img.width / GRID);
			const tileH = heightAttr || Math.floor(img.height / GRID);
			const x = (col - 1) * tileW;
			const y = (row - 1) * tileH;
			ctx.clearRect(x, y, tileW, tileH);

			currentAtlasDataUrl = canvas.toDataURL('image/png');
			glyphCache.clear(); // force regen next time to reflect cleared tile
			setAtlasInfo(img.width, img.height, currentAtlasLabel || 'Atlas');
			resolve(currentAtlasDataUrl);
		};
		img.src = currentAtlasDataUrl;
	});
}

// Replace a single glyph cell with a provided image; updates atlas and cache
function replaceAtlasTile(cell, newImage) {
	return new Promise((resolve) => {
		if (!currentAtlasDataUrl || !cell || !newImage) return resolve(null);

		const pos = cell.getAttribute('data-position');
		const match = pos ? pos.match(/\((\d+);(\d+)\)/) : null;
		if (!match) return resolve(null);
		const col = parseInt(match[1], 10);
		const row = parseInt(match[2], 10);

		const widthAttr = parseInt(cell.getAttribute('data-width'), 10);
		const heightAttr = parseInt(cell.getAttribute('data-height'), 10);

		const atlasImg = new Image();
		atlasImg.onload = function () {
			const canvas = document.createElement('canvas');
			canvas.width = atlasImg.width;
			canvas.height = atlasImg.height;
			const ctx = canvas.getContext('2d');
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(atlasImg, 0, 0);

			const tileW = widthAttr || Math.floor(atlasImg.width / GRID);
			const tileH = heightAttr || Math.floor(atlasImg.height / GRID);
			const x = (col - 1) * tileW;
			const y = (row - 1) * tileH;

			ctx.clearRect(x, y, tileW, tileH);
			ctx.drawImage(newImage, 0, 0, newImage.width, newImage.height, x, y, tileW, tileH);

			currentAtlasDataUrl = canvas.toDataURL('image/png');
			glyphCache.clear();
			setAtlasInfo(atlasImg.width, atlasImg.height, currentAtlasLabel || 'Atlas');

			const tileCanvas = document.createElement('canvas');
			tileCanvas.width = tileW;
			tileCanvas.height = tileH;
			const tileCtx = tileCanvas.getContext('2d');
			tileCtx.imageSmoothingEnabled = false;
			tileCtx.drawImage(newImage, 0, 0, newImage.width, newImage.height, 0, 0, tileW, tileH);

			resolve({ tileUrl: tileCanvas.toDataURL('image/png'), tileW, tileH });
		};
		atlasImg.src = currentAtlasDataUrl;
	});
}
