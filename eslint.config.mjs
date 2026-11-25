import js from '@eslint/js';
import globals from 'globals';

const sharedAppGlobals = {
	APP_CONFIG: 'readonly',
	DEFAULT_GLYPHS: 'readonly',
	GLYPH_CACHE_LIMIT: 'readonly',
	GRID: 'readonly',
	Glyph: 'readonly',
	clearAtlasTile: 'readonly',
	convert: 'readonly',
	copyOutput: 'readonly',
	copyText: 'readonly',
	currentAtlasDataUrl: 'writable',
	currentAtlasLabel: 'writable',
	downloadFile: 'readonly',
	downloadUrl: 'readonly',
	extractGlyphTileUrl: 'readonly',
	getBackgroundImageUrl: 'readonly',
	getElement: 'readonly',
	getGlyphPrefix: 'readonly',
	getGlyphPrefixFromFileName: 'readonly',
	glyphCache: 'readonly',
	initializeGlyph: 'readonly',
	isDarkMode: 'writable',
	isValidGlyphPrefix: 'readonly',
	listen: 'readonly',
	loadPngFile: 'readonly',
	processGlyph: 'readonly',
	replaceAtlasTile: 'readonly',
	setButtonContent: 'readonly',
	showToast: 'readonly',
	toggleDarkMode: 'readonly',
	updateCopyButtonState: 'readonly',
	updateGlyphCellsAtlas: 'readonly'
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
			...js.configs.recommended.rules,
			'no-empty': ['error', { allowEmptyCatch: true }],
			'no-redeclare': 'off',
			'no-unused-vars': ['error', { vars: 'local', args: 'after-used', argsIgnorePattern: '^_' }],
		}
	},
	{
		files: ['scripts/**/*.js', 'tests/**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'commonjs',
			globals: globals.node
		},
		rules: {
			...js.configs.recommended.rules,
			'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }]
		}
	}
];
