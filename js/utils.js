// Utility functions
const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
let actionToastTimer = null;

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

	if (output.value.trim() === '') {
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
	setButtonContent(
		darkModeToggle,
		isDarkMode ? 'fas fa-sun text-warning' : 'fas fa-moon'
	);

	if (typeof renderGlyphs === 'function') renderGlyphs();
}

function setButtonContent(button, iconClassName, label = '') {
	if (!button) return;

	const icon = document.createElement('i');
	icon.className = iconClassName;
	button.replaceChildren(icon);
	if (label) button.appendChild(document.createTextNode(` ${label}`));
}

function showActionToast(message, variant = 'success', duration = 1500) {
	let toast = document.querySelector('.smart-tooltip');
	if (!toast) {
		toast = document.createElement('div');
		toast.className = 'smart-tooltip';
		document.body.appendChild(toast);
	}

	toast.textContent = String(message);
	toast.classList.toggle('success', variant === 'success');
	toast.classList.add('visible');
	toast.style.left = '50%';
	toast.style.top = '50px';
	toast.style.position = 'fixed';

	if (actionToastTimer) clearTimeout(actionToastTimer);
	actionToastTimer = setTimeout(() => {
		toast.classList.remove('visible', 'success');
		toast.style.position = 'absolute';
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
			// Fall back for browsers that expose Clipboard API but deny permission.
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

/**
 * Utility to download a file from the browser
 * @param {string} content - File content
 * @param {string} fileName - Name of the file
 * @param {string} contentType - MIME type
 */
function downloadFile(content, fileName, contentType) {
	const file = new Blob([content], { type: contentType });
	const objectUrl = URL.createObjectURL(file);
	downloadUrl(objectUrl, fileName);
	setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
