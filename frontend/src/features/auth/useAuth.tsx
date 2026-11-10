import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { onSessionEnded, refreshSession, setAccessToken } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';
import {
  authApi,
  type AuthResponse,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
  type UpdateMePayload,
} from '../../services/auth.api';

/** Pre-upgrade builds kept a 7-day token here; it is removed on load. */
const LEGACY_TOKEN_KEY = 'ql_token';
/** Tells other open tabs that this one logged out. */
const AUTH_CHANNEL = 'questlog-auth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  updateMe: (payload: UpdateMePayload) => Promise<AuthUser>;
  /** Re-fetch /auth/me, e.g. after XP changes from completing or undoing a quest. */
  refreshUser: () => Promise<void>;
  /** Ends this device's session. */
  logout: () => Promise<void>;
  /** Ends every session on every device. */
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const signOutLocally = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    queryClient.clear(); // never show the previous user's cached data
  }, []);

  // Restore the session from the HttpOnly refresh cookie on first load
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
      // storage unavailable (private mode); nothing to clean up
    }
    let cancelled = false;
    refreshSession()
      .then((session) => {
        if (!cancelled) setUser(session?.user ?? null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh failed mid-session (expired, revoked elsewhere, or reuse detected)
  useEffect(() => onSessionEnded(signOutLocally), [signOutLocally]);

  // Logging out in one tab logs out the others
  useEffect(() => {
    const channel = openChannel();
    if (!channel) return;
    channel.onmessage = (event) => {
      if (event.data === 'logout') signOutLocally();
    };
    return () => channel.close();
  }, [signOutLocally]);

  const startSession = useCallback(({ token, user: u }: AuthResponse) => {
    setAccessToken(token);
    setUser(u);
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => startSession(await authApi.login(payload)),
    [startSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => startSession(await authApi.register(payload)),
    [startSession],
  );

  const updateMe = useCallback(async (payload: UpdateMePayload) => {
    const { user: u } = await authApi.updateMe(payload);
    setUser(u);
    return u;
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: u } = await authApi.getMe();
    setUser(u);
  }, []);

  const endSession = useCallback(
    async (revoke: () => Promise<void>) => {
      try {
        await revoke();
      } catch {
        // Signed out locally regardless; the server session expires on its own
      } finally {
        signOutLocally();
        const channel = openChannel();
        channel?.postMessage('logout');
        channel?.close();
      }
    },
    [signOutLocally],
  );

  const logout = useCallback(() => endSession(authApi.logout), [endSession]);
  const logoutAll = useCallback(() => endSession(authApi.logoutAll), [endSession]);

  const value = useMemo(
    () => ({ user, isLoading, login, register, updateMe, refreshUser, logout, logoutAll }),
    [user, isLoading, login, register, updateMe, refreshUser, logout, logoutAll],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
