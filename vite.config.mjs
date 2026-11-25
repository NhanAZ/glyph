import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = process.cwd();
const staticDirectories = ['js', 'assets', 'vanilla-textures'];

export default defineConfig({
	base: '/glyph/',
	publicDir: false,
	build: {
		outDir: 'dist',
		emptyOutDir: true
	},
	plugins: [{
		name: 'copy-static-app-files',
		writeBundle() {
			for (const directory of staticDirectories) {
				cpSync(resolve(root, directory), resolve(root, 'dist', directory), { recursive: true });
			}
		}
	}]
});
