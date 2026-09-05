const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ACCESS_KEY = 'pava.accessToken';
const REFRESH_KEY = 'pava.refreshToken';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Fired when a session can no longer be refreshed (expired, revoked, or
// idle too long). AuthProvider listens for this to clear its user state and
// bounce to /login — kept as an event rather than a direct import so this
// file has no dependency on React.
export const SESSION_EXPIRED_EVENT = 'pava:session-expired';

let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// De-dupes concurrent refresh attempts: if five requests 401 at once, only
// one actual /auth/refresh call goes out.
async function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

interface ApiOptions extends RequestInit {
  auth?: boolean; // default true
}

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;

  const buildHeaders = () => {
    const h = new Headers(headers);
    if (rest.body && !h.has('Content-Type')) h.set('Content-Type', 'application/json');
    if (auth) {
      const token = getAccessToken();
      if (token) h.set('Authorization', `Bearer ${token}`);
    }
    return h;
  };

  let res = await fetch(`${API_URL}${path}`, { ...rest, headers: buildHeaders() });

  if (res.status === 401 && auth && getRefreshToken()) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      res = await fetch(`${API_URL}${path}`, { ...rest, headers: buildHeaders() });
    } else {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.message || message;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function pingActivity(): Promise<boolean> {
  return refreshOnce();
}

export const api = {
  get: <T = unknown>(path: string, options?: ApiOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(path: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T = unknown>(path: string, options?: ApiOptions) => apiFetch<T>(path, { ...options, method: 'DELETE' }),
};