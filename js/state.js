// Constants
const GRID = 16;

// Global variables
let zoomWindow = null;
let updateTimer = null;
let zoomEnabled = false;
let isDarkMode = false;

// Cache for processed glyph markup to avoid repeated canvas work
// Key format: `${cacheKey}__${theme}` (theme = 'light' | 'dark')
const glyphCache = new Map();
