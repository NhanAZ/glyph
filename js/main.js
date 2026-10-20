if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeGlyph, { once: true });
} else {
	initializeGlyph();
}

let glyphInputRequestId = 0;
let glyphUploadRequestId = 0;
let pendingGlyphUpload = null;

function cancelGlyphUpload() {
	glyphUploadRequestId++;
	if (!pendingGlyphUpload) return;

	if (pendingGlyphUpload.input) pendingGlyphUpload.input.value = '';
	pendingGlyphUpload = null;
	const dialog = getElement('glyphPrefixDialog');
	if (dialog && dialog.open) dialog.close();
	const label = getElement('uploadLabel');
	if (label) {
		label.textContent = 'Tap or drop a PNG';
		label.className = 'text-secondary upload-label-text';
	}
}

function updateGlyphInputState(prefix) {
	const input = getElement('glyph-input');
	if (input) {
		input.value = prefix;
		input.classList.remove('is-invalid');
	}
	for (const id of ['glyphErrorMsg', 'inputValidation']) {
		const message = getElement(id);
		if (message) message.classList.add('d-none');
	}
}

function loadPreset(assetKey, hex, cacheKey, labelText, options = {}) {
	const source = DEFAULT_GLYPHS[assetKey];
	if (!source || !isValidGlyphPrefix(hex)) return false;
	cancelGlyphUpload();
	const uploadRequestId = glyphUploadRequestId;

	const {
		hideHint = true,
		updateUploadLabel = true,
		showErrorToast = true,
		isCurrent = () => true,
		onError = null
	} = options;

	const image = new Image();
	image.crossOrigin = 'anonymous';
	image.onload = () => {
		if (uploadRequestId !== glyphUploadRequestId || !isCurrent()) return;

		if (!processGlyph(image, hex, { cacheKey, label: labelText, atlasUrl: source })) {
			if (showErrorToast) showToast('Unable to process the preset image.', 'error');
			if (onError) onError();
			return;
		}

		updateGlyphInputState(hex);
		if (hideHint) {
			const hintMsg = getElement('defaultImageHint');
			if (hintMsg) hintMsg.classList.add('d-none');
		}

		if (updateUploadLabel) {
			const uploadLabel = getElement('uploadLabel');
			if (uploadLabel) {
				uploadLabel.textContent = `Loaded: ${labelText}`;
				uploadLabel.className = 'text-primary fw-bold upload-label-text';
			}
		}
	};
	image.onerror = () => {
		if (uploadRequestId !== glyphUploadRequestId || !isCurrent()) return;
		if (showErrorToast) showToast('Unable to load the preset image.', 'error');
		if (onError) onError();
	};
	image.src = source;
	return true;
}

const glyphInputElement = getElement('glyph-input');
listen(glyphInputElement, 'input', function () {
	cancelGlyphUpload();
	const rawGlyphInput = this.value.trim().toUpperCase();
	let glyphInput = rawGlyphInput;
	const requestId = ++glyphInputRequestId;
	const glyphSuccessMsg = getElement('glyphSuccessMsg');
	const glyphErrorMsg = getElement('glyphErrorMsg');
	const validationMsg = getElement('inputValidation');
	const hintMsg = getElement('defaultImageHint');
	const hintHex = getElement('hintHex');
	if (!glyphSuccessMsg || !glyphErrorMsg) return;

	const glyphUpload = getElement('glyphUpload');
	if (glyphUpload) glyphUpload.value = '';
	const label = getElement('uploadLabel');
	if (label) {
		label.textContent = 'Tap or drop a PNG';
		label.className = 'text-secondary upload-label-text';
	}

	if (glyphInput === '') glyphInput = 'E0';

	if (isValidGlyphPrefix(glyphInput)) {
		const isDefaultAtlas = glyphInput === 'E0' || glyphInput === 'E1';
		const loadDefaultAtlas = () => loadPreset(glyphInput, glyphInput, `${glyphInput}_DEFAULT`, `glyph_${glyphInput}.png`, {
			updateUploadLabel: false,
			showErrorToast: false,
			isCurrent: () => requestId === glyphInputRequestId,
			onError: () => {
				if (requestId !== glyphInputRequestId) return;
				Glyph(glyphInput);
				if (hintMsg && hintHex) {
					hintHex.textContent = glyphInput;
					hintMsg.classList.remove('d-none');
				}
			}
		});

		if (!isDefaultAtlas || !loadDefaultAtlas()) {
			Glyph(glyphInput);
		}

		if (rawGlyphInput) {
			glyphSuccessMsg.textContent = 'Glyph generated successfully.';
			glyphSuccessMsg.classList.remove('d-none');
		} else {
			glyphSuccessMsg.textContent = '';
			glyphSuccessMsg.classList.add('d-none');
		}
		glyphErrorMsg.classList.add('d-none');
		if (validationMsg) validationMsg.classList.add('d-none');
		this.classList.remove('is-invalid');

		if (hintMsg) hintMsg.classList.add('d-none');
	} else {
		glyphErrorMsg.textContent = 'Please enter a hex prefix from 0 to 10FF.';
		glyphErrorMsg.classList.remove('d-none');
		glyphSuccessMsg.classList.add('d-none');
		if (validationMsg) validationMsg.classList.remove('d-none');
		this.classList.add('is-invalid');
		if (hintMsg) hintMsg.classList.add('d-none');
	}
});

