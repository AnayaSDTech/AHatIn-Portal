// Central place for environment settings. Only public values belong in VITE_ variables.
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  authMode: (import.meta.env.VITE_AUTH_MODE ?? 'mock') as 'mock' | 'api',
};
