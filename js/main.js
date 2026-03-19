// Event listeners
window.onload = () => {
	initializeGlyph();
};

document.getElementById('glyph-input').addEventListener('input', function () {
	let glyphInput = this.value.trim().toUpperCase();
	const glyphSuccessMsg = document.getElementById('glyphSuccessMsg');
	const glyphErrorMsg = document.getElementById('glyphErrorMsg');
	const validationMsg = document.getElementById('inputValidation');
	const hintMsg = document.getElementById('defaultImageHint');
	const hintHex = document.getElementById('hintHex');

	// Clear upload input when hex changes manually
	document.getElementById('glyphUpload').value = '';
	const label = document.getElementById('uploadLabel');
	if (label) {
		label.textContent = "Upload glyph_XX.png";
		label.className = "text-secondary";
	}

	if (glyphInput === '') {
		glyphInput = 'E0';
	}

	if (/^[A-F0-9]{1,4}$/.test(glyphInput)) {
		Glyph(glyphInput);
		glyphSuccessMsg.textContent = 'Glyph generated successfully!';
		glyphSuccessMsg.classList.remove('d-none');
		glyphErrorMsg.classList.add('d-none');
		if (validationMsg) validationMsg.classList.add('d-none');
		this.classList.remove('is-invalid');
		renderGlyphs();

		// Detect E0 or E1 to offer default image load
		if ((glyphInput === "E0" || glyphInput === "E1") && hintMsg && hintHex) {
			hintHex.textContent = glyphInput;
			hintMsg.classList.remove('d-none');
		} else if (hintMsg) {
			hintMsg.classList.add('d-none');
		}
	} else {
		glyphErrorMsg.textContent = 'Please enter a valid hex value.';
		glyphErrorMsg.classList.remove('d-none');
		glyphSuccessMsg.classList.add('d-none');
		if (validationMsg) validationMsg.classList.remove('d-none');
		this.classList.add('is-invalid');
		if (hintMsg) hintMsg.classList.add('d-none');
	}
});



document.getElementById('copyButton').addEventListener('click', copyOutput);
document.getElementById('converterInput').addEventListener('input', convert);

// Optional: auto copy when clicking the output text box directly (low friction)
document.getElementById('converterOutput').addEventListener('click', copyOutput);

document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

document.getElementById('glyphUpload').addEventListener('change', function (e) {
	const file = e.target.files[0];
	if (!file) return;

	const fileNameRegex = /^glyph_([0-9A-F]{2})\.png$/i;
	const match = file.name.match(fileNameRegex);
	if (!match) {
		alert('Invalid file name. Please use the format glyph_XX.png where XX is a hex value from 00 to FF.');
		this.value = '';
		return;
	}

	const hexValue = match[1].toUpperCase();
	const label = document.getElementById('uploadLabel');
	if (label) {
		label.textContent = file.name;
		label.className = "text-primary fw-bold";
	}

	const reader = new FileReader();
	reader.onload = function (event) {
		const img = new Image();
		img.onload = function () {
			if (typeof updateTimer !== 'undefined') clearTimeout(updateTimer);
			processGlyph(img, hexValue, { label: file.name });
			
			const hintMsg = document.getElementById('defaultImageHint');
			if (hintMsg) hintMsg.classList.add('d-none');
			
			// Show success tooltip
			const tooltip = document.querySelector('.smart-tooltip');
			if (tooltip) {
				tooltip.innerHTML = "Grid Updated!";
				tooltip.classList.add('success', 'visible');
				tooltip.style.left = "50%";
				tooltip.style.top = "50px";
				tooltip.style.position = "fixed";
				
				setTimeout(() => {
					tooltip.classList.remove('success', 'visible');
					tooltip.style.position = "absolute";
				}, 2000);
			}
		};
		img.src = event.target.result;
	};
	reader.readAsDataURL(file);
});

window.addEventListener('scroll', function () {
	hideZoomWindow();
	if (zoomWindow) {
		zoomWindow.style.bottom = '20px';
	}
});

