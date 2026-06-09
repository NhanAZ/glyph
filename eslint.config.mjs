import globals from 'globals';

const sharedAppGlobals = {
	APP_CONFIG: 'readonly',
	DEFAULT_GLYPHS: 'readonly',
	GLYPH_CACHE_LIMIT: 'readonly',
	GRID: 'readonly',
	Glyph: 'readonly',
	addZoomEvents: 'readonly',
	clearAtlasTile: 'readonly',
	convert: 'readonly',
	copyOutput: 'readonly',
	copyText: 'readonly',
	currentAtlasDataUrl: 'writable',
	currentAtlasLabel: 'writable',
	downloadFile: 'readonly',
	downloadUrl: 'readonly',
	getBackgroundImageUrl: 'readonly',
	getElement: 'readonly',
	getGlyphPrefix: 'readonly',
	glyphCache: 'readonly',
	hideZoomWindow: 'readonly',
	initializeGlyph: 'readonly',
	isDarkMode: 'writable',
	isValidGlyphPrefix: 'readonly',
	listen: 'readonly',
	loadPngFile: 'readonly',
	processGlyph: 'readonly',
	removeZoomEvents: 'readonly',
	renderGlyphs: 'readonly',
	replaceAtlasTile: 'readonly',
	setButtonContent: 'readonly',
	showActionToast: 'readonly',
	showZoomWindow: 'readonly',
	toggleDarkMode: 'readonly',
	updateTimer: 'writable',
	updateCopyButtonState: 'readonly',
	updateZoomWindowContent: 'readonly',
	zoomEnabled: 'writable',
	zoomWindow: 'writable'
};

export default [
	{
		files: ['js/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'script',
			globals: {
				...globals.browser,
				...sharedAppGlobals
			}
		},
		rules: {
			'constructor-super': 'error',
			'for-direction': 'error',
			'getter-return': 'error',
			'no-async-promise-executor': 'error',
			'no-class-assign': 'error',
			'no-const-assign': 'error',
			'no-dupe-args': 'error',
			'no-dupe-class-members': 'error',
			'no-dupe-else-if': 'error',
			'no-dupe-keys': 'error',
			'no-duplicate-case': 'error',
			'no-empty': ['error', { allowEmptyCatch: true }],
			'no-ex-assign': 'error',
			'no-fallthrough': 'error',
			'no-func-assign': 'error',
			'no-import-assign': 'error',
			'no-loss-of-precision': 'error',
			'no-new-native-nonconstructor': 'error',
			'no-obj-calls': 'error',
			'no-promise-executor-return': 'error',
			'no-self-assign': 'error',
			'no-setter-return': 'error',
			'no-shadow-restricted-names': 'error',
			'no-sparse-arrays': 'error',
			'no-this-before-super': 'error',
			'no-undef': 'error',
			'no-unexpected-multiline': 'error',
			'no-unmodified-loop-condition': 'error',
			'no-unreachable': 'error',
			'no-unreachable-loop': 'error',
			'no-unsafe-finally': 'error',
			'no-unsafe-negation': 'error',
			'no-unsafe-optional-chaining': 'error',
			'no-unused-labels': 'error',
			'no-unused-private-class-members': 'error',
			'no-unused-vars': ['error', { vars: 'local', args: 'after-used', argsIgnorePattern: '^_' }],
			'no-useless-backreference': 'error',
			'no-useless-catch': 'error',
			'no-useless-escape': 'error',
			'no-with': 'error',
			'require-yield': 'error',
			'use-isnan': 'error',
			'valid-typeof': 'error'
		}
	},
	{
		files: ['scripts/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'commonjs',
			globals: globals.node
		},
		rules: {
			'no-undef': 'error',
			'no-unreachable': 'error',
			'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }]
		}
	}
];
