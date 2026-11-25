# Glyph Tools

Prepare custom emoji glyph sheets for Minecraft Bedrock. Glyph Tools maps the cells in a 16 by 16 PNG atlas to 256 consecutive Unicode code points. Use it to start an atlas, replace individual cells, inspect their code points, and export the result.

The app runs in your browser. Atlas changes stay in the current page until exported. It does not create or install a complete resource pack. For Bedrock setup instructions, see the [custom emojis guide](https://wiki.bedrock.dev/text/custom-emojis).

**[Open Glyph Tools](https://nhanaz.github.io/glyph/)**

![Glyph Tools workspace](docs/glyph-tools-preview.png)

## Build an atlas

1. Choose the grid template, E1 example, or empty grid, or upload your own PNG atlas.
2. Enter a hexadecimal prefix such as `E0` to map the cells to `E000` through `E0FF`. A filename such as `glyph_E0.png` fills in the prefix automatically. Other filenames prompt you to enter it.
3. Select a cell to view its character, hexadecimal and decimal code points, grid position, and dimensions. Replace it with a PNG or a bundled Bedrock texture, or clear it to transparency.
4. Export the atlas as a PNG. You can also copy the character string or reference map, or download metadata JSON.

The converter accepts a hexadecimal code point or a character and returns the other form.

The JSON Pack export is a Java Edition bitmap font provider file. It is not a Bedrock resource pack.

## Run locally

Serve the repository over HTTP so the texture picker can load its bundled manifest.

```bash
python -m http.server 8000
```

Open [localhost:8000](http://localhost:8000/) in a browser. The app has no build step.

## Refresh the Minecraft texture library

The texture picker uses PNGs bundled from [Mojang Bedrock Samples](https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/textures). To refresh the local library, run the script below with Node.js and Git.

```bash
node scripts/fetch-vanilla.js
```

The script downloads the sample textures, then updates `vanilla-textures/manifest.json` and the local texture files.

## Development

Use Node.js 22 or newer to install the development dependencies and run the checks.

```bash
npm ci
npm run check
```

The check command runs syntax checks, ESLint, and the test suite.

## License

The source code is licensed under [GPL-3.0](LICENSE).

Bundled Minecraft textures remain subject to the [Minecraft End User License Agreement](https://www.minecraft.net/eula).
