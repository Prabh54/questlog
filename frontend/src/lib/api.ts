import type { AuthResponse } from '@questlog/shared';

/**
 * Same-origin by default: in development Vite proxies /api to the API, and in
 * production the web app's nginx does. Same-origin is what lets the refresh
 * cookie be SameSite=Strict and first-party (no third-party-cookie problems).
 */
// `||`, not `??`: an unset Docker build arg arrives as an empty string
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get isUnauthorized() {
    return this.status === 401;
  }
  get isNotFound() {
    return this.status === 404;
  }
  get isConflict() {
    return this.status === 409;
  }
}

// ── Session state ────────────────────────────────────────────────────────
// The access token lives only in this module's memory, never in localStorage,
// so an XSS bug can't lift a long-lived credential out of storage. The refresh
// token is an HttpOnly cookie that JavaScript can't read at all.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

type SessionListener = () => void;
const sessionEndedListeners = new Set<SessionListener>();

/** Called when the session can't be refreshed any more (expired, revoked, reused). */
export function onSessionEnded(listener: SessionListener): () => void {
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
}

let refreshInFlight: Promise<AuthResponse | null> | null = null;

async function requestRefresh(): Promise<AuthResponse | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthResponse;
  } catch {
    return null;
  }
}

/**
 * Exchanges the refresh cookie for a new access token.
 *
 * Refresh tokens are single-use and the server treats a second use as theft,
 * so refreshes must never overlap: concurrent callers in this tab share one
 * request, and the Web Locks API serialises refreshes across tabs (the next
 * tab then sends the cookie the previous refresh just rotated).
 */
export function refreshSession(): Promise<AuthResponse | null> {
  if (!refreshInFlight) {
    const run = () => requestRefresh();
    const locked: Promise<AuthResponse | null> =
      typeof navigator !== 'undefined' && navigator.locks
        ? new Promise<AuthResponse | null>((resolve, reject) => {
            // The lock is held until the callback's promise settles
            navigator.locks
              .request('questlog-refresh', () => run().then(resolve, reject))
              .catch(reject);
          })
        : run();
    refreshInFlight = locked
      .then((result) => {
        setAccessToken(result?.token ?? null);
        return result;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Endpoints whose 401 means "wrong credentials", not "access token expired"
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

async function apiFetch<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: 'include' });

  // Access token expired (or the page just loaded): refresh once, then retry
  if (res.status === 401 && !retried && !NO_REFRESH.includes(path)) {
    if (await refreshSession()) return apiFetch<T>(path, init, true);
    sessionEndedListeners.forEach((listener) => listener());
  }

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, string>;
    throw new ApiError(
      res.status,
      body['error'] ?? 'UNKNOWN_ERROR',
      body['message'] ?? 'Request failed',
    );
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
