import { fileURLToPath } from 'node:url';

export default {
  reactStrictMode: true,
  /* src/ and screens/ live above this directory and are shared with the
   * renderer. Next compiles them from source rather than us keeping a second
   * copy of the validation rules that would drift. */
  outputFileTracingRoot: fileURLToPath(new URL('..', import.meta.url))
};
