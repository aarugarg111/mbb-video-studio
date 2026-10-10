/* Builds the studio the way the Cloudflare Worker serves it: at the root of
 * its own domain, so no base path, and in team mode, so the page asks for the
 * team password instead of an API key.
 *
 * A script rather than an inline env var because npm runs scripts through cmd
 * on Windows, where NAME=value in front of a command is not a thing. */

import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_TEAM_MODE: '1', NEXT_PUBLIC_BASE_PATH: '' }
});

process.exit(result.status ?? 1);
