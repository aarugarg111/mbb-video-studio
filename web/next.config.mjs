import { fileURLToPath } from 'node:url';

/* A static export - no server, no functions. The whole tool is files on a
 * CDN, which is why it is free to host and has no plan to violate. */
export default {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  /* Set by the Pages workflow (e.g. /my-repo). Empty locally, so dev and a
   * root-hosted build are unchanged. Same variable as lib/base-path.ts. */
  basePath: (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, ''),
  /* src/ and screens/ live above this directory and are shared with the
   * renderer. Next compiles them from source rather than us keeping a second
   * copy of the validation rules that would drift. */
  outputFileTracingRoot: fileURLToPath(new URL('..', import.meta.url))
};
