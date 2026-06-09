function removeZoomEvents() {
	const glyphOutput = getElement('glyph-output');
	if (glyphOutput && glyphOutput.zoomHandlers) {
		glyphOutput.removeEventListener('mouseover', glyphOutput.zoomHandlers.mouseover);
		glyphOutput.removeEventListener('mousemove', glyphOutput.zoomHandlers.mousemove);
		glyphOutput.removeEventListener('mouseout', glyphOutput.zoomHandlers.mouseout);
		delete glyphOutput.zoomHandlers;
	}
}

function addZoomEvents(unicodeSize) {
	const glyphOutput = getElement('glyph-output');
	if (!glyphOutput || !Number.isFinite(unicodeSize) || unicodeSize < 1) return;
	removeZoomEvents();

	function zoomMouseoverHandler(e) {
		const target = e.target instanceof Element ? e.target.closest('div[data-hex]') : null;
		if (target && zoomEnabled) {
			showZoomWindow(unicodeSize);
			updateZoomWindowContent(target, unicodeSize);
		}
	}

	function zoomMousemoveHandler(e) {
		const target = e.target instanceof Element ? e.target.closest('div[data-hex]') : null;
		if (target && zoomWindow && zoomEnabled) {
			clearTimeout(updateTimer);
			updateTimer = setTimeout(() => {
				updateZoomWindowContent(target, unicodeSize);
			}, 50);
		}
	}

	function zoomMouseoutHandler(e) {
		const relatedTarget = e.relatedTarget instanceof Element ? e.relatedTarget : null;
		if (!relatedTarget || !relatedTarget.closest('#glyph-output')) {
			hideZoomWindow();
		}
	}

	glyphOutput.addEventListener('mouseover', zoomMouseoverHandler);
	glyphOutput.addEventListener('mousemove', zoomMousemoveHandler);
	glyphOutput.addEventListener('mouseout', zoomMouseoutHandler);

	glyphOutput.zoomHandlers = {
		mouseover: zoomMouseoverHandler,
		mousemove: zoomMousemoveHandler,
		mouseout: zoomMouseoutHandler
	};
}

function updateZoomWindowPosition(e) {
	if (!zoomWindow || !e) return;
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
	const backgroundImageUrl = getBackgroundImageUrl(target);

	const zoomCanvas = zoomWindow.querySelector('canvas');
	if (!zoomCanvas || !Number.isFinite(unicodeSize) || unicodeSize < 1) return;
	const zoomCtx = zoomCanvas.getContext('2d');
	if (!zoomCtx) return;
	zoomCtx.imageSmoothingEnabled = false;

	zoomCtx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);

	if (backgroundImageUrl) {
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
		img.src = backgroundImageUrl;
	}

	const info = zoomWindow.querySelector('.zoom-info');
	if (info) info.textContent = `Hex: ${hexCode} - Position: ${position}`;
}

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

function createZoomWindow() {
	const zoomWindow = document.createElement('div');
	zoomWindow.className = 'zoom-window';
	zoomWindow.style.position = 'fixed';
	zoomWindow.style.right = '20px';
	zoomWindow.style.bottom = '20px';
	zoomWindow.style.zIndex = '1000';
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
