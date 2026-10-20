#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPOSITORY = 'https://github.com/Mojang/bedrock-samples.git';
const TEXTURE_DIRECTORY = 'resource_pack/textures';
const OUTPUT_DIRECTORY = path.resolve(__dirname, '..', 'vanilla-textures');

function runGit(args, cwd) {
	execFileSync('git', args, { cwd, stdio: 'inherit' });
}

function copyPngFiles(source, destination, baseDirectory = destination) {
	const paths = [];
	fs.mkdirSync(destination, { recursive: true });

	for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
		const sourcePath = path.join(source, entry.name);
		const destinationPath = path.join(destination, entry.name);

		if (entry.isDirectory()) {
			paths.push(...copyPngFiles(sourcePath, destinationPath, baseDirectory));
		} else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
			fs.copyFileSync(sourcePath, destinationPath);
			paths.push(path.relative(baseDirectory, destinationPath).replace(/\\/g, '/'));
		}
	}

	return paths;
}

function main() {
	const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vanilla-textures-'));
	let stagingDirectory;
	let backupDirectory;

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

		// Keep staging on the output filesystem so installation uses directory renames.
		stagingDirectory = fs.mkdtempSync(path.join(path.dirname(OUTPUT_DIRECTORY), '.vanilla-textures-'));
		const stagedTextures = path.join(stagingDirectory, 'textures');
		backupDirectory = path.join(stagingDirectory, 'previous');
		const paths = copyPngFiles(sourceDirectory, stagedTextures).sort();
		if (paths.length === 0) throw new Error('The source contains no PNG textures.');
		const manifest = {
			source: REPOSITORY,
			revision,
			paths
		};
		fs.writeFileSync(path.join(stagedTextures, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

		if (fs.existsSync(OUTPUT_DIRECTORY)) fs.renameSync(OUTPUT_DIRECTORY, backupDirectory);
		try {
			fs.renameSync(stagedTextures, OUTPUT_DIRECTORY);
		} catch (error) {
			if (fs.existsSync(backupDirectory)) fs.renameSync(backupDirectory, OUTPUT_DIRECTORY);
			throw error;
		}
		fs.rmSync(backupDirectory, { recursive: true, force: true });

		console.log(`Copied ${paths.length} textures into ${OUTPUT_DIRECTORY}`);
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
		if (stagingDirectory) {
			if (fs.existsSync(backupDirectory)) {
				console.warn(`Previous textures preserved at ${backupDirectory}`);
			} else {
				fs.rmSync(stagingDirectory, { recursive: true, force: true });
			}
		}
	}
}

main();
