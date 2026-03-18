// Utility functions
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

function toggleDarkMode() {
	isDarkMode = !isDarkMode;
	const glyphCard = document.querySelector('.card:has(#glyph-output)');
	const glyphCardHeader = glyphCard.querySelector('.card-header');

	glyphCard.classList.toggle('dark-mode', isDarkMode);
	glyphCardHeader.classList.toggle('dark-mode', isDarkMode);

	const darkModeToggle = document.getElementById('darkModeToggle');
	darkModeToggle.innerHTML = isDarkMode
		? '<i class="fas fa-sun"></i> Toggle Light Mode'
		: '<i class="fas fa-moon"></i> Toggle Dark Mode';

	renderGlyphs();
}
