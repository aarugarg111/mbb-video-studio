import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/* Not real auth - one shared password, enough that finding the URL does not
 * mean spending the API budget. Replace before this spreads beyond the team. */
export function middleware(req: NextRequest) {
  const expected = process.env.APP_PASSWORD;

  if (!expected) {
    return new NextResponse('APP_PASSWORD is not configured.', { status: 500 });
  }

  const header = req.headers.get('authorization') ?? '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    const [, password] = atob(encoded).split(':');
    if (password === expected) return NextResponse.next();
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="mbb-video-studio"' }
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
