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
			processGlyph(img, hexValue);
			
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
	const detailCopyBtn = document.getElementById('glyphDetailCopyBtn');

	function showGlyphDetail(cell) {
		if (!cell || !detailModal) return;

		const hex = cell.getAttribute('data-hex') || '';
		const pos = cell.getAttribute('data-position') || '';
		const char = cell.getAttribute('data-char') || '';
		const codePoint = char.codePointAt(0);
		const decVal = typeof codePoint === 'number' ? codePoint.toString(10) : '';
		const bg = cell.style.backgroundImage;

		if (bg) {
			const url = bg.slice(5, -2);
			detailImg.src = url;
			detailImg.classList.remove('d-none');
			detailCharFallback.classList.add('d-none');
		} else {
			detailImg.classList.add('d-none');
			detailCharFallback.classList.remove('d-none');
			detailCharFallback.textContent = char || '?';
		}

		detailHex.textContent = hex;
		detailDec.textContent = decVal;
		detailPos.textContent = pos;
		detailCharText.textContent = char;

		if (detailCopyBtn) {
			detailCopyBtn.disabled = !char;
			detailCopyBtn.innerHTML = '<i class="far fa-copy me-1"></i> Copy glyph';
			detailCopyBtn.onclick = () => {
				if (!char) return;
				navigator.clipboard.writeText(char).then(() => {
					detailCopyBtn.innerHTML = '<i class="fas fa-check me-1"></i> Copied!';
					setTimeout(() => {
						detailCopyBtn.innerHTML = '<i class="far fa-copy me-1"></i> Copy glyph';
					}, 1500);
				});
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
					processGlyph(img, hex, { cacheKey: `${hex}_DEFAULT` });
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
					processGlyph(img, hex, { cacheKey: 'TEMPLATE' });
					
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
					processGlyph(img, hex, { cacheKey: 'E1_MOD' });
					
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
});
