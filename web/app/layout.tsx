import './globals.css';

export const metadata = { title: 'myBillBook Video Studio' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/kit/tokens.css" />
        <link rel="stylesheet" href="/kit/kit.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
