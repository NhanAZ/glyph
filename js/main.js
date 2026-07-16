if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeGlyph, { once: true });
} else {
	initializeGlyph();
}

let glyphInputRequestId = 0;

function loadPreset(assetKey, hex, cacheKey, labelText, options = {}) {
	const source = DEFAULT_GLYPHS[assetKey];
	if (!source || !isValidGlyphPrefix(hex)) return false;

	const {
		hideHint = true,
		updateUploadLabel = true,
		showErrorToast = true,
		isCurrent = () => true,
		onError = null
	} = options;

	clearTimeout(updateTimer);
	const image = new Image();
	image.crossOrigin = 'anonymous';
	image.onload = () => {
		if (!isCurrent()) return;

		if (!processGlyph(image, hex, { cacheKey, label: labelText, atlasUrl: source })) {
			if (showErrorToast) showToast('Unable to process the preset image.', 'error');
			if (onError) onError();
			return;
		}

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
		if (!isCurrent()) return;
		if (showErrorToast) showToast('Unable to load the preset image.', 'error');
		if (onError) onError();
	};
	image.src = source;
	return true;
}

const glyphInputElement = getElement('glyph-input');
listen(glyphInputElement, 'input', function () {
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
		label.textContent = 'Upload glyph_XX.png';
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
				renderGlyphs();
				if (hintMsg && hintHex) {
					hintHex.textContent = glyphInput;
					hintMsg.classList.remove('d-none');
				}
			}
		});

		if (!isDefaultAtlas || !loadDefaultAtlas()) {
			Glyph(glyphInput);
			renderGlyphs();
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

listen(getElement('glyphUpload'), 'change', async function () {
	const file = this.files && this.files[0];
	if (!file) return;

	const hexValue = getGlyphPrefixFromFileName(file.name);
	if (!hexValue) {
		alert('Invalid file name. Use glyph_<HEX>.png with a prefix from 0 to 10FF.');
		this.value = '';
		return;
	}

	const label = getElement('uploadLabel');

	try {
		const image = await loadPngFile(file, {
			minWidth: GRID,
			minHeight: GRID,
			requireSquare: true,
			dimensionMultiple: GRID
		});
		clearTimeout(updateTimer);
		if (!processGlyph(image, hexValue, { label: file.name })) {
			throw new Error('The atlas could not be processed.');
		}

		if (glyphInputElement) glyphInputElement.value = hexValue;
		if (label) {
			label.textContent = file.name;
			label.className = 'text-primary fw-bold upload-label-text';
		}

		const hintMsg = getElement('defaultImageHint');
		if (hintMsg) hintMsg.classList.add('d-none');
		showToast('Grid updated', 'success', 2000);
	} catch (error) {
		this.value = '';
		if (label) {
			label.textContent = 'Upload glyph_XX.png';
			label.className = 'text-secondary upload-label-text';
		}
		alert(error instanceof Error ? error.message : 'Unable to load the PNG atlas.');
	}
});

window.addEventListener('scroll', function () {
	hideZoomWindow();
	if (zoomWindow) {
		zoomWindow.style.bottom = '20px';
	}
});

document.addEventListener('DOMContentLoaded', () => {
	const mobileAlert = getElement('mobileAlert');
	const glyphGrid = getElement('glyph-output');
	const gridModeToggle = getElement('gridModeToggle');
	const gridToggleLabel = gridModeToggle ? gridModeToggle.querySelector('.grid-toggle-label') : null;
	let gridMode = 'adaptive';
	let mobileAlertTimer = null;

	function applyGridMode(mode) {
		if (!glyphGrid) return;
		if (mode === 'fixed') {
			glyphGrid.style.setProperty('--glyph-columns', 16);
			if (gridToggleLabel) gridToggleLabel.textContent = '16x16 view';
		} else {
			glyphGrid.style.removeProperty('--glyph-columns');
			if (gridToggleLabel) gridToggleLabel.textContent = 'Adaptive grid';
		}
	}

	function checkScreenSize() {
		if (!mobileAlert) return;
		if (window.innerWidth < 768) {
			mobileAlert.style.display = 'block';
			if (mobileAlertTimer) clearTimeout(mobileAlertTimer);
			mobileAlertTimer = setTimeout(() => {
				if (window.bootstrap && window.bootstrap.Alert) {
					const alertInstance = window.bootstrap.Alert.getOrCreateInstance(mobileAlert);
					alertInstance.close();
				} else {
					mobileAlert.style.display = 'none';
				}
			}, 5000);
		} else {
			mobileAlert.style.display = 'none';
		}
	}

	checkScreenSize();
	window.addEventListener('resize', checkScreenSize);
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
	const detailCharFallback = getElement('glyphDetailChar');
	const detailHex = getElement('glyphDetailHex');
	const detailDec = getElement('glyphDetailDec');
	const detailPos = getElement('glyphDetailPos');
	const detailCharText = getElement('glyphDetailCharText');
	const detailDim = getElement('glyphDetailDim');
	const detailUnicode = getElement('glyphDetailUnicode');
	const detailNotice = getElement('glyphDetailNotice');
	const detailPreview = document.querySelector('.detail-preview');
	const detailCopyBtn = getElement('glyphDetailCopyBtn');
	const detailDownloadBtn = getElement('glyphDetailDownloadBtn');
	const detailClearBtn = getElement('glyphDetailClearBtn');
	const detailReplaceInput = getElement('glyphDetailReplaceInput');
	const actionUploadPng = getElement('actionUploadPng');
	const actionVanillaPicker = getElement('actionVanillaPicker');
	const beforeAfterWrap = getElement('glyphBeforeAfter');
	const vanillaStatus = getElement('vanillaStatus');
	const vanillaOpenPickerBtn = actionVanillaPicker;
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
	let replacePending = null;
	let currentDetailCell = null;
	let detailNoticeTimer = null;
	const vanillaCacheTtl = 24 * 60 * 60 * 1000;

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

	function ensureDrawerPrompt() {
		let overlay = getElement('drawerRedirectPrompt');
		if (!overlay) {
			overlay = document.createElement('div');
			overlay.id = 'drawerRedirectPrompt';
			overlay.className = 'drawer-redirect-overlay';

			const card = document.createElement('div');
			card.className = 'drawer-redirect-card';
			
			const title = document.createElement('h5');
			title.className = 'mb-3 fw-bold text-center';
			title.textContent = 'Choose a Drawing Tool';
			
			const description = document.createElement('p');
			description.className = 'mb-4 text-secondary text-center';
			description.textContent = 'Where would you like to draw this glyph?';
			
			const actions = document.createElement('div');
			actions.className = 'd-flex flex-column gap-2 mb-3';
			
			const webDrawerBtn = document.createElement('button');
			webDrawerBtn.type = 'button';
			webDrawerBtn.className = 'btn btn-outline-primary w-100 py-2';
			webDrawerBtn.textContent = 'Web Glyph Drawer (Experiment)';
			
			const asepriteBtn = document.createElement('button');
			asepriteBtn.type = 'button';
			asepriteBtn.className = 'btn btn-primary w-100 py-2';
			asepriteBtn.textContent = 'Aseprite (Recommend)';
			
			const jokeText = document.createElement('small');
			jokeText.className = 'text-muted text-center d-block mb-3 mt-1';
			jokeText.style.fontSize = '0.75rem';
			jokeText.style.fontStyle = 'italic';
			jokeText.innerHTML = '(Dear Aseprite team, I am a huge fan! If you happen to see this little shoutout, a Pro license would be a dream come true for me at <a href="mailto:itsnhanaz@gmail.com" class="text-muted text-decoration-none">itsnhanaz@gmail.com</a>. Thank you so much!)';

			const cancelButton = document.createElement('button');
			cancelButton.type = 'button';
			cancelButton.className = 'btn btn-outline-secondary w-100 py-2 drawer-cancel mt-2';
			cancelButton.textContent = 'Cancel';

			actions.append(asepriteBtn, webDrawerBtn);
			card.append(title, description, actions, jokeText, cancelButton);
			overlay.appendChild(card);
			document.body.appendChild(overlay);

			cancelButton.addEventListener('click', () => overlay.classList.remove('visible'));
			webDrawerBtn.addEventListener('click', () => {
				window.open('https://nhanaz-web.github.io/glyph-drawer/', '_blank', 'noopener');
				overlay.classList.remove('visible');
			});
			asepriteBtn.addEventListener('click', () => {
				window.open('https://www.aseprite.org/', '_blank', 'noopener');
				overlay.classList.remove('visible');
			});
			overlay.addEventListener('click', (e) => {
				if (e.target === overlay) overlay.classList.remove('visible');
			});
		}
		requestAnimationFrame(() => {
			overlay.classList.add('visible');
		});
	}

	async function showGlyphDetail(cell) {
		if (!cell || !detailModal) return;
		currentDetailCell = cell;
		replacePending = null;
		if (beforeAfterWrap) beforeAfterWrap.classList.add('d-none');
		if (detailImg) detailImg.classList.remove('d-none');
		if (detailCharFallback) detailCharFallback.classList.add('d-none');
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
		if (currentDetailCell !== cell) return;

		if (resolvedImageUrl) {
			if (detailPreview && isTransparentCell) detailPreview.classList.add('transparent-state');
			glyphDownloadUrl = resolvedImageUrl;
			if (detailImg && detailImg.src !== resolvedImageUrl) detailImg.src = resolvedImageUrl;
			if (detailImg) detailImg.classList.remove('d-none');
			if (detailCharFallback) detailCharFallback.classList.add('d-none');
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
			if (detailCharFallback) detailCharFallback.classList.add('d-none');
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

		if (detailCopyBtn) {
			detailCopyBtn.disabled = false;
			setButtonContent(detailCopyBtn, 'Draw');
			detailCopyBtn.onclick = () => {
				ensureDrawerPrompt();
			};
		}

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
			detailClearBtn.onclick = () => {
				cell.classList.add('transparent');
				delete cell.dataset.originalBg;
				delete cell.dataset.displayBg;
				delete cell.dataset.pendingTintTheme;
				delete cell.dataset.tintTheme;

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
				if (detailCharFallback) {
					detailCharFallback.classList.add('d-none');
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

				clearAtlasTile(cell).then((atlasUrl) => {
					if (atlasUrl) updateGlyphCellsAtlas(atlasUrl);
				});
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
		const glyphInput = getElement('glyph-input');
		return getGlyphPrefix(glyphInput ? glyphInput.value : '', 'E0');
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

	function queueReplaceCandidate(imgObj) {
		replacePending = { img: imgObj };
		applyPendingReplace();
	}

	function applyPendingReplace() {
		if (!replacePending || !currentDetailCell) return;
		const { img } = replacePending;
		const cell = currentDetailCell;
		const hex = cell.getAttribute('data-hex') || '';
		replaceAtlasTile(cell, img).then((result) => {
			const tileUrl = result && result.tileUrl;
			const tileW = result && result.tileW;
			const tileH = result && result.tileH;
			if (tileUrl) {
				if (result.atlasUrl) updateGlyphCellsAtlas(result.atlasUrl);
				cell.classList.remove('transparent');
				delete cell.dataset.originalBg;
				delete cell.dataset.displayBg;
				delete cell.dataset.pendingTintTheme;
				delete cell.dataset.tintTheme;
				if (detailPreview) detailPreview.classList.remove('transparent-state');
				if (tileW) cell.setAttribute('data-width', tileW);
				if (tileH) cell.setAttribute('data-height', tileH);
				if (detailImg) {
					detailImg.src = tileUrl;
					detailImg.classList.remove('d-none');
				}
				if (detailCharFallback) detailCharFallback.classList.add('d-none');
				if (detailDim) {
					detailDim.textContent = tileW && tileH
						? `${tileW}px x ${tileH}px`
						: detailDim.textContent;
				}
				if (detailDownloadBtn) {
					const fileName = `glyph_${hex.replace(/^0x/i, '').toLowerCase() || 'char'}.png`;
					detailDownloadBtn.disabled = false;
					detailDownloadBtn.onclick = () => {
						downloadUrl(tileUrl, fileName);
					};
				}
				showToast('Glyph replaced');
			} else {
				showToast('Load an atlas before replacing a glyph.', 'error');
			}
			replacePending = null;
			if (beforeAfterWrap) beforeAfterWrap.classList.add('d-none');
			if (detailImg) detailImg.classList.remove('d-none');
		});
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
					const previewSrc = img.src;
					const previewImg = new Image();
					previewImg.crossOrigin = 'anonymous';
					previewImg.onload = function () {
						queueReplaceCandidate(previewImg);
						if (vanillaPickerModal) vanillaPickerModal.hide();
					};
					previewImg.onerror = function () {
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

	if (vanillaOpenPickerBtn) {
		vanillaOpenPickerBtn.addEventListener('click', async () => {
			if (!vanillaPaths.length) {
				if (Array.isArray(window.__vanillaPaths) && window.__vanillaPaths.length) {
					vanillaPaths = updateVanillaPathState(window.__vanillaPaths);
				} else {
					vanillaPaths = await fetchVanillaList(false);
				}
				populateCategories();
			}
			if (!vanillaPaths.length) {
				showToast('Vanilla textures are unavailable.', 'error');
				return;
			}
			vanillaPage = 1;
			renderVanillaGrid('');
			if (vanillaPickerStatus) vanillaPickerStatus.textContent = 'Click a texture to apply it.';
			if (vanillaPickerModal) vanillaPickerModal.show();
		});
	}

	if (vanillaSearchInput) {
		let searchDebounce = null;
		vanillaSearchInput.addEventListener('input', () => {
			const val = vanillaSearchInput.value || '';
			if (searchDebounce) clearTimeout(searchDebounce);
			searchDebounce = setTimeout(() => renderVanillaGrid(val), 200);
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

			try {
				const image = await loadPngFile(file);
				queueReplaceCandidate(image);
			} catch (error) {
				alert(error instanceof Error ? error.message : 'Unable to load the PNG image.');
			}
		};
	}
});
