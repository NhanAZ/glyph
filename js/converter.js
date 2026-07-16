let copyFeedbackTimer = null;

const CONTROL_CHARACTER_LABELS = new Map([
	[0x0000, 'NULL'],
	[0x0001, 'START OF HEADING'],
	[0x0002, 'START OF TEXT'],
	[0x0003, 'END OF TEXT'],
	[0x0004, 'END OF TRANSMISSION'],
	[0x0005, 'ENQUIRY'],
	[0x0006, 'ACKNOWLEDGE'],
	[0x0007, 'BELL'],
	[0x0008, 'BACKSPACE'],
	[0x0009, 'TAB'],
	[0x000A, 'LINE FEED'],
	[0x000B, 'VERTICAL TAB'],
	[0x000C, 'FORM FEED'],
	[0x000D, 'CARRIAGE RETURN'],
	[0x000E, 'SHIFT OUT'],
	[0x000F, 'SHIFT IN'],
	[0x0010, 'DATA LINK ESCAPE'],
	[0x0011, 'DEVICE CONTROL ONE'],
	[0x0012, 'DEVICE CONTROL TWO'],
	[0x0013, 'DEVICE CONTROL THREE'],
	[0x0014, 'DEVICE CONTROL FOUR'],
	[0x0015, 'NEGATIVE ACKNOWLEDGE'],
	[0x0016, 'SYNCHRONOUS IDLE'],
	[0x0017, 'END OF TRANSMISSION BLOCK'],
	[0x0018, 'CANCEL'],
	[0x0019, 'END OF MEDIUM'],
	[0x001A, 'SUBSTITUTE'],
	[0x001B, 'ESCAPE'],
	[0x001C, 'FILE SEPARATOR'],
	[0x001D, 'GROUP SEPARATOR'],
	[0x001E, 'RECORD SEPARATOR'],
	[0x001F, 'UNIT SEPARATOR'],
	[0x007F, 'DELETE']
]);

const NAMED_INVISIBLE_CODE_POINTS = new Map([
	[0x0020, 'SPACE'],
	[0x00A0, 'NO-BREAK SPACE'],
	[0x00AD, 'SOFT HYPHEN'],
	[0x061C, 'ARABIC LETTER MARK'],
	[0x1680, 'OGHAM SPACE MARK'],
	[0x180E, 'MONGOLIAN VOWEL SEPARATOR'],
	[0x2000, 'EN QUAD'],
	[0x2001, 'EM QUAD'],
	[0x2002, 'EN SPACE'],
	[0x2003, 'EM SPACE'],
	[0x2004, 'THREE-PER-EM SPACE'],
	[0x2005, 'FOUR-PER-EM SPACE'],
	[0x2006, 'SIX-PER-EM SPACE'],
	[0x2007, 'FIGURE SPACE'],
	[0x2008, 'PUNCTUATION SPACE'],
	[0x2009, 'THIN SPACE'],
	[0x200A, 'HAIR SPACE'],
	[0x200B, 'ZERO WIDTH SPACE'],
	[0x200C, 'ZERO WIDTH NON-JOINER'],
	[0x200D, 'ZERO WIDTH JOINER'],
	[0x200E, 'LEFT-TO-RIGHT MARK'],
	[0x200F, 'RIGHT-TO-LEFT MARK'],
	[0x2028, 'LINE SEPARATOR'],
	[0x2029, 'PARAGRAPH SEPARATOR'],
	[0x202F, 'NARROW NO-BREAK SPACE'],
	[0x205F, 'MEDIUM MATHEMATICAL SPACE'],
	[0x2060, 'WORD JOINER'],
	[0x3000, 'IDEOGRAPHIC SPACE'],
	[0xFEFF, 'ZERO WIDTH NO-BREAK SPACE']
]);

function clearCopyFeedbackTimer() {
	if (copyFeedbackTimer) {
		clearTimeout(copyFeedbackTimer);
		copyFeedbackTimer = null;
	}
}

