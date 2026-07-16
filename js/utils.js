const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
let toastTimer = null;
const noSelectControlSelector = [
	'button',
	'[role="button"]',
	'.btn',
	'.dropdown-item',
	'.detail-field',
	'.vanilla-tile',
	'.footer-links a',
	'.mobile-nav-card a',
	'.hint-link'
].join(',');

if (typeof document !== 'undefined' && typeof Element !== 'undefined') {
	document.addEventListener('selectstart', event => {
		if (event.target instanceof Element && event.target.closest(noSelectControlSelector)) {
			event.preventDefault();
		}
	}, true);

	document.addEventListener('dragstart', event => {
		if (event.target instanceof Element && event.target.closest(noSelectControlSelector)) {
			event.preventDefault();
		}
	}, true);

	document.addEventListener('mousedown', event => {
		if (
			event.button === 0 &&
			event.target instanceof Element &&
			event.target.closest(noSelectControlSelector) &&
			!event.target.closest('input, textarea, select')
		) {
			if (window.getSelection) window.getSelection().removeAllRanges();
			event.preventDefault();
		}
	}, true);
}

function getElement(id) {
	return document.getElementById(id);
}

function listen(element, eventName, handler, options) {
	if (!element) return false;
	element.addEventListener(eventName, handler, options);
	return true;
}

function showCopyNotification(element) {
	if (!element) return;
	const notification = element.querySelector('.copy-notification');
	if (!notification) return;
	notification.classList.add('show-anim');
	setTimeout(() => {
		notification.classList.remove('show-anim');
	}, 1000);
}

function updateCopyButtonState() {
	const output = getElement('converterOutput');
	const copyButton = getElement('copyButton');
	if (!output || !copyButton) return;

	if (output.value.length === 0) {
		copyButton.style.opacity = '0.4';
		copyButton.style.pointerEvents = 'none';
	} else {
		copyButton.style.opacity = '1';
		copyButton.style.pointerEvents = 'auto';
	}
}

function toggleDarkMode() {
	isDarkMode = !isDarkMode;
	document.body.classList.toggle('dark-mode', isDarkMode);

	const darkModeToggle = getElement('darkModeToggle');
	setButtonContent(darkModeToggle, isDarkMode ? 'Light' : 'Dark');

	renderGlyphs();
}

function setButtonContent(button, label = '') {
	if (!button) return;
	button.textContent = label;
}

function showToast(message, variant = 'success', duration = 1500) {
	let toastLayer = document.querySelector('.toast-layer');
	if (!toastLayer) {
		toastLayer = document.createElement('div');
		toastLayer.className = 'toast-layer';
		document.body.appendChild(toastLayer);
	}
	document.body.appendChild(toastLayer);

	let toast = toastLayer.querySelector('.action-toast');
	if (!toast) {
		toast = document.createElement('div');
		toast.className = 'action-toast';
		toastLayer.appendChild(toast);
	}

	toast.textContent = String(message);
	toast.classList.toggle('success', variant === 'success');
	toast.classList.add('visible');
	Object.assign(toastLayer.style, {
		position: 'fixed',
		top: '0',
		left: '0',
		right: '0',
		height: '0',
		zIndex: '2147483647',
		overflow: 'visible',
		pointerEvents: 'none'
	});
	Object.assign(toast.style, {
		position: 'absolute',
		top: '12px',
		left: '50%',
		zIndex: '1'
	});

	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		toast.classList.remove('visible', 'success');
	}, duration);
}

function isValidGlyphPrefix(value) {
	if (!/^[0-9A-F]{1,4}$/i.test(value || '')) return false;
	const prefix = Number.parseInt(value, 16);
	return Number.isInteger(prefix) && prefix >= 0 && prefix <= 0x10FF;
}

function getGlyphPrefix(value, fallback = 'E0') {
	const normalized = String(value || '').trim().toUpperCase();
	return isValidGlyphPrefix(normalized) ? normalized : fallback;
}

