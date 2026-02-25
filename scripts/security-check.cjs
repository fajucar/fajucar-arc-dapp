#!/usr/bin/env node
/**
 * security-check: runs npm audit (informational) + lint (can fail).
 * Audit does not block because most vulns are in dev/build deps, not production bundle.
 * Lint failures block the script.
 */
const { execSync } = require('child_process');

console.log('--- npm audit (informational, does not block) ---\n');
try {
  execSync('npm audit', { stdio: 'inherit' });
} catch {
  console.log('\n^ Audit reported issues. See docs/SECURITY-DAPP-AUDIT.md for policy.\n');
}

console.log('\n--- lint (must pass) ---\n');
execSync('npm run lint', { stdio: 'inherit' });