listen(getElement('copyButton'), 'click', copyOutput);
listen(getElement('converterInput'), 'input', convert);

listen(getElement('converterOutput'), 'click', copyOutput);
listen(getElement('darkModeToggle'), 'click', toggleDarkMode);

async function importGlyphFile(file, input = null, confirmedPrefix = null) {
	if (!file) return;

	cancelGlyphUpload();
	const requestId = glyphUploadRequestId;
	glyphInputRequestId++;
	const hexValue = getGlyphPrefixFromFileName(file.name)
		|| getGlyphPrefix(confirmedPrefix, null);

	const label = getElement('uploadLabel');
	if (!hexValue) {
		pendingGlyphUpload = { file, input };
		if (label) {
			label.textContent = file.name;
			label.className = 'text-primary fw-bold upload-label-text';
		}
		const filename = getElement('uploadPrefixFilename');
		if (filename) filename.textContent = file.name;
		const prefixInput = getElement('uploadPrefix');
		if (prefixInput) {
			prefixInput.value = '';
		}
		const confirmButton = getElement('confirmGlyphImport');
		if (confirmButton) confirmButton.disabled = true;
		const dialog = getElement('glyphPrefixDialog');
		if (dialog && !dialog.open) dialog.showModal();
		if (prefixInput) prefixInput.focus();
		return;
	}

	try {
		const image = await loadPngFile(file, {
			minWidth: GRID,
			minHeight: GRID,
			requireSquare: true,
			dimensionMultiple: GRID
		});
		if (requestId !== glyphUploadRequestId) return;
		if (!processGlyph(image, hexValue, { label: file.name })) {
			throw new Error('The atlas could not be processed.');
		}

		updateGlyphInputState(hexValue);
		if (input) input.value = '';
		if (label) {
			label.textContent = file.name;
			label.className = 'text-primary fw-bold upload-label-text';
		}

		const hintMsg = getElement('defaultImageHint');
		if (hintMsg) hintMsg.classList.add('d-none');
	} catch (error) {
		if (requestId !== glyphUploadRequestId) return;
		if (input) input.value = '';
		if (label) {
			label.textContent = 'Tap or drop a PNG';
			label.className = 'text-secondary upload-label-text';
		}
		alert(error instanceof Error ? error.message : 'Unable to load the PNG atlas.');
	}
}

listen(getElement('glyphUpload'), 'change', async function () {
	await importGlyphFile(this.files && this.files[0], this);
});

listen(getElement('uploadPrefix'), 'input', function () {
	const confirmButton = getElement('confirmGlyphImport');
	if (confirmButton) confirmButton.disabled = !getGlyphPrefix(this.value, null);
});

listen(getElement('glyphPrefixForm'), 'submit', async event => {
	event.preventDefault();
	const prefixInput = getElement('uploadPrefix');
	const prefix = getGlyphPrefix(prefixInput ? prefixInput.value : '', null);
	if (!pendingGlyphUpload || !prefix) return;
	const { file, input } = pendingGlyphUpload;
	await importGlyphFile(file, input, prefix);
});

listen(getElement('cancelGlyphImport'), 'click', cancelGlyphUpload);
listen(getElement('glyphPrefixDialog'), 'cancel', event => {
	event.preventDefault();
	cancelGlyphUpload();
});

const glyphUploadZone = document.querySelector('.upload-zone');
let uploadDragDepth = 0;

if (glyphUploadZone) {
	const isFileDrag = event => event.dataTransfer
		&& Array.from(event.dataTransfer.types || []).includes('Files');

	glyphUploadZone.addEventListener('dragenter', event => {
		if (!isFileDrag(event)) return;
		event.preventDefault();
		uploadDragDepth++;
		glyphUploadZone.classList.add('is-dragging');
	});

	glyphUploadZone.addEventListener('dragover', event => {
		if (!isFileDrag(event)) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
		glyphUploadZone.classList.add('is-dragging');
	});

	glyphUploadZone.addEventListener('dragleave', event => {
		if (!isFileDrag(event)) return;
		uploadDragDepth = Math.max(0, uploadDragDepth - 1);
		if (uploadDragDepth === 0) glyphUploadZone.classList.remove('is-dragging');
	});

	glyphUploadZone.addEventListener('drop', async event => {
		if (!isFileDrag(event)) return;
		event.preventDefault();
		uploadDragDepth = 0;
		glyphUploadZone.classList.remove('is-dragging');
		const file = event.dataTransfer.files && event.dataTransfer.files[0];
		await importGlyphFile(file, getElement('glyphUpload'));
	});
}

