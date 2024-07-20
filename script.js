const GRID = 16;
let isHexToEmoji = true;

function showCopyNotification(element) {
	const notification = element.querySelector('.copy-notification');
	notification.style.opacity = '1';
	setTimeout(() => {
		notification.style.opacity = '0';
	}, 1000);
}

function updateCopyButtonState() {
	const output = document.getElementById('converterOutput');
	const copyButton = document.getElementById('copyButton');
	copyButton.disabled = output.value.trim() === '';
}

function addClickEventToGlyphs() {
	document.querySelectorAll('#glyph-output div').forEach(div => {
		div.addEventListener('click', function () {
			const char = this.getAttribute('data-char');
			navigator.clipboard.writeText(char).then(() => {
				showCopyNotification(this);
			});
		});
	});
}

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
		markdownContent += `<div data-hex="0x${hexCode}" data-char="${char}">
			${char}
			<span class="tooltip">Position: (${col};${row}) - Hex: 0x${hexCode}</span>
			<span class="copy-notification">Copied</span>
		</div>`;
	}

	document.getElementById('glyph-output').innerHTML = markdownContent;
	addClickEventToGlyphs();
}

function initializeGlyph() {
	const glyphOutput = document.getElementById('glyph-output');
	if (glyphOutput.innerHTML.trim() === '') {
		Glyph("E0");
	}
}

function convertHexToEmoji(input) {
	if (/^[0-9A-Fa-f]{1,6}$/.test(input)) {
		try {
			const codePoint = parseInt(input, 16);
			document.getElementById('converterOutput').value = String.fromCodePoint(codePoint);
			document.getElementById('successMsg').textContent = 'Converted successfully!';
			document.getElementById('successMsg').classList.remove('d-none');
		} catch (error) {
			document.getElementById('errorMsg').textContent = 'Invalid Unicode code point.';
			document.getElementById('errorMsg').classList.remove('d-none');
		}
	} else {
		document.getElementById('errorMsg').textContent = 'Please enter a valid hex value (1-6 hex digits).';
		document.getElementById('errorMsg').classList.remove('d-none');
	}
}

function convertEmojiToHex(input) {
	if (input.length === 1) {
		const hexValue = input.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
		document.getElementById('converterOutput').value = `0x${hexValue}`;
		document.getElementById('successMsg').textContent = 'Converted successfully!';
		document.getElementById('successMsg').classList.remove('d-none');
	} else {
		document.getElementById('errorMsg').textContent = 'Please enter a single emoji or symbol.';
		document.getElementById('errorMsg').classList.remove('d-none');
	}
}

function convert() {
	const input = document.getElementById('converterInput').value.trim();
	const errorMsg = document.getElementById('errorMsg');
	const successMsg = document.getElementById('successMsg');
	const output = document.getElementById('converterOutput');
	errorMsg.classList.add('d-none');
	successMsg.classList.add('d-none');
	output.value = '';

	if (isHexToEmoji) {
		convertHexToEmoji(input);
	} else {
		convertEmojiToHex(input);
	}
	updateCopyButtonState();
}

function copyOutput() {
	const output = document.getElementById('converterOutput');
	const copyButton = document.getElementById('copyButton');

	if (output.value.trim() === '') {
		return;
	}

	navigator.clipboard.writeText(output.value).then(() => {
		const originalText = copyButton.innerHTML;
		copyButton.innerHTML = '<i class="fas fa-check me-2"></i>Copied';
		copyButton.disabled = true;

		setTimeout(() => {
			copyButton.innerHTML = originalText;
			copyButton.disabled = false;
		}, 2000);
	});
}

window.onload = () => {
	initializeGlyph();
};

document.getElementById('glyph-input').addEventListener('input', function () {
	const glyphInput = this.value.trim();
	const glyphSuccessMsg = document.getElementById('glyphSuccessMsg');
	const glyphErrorMsg = document.getElementById('glyphErrorMsg');

	if (/^[A-Fa-f0-9]{1,2}$/.test(glyphInput)) {
		Glyph(glyphInput || "E0");
		glyphSuccessMsg.textContent = 'Glyph generated successfully!';
		glyphSuccessMsg.classList.remove('d-none');
		glyphErrorMsg.classList.add('d-none');
	} else {
		glyphErrorMsg.textContent = 'Please enter a valid hex value (1-2 hex digits).';
		glyphErrorMsg.classList.remove('d-none');
		glyphSuccessMsg.classList.add('d-none');
	}
});

