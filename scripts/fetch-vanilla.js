#!/usr/bin/env node
/**
 * Fetch Bedrock vanilla textures from mojang/bedrock-samples and generate a local manifest.
 * Strategy: shallow clone with sparse checkout of resource_pack/textures, then copy into
 * ./vanilla-textures preserving relative paths (e.g., blocks/stone.png). Produces manifest.json
 * with { paths: [ "blocks/stone.png", ... ] } for the picker.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO = 'https://github.com/Mojang/bedrock-samples.git';
const TEXTURE_DIR = 'resource_pack/textures';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'vanilla-textures');
const MANIFEST = path.join(OUTPUT_DIR, 'manifest.json');

function run(cmd, cwd) {
  execSync(cmd, { stdio: 'inherit', cwd });
}

function rimraf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      fs.copyFileSync(s, d);
    }
  }
}

function collectPaths(dir, base) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      results.push(...collectPaths(full, base));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      results.push(rel);
    }
  }
  return results;
}

function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vanilla-'));
  console.log('Cloning textures to', temp);
  run(`git clone --depth 1 --filter=blob:none --no-checkout ${REPO} .`, temp);
  run(`git sparse-checkout init --cone`, temp);
  run(`git sparse-checkout set ${TEXTURE_DIR}`, temp);
  run(`git checkout`, temp);

  const srcTextures = path.join(temp, TEXTURE_DIR);
  rimraf(OUTPUT_DIR);
  copyDir(srcTextures, OUTPUT_DIR);

  const paths = collectPaths(OUTPUT_DIR, OUTPUT_DIR).sort();
  fs.writeFileSync(MANIFEST, JSON.stringify({ paths }, null, 2), 'utf8');

  console.log(`Copied ${paths.length} textures into ${OUTPUT_DIR}`);
}

main();
