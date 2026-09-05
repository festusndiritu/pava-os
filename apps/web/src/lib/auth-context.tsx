'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearTokens, getAccessToken, pingActivity, setTokens, SESSION_EXPIRED_EVENT } from './api';
import type { ModuleKey } from './constants';

export interface AuthUser {
  id: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
  email?: string | null;
  avatar?: string | null;
  permissions: ModuleKey[];
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresInMinutes: number;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  idleWarning: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  loginWithPin: (userId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  hasPermission: (module: ModuleKey) => boolean;
  dismissIdleWarning: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// How long before the timeout to show "your session is about to expire".
const WARNING_LEAD_MS = 60_000;
// How often we check elapsed idle time.
const CHECK_INTERVAL_MS = 5_000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [idleWarning, setIdleWarning] = useState(false);
  const [timeoutMinutes, setTimeoutMinutes] = useState(30);

  const lastActivityRef = useRef(Date.now());
  const timeoutMinutesRef = useRef(timeoutMinutes);
  timeoutMinutesRef.current = timeoutMinutes;

  const hardLogout = useCallback(() => {
    clearTokens();
    setUser(null);
    setIdleWarning(false);
    router.push('/login');
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // best-effort — even if the network call fails, clear locally
    }
    hardLogout();
  }, [hardLogout]);

  const applySession = useCallback((data: LoginResponse) => {
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    setTimeoutMinutes(data.expiresInMinutes);
    lastActivityRef.current = Date.now();
    setIdleWarning(false);
  }, []);

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<LoginResponse>('/auth/login/password', { email, password }, { auth: false });
      applySession(data);
    },
    [applySession],
  );

  const loginWithPin = useCallback(
    async (userId: string, pin: string) => {
      const data = await api.post<LoginResponse>('/auth/login/pin', { userId, pin }, { auth: false });
      applySession(data);
    },
    [applySession],
  );

  const refreshMe = useCallback(async () => {
    const me = await api.get<AuthUser>('/auth/me');
    setUser(me);
  }, []);

  // Hydrate on load if we already have a token pair.
  useEffect(() => {
    (async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        await refreshMe();
      } catch {
        clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshMe]);

  // Force logout if the API layer decides the session can't be refreshed.
  useEffect(() => {
    const onExpired = () => hardLogout();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [hardLogout]);

  // Activity tracking + the idle-warning/auto-logout loop. Only runs while
  // logged in; "activity" is throttled implicitly by only mattering once per
  // CHECK_INTERVAL_MS tick.
  useEffect(() => {
    if (!user) return;

    const markActive = () => {
      lastActivityRef.current = Date.now();
      if (idleWarning) setIdleWarning(false);
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      const limitMs = timeoutMinutesRef.current * 60_000;
      if (idleMs >= limitMs) {
        logout();
      } else if (idleMs >= limitMs - WARNING_LEAD_MS) {
        setIdleWarning(true);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, logout]);

  // "Continue session" — resets the local clock AND pings the server so
  // Session.lastActiveAt (the thing that actually governs refresh) moves too.
  const dismissIdleWarning = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIdleWarning(false);
    pingActivity().catch(() => undefined);
  }, []);

  const hasPermission = useCallback(
    (module: ModuleKey) => {
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      return user.permissions.includes(module);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        idleWarning,
        loginWithPassword,
        loginWithPin,
        logout,
        refreshMe,
        hasPermission,
        dismissIdleWarning,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}