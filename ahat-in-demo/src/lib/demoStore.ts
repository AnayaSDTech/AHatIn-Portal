import { useCallback, useSyncExternalStore } from 'react';

/**
 * DEMO ONLY: a tiny shared "database" in this browser's localStorage.
 * Every role (student, counsellor, admin) reads and writes the same collections, so a session a
 * student books appears in the counsellor's schedule. Components re-render when a collection
 * changes, in this tab and in other tabs. The real portal uses the FastAPI backend instead.
 */

const PREFIX = 'ahatin-demo-db-v2:';
type Listener = () => void;

const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<Listener>>();

function notify(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

export function readShared<T>(key: string, initial: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let value = initial;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) value = JSON.parse(raw) as T;
  } catch {
    /* unreadable: fall back to the seed */
  }
  cache.set(key, value);
  return value;
}

export function writeShared<T>(key: string, value: T) {
  cache.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
  notify(key);
}

export function updateShared<T>(key: string, initial: T, fn: (prev: T) => T) {
  writeShared(key, fn(readShared(key, initial)));
}

/** Clears every shared demo collection (used by "Reset demo data"). */
export function resetShared() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
  const keys = [...cache.keys()];
  cache.clear();
  keys.forEach(notify);
}

if (typeof window !== 'undefined') {
  // Keep other open tabs in step.
  window.addEventListener('storage', (e) => {
    if (!e.key?.startsWith(PREFIX)) return;
    const key = e.key.slice(PREFIX.length);
    cache.delete(key);
    notify(key);
  });
}

function subscribe(key: string, listener: Listener) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(listener);
  return () => listeners.get(key)?.delete(listener);
}

type Updater<T> = T | ((prev: T) => T);

/** React hook for one shared collection. */
export function useShared<T>(key: string, initial: T): [T, (update: Updater<T>) => void] {
  const value = useSyncExternalStore(
    (l) => subscribe(key, l),
    () => readShared(key, initial),
  );
  const set = useCallback(
    (update: Updater<T>) =>
      updateShared(key, initial, (prev) => (typeof update === 'function' ? (update as (p: T) => T)(prev) : update)),
    [key, initial],
  );
  return [value, set];
}
