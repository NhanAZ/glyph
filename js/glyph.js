// Glyph related functions
function Glyph(glyph = "E0") {
	const filename = `glyph_${glyph}`;
	const startChar = parseInt(filename.split("_").pop() + "00", 16);
	let markdownContent = ``;

	for (let i = 0; i < GRID * GRID; i++) {
		const row = Math.floor(i / GRID) + 1;
		const col = (i % GRID) + 1;
		const charCode = startChar + i;
		const char = String.fromCodePoint(charCode);
		const hexCode = charCode.toString(16).toUpperCase().padStart(4, '0');
		
		markdownContent += `<div data-hex="0x${hexCode}" data-char="${char}" data-position="(${col};${row})">${char}</div>`;
	}

	document.getElementById('glyph-output').innerHTML = markdownContent;
	
	if (typeof removeZoomEvents === 'function') {
		removeZoomEvents();
		zoomEnabled = false;
		if (typeof hideZoomWindow === 'function') hideZoomWindow();
	}
}

function initializeGlyph() {
	const glyphOutput = document.getElementById('glyph-output');
	if (glyphOutput.innerHTML.trim() === '') {
		if (typeof DEFAULT_GLYPHS !== 'undefined' && DEFAULT_GLYPHS["E0"]) {
			const img = new Image();
			img.onload = function() {
				processGlyph(img, "E0");
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
				glyph.style.backgroundImage = `url(${canvas.toDataURL()})`;
			};
			img.src = backgroundImage.slice(5, -2); // Remove 'url("")' from backgroundImage
		}
	});
}

function processGlyph(img, hexValue) {
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
			data-position="(${col};${row})" 
			style="background-image: url(${unicodeCanvas.toDataURL()}); background-size: 100% 100%;"></div>`;
	}

	removeZoomEvents();
	zoomEnabled = false;

	if (img.width > 0 || img.height > 0) {
		zoomEnabled = true;
		addZoomEvents(unicodeSize);
	} else {
		hideZoomWindow();
	}

	document.getElementById('glyph-output').innerHTML = markdownContent;
	renderGlyphs();
}
