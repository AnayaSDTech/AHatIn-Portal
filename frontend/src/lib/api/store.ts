import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from './client';
import { ApiError } from './types';

/**
 * A small shared cache of API data, keyed by path. Every screen that shows the same data reads the same
 * entry, so a change made anywhere appears everywhere. After any change the data on screen is fetched
 * again, so student and staff views always match the server. Data is also refreshed when the tab comes
 * back into view, and on a timer for paths that change often (e.g. messages).
 */

type Listener = () => void;
interface Entry {
  data: unknown;
  loaded: boolean;
  inflight?: Promise<void>;
}

const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<Listener>>();

const notify = (path: string) => listeners.get(path)?.forEach((l) => l());

async function load(path: string) {
  const entry = entries.get(path) ?? { data: undefined, loaded: false };
  entries.set(path, entry);
  if (entry.inflight) return entry.inflight;
  entry.inflight = api
    .get<unknown>(path)
    .then((data) => {
      entry.data = data;
      entry.loaded = true;
    })
    .catch((err) => {
      // Keep showing the last good data; a missing record shows as "not found".
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        entry.data = undefined;
        entry.loaded = true;
      }
    })
    .finally(() => {
      entry.inflight = undefined;
      notify(path);
    });
  return entry.inflight;
}

function subscribe(path: string, listener: Listener) {
  if (!listeners.has(path)) listeners.set(path, new Set());
  listeners.get(path)!.add(listener);
  if (!entries.get(path)?.loaded) void load(path);
  return () => listeners.get(path)?.delete(listener);
}

/** Fetches every path that is on screen again. */
export async function refreshAll() {
  await Promise.all([...listeners.entries()].filter(([, ls]) => ls.size > 0).map(([path]) => load(path)));
}

/** Forgets everything (on sign-in and sign-out). */
export function clearCache() {
  const paths = [...entries.keys()];
  entries.clear();
  paths.forEach(notify);
}

/** Shared failure message for changes made without their own error display. */
export function reportError(err: unknown) {
  const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
  window.dispatchEvent(new CustomEvent('ahat:error', { detail: message }));
}

/**
 * Runs a change on the server, then refreshes the data on screen.
 * Errors are shown in the shared message bar and passed on, so forms can react too.
 */
export async function mutate<T>(request: () => Promise<T>, { silent = false } = {}): Promise<T> {
  try {
    return await request();
  } catch (err) {
    if (!silent) reportError(err);
    throw err;
  } finally {
    await refreshAll();
  }
}

/** Fire-and-forget version for buttons whose result is shown by the refreshed data. */
export const act = (request: () => Promise<unknown>) => void mutate(request).catch(() => undefined);

const EMPTY = Symbol('empty');

/** React hook: the data at `path` (or `fallback` until it has loaded). Pass null to skip. */
export function useApi<T>(path: string | null, fallback: T, { pollMs }: { pollMs?: number } = {}): [T, boolean] {
  const key = path ?? '';
  const snapshot = useSyncExternalStore(
    useCallback((l: Listener) => (path ? subscribe(path, l) : () => undefined), [path]),
    () => (path ? (entries.get(key)?.loaded ? entries.get(key)!.data : EMPTY) : EMPTY),
  );
  useEffect(() => {
    if (!path || !pollMs) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void load(path);
    }, pollMs);
    return () => clearInterval(t);
  }, [path, pollMs]);
  return snapshot === EMPTY ? [fallback, false] : [(snapshot ?? fallback) as T, true];
}

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshAll();
  });
}
