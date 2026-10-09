import './globals.css';
import { asset } from '../lib/base-path';

export const metadata = { title: 'myBillBook Video Studio' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* The kit is shared with the CLI renderer and copied into public/ at
            build time. Resolved through asset() so this works when the site is
            served from a subpath, as GitHub Pages does. */}
        <link rel="stylesheet" href={asset('/kit/tokens.css')} />
        <link rel="stylesheet" href={asset('/kit/kit.css')} />
      </head>
      <body>{children}</body>
    </html>
  );
}
