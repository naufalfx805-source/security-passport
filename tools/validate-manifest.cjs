// Validate manifest.yml with the Forge CLI's own @forge/manifest validators,
// without logging in (forge lint needs credentials).
// Usage: node tools/validate-manifest.cjs [manifest.yml] [path-to-forge-cli-package]

const path = require('node:path');
const { execSync } = require('node:child_process');

const manifestPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'manifest.yml'));
const cliDir = process.argv[3]
  || path.join(execSync('npm root -g').toString().trim(), '@forge', 'cli');
const { validate } = require(require.resolve('@forge/manifest', { paths: [cliDir] }));

validate(false, manifestPath).then((result) => {
  const errors = result.errors || [];
  if (result.success && errors.length === 0) {
    console.log('manifest.yml: valid');
    return;
  }
  for (const e of errors) {
    const where = e.reference && e.reference.line != null ? ` (line ${e.reference.line})` : '';
    console.log(`- [${e.level || 'error'}] ${e.message}${where}`);
  }
  process.exitCode = result.success ? 0 : 1;
}).catch((error) => {
  console.error('validator crashed:', error.message);
  process.exitCode = 2;
});
