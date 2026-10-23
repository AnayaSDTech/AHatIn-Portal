import { env } from '../../config/env';
import { ApiError } from './types';

/**
 * Small fetch wrapper for the future FastAPI backend.
 * - Sends cookies (the real portal uses HttpOnly session cookies, never tokens in storage).
 * - Turns the backend's JSON error format into an ApiError.
 */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}/api/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    let body: { detail?: string; errors?: { field: string; message: string }[]; trace_id?: string } = {};
    try {
      body = await response.json();
    } catch {
      /* non-JSON error body */
    }
    const fieldErrors = Object.fromEntries((body.errors ?? []).map((e) => [e.field, e.message]));
    throw new ApiError(response.status, body.detail ?? 'Something went wrong. Please try again.', fieldErrors, body.trace_id);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