function formatCodePoint(codePoint) {
	return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

function isCombiningMark(codePoint) {
	return (
		(codePoint >= 0x0300 && codePoint <= 0x036F) ||
		(codePoint >= 0x1AB0 && codePoint <= 0x1AFF) ||
		(codePoint >= 0x1DC0 && codePoint <= 0x1DFF) ||
		(codePoint >= 0x20D0 && codePoint <= 0x20FF) ||
		(codePoint >= 0xFE20 && codePoint <= 0xFE2F)
	);
}

function isVariationSelector(codePoint) {
	return (
		(codePoint >= 0xFE00 && codePoint <= 0xFE0F) ||
		(codePoint >= 0xE0100 && codePoint <= 0xE01EF)
	);
}

function isFormatCharacter(codePoint) {
	return (
		(codePoint >= 0x202A && codePoint <= 0x202E) ||
		(codePoint >= 0x2061 && codePoint <= 0x206F) ||
		(codePoint >= 0xFFF9 && codePoint <= 0xFFFB) ||
		(codePoint >= 0xE0000 && codePoint <= 0xE007F)
	);
}

function isPrivateUseCodePoint(codePoint) {
	return (
		(codePoint >= 0xE000 && codePoint <= 0xF8FF) ||
		(codePoint >= 0xF0000 && codePoint <= 0xFFFFD) ||
		(codePoint >= 0x100000 && codePoint <= 0x10FFFD)
	);
}

function isComplexScriptBlock(codePoint) {
	return codePoint >= 0x0900 && codePoint <= 0x0DFF;
}

function getUnicodeMarkLabel(character) {
	if (/^\p{Nonspacing_Mark}$/u.test(character)) return 'NONSPACING MARK';
	if (/^\p{Spacing_Mark}$/u.test(character)) return 'SPACING MARK';
	if (/^\p{Enclosing_Mark}$/u.test(character)) return 'ENCLOSING MARK';
	if (/^\p{Mark}$/u.test(character)) return 'MARK CHARACTER';
	return '';
}

function isAssignedCodePoint(character) {
	return /^\p{Assigned}$/u.test(character);
}

function getInvisibleCodePointLabel(codePoint, character) {
	if (CONTROL_CHARACTER_LABELS.has(codePoint)) return CONTROL_CHARACTER_LABELS.get(codePoint);
	if (NAMED_INVISIBLE_CODE_POINTS.has(codePoint)) return NAMED_INVISIBLE_CODE_POINTS.get(codePoint);
	if (codePoint <= 0x001F || (codePoint >= 0x0080 && codePoint <= 0x009F)) {
		return 'CONTROL CHARACTER';
	}
	const markLabel = getUnicodeMarkLabel(character);
	if (markLabel) return markLabel;
	if (isCombiningMark(codePoint)) return 'COMBINING MARK';
	if (isVariationSelector(codePoint)) return 'VARIATION SELECTOR';
	if (isFormatCharacter(codePoint)) return 'FORMAT CHARACTER';
	if (isPrivateUseCodePoint(codePoint)) return 'PRIVATE USE CHARACTER';
	if (!isAssignedCodePoint(character)) return 'UNASSIGNED CODE POINT';
	if (isComplexScriptBlock(codePoint)) return 'CODE POINT';
	return '';
}

function getOutputVisualHint(value) {
	const characters = Array.from(value);
	if (characters.length !== 1) return '';

	const character = characters[0];
	const codePoint = character.codePointAt(0);
	const label = getInvisibleCodePointLabel(codePoint, character);
	return label ? `${formatCodePoint(codePoint)} ${label}` : '';
}

function updateConverterOutputHint(value) {
	const output = getElement('converterOutput');
	const hint = getElement('converterOutputHint');
	const wrapper = output ? output.closest('.output-wrapper') : null;
	const visualHint = getOutputVisualHint(value);

	if (hint) {
		hint.textContent = visualHint;
		hint.classList.toggle('d-none', !visualHint);
	}
	if (wrapper) wrapper.classList.toggle('has-output-hint', Boolean(visualHint));
	if (output) output.title = visualHint ? `${visualHint} - copy uses the actual character.` : '';
}

function setConverterOutput(value) {
	const output = getElement('converterOutput');
	if (!output) return;
	output.value = value;
	updateConverterOutputHint(value);
}

function convertHexToEmoji(input) {
	const successMsg = getElement('successMsg');
	const errorMsg = getElement('errorMsg');
	if (!successMsg || !errorMsg) return;

	try {
		const codePoint = Number.parseInt(input, 16);
		if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) {
			throw new RangeError('Invalid Unicode code point.');
		}
		setConverterOutput(String.fromCodePoint(codePoint));
		successMsg.textContent = 'Converted successfully.';
		successMsg.classList.remove('d-none');
	} catch {
		errorMsg.textContent = 'Invalid Unicode code point.';
		errorMsg.classList.remove('d-none');
	}
}

function convertEmojiToHex(input) {
	const successMsg = getElement('successMsg');
	if (!successMsg) return;

	const hexValue = input.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
	setConverterOutput(`0x${hexValue}`);
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
	clearCopyFeedbackTimer();
	const copyButton = getElement('copyButton');
	setButtonContent(copyButton, 'Copy');
	if (copyButton) copyButton.disabled = false;
	errorMsg.classList.add('d-none');
	successMsg.classList.add('d-none');
	setConverterOutput('');

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

	if (!output || !copyButton || output.value === '') return;

	copyText(output.value).then(() => {
		clearCopyFeedbackTimer();
		if (errorMsg) errorMsg.classList.add('d-none');
		if (successMsg) {
			successMsg.textContent = 'Copied to clipboard.';
			successMsg.classList.remove('d-none');
		}
		setButtonContent(copyButton, 'Copied');
		copyButton.disabled = true;

		copyFeedbackTimer = setTimeout(() => {
			setButtonContent(copyButton, 'Copy');
			copyButton.disabled = false;
			if (successMsg && successMsg.textContent === 'Copied to clipboard.') {
				successMsg.classList.add('d-none');
			}
			copyFeedbackTimer = null;
		}, 2000);
	}).catch(() => {
		clearCopyFeedbackTimer();
		if (successMsg) successMsg.classList.add('d-none');
		if (errorMsg) {
			errorMsg.textContent = 'Unable to access the clipboard.';
			errorMsg.classList.remove('d-none');
		}
	});
}
