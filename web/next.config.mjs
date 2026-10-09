import { fileURLToPath } from 'node:url';

/* A static export - no server, no functions. The whole tool is files on a
 * CDN, which is why it is free to host and has no plan to violate. */
export default {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  /* src/ and screens/ live above this directory and are shared with the
   * renderer. Next compiles them from source rather than us keeping a second
   * copy of the validation rules that would drift. */
  outputFileTracingRoot: fileURLToPath(new URL('..', import.meta.url))
};