document.addEventListener('DOMContentLoaded', () => {
	const glyphGrid = getElement('glyph-output');
	const gridModeToggle = getElement('gridModeToggle');
	const gridToggleLabel = gridModeToggle ? gridModeToggle.querySelector('.grid-toggle-label') : null;
	let gridMode = 'adaptive';

	function applyGridMode(mode) {
		if (!glyphGrid) return;
		if (mode === 'fixed') {
			glyphGrid.style.setProperty('--glyph-columns', 16);
			glyphGrid.style.setProperty('--glyph-rows', 16);
			if (gridToggleLabel) gridToggleLabel.textContent = '16x16 view';
		} else {
			glyphGrid.style.removeProperty('--glyph-columns');
			glyphGrid.style.removeProperty('--glyph-rows');
			if (gridToggleLabel) gridToggleLabel.textContent = 'Adaptive grid';
		}
	}

	applyGridMode(gridMode);

	if (gridModeToggle && glyphGrid) {
		gridModeToggle.addEventListener('click', () => {
			gridMode = gridMode === 'adaptive' ? 'fixed' : 'adaptive';
			gridModeToggle.classList.toggle('active', gridMode === 'fixed');
			applyGridMode(gridMode);
		});
	}

	// Glyph detail dialog.
	const modalApi = window.bootstrap && window.bootstrap.Modal;
	const detailModalEl = getElement('glyphDetailModal');
	const detailModal = detailModalEl && modalApi ? new modalApi(detailModalEl) : null;
	const detailImg = getElement('glyphDetailImage');
	const detailHex = getElement('glyphDetailHex');
	const detailDec = getElement('glyphDetailDec');
	const detailPos = getElement('glyphDetailPos');
	const detailCharText = getElement('glyphDetailCharText');
	const detailDim = getElement('glyphDetailDim');
	const detailUnicode = getElement('glyphDetailUnicode');
	const detailNotice = getElement('glyphDetailNotice');
	const detailPreview = document.querySelector('.detail-preview');
	const detailDownloadBtn = getElement('glyphDetailDownloadBtn');
	const detailClearBtn = getElement('glyphDetailClearBtn');
	const detailReplaceInput = getElement('glyphDetailReplaceInput');
	const actionUploadPng = getElement('actionUploadPng');
	const actionVanillaPicker = getElement('actionVanillaPicker');
	const vanillaStatus = getElement('vanillaStatus');
	const vanillaPickerStatus = getElement('vanillaPickerStatus');
	const vanillaGrid = getElement('vanillaGrid');
	const vanillaPickerModalEl = getElement('vanillaPickerModal');
	const vanillaPickerModal = vanillaPickerModalEl && modalApi ? new modalApi(vanillaPickerModalEl) : null;
	const vanillaSearchInput = getElement('vanillaSearchInput');
	const vanillaCategorySelect = getElement('vanillaCategorySelect');
	const vanillaPageSizeBtn = getElement('vanillaPageSizeBtn');
	const vanillaPageSizeMenu = getElement('vanillaPageSizeMenu');
	const vanillaPrevPage = getElement('vanillaPrevPage');
	const vanillaNextPage = getElement('vanillaNextPage');
	const vanillaPageInfo = getElement('vanillaPageInfo');
	const detailMeta = document.querySelector('.detail-meta');
	let vanillaPaths = [];
	let vanillaCategories = ['all'];
	let vanillaFiltered = [];
	let vanillaPage = 1;
	let vanillaPageSizeValue = '36';
	let vanillaRenderId = 0;
	let currentDetailCell = null;
	let detailRequestId = 0;
	let detailNoticeTimer = null;
	const vanillaCacheTtl = 24 * 60 * 60 * 1000;

	listen(detailModalEl, 'hidden.bs.modal', () => {
		currentDetailCell = null;
		detailRequestId++;
	});

	function showDetailNotice(message, variant = 'success') {
		if (!detailNotice) return;
		if (detailNoticeTimer) clearTimeout(detailNoticeTimer);
		detailNotice.textContent = message;
		detailNotice.classList.toggle('error', variant === 'error');
		detailNotice.classList.add('visible');
		detailNoticeTimer = setTimeout(() => {
			detailNotice.classList.remove('visible', 'error');
		}, 1500);
	}

	function formatUnicodeEscape(hexValue) {
		if (!hexValue) return '-';
		const clean = hexValue.toString().trim().replace(/^0x/i, '');
		if (!clean || !/^[0-9A-Fa-f]+$/.test(clean)) return '-';
		return `\\u{${clean.toUpperCase()}}`;
	}

	function isPrivateUseCharacter(codePoint) {
		return Number.isInteger(codePoint) && (
			(codePoint >= 0xE000 && codePoint <= 0xF8FF) ||
			(codePoint >= 0xF0000 && codePoint <= 0xFFFFD) ||
			(codePoint >= 0x100000 && codePoint <= 0x10FFFD)
		);
	}

	async function showGlyphDetail(cell) {
		if (!cell || !detailModal) return;
		currentDetailCell = cell;
		const requestId = ++detailRequestId;
		if (detailImg) detailImg.classList.remove('d-none');
		if (vanillaStatus) vanillaStatus.textContent = '';

		const isTransparentCell = cell.classList.contains('transparent');
		if (detailPreview) detailPreview.classList.remove('transparent-state');

		const hex = cell.getAttribute('data-hex') || '';
		const pos = cell.getAttribute('data-position') || '';
		const char = cell.getAttribute('data-char') || '';
		const codePoint = char ? char.codePointAt(0) : null;
		const decVal = typeof codePoint === 'number' ? codePoint.toString(10) : '';
		const widthAttr = Number.parseInt(cell.getAttribute('data-width'), 10) || 16;
		const heightAttr = Number.parseInt(cell.getAttribute('data-height'), 10) || 16;
		let dimText = `${widthAttr}px x ${heightAttr}px`;
		let glyphDownloadUrl = '';

		const resolvedImageUrl = await extractGlyphTileUrl(cell);
		if (requestId !== detailRequestId || !cell.isConnected) return;

		if (resolvedImageUrl) {
			if (detailPreview && isTransparentCell) detailPreview.classList.add('transparent-state');
			glyphDownloadUrl = resolvedImageUrl;
			if (detailImg && detailImg.src !== resolvedImageUrl) detailImg.src = resolvedImageUrl;
			if (detailImg) detailImg.classList.remove('d-none');
		} else {
			if (detailPreview) detailPreview.classList.add('transparent-state');
			const transparentCanvas = document.createElement('canvas');
			transparentCanvas.width = widthAttr || 220;
			transparentCanvas.height = heightAttr || 220;
			glyphDownloadUrl = transparentCanvas.toDataURL('image/png');
			dimText = `${transparentCanvas.width}px x ${transparentCanvas.height}px`;

			if (detailImg) {
				detailImg.src = glyphDownloadUrl;
				detailImg.classList.remove('d-none');
			}
		}

		if (detailHex) detailHex.textContent = hex;
		if (detailDec) detailDec.textContent = decVal;
		if (detailPos) detailPos.textContent = pos;
		if (detailCharText) {
			const usesPlaceholder = isPrivateUseCharacter(codePoint);
			detailCharText.textContent = usesPlaceholder ? '\u25A1' : (char || '-');
			detailCharText.dataset.copyValue = char;
			detailCharText.classList.toggle('private-use-placeholder', usesPlaceholder);
			detailCharText.title = usesPlaceholder ? 'Private Use character' : '';
		}
		if (detailDim) detailDim.textContent = dimText || '-';
		if (detailUnicode) detailUnicode.textContent = formatUnicodeEscape(hex);

		if (detailDownloadBtn) {
			detailDownloadBtn.disabled = !glyphDownloadUrl;
			detailDownloadBtn.setAttribute('title', 'Download glyph');
			const fileName = `glyph_${hex.replace(/^0x/i, '').toLowerCase() || 'char'}.png`;
			detailDownloadBtn.onclick = () => {
				downloadUrl(glyphDownloadUrl, fileName);
			};
		}

		if (detailClearBtn) {
			detailClearBtn.disabled = false;
			setButtonContent(detailClearBtn, 'Clear to transparent');
			detailClearBtn.onclick = async () => {
				if (!cell.isConnected) return;
				const clearRequestId = ++detailRequestId;
				detailClearBtn.disabled = true;
				const atlasUrl = await clearAtlasTile(cell, () => clearRequestId === detailRequestId && cell.isConnected);
				if (!cell.isConnected) return;
				if (atlasUrl) {
					updateGlyphCellsAtlas(atlasUrl);
					cell.classList.add('transparent');
				}
				if (currentDetailCell === cell) detailClearBtn.disabled = false;
				if (clearRequestId !== detailRequestId) return;
				if (!atlasUrl) {
					showToast('Unable to clear the glyph. Load an atlas and try again.', 'error');
					return;
				}
				const clearedCanvas = document.createElement('canvas');
				const tileW = widthAttr || 220;
				const tileH = heightAttr || 220;
				clearedCanvas.width = tileW;
				clearedCanvas.height = tileH;
				const clearedUrl = clearedCanvas.toDataURL('image/png');
				if (detailImg) {
					detailImg.src = clearedUrl;
					detailImg.classList.remove('d-none');
				}
				if (detailPreview) detailPreview.classList.add('transparent-state');
				if (detailDim) detailDim.textContent = `${tileW}px x ${tileH}px`;
				if (detailDownloadBtn) {
					detailDownloadBtn.disabled = false;
					detailDownloadBtn.onclick = () => {
						downloadUrl(
							clearedUrl,
							`glyph_${hex.replace(/^0x/i, '').toLowerCase() || 'char'}.png`
						);
					};
				}
				showToast('Cleared to transparent');
			};
		}

		detailModal.show();
	}

	if (detailMeta) {
		detailMeta.addEventListener('click', (event) => {
			const field = event.target instanceof Element
				? event.target.closest('.detail-field')
				: null;
			if (!field) return;
			const targetId = field.getAttribute('data-copy-target');
			if (!targetId) return;
			const targetEl = getElement(targetId);
			const value = targetEl
				? (targetEl.dataset.copyValue ?? targetEl.textContent.trim())
				: '';
			if (!value) return;
			copyText(value).then(() => {
				const label = field.getAttribute('data-label') || 'value';
				showDetailNotice(`Copied ${label} to clipboard`);
			}).catch(() => {
				showDetailNotice('Clipboard access failed. Try copying again.', 'error');
			});
		});
	}

	if (glyphGrid) {
		glyphGrid.addEventListener('click', (e) => {
			const cell = e.target instanceof Element
				? e.target.closest('#glyph-output div[data-hex]')
				: null;
			if (cell) {
				e.preventDefault();
				showGlyphDetail(cell);
			}
		});
	}

	const hintMsg = getElement('defaultImageHint');
	if (hintMsg) {
		hintMsg.addEventListener('click', () => {
			const hintHex = getElement('hintHex');
			const hex = getGlyphPrefix(hintHex ? hintHex.textContent : '', 'E0');

			if (!loadPreset(hex, hex, `${hex}_DEFAULT`, `glyph_${hex}.png`)) {
				Glyph(hex);
				hintMsg.classList.add('d-none');
			}
		});
	}

	const btnLoadTemplate = getElement('btnLoadTemplate');
	if (btnLoadTemplate) {
		btnLoadTemplate.addEventListener('click', () => {
			const glyphInput = getElement('glyph-input');
			const hex = getGlyphPrefix(glyphInput ? glyphInput.value : '', 'E0');
			loadPreset('TEMPLATE', hex, `TEMPLATE_${hex}`, 'glyph_grid.png');
		});
	}

	const btnLoadExample = getElement('btnLoadExample');
	if (btnLoadExample) {
		btnLoadExample.addEventListener('click', () => {
			const glyphInput = getElement('glyph-input');
			if (glyphInput) glyphInput.value = 'E1';
			loadPreset('E1_MOD', 'E1', 'E1_MOD', 'glyph_E1_modified.png');
		});
	}

	const btnLoadEmpty = getElement('btnLoadEmpty');
	if (btnLoadEmpty) {
		btnLoadEmpty.addEventListener('click', () => {
			const glyphInput = getElement('glyph-input');
			const hex = getGlyphPrefix(glyphInput ? glyphInput.value : '', 'E0');
			loadPreset('EMPTY', hex, `EMPTY_${hex}`, 'glyph_empty.png');
		});
	}

	function getGlyphCells() {
		return glyphGrid ? Array.from(glyphGrid.querySelectorAll('div[data-char]')) : [];
	}

	function getCurrentGlyphPrefix() {
		const firstCell = getGlyphCells()[0];
		const firstCodePoint = firstCell ? Number.parseInt(firstCell.getAttribute('data-hex'), 16) : NaN;
		return Number.isInteger(firstCodePoint) ? Math.floor(firstCodePoint / (GRID * GRID)).toString(16).toUpperCase() : 'E0';
	}

	function getGlyphRows(cells = getGlyphCells()) {
		const rows = [];
		for (let index = 0; index < cells.length; index += GRID) {
			rows.push(
				cells
					.slice(index, index + GRID)
					.map(cell => cell.getAttribute('data-char') || '')
					.join('')
			);
		}
		return rows;
	}

	const btnCopyAll = getElement('btnCopyAll');
	if (btnCopyAll) {
		btnCopyAll.addEventListener('click', () => {
			const rows = getGlyphRows();
			if (!rows.length) {
				showToast('No glyphs to copy.', 'error');
				return;
			}

			copyText(rows.join('\n')).then(() => {
				showToast(`Copied ${getGlyphCells().length} glyphs`, 'success', 2000);
			}).catch(() => {
				showToast('Unable to access the clipboard.', 'error');
			});
		});
	}

	const btnDownloadAtlas = getElement('btnDownloadAtlas');
	if (btnDownloadAtlas) {
		btnDownloadAtlas.addEventListener('click', () => {
			if (currentAtlasDataUrl) {
				const startHex = getCurrentGlyphPrefix();
				const fileName = `glyph_${startHex.toLowerCase()}.png`;
				downloadUrl(currentAtlasDataUrl, fileName);
				showToast('Atlas downloaded');
			} else {
				showToast('No atlas image loaded', 'error');
			}
		});
	}

	const btnDownloadJson = getElement('btnDownloadJson');
	if (btnDownloadJson) {
		btnDownloadJson.addEventListener('click', () => {
			const startHex = getCurrentGlyphPrefix();
			const rows = getGlyphRows();

			const json = {
				providers: [
					{
						type: 'bitmap',
						file: `minecraft:font/glyph_${startHex.toLowerCase()}.png`,
						ascent: 7,
						chars: rows
					}
				]
			};

			downloadFile(
				JSON.stringify(json, null, 2),
				`glyph_${startHex.toLowerCase()}.json`,
				'application/json'
			);
		});
	}

	const btnCopyReference = getElement('btnCopyReference');
	if (btnCopyReference) {
		btnCopyReference.addEventListener('click', () => {
			const cells = getGlyphCells();
			let result = 'GLYPH REFERENCE MAP\n====================\n';

			cells.forEach((cell) => {
				const hex = cell.getAttribute('data-hex');
				const pos = cell.getAttribute('data-position');
				const char = cell.getAttribute('data-char');
				result += `${hex}: ${pos} - ${char}\n`;
			});

			copyText(result.trim()).then(() => {
				showToast('Reference copied', 'success', 2000);
			}).catch(() => {
				showToast('Unable to access the clipboard.', 'error');
			});
		});
	}

	const btnDownloadFullJson = getElement('btnDownloadFullJson');
	if (btnDownloadFullJson) {
		btnDownloadFullJson.addEventListener('click', () => {
			const startHex = getCurrentGlyphPrefix();
			const data = getGlyphCells().map(cell => ({
				hex: cell.getAttribute('data-hex'),
				pos: cell.getAttribute('data-position'),
				char: cell.getAttribute('data-char')
			}));

			const json = {
				metadata: {
					generator: 'Glyph Tools',
					hex_range: `${startHex}00 - ${startHex}FF`,
					total: data.length
				},
				glyphs: data
			};

			downloadFile(
				JSON.stringify(json, null, 2),
				`glyph_${startHex.toLowerCase()}_metadata.json`,
				'application/json'
			);
		});
	}

	function setVanillaStatus(text = '') {
		if (!vanillaStatus) return;
		vanillaStatus.textContent = text || '';
		vanillaStatus.classList.toggle('d-none', !text);
	}

	function normalizeVanillaPaths(value) {
		if (!Array.isArray(value)) return [];

		return value
			.filter(path => typeof path === 'string')
			.map(path => path.startsWith('resource_pack/textures/')
				? path.slice('resource_pack/textures/'.length)
				: path)
			.filter(path => {
				const segments = path.split('/');
				return (
					path.length > 0 &&
					path.length <= 512 &&
					path.toLowerCase().endsWith('.png') &&
					!path.startsWith('/') &&
					!path.includes('\\') &&
					!path.includes(':') &&
					segments.every(segment => segment && segment !== '.' && segment !== '..')
				);
			});
	}

	function updateVanillaPathState(paths) {
		const normalizedPaths = normalizeVanillaPaths(paths);
		window.__vanillaPaths = normalizedPaths;
		vanillaCategories = Array.from(
			new Set(normalizedPaths.map(path => path.split('/')[0]))
		).sort();
		return normalizedPaths;
	}

	async function fetchVanillaList(forceReload = false) {
		try {
			if (Array.isArray(window.__vanillaPaths) && !forceReload) {
				const paths = updateVanillaPathState(window.__vanillaPaths);
				if (paths.length) return paths;
			}

			const raw = localStorage.getItem('vanillaTexturesCache');
			if (raw && !forceReload) {
				const cached = JSON.parse(raw);
				const age = Date.now() - Number(cached.timestamp);
				if (age >= 0 && age < vanillaCacheTtl && Array.isArray(cached.paths)) {
					const paths = updateVanillaPathState(cached.paths);
					if (paths.length) {
						setVanillaStatus('');
						return paths;
					}
				}
			}
		} catch {
			try {
				localStorage.removeItem('vanillaTexturesCache');
			} catch {}
		}

		setVanillaStatus('Loading vanilla textures...');
		try {
			const resp = await fetch('vanilla-textures/manifest.json', { cache: forceReload ? 'reload' : 'default' });
			if (!resp.ok) throw new Error(`Manifest request failed with status ${resp.status}.`);
			const data = await resp.json();
			const paths = updateVanillaPathState(data.paths);
			if (!paths.length) throw new Error('Manifest does not contain valid PNG paths.');
			try {
				localStorage.setItem(
					'vanillaTexturesCache',
					JSON.stringify({ timestamp: Date.now(), paths })
				);
			} catch {}
			setVanillaStatus('');
			return paths;
		} catch {
			setVanillaStatus('Failed to load local manifest.');
			return [];
		}
	}

	async function replaceDetailGlyph(img, cell, requestId) {
		if (!cell || !cell.isConnected || requestId !== detailRequestId) return;
		const hex = cell.getAttribute('data-hex') || '';
		const result = await replaceAtlasTile(cell, img, () => requestId === detailRequestId && cell.isConnected);
		if (!cell.isConnected) return;
		if (result && result.atlasUrl) {
			updateGlyphCellsAtlas(result.atlasUrl);
			cell.classList.toggle('transparent', result.transparent);
		}
		if (requestId !== detailRequestId) return;
		if (!result || !result.tileUrl) {
			showToast('Unable to replace the glyph. Load an atlas and try again.', 'error');
			return;
		}
		const { tileUrl, tileW, tileH } = result;
		if (detailPreview) detailPreview.classList.toggle('transparent-state', result.transparent);
		if (detailImg) {
			detailImg.src = tileUrl;
			detailImg.classList.remove('d-none');
		}
		if (detailDim) detailDim.textContent = `${tileW}px x ${tileH}px`;
		if (detailDownloadBtn) {
			const fileName = `glyph_${hex.replace(/^0x/i, '').toLowerCase() || 'char'}.png`;
			detailDownloadBtn.disabled = false;
			detailDownloadBtn.onclick = () => downloadUrl(tileUrl, fileName);
		}
		showToast('Glyph replaced');
	}

	function populateCategories() {
		if (!vanillaCategorySelect) return;
		const cats = ['all', ...vanillaCategories];
		vanillaCategorySelect.replaceChildren();
		cats.forEach(c => {
			const opt = document.createElement('option');
			opt.value = c;
			opt.textContent = c === 'all' ? 'All categories' : c;
			vanillaCategorySelect.appendChild(opt);
		});
	}

	function renderVanillaGrid(filterText = '') {
		if (!vanillaGrid) return;
		const needle = (filterText || '').toLowerCase();
		const selectedCat = vanillaCategorySelect ? vanillaCategorySelect.value : 'all';
		vanillaFiltered = (vanillaPaths || []).filter(p => {
			const matchText = needle ? p.toLowerCase().includes(needle) : true;
			const matchCat = selectedCat === 'all' ? true : p.startsWith(selectedCat + '/');
			return matchText && matchCat;
		});

		const total = vanillaFiltered.length;
		const requestedAll = vanillaPageSizeValue === 'all';
		const pageSize = requestedAll
			? (total || 1)
			: (Number.parseInt(vanillaPageSizeValue, 10) || 36);
		const totalPages = Math.max(1, Math.ceil(total / pageSize));
		if (vanillaPage > totalPages) vanillaPage = totalPages;
		const start = (vanillaPage - 1) * pageSize;
		const pageItems = vanillaFiltered.slice(start, start + pageSize);
		const renderId = ++vanillaRenderId;

		vanillaGrid.replaceChildren();
		if (vanillaPickerStatus) vanillaPickerStatus.textContent = 'Rendering...';
		if (vanillaPageInfo) vanillaPageInfo.textContent = `Page ${vanillaPage}/${totalPages}`;
		if (vanillaPrevPage) vanillaPrevPage.disabled = vanillaPage <= 1;
		if (vanillaNextPage) vanillaNextPage.disabled = vanillaPage >= totalPages;

		const chunkSize = 40;
		let i = 0;
		const schedule = window.requestIdleCallback || window.requestAnimationFrame;

		const renderChunk = () => {
			if (renderId !== vanillaRenderId) return;
			const fragment = document.createDocumentFragment();
			let count = 0;
			while (i < pageItems.length && count < chunkSize) {
				const path = pageItems[i++];
				const card = document.createElement('div');
				card.className = 'vanilla-tile';
				card.dataset.path = path;
				card.tabIndex = 0;
				card.setAttribute('role', 'button');
				const img = document.createElement('img');
				img.loading = 'lazy';
				img.crossOrigin = 'anonymous';
				img.src = `./vanilla-textures/${path}`;
				img.alt = '';
				const label = document.createElement('div');
				label.className = 'vanilla-name';
				label.textContent = path.split('/').slice(-1)[0].replace(/\.png$/i, '');
				card.setAttribute('aria-label', `Use texture ${label.textContent}`);
				card.appendChild(img);
				card.appendChild(label);
				const selectTexture = () => {
					const cell = currentDetailCell;
					const requestId = ++detailRequestId;
					const previewSrc = img.src;
					const previewImg = new Image();
					previewImg.crossOrigin = 'anonymous';
					previewImg.onload = function () {
						if (requestId !== detailRequestId || !cell || !cell.isConnected) return;
						replaceDetailGlyph(previewImg, cell, requestId);
						if (vanillaPickerModal) vanillaPickerModal.hide();
					};
					previewImg.onerror = function () {
						if (requestId !== detailRequestId) return;
						if (vanillaPickerStatus) vanillaPickerStatus.textContent = 'Failed to load texture.';
					};
					previewImg.src = previewSrc;
				};
				card.addEventListener('click', selectTexture);
				card.addEventListener('keydown', event => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						selectTexture();
					}
				});
				fragment.appendChild(card);
				count++;
			}

			if (renderId !== vanillaRenderId) return;
			if (count) vanillaGrid.appendChild(fragment);

			if (vanillaPickerStatus) {
				const done = Math.min(i, pageItems.length);
				if (done >= pageItems.length) {
					vanillaPickerStatus.textContent = `Showing ${pageItems.length} of ${total} textures`;
				} else {
					vanillaPickerStatus.textContent = `Loading ${done}/${pageItems.length}...`;
				}
			}

			if (i < pageItems.length) {
				schedule(renderChunk);
			}
		};

		renderChunk();
	}

	if (actionVanillaPicker) {
		actionVanillaPicker.addEventListener('click', async () => {
			const cell = currentDetailCell;
			if (!vanillaPaths.length) {
				if (Array.isArray(window.__vanillaPaths) && window.__vanillaPaths.length) {
					vanillaPaths = updateVanillaPathState(window.__vanillaPaths);
				} else {
					vanillaPaths = await fetchVanillaList(false);
				}
				populateCategories();
			}
			if (currentDetailCell !== cell || !cell || !cell.isConnected) return;
			if (!vanillaPaths.length) {
				showToast('Vanilla textures are unavailable.', 'error');
				return;
			}
			vanillaPage = 1;
			renderVanillaGrid(vanillaSearchInput ? vanillaSearchInput.value : '');
			if (vanillaPickerStatus) vanillaPickerStatus.textContent = 'Click a texture to apply it.';
			if (vanillaPickerModal) vanillaPickerModal.show();
		});
	}

	if (vanillaSearchInput) {
		let searchDebounce = null;
		vanillaSearchInput.addEventListener('input', () => {
			const val = vanillaSearchInput.value || '';
			if (searchDebounce) clearTimeout(searchDebounce);
			searchDebounce = setTimeout(() => {
				vanillaPage = 1;
				renderVanillaGrid(val);
			}, 200);
		});
	}

	if (vanillaCategorySelect) {
		vanillaCategorySelect.addEventListener('change', () => {
			const val = vanillaSearchInput ? vanillaSearchInput.value : '';
			vanillaPage = 1;
			renderVanillaGrid(val);
		});
	}

	if (vanillaPageSizeMenu && vanillaPageSizeBtn) {
		vanillaPageSizeMenu.querySelectorAll('[data-size]').forEach(item => {
			item.addEventListener('click', (e) => {
				const val = e.currentTarget.getAttribute('data-size') || '36';
				vanillaPageSizeValue = val;
				const labelEl = vanillaPageSizeBtn.querySelector('.vanilla-page-size-label');
				if (labelEl) labelEl.textContent = val === 'all' ? 'Show all' : val;
				vanillaPage = 1;
				const searchVal = vanillaSearchInput ? vanillaSearchInput.value : '';
				renderVanillaGrid(searchVal);
			});
		});
	}

	if (vanillaPrevPage && vanillaNextPage) {
		vanillaPrevPage.addEventListener('click', () => {
			if (vanillaPage > 1) {
				vanillaPage--;
				const searchVal = vanillaSearchInput ? vanillaSearchInput.value : '';
				renderVanillaGrid(searchVal);
			}
		});
		vanillaNextPage.addEventListener('click', () => {
			const pageSize = (vanillaPageSizeValue === 'all')
				? (vanillaFiltered.length || 1)
				: (Number.parseInt(vanillaPageSizeValue || '36', 10) || 36);
			const totalPages = Math.max(1, Math.ceil((vanillaFiltered.length || 0) / pageSize));
			if (vanillaPage < totalPages) {
				vanillaPage++;
				const searchVal = vanillaSearchInput ? vanillaSearchInput.value : '';
				renderVanillaGrid(searchVal);
			}
		});
	}

	if (actionUploadPng && detailReplaceInput) {
		actionUploadPng.addEventListener('click', () => {
			detailReplaceInput.value = '';
			detailReplaceInput.click();
		});

		detailReplaceInput.onchange = async (event) => {
			const file = event.target.files && event.target.files[0];
			if (!file) return;
			const cell = currentDetailCell;
			const requestId = ++detailRequestId;

			try {
				const image = await loadPngFile(file);
				await replaceDetailGlyph(image, cell, requestId);
			} catch (error) {
				if (requestId !== detailRequestId) return;
				alert(error instanceof Error ? error.message : 'Unable to load the PNG image.');
			}
		};
	}
});
