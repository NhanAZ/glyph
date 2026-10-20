const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '..', 'scripts', 'fetch-vanilla.js');
const scriptSource = fs.readFileSync(scriptPath, 'utf8');

function createRefresh(t, failure) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'glyph-refresh-test-'));
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
	const output = path.join(directory, 'vanilla-textures');
	fs.mkdirSync(output);
	fs.writeFileSync(path.join(output, 'old.png'), 'old texture');
	fs.writeFileSync(path.join(output, 'manifest.json'), '{"paths":["old.png"]}');
	let failed = false;
	const mockedFs = Object.create(fs);
	mockedFs.copyFileSync = (source, destination) => {
		if (failure === 'copy') throw new Error('Simulated copy failure');
		return fs.copyFileSync(source, destination);
	};
	mockedFs.renameSync = (source, destination) => {
		if (failure === 'install' && destination === output && !failed) {
			failed = true;
			throw new Error('Simulated install failure');
		}
		return fs.renameSync(source, destination);
	};
	const context = {
		__dirname: path.join(directory, 'scripts'),
		console: { log() {}, warn() {} },
		require(moduleName) {
			if (moduleName === 'fs') return mockedFs;
			if (moduleName === 'os') return { tmpdir: () => directory };
			if (moduleName === 'child_process') {
				return {
					execFileSync(command, args, options) {
						assert.equal(command, 'git');
						if (args[0] === 'clone') {
							const textures = path.join(options.cwd, 'resource_pack', 'textures', 'ui');
							fs.mkdirSync(textures, { recursive: true });
							if (failure !== 'empty') {
								fs.writeFileSync(path.join(textures, 'new.PNG'), 'new texture');
								fs.writeFileSync(path.join(options.cwd, 'resource_pack', 'textures', 'first.png'), 'first texture');
							}
							fs.writeFileSync(path.join(textures, 'ignored.json'), '{}');
						}
						return args[0] === 'rev-parse' ? 'abc123\n' : '';
					}
				};
			}
			return require(moduleName);
		}
	};
	return { directory, output, run: () => vm.runInNewContext(scriptSource, context, { filename: scriptPath }) };
}

test('texture refresh copies PNGs and writes a sorted portable manifest', t => {
	const refresh = createRefresh(t);
	refresh.run();
	assert.deepEqual(fs.readdirSync(refresh.output).sort(), ['first.png', 'manifest.json', 'ui']);
	assert.deepEqual(fs.readdirSync(path.join(refresh.output, 'ui')), ['new.PNG']);
	const manifest = JSON.parse(fs.readFileSync(path.join(refresh.output, 'manifest.json'), 'utf8'));
	assert.equal(manifest.revision, 'abc123');
	assert.deepEqual(manifest.paths, ['first.png', 'ui/new.PNG']);
	assert.deepEqual(fs.readdirSync(refresh.directory), ['vanilla-textures']);
});

for (const failure of ['copy', 'install']) {
	test(`texture refresh preserves the existing library after ${failure} failure`, t => {
		const refresh = createRefresh(t, failure);
		assert.throws(refresh.run, new RegExp(`Simulated ${failure} failure`));
		assert.equal(fs.readFileSync(path.join(refresh.output, 'old.png'), 'utf8'), 'old texture');
		assert.deepEqual(JSON.parse(fs.readFileSync(path.join(refresh.output, 'manifest.json'), 'utf8')), {
			paths: ['old.png']
		});
		assert.deepEqual(fs.readdirSync(refresh.directory), ['vanilla-textures']);
	});
}

test('texture refresh rejects an empty source without removing the library', t => {
	const refresh = createRefresh(t, 'empty');
	assert.throws(refresh.run, /source contains no PNG textures/);
	assert.equal(fs.readFileSync(path.join(refresh.output, 'old.png'), 'utf8'), 'old texture');
	assert.deepEqual(fs.readdirSync(refresh.directory), ['vanilla-textures']);
});

test('texture refresh can install a library for the first time', t => {
	const refresh = createRefresh(t);
	fs.rmSync(refresh.output, { recursive: true });
	refresh.run();
	assert.equal(fs.readFileSync(path.join(refresh.output, 'ui', 'new.PNG'), 'utf8'), 'new texture');
	assert.deepEqual(fs.readdirSync(refresh.directory), ['vanilla-textures']);
});
