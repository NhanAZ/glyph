function convertHexToEmoji(input) {
	const output = getElement('converterOutput');
	const successMsg = getElement('successMsg');
	const errorMsg = getElement('errorMsg');
	if (!output || !successMsg || !errorMsg) return;

	try {
		const codePoint = Number.parseInt(input, 16);
		if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) {
			throw new RangeError('Invalid Unicode code point.');
		}
		output.value = String.fromCodePoint(codePoint);
		successMsg.textContent = 'Converted successfully.';
		successMsg.classList.remove('d-none');
	} catch {
		errorMsg.textContent = 'Invalid Unicode code point.';
		errorMsg.classList.remove('d-none');
	}
}

function convertEmojiToHex(input) {
	const output = getElement('converterOutput');
	const successMsg = getElement('successMsg');
	if (!output || !successMsg) return;

	const hexValue = input.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
	output.value = `0x${hexValue}`;
	successMsg.textContent = 'Converted successfully.';
	successMsg.classList.remove('d-none');
}

function convert() {
	const inputElement = getElement('converterInput');
	const errorMsg = getElement('errorMsg');
	const successMsg = getElement('successMsg');
	const output = getElement('converterOutput');
	if (!inputElement || !errorMsg || !successMsg || !output) return;

	let input = inputElement.value.trim();
	errorMsg.classList.add('d-none');
	successMsg.classList.add('d-none');
	output.value = '';

	if (!input) {
		updateCopyButtonState();
		return;
	}

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
		errorMsg.textContent = 'Enter a hex value or one symbol/emoji.';
		errorMsg.classList.remove('d-none');
	}
	
	updateCopyButtonState();
}

function copyOutput() {
	const output = getElement('converterOutput');
	const copyButton = getElement('copyButton');
	const errorMsg = getElement('errorMsg');
	const successMsg = getElement('successMsg');

	if (!output || !copyButton || output.value.trim() === '') return;

	copyText(output.value).then(() => {
		if (errorMsg) errorMsg.classList.add('d-none');
		if (successMsg) {
			successMsg.textContent = 'Copied to clipboard.';
			successMsg.classList.remove('d-none');
		}
		setButtonContent(copyButton, 'Copied');
		copyButton.disabled = true;

		setTimeout(() => {
			setButtonContent(copyButton, 'Copy');
			copyButton.disabled = false;
		}, 2000);
	}).catch(() => {
		if (successMsg) successMsg.classList.add('d-none');
		if (errorMsg) {
			errorMsg.textContent = 'Unable to access the clipboard.';
			errorMsg.classList.remove('d-none');
		}
	});
}
