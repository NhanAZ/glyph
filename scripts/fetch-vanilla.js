#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPOSITORY = 'https://github.com/Mojang/bedrock-samples.git';
const TEXTURE_DIRECTORY = 'resource_pack/textures';
const OUTPUT_DIRECTORY = path.resolve(__dirname, '..', 'vanilla-textures');
const MANIFEST_PATH = path.join(OUTPUT_DIRECTORY, 'manifest.json');

function runGit(args, cwd) {
	execFileSync('git', args, { cwd, stdio: 'inherit' });
}

function copyPngFiles(source, destination) {
	fs.mkdirSync(destination, { recursive: true });

	for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
		const sourcePath = path.join(source, entry.name);
		const destinationPath = path.join(destination, entry.name);

		if (entry.isDirectory()) {
			copyPngFiles(sourcePath, destinationPath);
		} else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
			fs.copyFileSync(sourcePath, destinationPath);
		}
	}
}

function collectPngPaths(directory, baseDirectory) {
	const paths = [];

	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			paths.push(...collectPngPaths(fullPath, baseDirectory));
		} else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
			paths.push(path.relative(baseDirectory, fullPath).replace(/\\/g, '/'));
		}
	}

	return paths;
}

function main() {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vanilla-textures-'));

	try {
		console.log('Downloading textures from Mojang/bedrock-samples...');
		runGit(
			['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', REPOSITORY, '.'],
			temporaryDirectory
		);
		runGit(['sparse-checkout', 'init', '--cone'], temporaryDirectory);
		runGit(['sparse-checkout', 'set', TEXTURE_DIRECTORY], temporaryDirectory);
		runGit(['checkout'], temporaryDirectory);

		const sourceDirectory = path.join(temporaryDirectory, TEXTURE_DIRECTORY);
		const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
			cwd: temporaryDirectory,
			encoding: 'utf8'
		}).trim();

		fs.rmSync(OUTPUT_DIRECTORY, { recursive: true, force: true });
		copyPngFiles(sourceDirectory, OUTPUT_DIRECTORY);

		const paths = collectPngPaths(OUTPUT_DIRECTORY, OUTPUT_DIRECTORY).sort();
		const manifest = {
			source: REPOSITORY,
			revision,
			paths
		};
		fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

		console.log(`Copied ${paths.length} textures into ${OUTPUT_DIRECTORY}`);
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
}

main();
