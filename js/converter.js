// Conversion functions
function convertHexToEmoji(input) {
	try {
		const codePoint = parseInt(input, 16);
		document.getElementById('converterOutput').value = String.fromCodePoint(codePoint);
		document.getElementById('successMsg').textContent = 'Converted successfully!';
		document.getElementById('successMsg').classList.remove('d-none');
	} catch (error) {
		document.getElementById('errorMsg').textContent = 'Invalid Unicode code point.';
		document.getElementById('errorMsg').classList.remove('d-none');
	}
}

function convertEmojiToHex(input) {
	const hexValue = input.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
	document.getElementById('converterOutput').value = `0x${hexValue}`;
	document.getElementById('successMsg').textContent = 'Converted successfully!';
	document.getElementById('successMsg').classList.remove('d-none');
}

function convert() {
	let input = document.getElementById('converterInput').value.trim();
	const errorMsg = document.getElementById('errorMsg');
	const successMsg = document.getElementById('successMsg');
	const output = document.getElementById('converterOutput');
	errorMsg.classList.add('d-none');
	successMsg.classList.add('d-none');
	output.value = '';

	if (!input) {
		updateCopyButtonState();
		return;
	}

	// 1. Explicit hex prefix
	let isExplicitHex = false;
	if (/^(0x|u\+|U\+)/i.test(input)) {
		isExplicitHex = true;
		input = input.replace(/^(0x|u\+|U\+)/i, '');
	}

	if (isExplicitHex || (input.length > 1 && /^[0-9A-Fa-f]+$/.test(input))) {
		convertHexToEmoji(input);
	} else if (Array.from(input).length === 1) {
		convertEmojiToHex(input);
	} else {
		errorMsg.textContent = 'Invalid input. Please enter a valid hex value or a single symbol/emoji.';
		errorMsg.classList.remove('d-none');
	}
	
	updateCopyButtonState();
}

function copyOutput() {
	const output = document.getElementById('converterOutput');
	const copyButton = document.getElementById('copyButton');

	if (output.value.trim() === '') {
		return;
	}

	navigator.clipboard.writeText(output.value).then(() => {
		const originalText = copyButton.innerHTML;
		copyButton.innerHTML = '<i class="fas fa-check text-primary"></i>';
		copyButton.disabled = true;

		setTimeout(() => {
			copyButton.innerHTML = originalText;
			copyButton.disabled = false;
		}, 2000);
	});
}