document.getElementById('conversionModeButton').addEventListener('click', function () {
	isHexToEmoji = !isHexToEmoji;
	this.textContent = isHexToEmoji ? "Hex to Emoji" : "Emoji to Hex";
	document.getElementById('inputPrefix').style.display = isHexToEmoji ? "inline-block" : "none";
	document.getElementById('converterInput').placeholder = isHexToEmoji ? "Enter hex value" : "Enter emoji/symbol";
	document.getElementById('converterOutput').value = '';
	updateCopyButtonState();
});

document.getElementById('convertButton').addEventListener('click', convert);
document.getElementById('copyButton').addEventListener('click', copyOutput);
document.getElementById('converterInput').addEventListener('input', convert);

document.getElementById('glyphUpload').addEventListener('change', function (e) {
	const file = e.target.files[0];
	if (!file) return;

	const fileNameRegex = /^glyph_([0-9A-F]{2})\.png$/i;
	const match = file.name.match(fileNameRegex);
	if (!match) {
		alert('Invalid file name. Please use the format glyph_XX.png where XX is a hex value from 00 to FF.');
		return;
	}

	const hexValue = match[1].toUpperCase();

	const reader = new FileReader();
	reader.onload = function (event) {
		const img = new Image();
		img.onload = function () {
			processGlyph(img, hexValue);
		};
		img.src = event.target.result;
	};
	reader.readAsDataURL(file);
});