function getGlyphPrefixFromFileName(fileName) {
	const normalizedName = String(fileName || '')
		.normalize('NFKC')
		.replace(/\p{Cf}|\p{Variation_Selector}/gu, '')
		.trim();
	const match = normalizedName.match(/^glyph\s*_\s*([0-9A-F]{1,4})\s*\.png$/i);

	return match ? getGlyphPrefix(match[1], null) : null;
}

async function loadPngFile(file, options = {}) {
	const {
		minWidth = 1,
		minHeight = 1,
		maxBytes = APP_CONFIG.maxPngBytes,
		maxDimension = APP_CONFIG.maxImageDimension,
		maxPixels = APP_CONFIG.maxImagePixels,
		requireSquare = false,
		dimensionMultiple = 1
	} = options;

	if (!(file instanceof Blob) || file.size <= 0) {
		throw new Error('The selected file is empty or unavailable.');
	}
	if (file.size > maxBytes) {
		throw new Error(`PNG files must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller.`);
	}
	if (file.type && file.type.toLowerCase() !== 'image/png') {
		throw new Error('Please select a valid PNG file.');
	}

	const header = new Uint8Array(await file.slice(0, 24).arrayBuffer());
	if (
		header.length < 24 ||
		!PNG_SIGNATURE.every((byte, index) => header[index] === byte) ||
		String.fromCharCode(...header.slice(12, 16)) !== 'IHDR'
	) {
		throw new Error('The selected file is not a valid PNG image.');
	}

	const headerView = new DataView(header.buffer, header.byteOffset, header.byteLength);
	const headerWidth = headerView.getUint32(16);
	const headerHeight = headerView.getUint32(20);
	const validateDimensions = (width, height) => {
		if (width < minWidth || height < minHeight) {
			throw new Error(`PNG dimensions must be at least ${minWidth}x${minHeight}px.`);
		}
		if (width > maxDimension || height > maxDimension || width * height > maxPixels) {
			throw new Error('PNG dimensions are too large to process safely.');
		}
		if (requireSquare && width !== height) {
			throw new Error('Glyph atlas PNGs must be square.');
		}
		if (
			dimensionMultiple > 1 &&
			(width % dimensionMultiple !== 0 || height % dimensionMultiple !== 0)
		) {
			throw new Error(`PNG dimensions must be divisible by ${dimensionMultiple}.`);
		}
	};
	validateDimensions(headerWidth, headerHeight);

	const objectUrl = URL.createObjectURL(file);
	try {
		const image = await new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('The PNG image could not be decoded.'));
			img.src = objectUrl;
		});

		const width = image.naturalWidth || image.width;
		const height = image.naturalHeight || image.height;
		validateDimensions(width, height);
		if (width !== headerWidth || height !== headerHeight) {
			throw new Error('PNG dimensions do not match the image header.');
		}

		return image;
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

async function copyText(text) {
	const value = String(text);
	if (navigator.clipboard && window.isSecureContext) {
		try {
			await navigator.clipboard.writeText(value);
			return;
		} catch {
			// Use the legacy copy command when clipboard permission is denied.
		}
	}

	const textArea = document.createElement('textarea');
	textArea.value = value;
	textArea.setAttribute('readonly', '');
	textArea.style.position = 'fixed';
	textArea.style.opacity = '0';
	document.body.appendChild(textArea);
	textArea.select();

	try {
		if (!document.execCommand('copy')) throw new Error('Copy command was rejected.');
	} finally {
		textArea.remove();
	}
}

function downloadUrl(url, fileName) {
	if (!url) return false;
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	anchor.style.display = 'none';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	return true;
}

function downloadFile(content, fileName, contentType) {
	const file = new Blob([content], { type: contentType });
	const objectUrl = URL.createObjectURL(file);
	downloadUrl(objectUrl, fileName);
	setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
