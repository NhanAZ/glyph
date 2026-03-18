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

	function checkScreenSize() {
		if (window.innerWidth < 768) {
			mobileAlert.style.display = 'block';
		} else {
			mobileAlert.style.display = 'none';
		}
	}

	checkScreenSize();
	window.addEventListener('resize', checkScreenSize);

    const tooltip = document.createElement('div');
    tooltip.className = 'smart-tooltip';
    document.body.appendChild(tooltip);

    let currentCopiedCell = null;

    document.addEventListener('mousemove', (e) => {
        const cell = e.target.closest('#glyph-output div[data-hex]');
        if (cell) {
            const hex = cell.getAttribute('data-hex');
            const pos = cell.getAttribute('data-position');
            
            if (currentCopiedCell && currentCopiedCell !== cell) {
                tooltip.classList.remove('success');
                currentCopiedCell = null;
            }

            if (!tooltip.classList.contains('success')) {
                tooltip.innerHTML = `Pos: ${pos}<br>Hex: ${hex}`;
            }
            
            const rect = cell.getBoundingClientRect();
            tooltip.style.left = (rect.left + window.scrollX + (rect.width / 2)) + 'px';
            tooltip.style.top = (rect.top + window.scrollY - 8) + 'px';
            tooltip.classList.add('visible');
        } else {
            tooltip.classList.remove('visible');
            tooltip.classList.remove('success');
            currentCopiedCell = null;
        }
    });

	document.addEventListener('click', (e) => {
		const cell = e.target.closest('#glyph-output div[data-hex]');
		if (cell) {
			const char = cell.getAttribute('data-char');
			navigator.clipboard.writeText(char).then(() => {
                currentCopiedCell = cell;
                tooltip.innerHTML = "Copied!";
                tooltip.classList.add('success');
                setTimeout(() => {
                    tooltip.classList.remove('success');
                    if (currentCopiedCell === cell && cell.matches(':hover')) {
                        const hex = cell.getAttribute('data-hex');
                        const pos = cell.getAttribute('data-position');
                        tooltip.innerHTML = `Pos: ${pos}<br>Hex: ${hex}`;
                    }
                    if (currentCopiedCell === cell) {
                        currentCopiedCell = null;
                    }
                }, 1500);
            });
		}
	});

	// Hint click logic
	const hintMsg = document.getElementById('defaultImageHint');
	if (hintMsg) {
		hintMsg.addEventListener('click', () => {
			const hex = document.getElementById('hintHex').textContent;
			
			if (typeof DEFAULT_GLYPHS !== 'undefined' && DEFAULT_GLYPHS[hex]) {
				const img = new Image();
				img.onload = function() {
					processGlyph(img, hex);
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
			let hex = "E0";
			if (glyphInput) glyphInput.value = hex;
			
			if (typeof DEFAULT_GLYPHS !== 'undefined' && DEFAULT_GLYPHS['TEMPLATE']) {
				if (typeof updateTimer !== 'undefined') clearTimeout(updateTimer);
				const img = new Image();
				img.onload = function() {
					processGlyph(img, hex);
					
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
			const glyphInput = document.getElementById('glyph-input');
			if (glyphInput) {
				glyphInput.value = hex;
			}
			
			if (typeof DEFAULT_GLYPHS !== 'undefined' && DEFAULT_GLYPHS['E1_MOD']) {
				if (typeof updateTimer !== 'undefined') clearTimeout(updateTimer);
				const img = new Image();
				img.onload = function() {
					processGlyph(img, hex);
					
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
