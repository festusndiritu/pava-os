import type { Request, Response } from 'express';

export const ACCESS_COOKIE = 'pava_at';
export const REFRESH_COOKIE = 'pava_rt';

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

// Both cookies are httpOnly, so page scripts (and anything injected into them) can never read the session.
// The refresh cookie is only ever sent to /auth, and lives as long as the session itself.
export function setSessionCookies(res: Response, accessToken: string, refreshToken: string, sessionMaxHours: number) {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || 'lax',
  };
  res.cookie(ACCESS_COOKIE, accessToken, { ...base, path: '/' });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...base, path: '/auth', maxAge: sessionMaxHours * 60 * 60 * 1000 });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
}
