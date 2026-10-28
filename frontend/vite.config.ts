import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A new upload replaces the old version straight away (no "Refresh" click needed), so a broken or old
      // cached copy can't keep showing.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'AHat International Educational Consultancy',
        short_name: 'AHat',
        description:
          'Free study-abroad guidance for Indian students: UK and Europe. Demo website and student portal.',
        theme_color: '#0B1F3A',
        background_color: '#FAF7F2',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'en-IN',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app shell only. The real portal must never cache personal data.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'demo-images',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  // 10-character hashes: every built file got a new name once, so browsers that cached a broken first upload of
  // ahat.in (HTML stored under a script's name) download fresh copies.
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash:10].js',
        chunkFileNames: 'assets/[name]-[hash:10].js',
        assetFileNames: 'assets/[name]-[hash:10][extname]',
      },
    },
  },
  // Requests to /api go to the FastAPI backend, so the app and the API share one origin
  // (cookies stay first-party). In production the web server or host does the same.
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
  preview: {
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
});
