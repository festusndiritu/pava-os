'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearTokens, getAccessToken, pingActivity, setTokens, SESSION_EXPIRED_EVENT } from './api';
import { releaseDeviceOnLogout } from './push';
import { ADMIN_ONLY_MODULES, type ModuleKey } from './constants';

export interface AuthUser {
  id: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
  email?: string | null;
  avatar?: string | null;
  permissions: ModuleKey[];
  canViewCost: boolean;
  canInvoiceWithoutStock: boolean;
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
  canViewCost: () => boolean;
  dismissIdleWarning: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const WARNING_LEAD_MS = 60_000;
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

  // `releaseDevice`: also stop this device receiving the signed-out person's push notifications.
  const endSession = useCallback(
    async (releaseDevice: boolean) => {
      if (releaseDevice) {
        // Needs the token still valid, so it goes first; capped so a slow network can never hold up
        // signing out.
        await Promise.race([releaseDeviceOnLogout(), new Promise<void>((r) => setTimeout(r, 3000))]);
      }
      try {
        await api.post('/auth/logout');
      } catch {
      }
      hardLogout();
    },
    [hardLogout],
  );
  const logout = useCallback(() => endSession(true), [endSession]);

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

  // Activity tracking + the idle-warning/auto-logout loop.
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
        void endSession(false);
      } else if (idleMs >= limitMs - WARNING_LEAD_MS) {
        setIdleWarning(true);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, endSession]);

  const dismissIdleWarning = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIdleWarning(false);
    pingActivity().catch(() => undefined);
  }, []);

  const hasPermission = useCallback(
    (module: ModuleKey) => {
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      // USERS/AUDIT stay admin-only even if a permissions array somehow still carries them (e.g.
      if (ADMIN_ONLY_MODULES.includes(module)) return false;
      return user.permissions.includes(module);
    },
    [user],
  );

  const canViewCost = useCallback(() => {
    if (!user) return false;
    return user.role === 'ADMIN' || user.canViewCost;
  }, [user]);

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
        canViewCost,
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