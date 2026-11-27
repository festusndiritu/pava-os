// Where the app opens when someone lands on "/" (the installed app's start page) or has just signed in:
// straight back to the page they were last on, not a landing screen.
const LAST_PATH_KEY = 'pava.lastPath';

export function rememberPath(pathname: string) {
  try {
    if (pathname && pathname !== '/' && !pathname.startsWith('/login')) sessionStorage.setItem(LAST_PATH_KEY, pathname);
    if (pathname && pathname !== '/' && !pathname.startsWith('/login')) localStorage.setItem(LAST_PATH_KEY, pathname);
  } catch {
    /* storage unavailable */
  }
}

export function homePath(offlineSession = false): string {
  // Offline, only the till works.
  if (offlineSession) return '/pos';
  try {
    return localStorage.getItem(LAST_PATH_KEY) || '/dashboard';
  } catch {
    return '/dashboard';
  }
}
