// Constants
const GRID = 16;
const GLYPH_CACHE_LIMIT = 6;

// Global variables
let zoomWindow = null;
let updateTimer = null;
let zoomEnabled = false;
let isDarkMode = false;
let currentAtlasDataUrl = null;
let currentAtlasLabel = '';

// Cache for processed glyph markup to avoid repeated canvas work
// Key format: `${cacheKey}__${theme}` (theme = 'light' | 'dark')
const glyphCache = new Map();