let zoomWindow = null;
let updateTimer = null;
let zoomEnabled = false;

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
            style="background-image: url(${unicodeCanvas.toDataURL()}); background-size: 100% 100%;">
            <span class="tooltip">Position: (${col};${row}) - Hex: 0x${hexCode}</span>
            <span class="copy-notification">Copied</span>
        </div>`;
	}

	document.getElementById('glyph-output').innerHTML = markdownContent;
	addClickEventToGlyphs();

	removeZoomEvents();
	zoomEnabled = false;

	if (img.width > 256 || img.height > 256) {
		zoomEnabled = true;
		addZoomEvents(unicodeSize);
	} else {
		hideZoomWindow();
	}

}

function removeZoomEvents() {
	const glyphOutput = document.getElementById('glyph-output');
	if (glyphOutput.zoomHandlers) {
		glyphOutput.removeEventListener('mouseover', glyphOutput.zoomHandlers.mouseover);
		glyphOutput.removeEventListener('mousemove', glyphOutput.zoomHandlers.mousemove);
		glyphOutput.removeEventListener('mouseout', glyphOutput.zoomHandlers.mouseout);
		delete glyphOutput.zoomHandlers;
	}
}

function addZoomEvents(unicodeSize) {
	const glyphOutput = document.getElementById('glyph-output');

	glyphOutput.addEventListener('mouseover', zoomMouseoverHandler);
	glyphOutput.addEventListener('mousemove', zoomMousemoveHandler);
	glyphOutput.addEventListener('mouseout', zoomMouseoutHandler);

	function zoomMouseoverHandler(e) {
		const target = e.target.closest('div[data-hex]');
		if (target && zoomEnabled) {
			showZoomWindow(unicodeSize);
			updateZoomWindowContent(target, unicodeSize);
		}
	}

	function zoomMousemoveHandler(e) {
		const target = e.target.closest('div[data-hex]');
		if (target && zoomWindow && zoomEnabled) {
			clearTimeout(updateTimer);
			updateTimer = setTimeout(() => {
				updateZoomWindowContent(target, unicodeSize);
			}, 50);
		}
	}

	function zoomMouseoutHandler(e) {
		if (!e.relatedTarget || !e.relatedTarget.closest('#glyph-output')) {
			hideZoomWindow();
		}
	}

	glyphOutput.zoomHandlers = {
		mouseover: zoomMouseoverHandler,
		mousemove: zoomMousemoveHandler,
		mouseout: zoomMouseoutHandler
	};
}

function updateZoomWindowPosition(e) {
	const padding = 20;
	let left = e.pageX + padding;
	let top = e.pageY + padding;

	const windowWidth = window.innerWidth;
	const windowHeight = window.innerHeight;
	if (left + zoomWindow.offsetWidth > windowWidth) {
		left = e.pageX - zoomWindow.offsetWidth - padding;
	}
	if (top + zoomWindow.offsetHeight > windowHeight) {
		top = e.pageY - zoomWindow.offsetHeight - padding;
	}

	zoomWindow.style.left = `${left}px`;
	zoomWindow.style.top = `${top}px`;
}

function updateZoomWindowContent(target, unicodeSize) {
	if (!target || !zoomWindow) return;

	const hexCode = target.getAttribute('data-hex');
	const position = target.getAttribute('data-position');
	const backgroundImage = target.style.backgroundImage;

	const zoomCanvas = zoomWindow.querySelector('canvas');
	const zoomCtx = zoomCanvas.getContext('2d');
	zoomCtx.imageSmoothingEnabled = false;

	zoomCtx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);

	if (backgroundImage) {
		const img = new Image();
		img.onload = function () {
			const scale = Math.min(zoomCanvas.width / unicodeSize, zoomCanvas.height / unicodeSize);

			const scaledWidth = unicodeSize * scale;
			const scaledHeight = unicodeSize * scale;

			const offsetX = (zoomCanvas.width - scaledWidth) / 2;
			const offsetY = (zoomCanvas.height - scaledHeight) / 2;

			zoomCtx.drawImage(img, 0, 0, unicodeSize, unicodeSize,
				offsetX, offsetY, scaledWidth, scaledHeight);
		};
		img.src = backgroundImage.slice(5, -2);
	}

	const info = zoomWindow.querySelector('.zoom-info');
	info.textContent = `Hex: ${hexCode} - Position: ${position}`;
}


window.addEventListener('scroll', function () {
	hideZoomWindow();
});

function showZoomWindow(unicodeSize) {
	if (!zoomWindow) {
		zoomWindow = createZoomWindow(unicodeSize);
		document.body.appendChild(zoomWindow);
	}
	zoomWindow.style.display = 'block';
}


function hideZoomWindow() {
	if (zoomWindow) {
		zoomWindow.style.display = 'none';
	}
}


function createZoomWindow(unicodeSize) {
	const zoomWindow = document.createElement('div');
	zoomWindow.className = 'zoom-window';
	zoomWindow.style.position = 'fixed';
	zoomWindow.style.right = '20px';
	zoomWindow.style.bottom = '20px';
	zoomWindow.style.zIndex = '1000';
	zoomWindow.style.background = 'white';
	zoomWindow.style.border = '1px solid #ccc';
	zoomWindow.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
	zoomWindow.style.padding = '5px';
	zoomWindow.style.display = 'none';

	const zoomCanvas = document.createElement('canvas');
	zoomCanvas.width = 256;
	zoomCanvas.height = 256;
	zoomWindow.appendChild(zoomCanvas);

	const info = document.createElement('div');
	info.className = 'zoom-info';
	zoomWindow.appendChild(info);

	return zoomWindow;
}

window.addEventListener('scroll', function () {
	if (zoomWindow) {
		zoomWindow.style.bottom = '20px';
	}
});

const style = document.createElement('style');
style.textContent = `
    .zoom-window {
        border-radius: 5px;
        background: white;
        padding: 10px;
        box-shadow: 0 0 15px rgba(0,0,0,0.2);
    }

    .zoom-window canvas {
        display: block;
        image-rendering: pixelated;
        width: 200px;
        height: 200px;
    }

    .zoom-window .zoom-info {
        margin-top: 5px;
        font-size: 12px;
        text-align: center;
    }

    #glyph-output div {
        background-repeat: no-repeat;
        image-rendering: pixelated;
    }
`;
document.head.appendChild(style);