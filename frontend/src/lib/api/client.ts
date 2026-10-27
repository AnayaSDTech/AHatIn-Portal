import { env } from '../../config/env';
import { ApiError } from './types';

const CSRF_COOKIE = 'ahat_csrf';
const UNSAFE = ['POST', 'PUT', 'PATCH', 'DELETE'];

function readCookie(name: string) {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * Small fetch wrapper for the FastAPI backend.
 * - Sends cookies (HttpOnly session cookie; no tokens in browser storage).
 * - Sends the CSRF token (double-submit cookie) on every change.
 * - Turns the backend's JSON error format into an ApiError.
 * - Tells the app when the session has ended (401), so it can show the login page.
 */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const csrf = UNSAFE.includes(method) ? readCookie(CSRF_COOKIE) : undefined;
  const response = await fetch(`${env.apiBaseUrl}/api/v1${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}), ...(init.headers ?? {}) },
  });

  if (!response.ok) {
    let body: { detail?: string; errors?: { field: string; message: string }[]; trace_id?: string } = {};
    try {
      body = await response.json();
    } catch {
      /* non-JSON error body */
    }
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('ahat:signed-out'));
    const fieldErrors = Object.fromEntries((body.errors ?? []).map((e) => [e.field, e.message]));
    throw new ApiError(response.status, body.detail ?? 'Something went wrong. Please try again.', fieldErrors, body.trace_id);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body: unknown = {}) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown = {}) => apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown = {}) => apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
