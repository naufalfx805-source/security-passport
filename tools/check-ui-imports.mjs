// Confirm every UI Kit component the panel imports is exported by @forge/react.
// Reads the package's type declarations, because importing @forge/react or
// @forge/bridge outside an Atlassian product throws.
// Usage: node tools/check-ui-imports.mjs

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'src/frontend/index.jsx'), 'utf8');
const block = source.match(/import ForgeReconciler,\s*\{([^}]+)\}\s*from '@forge\/react'/);
const wanted = block[1].split(',').map((s) => s.trim()).filter(Boolean);

async function declarationFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await declarationFiles(full));
    else if (entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const exported = new Set();
for (const file of await declarationFiles(path.join(root, 'node_modules/@forge/react/out/components'))) {
  for (const m of (await readFile(file, 'utf8')).matchAll(/export declare const ([A-Z][A-Za-z]+)/g)) exported.add(m[1]);
}
const missing = wanted.filter((name) => !exported.has(name));
console.log(missing.length
  ? `missing from @forge/react: ${missing.join(', ')}`
  : `ok: all ${wanted.length} UI Kit components are exported (${exported.size} available)`);
process.exitCode = missing.length ? 1 : 0;
