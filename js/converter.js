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
	const input = document.getElementById('converterInput').value.trim();
	const errorMsg = document.getElementById('errorMsg');
	const successMsg = document.getElementById('successMsg');
	const output = document.getElementById('converterOutput');
	errorMsg.classList.add('d-none');
	successMsg.classList.add('d-none');
	output.value = '';

	if (/^[0-9A-Fa-f]{1,6}$/.test(input)) {
		convertHexToEmoji(input);
	} else if (input.length === 1) {
		convertEmojiToHex(input);
	} else {
		errorMsg.textContent = 'Invalid input. Please enter a hex value or a single emoji/symbol.';
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
		copyButton.innerHTML = '<i class="fas fa-check me-2"></i>Copied';
		copyButton.disabled = true;

		setTimeout(() => {
			copyButton.innerHTML = originalText;
			copyButton.disabled = false;
		}, 2000);
	});
}
