/**
 * Whether to show demo labels and on-screen helpers. The demo accounts themselves are in the backend's demo data
 * (`python -m app.seed`) and aren't listed on the login pages. Hide these in production with VITE_SHOW_DEMO_HINTS=false.
 */
export const showDemoHints = import.meta.env.VITE_SHOW_DEMO_HINTS !== 'false';