// Smart Tooltip & Copy Logic
document.addEventListener('DOMContentLoaded', () => {
	const mobileAlert = document.getElementById('mobileAlert');
	const glyphGrid = document.getElementById('glyph-output');
	const gridModeToggle = document.getElementById('gridModeToggle');
	const gridToggleLabel = gridModeToggle ? gridModeToggle.querySelector('.grid-toggle-label') : null;
	const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
	let gridMode = 'adaptive';
	let mobileAlertTimer = null;
	const themeVar = (name, fallback) => {
		const val = getComputedStyle(document.body).getPropertyValue(name);
		return val && val.trim() ? val.trim() : fallback;
	};

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
		if (window.innerWidth < 768) {
			mobileAlert.style.display = 'block';
			if (mobileAlertTimer) clearTimeout(mobileAlertTimer);
			mobileAlertTimer = setTimeout(() => {
				if (window.bootstrap && bootstrap.Alert) {
					const alertInstance = bootstrap.Alert.getOrCreateInstance(mobileAlert);
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

	// Minimal tooltip container (used only for action confirmations)
	let smartTooltip = document.querySelector('.smart-tooltip');
	if (!smartTooltip) {
		smartTooltip = document.createElement('div');
		smartTooltip.className = 'smart-tooltip';
		document.body.appendChild(smartTooltip);
	}

	if (gridModeToggle && glyphGrid) {
		gridModeToggle.addEventListener('click', () => {
			gridMode = gridMode === 'adaptive' ? 'fixed' : 'adaptive';
			gridModeToggle.classList.toggle('active', gridMode === 'fixed');
			applyGridMode(gridMode);
		});
	}

	// Glyph detail modal (click to inspect + copy)
	const detailModalEl = document.getElementById('glyphDetailModal');
	const detailModal = detailModalEl ? new bootstrap.Modal(detailModalEl) : null;
	const detailImg = document.getElementById('glyphDetailImage');
	const detailCharFallback = document.getElementById('glyphDetailChar');
	const detailHex = document.getElementById('glyphDetailHex');
	const detailDec = document.getElementById('glyphDetailDec');
	const detailPos = document.getElementById('glyphDetailPos');
	const detailCharText = document.getElementById('glyphDetailCharText');
	const detailDim = document.getElementById('glyphDetailDim');
	const detailCopyBtn = document.getElementById('glyphDetailCopyBtn');
	const detailDownloadBtn = document.getElementById('glyphDetailDownloadBtn');
	const detailClearBtn = document.getElementById('glyphDetailClearBtn');
	const detailReplaceInput = document.getElementById('glyphDetailReplaceInput');
	const actionUploadPng = document.getElementById('actionUploadPng');
	const actionVanillaPicker = document.getElementById('actionVanillaPicker');
	const beforeAfterWrap = document.getElementById('glyphBeforeAfter');
	const beforeImg = document.getElementById('glyphBeforeImg');
	const afterImg = document.getElementById('glyphAfterImg');
	const vanillaStatus = document.getElementById('vanillaStatus');
	const vanillaOpenPickerBtn = actionVanillaPicker;
	const vanillaPickerStatus = document.getElementById('vanillaPickerStatus');
	const vanillaGrid = document.getElementById('vanillaGrid');
	const vanillaPickerModalEl = document.getElementById('vanillaPickerModal');
	const vanillaPickerModal = vanillaPickerModalEl ? new bootstrap.Modal(vanillaPickerModalEl) : null;
	const vanillaSearchInput = document.getElementById('vanillaSearchInput');
	const vanillaCategorySelect = document.getElementById('vanillaCategorySelect');
	const vanillaPageSizeSelect = document.getElementById('vanillaPageSize');
	const vanillaPrevPage = document.getElementById('vanillaPrevPage');
	const vanillaNextPage = document.getElementById('vanillaNextPage');
	const vanillaPageInfo = document.getElementById('vanillaPageInfo');
	let vanillaPaths = [];
	let vanillaCategories = ['all'];
	let vanillaFiltered = [];
	let vanillaPage = 1;
	let vanillaPageSize = 200;
	let clearConfirmTimer = null;
	let replacePending = null;
	let currentDetailCell = null;

	function showToast(message, variant = 'success', duration = 1500) {
		if (!smartTooltip) return;
		smartTooltip.innerHTML = message;
		smartTooltip.classList.toggle('success', variant === 'success');
		smartTooltip.classList.add('visible');
		smartTooltip.style.left = "50%";
		smartTooltip.style.top = "50px";
		smartTooltip.style.position = "fixed";
		setTimeout(() => {
			smartTooltip.classList.remove('visible', 'success');
			smartTooltip.style.position = "absolute";
		}, duration);
	}

	function resetReplaceButton() {}

	function showGlyphDetail(cell) {
		if (!cell || !detailModal) return;
		currentDetailCell = cell;
		replacePending = null;
		if (beforeAfterWrap) beforeAfterWrap.classList.add('d-none');
		if (detailImg) detailImg.classList.remove('d-none');
		if (detailCharFallback) detailCharFallback.classList.add('d-none');
		if (vanillaStatus) vanillaStatus.textContent = '';

		const hex = cell.getAttribute('data-hex') || '';
		const pos = cell.getAttribute('data-position') || '';
		const char = cell.getAttribute('data-char') || '';
		const codePoint = char.codePointAt(0);
		const decVal = typeof codePoint === 'number' ? codePoint.toString(10) : '';
		const bg = cell.style.backgroundImage;
		const widthAttr = cell.getAttribute('data-width');
		const heightAttr = cell.getAttribute('data-height');
		let dimText = '';
		let downloadUrl = '';
		let currentPreviewUrl = '';

		if (bg) {
			const url = bg.slice(5, -2);
			downloadUrl = url;
			currentPreviewUrl = url;
			detailImg.src = url;
			detailImg.classList.remove('d-none');
			detailCharFallback.classList.add('d-none');
			// If dimensions exist as attributes, use them; otherwise try to read image natural size later
			if (widthAttr && heightAttr) {
				dimText = `${widthAttr}px x ${heightAttr}px`;
			} else {
				const probe = new Image();
				probe.onload = function () {
					dimText = `${probe.naturalWidth}px x ${probe.naturalHeight}px`;
					if (detailDim) detailDim.textContent = dimText;
				};
				probe.src = url;
			}
		} else {
			// Generate a simple preview image from the character itself
			const canvas = document.createElement('canvas');
			canvas.width = 220;
			canvas.height = 220;
			const ctx = canvas.getContext('2d');
			ctx.fillStyle = themeVar('--bg-card', '#f5f5f7');
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = themeVar('--text-primary', '#000');
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.font = 'bold 120px "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
			ctx.fillText(char || '?', canvas.width / 2, canvas.height / 2 + 8);
			downloadUrl = canvas.toDataURL('image/png');
			currentPreviewUrl = downloadUrl;
			dimText = `${canvas.width}px x ${canvas.height}px`;

			detailImg.src = downloadUrl;
			detailImg.classList.remove('d-none');
			detailCharFallback.classList.add('d-none');
			detailCharFallback.textContent = char || '?';
		}

		detailHex.textContent = hex;
		detailDec.textContent = decVal;
		detailPos.textContent = pos;
			detailCharText.textContent = char;
		if (detailDim) {
			detailDim.textContent = dimText || '-';
		}

		if (detailCopyBtn) {
			detailCopyBtn.disabled = !char;
			detailCopyBtn.innerHTML = '<i class="far fa-copy me-1"></i> Copy glyph';
			detailCopyBtn.onclick = () => {
				if (!char) return;
				navigator.clipboard.writeText(char).then(() => {
					showToast('Copied glyph');
				});
			};
		}

		if (detailDownloadBtn) {
			detailDownloadBtn.disabled = !downloadUrl;
			detailDownloadBtn.setAttribute('title', 'Download glyph');
			const fileName = `glyph_${hex.replace(/^0x/i, '').toLowerCase() || 'char'}.png`;
			detailDownloadBtn.onclick = () => {
				if (!downloadUrl) return;
				const a = document.createElement('a');
				a.href = downloadUrl;
				a.download = fileName;
				a.click();
			};
		}

		if (detailClearBtn) {
			detailClearBtn.disabled = false;
			detailClearBtn.innerHTML = '<i class="fas fa-eraser me-1"></i> Clear to transparent';
			detailClearBtn.onclick = () => {
				// perform clear immediately
				cell.style.backgroundImage = '';
				cell.style.backgroundSize = '';
				cell.classList.add('transparent');
				// keep width/height attributes so we can map back to atlas
				// update modal view
				const bglessCanvas = document.createElement('canvas');
				bglessCanvas.width = 220;
				bglessCanvas.height = 220;
				const ctx = bglessCanvas.getContext('2d');
				ctx.fillStyle = themeVar('--bg-card', '#f5f5f7');
				ctx.fillRect(0, 0, bglessCanvas.width, bglessCanvas.height);
				ctx.fillStyle = themeVar('--text-secondary', '#555');
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.font = 'bold 120px "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
				ctx.fillText(char || '?', bglessCanvas.width / 2, bglessCanvas.height / 2 + 8);
				const clearedUrl = bglessCanvas.toDataURL('image/png');
				if (detailImg) {
					detailImg.src = clearedUrl;
					detailImg.classList.remove('d-none');
				}
				if (detailCharFallback) {
					detailCharFallback.classList.add('d-none');
				}
				if (detailDim) detailDim.textContent = `${bglessCanvas.width}px x ${bglessCanvas.height}px`;
				if (detailDownloadBtn) {
					detailDownloadBtn.disabled = false;
					detailDownloadBtn.onclick = () => {
						const a = document.createElement('a');
						a.href = clearedUrl;
						a.download = `glyph_${hex.replace(/^0x/i, '').toLowerCase() || 'char'}.png`;
						a.click();
					};
				}
				showToast('Cleared to transparent');

				// update atlas source (if any) to keep Download Atlas in sync
				if (typeof clearAtlasTile === 'function') {
					clearAtlasTile(cell).then(() => {});
				}
			};
		}

		detailModal.show();
	}

	if (glyphGrid) {
		glyphGrid.addEventListener('click', (e) => {
			const cell = e.target.closest('#glyph-output div[data-hex]');
			if (cell) {
				e.preventDefault();
				showGlyphDetail(cell);
			}
		});
	}

	// Hint click logic
	const hintMsg = document.getElementById('defaultImageHint');
	if (hintMsg) {
		hintMsg.addEventListener('click', () => {
			const hex = document.getElementById('hintHex').textContent;
			
			if (typeof DEFAULT_GLYPHS !== 'undefined' && DEFAULT_GLYPHS[hex]) {
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.onload = function() {
					processGlyph(img, hex, { cacheKey: `${hex}_DEFAULT`, label: `glyph_${hex}.png` });
					hintMsg.classList.add('d-none');
				};
				img.src = DEFAULT_GLYPHS[hex];
			} else {
				// Fallback mechanism
				Glyph(hex);
				hintMsg.classList.add('d-none');
			}
		});
	}

	// Quick Load Template & Example logic
	const btnLoadTemplate = document.getElementById('btnLoadTemplate');
	if (btnLoadTemplate) {
		btnLoadTemplate.addEventListener('click', () => {
			const glyphInput = document.getElementById('glyph-input');
			const current = glyphInput ? glyphInput.value.trim().toUpperCase() : "";
			const hex = /^[A-F0-9]{1,4}$/.test(current) ? current : "E0";
			
			if (typeof DEFAULT_GLYPHS !== 'undefined' && DEFAULT_GLYPHS['TEMPLATE']) {
				if (typeof updateTimer !== 'undefined') clearTimeout(updateTimer);
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.onload = function() {
					processGlyph(img, hex, { cacheKey: 'TEMPLATE', label: 'glyph_grid.png' });
					
					if (hintMsg) hintMsg.classList.add('d-none');
					const label = document.getElementById('uploadLabel');
					if (label) {
						label.textContent = "Loaded: glyph_grid.png";
						label.className = "text-primary fw-bold";
					}
				};
				img.src = DEFAULT_GLYPHS['TEMPLATE'];
			}
		});
	}

	const btnLoadExample = document.getElementById('btnLoadExample');
	if (btnLoadExample) {
		btnLoadExample.addEventListener('click', () => {
			const hex = "E1"; 
			
			if (typeof DEFAULT_GLYPHS !== 'undefined' && DEFAULT_GLYPHS['E1_MOD']) {
				if (typeof updateTimer !== 'undefined') clearTimeout(updateTimer);
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.onload = function() {
					processGlyph(img, hex, { cacheKey: 'E1_MOD', label: 'glyph_E1_modified.png' });
					
					if (hintMsg) hintMsg.classList.add('d-none');
					const label = document.getElementById('uploadLabel');
					if (label) {
						label.textContent = "Loaded: glyph_E1_modified.png";
						label.className = "text-primary fw-bold";
					}
				};
				img.src = DEFAULT_GLYPHS['E1_MOD'];
			}
		});
	}

	const btnLoadEmpty = document.getElementById('btnLoadEmpty');
	if (btnLoadEmpty) {
		btnLoadEmpty.addEventListener('click', () => {
			const glyphInput = document.getElementById('glyph-input');
			const current = glyphInput ? glyphInput.value.trim().toUpperCase() : "E0";
			const hex = /^[A-F0-9]{1,4}$/.test(current) ? current : "E0";

			if (typeof DEFAULT_GLYPHS !== 'undefined' && DEFAULT_GLYPHS['EMPTY']) {
				if (typeof updateTimer !== 'undefined') clearTimeout(updateTimer);
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.onload = function() {
					processGlyph(img, hex, { cacheKey: 'EMPTY', label: 'glyph_empty.png' });
					const hintMsg = document.getElementById('defaultImageHint');
					if (hintMsg) hintMsg.classList.add('d-none');
					const label = document.getElementById('uploadLabel');
					if (label) {
						label.textContent = "Loaded: glyph_empty.png";
						label.className = "text-primary fw-bold";
					}
				};
				img.src = DEFAULT_GLYPHS['EMPTY'];
			}
		});
	}

	// Smart Export Logic
	const btnCopyAll = document.getElementById('btnCopyAll');
	if (btnCopyAll) {
		btnCopyAll.addEventListener('click', () => {
			const cells = document.querySelectorAll('#glyph-output div[data-char]');
			const tooltip = document.querySelector('.smart-tooltip');
			let result = '';
			let row = '';
			cells.forEach((cell, index) => {
				row += cell.getAttribute('data-char');
				if ((index + 1) % 16 === 0) {
					result += row + '\n';
					row = '';
				}
			});

			navigator.clipboard.writeText(result.trim()).then(() => {
				if (tooltip) {
					tooltip.innerHTML = "Copied 256 Glyphs!";
					tooltip.classList.add('success', 'visible');
					tooltip.style.left = "50%";
					tooltip.style.top = "50px";
					tooltip.style.position = "fixed";
					
					setTimeout(() => {
						tooltip.classList.remove('success', 'visible');
						tooltip.style.position = "absolute";
					}, 2000);
				}
			});
	});
}

	const btnDownloadAtlas = document.getElementById('btnDownloadAtlas');
	if (btnDownloadAtlas) {
		btnDownloadAtlas.addEventListener('click', () => {
			if (typeof currentAtlasDataUrl !== 'undefined' && currentAtlasDataUrl) {
				const glyphInput = document.getElementById('glyph-input');
				const startHex = (glyphInput && glyphInput.value.trim()) ? glyphInput.value.trim().toUpperCase() : "E0";
				const fileName = `glyph_${startHex.toLowerCase()}.png`;
				const a = document.createElement('a');
				a.href = currentAtlasDataUrl;
				a.download = fileName;
				a.click();
				if (smartTooltip) {
					smartTooltip.innerHTML = "Atlas downloaded!";
					smartTooltip.classList.add('success', 'visible');
					smartTooltip.style.left = "50%";
					smartTooltip.style.top = "50px";
					smartTooltip.style.position = "fixed";
					setTimeout(() => {
						smartTooltip.classList.remove('success', 'visible');
						smartTooltip.style.position = "absolute";
					}, 1500);
				}
			} else if (smartTooltip) {
				smartTooltip.innerHTML = "No atlas image loaded";
				smartTooltip.classList.add('visible');
				smartTooltip.style.left = "50%";
				smartTooltip.style.top = "50px";
				smartTooltip.style.position = "fixed";
				setTimeout(() => {
					smartTooltip.classList.remove('visible', 'success');
					smartTooltip.style.position = "absolute";
				}, 1500);
			}
		});
	}

	const btnDownloadJson = document.getElementById('btnDownloadJson');
	if (btnDownloadJson) {
		btnDownloadJson.addEventListener('click', () => {
			const cells = document.querySelectorAll('#glyph-output div[data-char]');
			const glyphInput = document.getElementById('glyph-input');
			const startHex = (glyphInput && glyphInput.value.trim()) ? glyphInput.value.trim().toUpperCase() : "E0";
			
			const rows = [];
			let currentRow = "";
			cells.forEach((cell, index) => {
				currentRow += cell.getAttribute('data-char');
				if ((index + 1) % 16 === 0) {
					rows.push(currentRow);
					currentRow = "";
				}
			});

			const json = {
				"providers": [
					{
						"type": "bitmap",
						"file": `minecraft:font/glyph_${startHex.toLowerCase()}.png`,
						"ascent": 7,
						"chars": rows
					}
				]
			};

			downloadFile(JSON.stringify(json, null, 2), `glyph_${startHex.toLowerCase()}.json`, "application/json");
		});
	}

	const btnCopyReference = document.getElementById('btnCopyReference');
	if (btnCopyReference) {
		btnCopyReference.addEventListener('click', () => {
			const cells = document.querySelectorAll('#glyph-output div[data-char]');
			const tooltip = document.querySelector('.smart-tooltip');
			let result = 'GLYPH REFERENCE MAP\n====================\n';
			
			cells.forEach((cell) => {
				const hex = cell.getAttribute('data-hex');
				const pos = cell.getAttribute('data-position');
				const char = cell.getAttribute('data-char');
				result += `${hex}: ${pos} - ${char}\n`;
			});

			navigator.clipboard.writeText(result.trim()).then(() => {
				if (tooltip) {
					tooltip.innerHTML = "Reference Copied!";
					tooltip.classList.add('success', 'visible');
					tooltip.style.left = "50%";
					tooltip.style.top = "50px";
					tooltip.style.position = "fixed";
					
					setTimeout(() => {
						tooltip.classList.remove('success', 'visible');
						tooltip.style.position = "absolute";
					}, 2000);
				}
			});
		});
	}

	const btnDownloadFullJson = document.getElementById('btnDownloadFullJson');
	if (btnDownloadFullJson) {
		btnDownloadFullJson.addEventListener('click', () => {
			const cells = document.querySelectorAll('#glyph-output div[data-char]');
			const glyphInput = document.getElementById('glyph-input');
			const startHex = (glyphInput && glyphInput.value.trim()) ? glyphInput.value.trim().toUpperCase() : "E0";
			
			const data = Array.from(cells).map(cell => ({
				hex: cell.getAttribute('data-hex'),
				pos: cell.getAttribute('data-position'),
				char: cell.getAttribute('data-char')
			}));

			const json = {
				metadata: {
					generator: "Glyph Tools",
					hex_range: `${startHex}00 - ${startHex}FF`,
					total: data.length
				},
				glyphs: data
			};

			downloadFile(JSON.stringify(json, null, 2), `glyph_${startHex.toLowerCase()}_metadata.json`, "application/json");
		});
	}

	// Vanilla texture helpers
	function setVanillaStatus(text) {
		if (vanillaStatus) vanillaStatus.textContent = text;
	}

	// Vanilla list loader (local manifest only, no remote API). Always refresh manifest on load.
	async function fetchVanillaList() {
		localStorage.removeItem('vanillaTexturesCache'); // force refresh to avoid stale prefixed paths
		setVanillaStatus('Loading vanilla manifest…');
		try {
			const resp = await fetch('vanilla-textures/manifest.json', { cache: 'reload' });
			const data = await resp.json();
			let paths = data.paths || [];
			// Migration: strip resource_pack/textures/ prefix if present in older cache
			paths = paths.map(p => p.startsWith('resource_pack/textures/') ? p.replace('resource_pack/textures/', '') : p);
			window.__vanillaPaths = paths;
			localStorage.setItem('vanillaTexturesCache', JSON.stringify({ timestamp: Date.now(), paths }));
			vanillaCategories = Array.from(new Set(paths.map(p => p.split('/')[0]))).sort();
			setVanillaStatus(`Loaded ${paths.length} textures (local).`);
			return paths;
		} catch (err) {
			setVanillaStatus('Failed to load local manifest.');
			try {
				const raw = localStorage.getItem('vanillaTexturesCache');
				if (raw) {
					const cached = JSON.parse(raw);
					let paths = cached.paths || [];
					paths = paths.map(p => p.startsWith('resource_pack/textures/') ? p.replace('resource_pack/textures/', '') : p);
					window.__vanillaPaths = paths;
					vanillaCategories = Array.from(new Set(paths.map(p => p.split('/')[0]))).sort();
					setVanillaStatus(`Using cached list (${paths.length}).`);
					return paths;
				}
			} catch {}
			return [];
		}
	}

	function queueReplaceCandidate(imgObj, imgSrc, currentPreviewUrl) {
		replacePending = { img: imgObj };
		applyPendingReplace();
	}

	function applyPendingReplace() {
		if (!replacePending || !currentDetailCell) return;
		const { img } = replacePending;
		const cell = currentDetailCell;
		const hex = cell.getAttribute('data-hex') || '';
		if (typeof replaceAtlasTile === 'function') {
			replaceAtlasTile(cell, img).then((res) => {
				const tileUrl = res && res.tileUrl;
				const tileW = res && res.tileW;
				const tileH = res && res.tileH;
				if (tileUrl) {
					cell.style.backgroundImage = `url(${tileUrl})`;
					cell.style.backgroundSize = '100% 100%';
					cell.classList.remove('transparent');
					if (tileW) cell.setAttribute('data-width', tileW);
					if (tileH) cell.setAttribute('data-height', tileH);
					// refresh modal preview
					detailImg.src = tileUrl;
					detailImg.classList.remove('d-none');
					detailCharFallback.classList.add('d-none');
					if (detailDim) detailDim.textContent = tileW && tileH ? `${tileW}px x ${tileH}px` : detailDim.textContent;
					// update download button to new tile
					if (detailDownloadBtn) {
						const fileName = `glyph_${hex.replace(/^0x/i, '').toLowerCase() || 'char'}.png`;
						detailDownloadBtn.disabled = false;
						detailDownloadBtn.onclick = () => {
							const a = document.createElement('a');
							a.href = tileUrl;
							a.download = fileName;
							a.click();
						};
					}
				}
				replacePending = null;
				if (beforeAfterWrap) beforeAfterWrap.classList.add('d-none');
				if (detailImg) detailImg.classList.remove('d-none');
			});
		}
	}

	// Preload vanilla cache on first open (non-blocking)
	fetchVanillaList(false).then(paths => {
		vanillaPaths = paths || [];
		populateCategories();
	});

	// Vanilla picker modal interactions
	function populateCategories() {
		if (!vanillaCategorySelect) return;
		const cats = ['all', ...vanillaCategories];
		vanillaCategorySelect.innerHTML = '';
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

		// pagination
		const total = vanillaFiltered.length;
		let pageSize = vanillaPageSize;
		if (vanillaPageSizeSelect && vanillaPageSizeSelect.value === 'all') {
			pageSize = total || 1;
		}
		const totalPages = Math.max(1, Math.ceil(total / pageSize));
		if (vanillaPage > totalPages) vanillaPage = totalPages;
		const start = (vanillaPage - 1) * pageSize;
		const pageItems = vanillaFiltered.slice(start, start + pageSize);

		vanillaGrid.innerHTML = '';
		if (vanillaPickerStatus) vanillaPickerStatus.textContent = `Showing ${pageItems.length} of ${total} textures`;
		if (vanillaPageInfo) vanillaPageInfo.textContent = `Page ${vanillaPage}/${totalPages}`;

		pageItems.forEach(path => {
			const card = document.createElement('div');
			card.className = 'vanilla-tile';
			card.dataset.path = path;
			const img = document.createElement('img');
			img.loading = 'lazy';
			img.crossOrigin = 'anonymous';
			img.src = `./vanilla-textures/${path}`;
			const label = document.createElement('div');
			label.className = 'vanilla-name';
			label.textContent = path.split('/').slice(-1)[0].replace('.png','');
			card.appendChild(img);
			card.appendChild(label);
			card.addEventListener('click', () => {
				const previewSrc = img.src;
				const previewImg = new Image();
				previewImg.crossOrigin = 'anonymous';
				previewImg.onload = function () {
					queueReplaceCandidate(previewImg, previewSrc, detailImg && detailImg.src);
					if (vanillaPickerModal) vanillaPickerModal.hide();
				};
				previewImg.onerror = function () {
					if (vanillaPickerStatus) vanillaPickerStatus.textContent = 'Failed to load texture.';
				};
				previewImg.src = previewSrc;
			});
			vanillaGrid.appendChild(card);
		});
	}

	if (vanillaOpenPickerBtn) {
		vanillaOpenPickerBtn.addEventListener('click', async () => {
			if (!vanillaPaths || !vanillaPaths.length) {
				const list = await fetchVanillaList(false);
				vanillaPaths = list || [];
				populateCategories();
			}
			vanillaPage = 1;
			renderVanillaGrid('');
			if (vanillaPickerStatus) vanillaPickerStatus.textContent = 'Click a texture to apply immediately.';
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

	if (vanillaPageSizeSelect) {
		vanillaPageSizeSelect.addEventListener('change', () => {
			const val = vanillaPageSizeSelect.value;
			vanillaPageSize = val === 'all' ? Number.MAX_SAFE_INTEGER : parseInt(val, 10) || 200;
			vanillaPage = 1;
			const searchVal = vanillaSearchInput ? vanillaSearchInput.value : '';
			renderVanillaGrid(searchVal);
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
			const pageSize = vanillaPageSizeSelect && vanillaPageSizeSelect.value === 'all'
				? Number.MAX_SAFE_INTEGER
				: (parseInt(vanillaPageSizeSelect?.value || '200', 10) || 200);
			const totalPages = Math.max(1, Math.ceil((vanillaFiltered.length || 0) / pageSize));
			if (vanillaPage < totalPages) {
				vanillaPage++;
				const searchVal = vanillaSearchInput ? vanillaSearchInput.value : '';
				renderVanillaGrid(searchVal);
			}
		});
	}

	// Upload PNG action (from unified dropdown)
	if (actionUploadPng && detailReplaceInput) {
		actionUploadPng.addEventListener('click', () => {
			detailReplaceInput.value = '';
			detailReplaceInput.click();
		});

		detailReplaceInput.onchange = (ev) => {
			const file = ev.target.files && ev.target.files[0];
			if (!file) return;
			if (!file.type || !file.type.includes('png')) {
				alert('Please select a PNG file.');
				return;
			}

			const reader = new FileReader();
			reader.onload = (e) => {
				const newImg = new Image();
				newImg.onload = function () {
					queueReplaceCandidate(newImg, e.target.result, detailImg && detailImg.src);
				};
				newImg.src = e.target.result;
			};
			reader.readAsDataURL(file);
		};
	}
});
