/* Deleting a Durable Object from the config does not delete it from the
 * account, and Cloudflare will not let you pretend otherwise.
 *
 * The Worker once had an object called Egress, to pin an Anthropic call to a
 * region that answered. When the Anthropic path went, the binding and its
 * migration were taken out of wrangler.toml with a note saying the object
 * "was never deployed, so it is simply gone rather than retired with a
 * migration". It had been deployed. Every deploy after that was refused:
 *
 *   New version of script does not export class 'Egress' which is depended
 *   on by existing Durable Objects.
 *
 * Which meant the studio could not be deployed at all. It stayed on the old
 * code, that code hard-required a secret that had since been deleted, and so
 * it answered 503 to every request - including signing in. For an afternoon
 * that looked like a team password that had gone wrong, and the password was
 * changed twice chasing it.
 *
 * The invariant is small and it holds in both directions: a class the
 * account has been told to create must be exported by the Worker, until a
 * migration tells the account to delete it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CONFIG = readFileSync(new URL('../cf/wrangler.toml', import.meta.url), 'utf8');
const WORKER = readFileSync(new URL('../cf/src/worker.js', import.meta.url), 'utf8');

/* Every class named by a key across all [[migrations]] blocks. Enough TOML
 * for the one shape this file uses: key = ["A", "B"]. */
function classesIn(key) {
  const found = [];
  for (const m of CONFIG.matchAll(new RegExp(`^\\s*${key}\\s*=\\s*\\[([^\\]]*)\\]`, 'gm'))) {
    for (const name of m[1].matchAll(/["']([^"']+)["']/g)) found.push(name[1]);
  }
  return found;
}

const created = [...classesIn('new_classes'), ...classesIn('new_sqlite_classes')];
const deleted = classesIn('deleted_classes');
const exported = name => new RegExp(`export\\s+(class\\s+${name}\\b|\\{[^}]*\\b${name}\\b)`).test(WORKER);

test('a class the account was told to create is exported, or retired by a migration', () => {
  for (const name of created) {
    if (deleted.includes(name)) continue;
    assert.ok(
      exported(name),
      `wrangler.toml created the Durable Object "${name}" and the Worker no longer exports ` +
      'it. Cloudflare will refuse EVERY deploy until either the class comes back or a ' +
      `migration with deleted_classes = ["${name}"] retires it. Taking the binding out of ` +
      'this file is not enough - it does not reach the account.'
    );
  }
});

test('a class a migration retired is not still being exported', () => {
  for (const name of deleted) {
    assert.ok(
      !exported(name),
      `a migration deletes "${name}" but the Worker still exports it - one of the two is a ` +
      'leftover, and the config is the thing that acts.'
    );
  }
});

test('the migration tags are unique, so the sequence means something', () => {
  const tags = [...CONFIG.matchAll(/^\s*tag\s*=\s*["']([^"']+)["']/gm)].map(m => m[1]);
  assert.deepEqual([...new Set(tags)], tags, `a tag is repeated: ${tags.join(', ')}`);
});

test('the Egress object specifically is retired rather than merely forgotten', () => {
  /* The one that actually took the studio down. If a future change drops
     these lines, the account still has the object and deploys stop again. */
  assert.ok(created.includes('Egress'), 'the record of creating it is kept, not quietly dropped');
  assert.ok(deleted.includes('Egress'), 'and it is deleted by a migration, not just left out');
  assert.ok(!exported('Egress'), 'and the code does not define it any more');
});
