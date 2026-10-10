/* Removes Next's build cache before a build.
 *
 * Next bakes NEXT_PUBLIC_* values into the chunks it caches and will reuse a
 * cached chunk when only an env var changed, so building team mode and then
 * the static site on one machine leaves the static site asking for a team
 * password that nothing can check. Both builds start clean instead. */

import { rmSync } from 'node:fs';

rmSync(new URL('../.next', import.meta.url), { recursive: true, force: true });
