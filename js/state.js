const APP_CONFIG = Object.freeze({
	gridSize: 16,
	glyphCacheLimit: 6,
	maxPngBytes: 16 * 1024 * 1024,
	maxImageDimension: 8192,
	maxImagePixels: 64 * 1024 * 1024
});

const GRID = APP_CONFIG.gridSize;
const GLYPH_CACHE_LIMIT = APP_CONFIG.glyphCacheLimit;

let zoomWindow = null;
let updateTimer = null;
let zoomEnabled = false;
let isDarkMode = false;
let currentAtlasDataUrl = null;
let currentAtlasLabel = '';

// Cached cells are keyed by atlas and color theme.
const glyphCache = new Map();
