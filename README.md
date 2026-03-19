# Glyph Tools

Single-page, client-only utilities for creating, inspecting, and editing 16×16 glyph atlases (PUA E000–E0FF, etc.) for Minecraft resource packs. No backend required—open the page and start.

## Features
- Generate 256 characters from a HEX prefix (default E0); quick presets for `glyph_E0`, template grid, empty grid, and an E1 example.
- Upload a full atlas named `glyph_XX.png`, or click any cell to inspect, copy, download its PNG, clear to transparent, replace with another PNG, or swap in a bundled vanilla texture.
- Smart Converter: HEX ⇄ character/emoji with one-click copy.
- Smart Export: download the current atlas PNG; copy the 256-character string; copy a reference map (hex, position, char); export JSON font provider and JSON metadata.
- Quality-of-life: dark mode, mobile warning, adaptive vs fixed 16×16 grid, action tooltips/mini toasts.
- Vanilla Texture Picker: reads a local manifest so you can drop in official textures quickly.

## Quick start
1) Use any modern browser.  
2) Serve the folder statically to avoid CORS when loading `vanilla-textures/manifest.json`:
```bash
cd glyph
python -m http.server 8000
# or: npx serve .
```
3) Open http://localhost:8000/ and enter a HEX prefix or upload `glyph_XX.png`.

## Suggested workflow
- Type HEX (E0, E1, …) to build the 256-cell grid; use **Grid Template**, **E1 Example**, or **Empty Grid** for quick presets.
- Upload `glyph_XX.png` to replace the whole atlas (expects a 16×16 tile sheet).
- Click a grid cell to open the detail modal: copy the character, download that PNG, clear to transparent, upload a replacement PNG, or pick a vanilla texture and apply immediately.
- Use **Smart Export** to grab the atlas, the character string, or JSON outputs (`glyph_<hex>.json` and `glyph_<hex>_metadata.json`) for your resource pack.

## Refreshing vanilla textures (optional)
`scripts/fetch-vanilla.js` performs a shallow clone of `mojang/bedrock-samples`, sparsely checks out `resource_pack/textures`, and rebuilds `vanilla-textures/` plus `manifest.json`.

Requirements: Node.js ≥ 18 and Git. Run:
```bash
node scripts/fetch-vanilla.js
```
This overwrites `vanilla-textures/` with the latest textures and regenerates the manifest for the picker.

## Directory layout
- `index.html` — main page wiring Bootstrap + Font Awesome + scripts.
- `styles.css` — Apple-inspired styling with dark mode.
- `js/` — logic: `main.js` (UI/exports/modal), `glyph.js` (atlas processing/cache), `converter.js`, `zoom.js`, `defaults.js`, `utils.js`, `state.js`.
- `RP/font/` — preset atlases (`glyph_E0`, `glyph_E1_modified`, empty grid, template).
- `vanilla-textures/` — bundled vanilla textures + `manifest.json` for the picker; rebuildable via the script above.
- `glyph-for-test/` — sample PNGs for quick testing.
- `LICENSE` — GPL-3.0.

## Deployment
Static site: host the folder on GitHub Pages, Vercel static, S3, etc. Ensure `vanilla-textures/manifest.json` is served over HTTP(S) so the picker can load it.

## License
GPL-3.0 (see `LICENSE`).
