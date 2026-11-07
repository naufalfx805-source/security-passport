// Confirm every UI Kit component the panel imports is exported by @forge/react,
// and that @forge/bridge exports invoke. Usage: node tools/check-ui-imports.mjs

import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/frontend/index.jsx', import.meta.url), 'utf8');
const block = source.match(/import ForgeReconciler,\s*\{([^}]+)\}\s*from '@forge\/react'/);
const wanted = block[1].split(',').map((s) => s.trim()).filter(Boolean);

const react = await import('@forge/react');
const bridge = await import('@forge/bridge');
const missing = wanted.filter((name) => !(name in react));
const problems = [
  ...missing.map((name) => `@forge/react has no export "${name}"`),
  ...(typeof react.default?.render === 'function' ? [] : ['@forge/react default export has no render()']),
  ...(typeof bridge.invoke === 'function' ? [] : ['@forge/bridge has no invoke()']),
];
console.log(problems.length ? problems.join('\n') : `ok: ${wanted.length} UI Kit components, ForgeReconciler.render and invoke found`);
process.exitCode = problems.length ? 1 : 0;
