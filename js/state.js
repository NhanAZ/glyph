// Shared configuration for the classic scripts loaded by index.html.
const APP_CONFIG = Object.freeze({
	gridSize: 16,
	glyphCacheLimit: 6,
	maxPngBytes: 16 * 1024 * 1024,
	maxImageDimension: 8192,
	maxImagePixels: 64 * 1024 * 1024
});

const GRID = APP_CONFIG.gridSize;
const GLYPH_CACHE_LIMIT = APP_CONFIG.glyphCacheLimit;

// Shared runtime state. Keep cross-file globals declared here so ownership is clear.
let zoomWindow = null;
let updateTimer = null;
let zoomEnabled = false;
let isDarkMode = false;
let currentAtlasDataUrl = null;
let currentAtlasLabel = '';

// Cache for processed glyph markup to avoid repeated canvas work
// Key format: `${cacheKey}__${theme}` (theme = 'light' | 'dark')
const glyphCache = new Map();
