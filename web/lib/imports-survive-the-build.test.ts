/* The test runner and the bundler disagree, and only one of them ships.
 *
 * `import yaml from 'js-yaml'` passed tsc, passed every test under tsx, and
 * then failed the Next build with "The export default was not found" - which
 * meant the studio could not be deployed at all. It was found by running the
 * build by hand while chasing an unrelated fault, and what it was holding up
 * was the fix for a studio that was down.
 *
 * js-yaml's ESM build has no default export. tsx resolves it through the CJS
 * interop and hands one over anyway; turbopack reads the ESM exports and is
 * right to refuse. So the rule is the namespace form, which both agree on.
 *
 * A test rather than a lint rule because the suite is what people run, and
 * the full build is too slow to put in front of every change. The build on
 * push stays the backstop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Packages whose ESM build has no default export, so a default import of them
 * builds on one machine and not the other. Add to this when the build finds
 * another; do not relax it. */
const NO_DEFAULT_EXPORT = ['js-yaml'];

function sources(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'out') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, found);
    /* Not this file: it quotes the bad form on purpose, to prove the check
       can catch it. */
    else if (/\.(ts|tsx|mts)$/.test(name) && name !== 'imports-survive-the-build.test.ts') {
      found.push(path);
    }
  }
  return found;
}

test('nothing default-imports a package that has no default export', () => {
  const offenders: string[] = [];

  for (const file of sources(WEB)) {
    const text = readFileSync(file, 'utf8');
    for (const pkg of NO_DEFAULT_EXPORT) {
      /* `import x from 'pkg'` - but not `import * as x from` and not
         `import { a } from`, both of which are fine. */
      const bad = new RegExp(`import\\s+(?!\\*|\\{|type\\b)[A-Za-z_$][\\w$]*\\s+from\\s+['"]${pkg}['"]`);
      if (bad.test(text)) {
        offenders.push(`${file.slice(WEB.length + 1)} default-imports ${pkg}`);
      }
    }
  }

  assert.deepEqual(
    offenders, [],
    'these pass under the test runner and fail the production build, which ' +
    'means they cannot be deployed. Use `import * as name from "..."` instead.'
  );
});

test('the check can actually catch one', () => {
  /* A guard that cannot fail is decoration. */
  const bad = new RegExp(`import\\s+(?!\\*|\\{|type\\b)[A-Za-z_$][\\w$]*\\s+from\\s+['"]js-yaml['"]`);
  assert.ok(bad.test(`import yaml from 'js-yaml';`), 'the form that broke the build');
  assert.ok(!bad.test(`import * as yaml from 'js-yaml';`), 'the form that works');
  assert.ok(!bad.test(`import { load } from 'js-yaml';`), 'named imports are fine');
});
