const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_URL}${path}`;
}

export class ApiError extends Error {
  status: number;
  // The parsed error body, when the server sent one.
  details: Record<string, unknown> | null;

  constructor(status: number, message: string, details: Record<string, unknown> | null = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Fired when a session can no longer be refreshed (expired, revoked, or idle too long).
export const SESSION_EXPIRED_EVENT = 'pava:session-expired';

let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
    return res.ok;
  } catch {
    return false;
  }
}

// De-dupes concurrent refresh attempts: if five requests 401 at once, only one actual /auth/refresh
// call goes out.
async function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

interface ApiOptions extends RequestInit {
  auth?: boolean; // default true Called with the response headers of a successful request.
  onHeaders?: (headers: Headers) => void;
}

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, headers, onHeaders, ...rest } = options;

  const buildHeaders = () => {
    const h = new Headers(headers);
    if (rest.body && !h.has('Content-Type')) h.set('Content-Type', 'application/json');
    return h;
  };

  let res = await fetch(`${API_URL}${path}`, { ...rest, headers: buildHeaders(), credentials: 'include' });

  if (res.status === 401 && auth) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      res = await fetch(`${API_URL}${path}`, { ...rest, headers: buildHeaders(), credentials: 'include' });
    } else {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let details: Record<string, unknown> | null = null;
    try {
      const body = await res.json();
      message = body?.message || message;
      if (body && typeof body === 'object') details = body as Record<string, unknown>;
    } catch {
    }
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message, details);
  }

  onHeaders?.(res.headers);
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
  // One page of a list plus how many rows match in all (the X-Total-Count header).
  getPage: async <T = unknown>(path: string, options?: ApiOptions) => {
    const meta: { total: number | null } = { total: null };
    const items = await apiFetch<T[]>(path, {
      ...options,
      method: 'GET',
      onHeaders: (h) => {
        const raw = h.get('X-Total-Count');
        const n = raw === null ? NaN : Number(raw);
        meta.total = Number.isFinite(n) ? n : null;
      },
    });
    return { items, total: meta.total ?? items.length };
  },
};