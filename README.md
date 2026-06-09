# Glyph Tools

Static, client-side tools for creating and editing 16x16 Minecraft glyph atlases. The app has no backend.

## Features

- Generate a 256-character grid from a hexadecimal prefix such as `E0`.
- Load the included template, empty atlas, or example atlas.
- Upload a `glyph_XX.png` atlas and inspect, clear, replace, copy, or download individual cells.
- Convert between hexadecimal code points and characters.
- Export the current atlas, character rows, reference text, font JSON, or metadata JSON.
- Replace a glyph with a bundled Minecraft texture.

## Run locally

Serve the repository over HTTP so the browser can load `vanilla-textures/manifest.json`.

```bash
cd glyph
python -m http.server 8000
```

Open `http://localhost:8000/`.

You can also use another static file server, for example:

```bash
npx serve .
```

## Refresh vanilla textures

The repository already contains the texture files required by the picker. To refresh them, install Node.js 18 or newer and Git, then run:

```bash
node scripts/fetch-vanilla.js
```

The script replaces `vanilla-textures/` with PNG files from
[`Mojang/bedrock-samples`](https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/textures)
and regenerates `manifest.json`.

## Development checks

```bash
npm install
npm run check
```

## Project layout

- `index.html`: page markup and script loading order.
- `assets/css/`: application styles.
- `assets/icons/`: favicon and web app manifest files.
- `assets/glyphs/`: built-in atlas presets.
- `js/`: application code.
- `scripts/`: maintenance scripts.
- `tests/fixtures/`: PNG files for manual testing.
- `vanilla-textures/`: bundled texture PNGs and the picker manifest.

## License

The application source is licensed under GPL-3.0. See `LICENSE`.

Files under `vanilla-textures/` come from Mojang's `bedrock-samples` repository and remain subject to the
[Minecraft EULA](https://www.minecraft.net/eula).
