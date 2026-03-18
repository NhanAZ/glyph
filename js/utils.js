// Utility functions
function showCopyNotification(element) {
	const notification = element.querySelector('.copy-notification');
	notification.classList.add('show-anim');
	setTimeout(() => {
		notification.classList.remove('show-anim');
	}, 1000);
}

function updateCopyButtonState() {
	const output = document.getElementById('converterOutput');
	const copyButton = document.getElementById('copyButton');
	if(output.value.trim() === '') {
		copyButton.style.opacity = '0.4';
		copyButton.style.pointerEvents = 'none';
	} else {
		copyButton.style.opacity = '1';
		copyButton.style.pointerEvents = 'auto';
	}
}

function toggleDarkMode() {
	isDarkMode = !isDarkMode;
	
	if (isDarkMode) {
		document.body.classList.add('dark-mode');
	} else {
		document.body.classList.remove('dark-mode');
	}

	const darkModeToggle = document.getElementById('darkModeToggle');
	darkModeToggle.innerHTML = isDarkMode
		? '<i class="fas fa-sun text-warning"></i>'
		: '<i class="fas fa-moon"></i>';

	renderGlyphs();
}

/**
 * Utility to download a file from the browser
 * @param {string} content - File content
 * @param {string} fileName - Name of the file
 * @param {string} contentType - MIME type
 */
function downloadFile(content, fileName, contentType) {
	const a = document.createElement("a");
	const file = new Blob([content], { type: contentType });
	a.href = URL.createObjectURL(file);
	a.download = fileName;
	a.click();
	URL.revokeObjectURL(a.href);
}
