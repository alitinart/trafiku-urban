// Service worker for the web/PWA build. Generated after `expo export -p web`.
// Goal: near-zero repeat data use. App shell is precached; map tiles and
// glyphs (immutable, versioned URLs) are cache-first for 30 days.
module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{js,mjs,css,html,json,png,svg,ttf,woff2,ico}'],
  // workerSource is the native-only embedded worker; web loads /maplibre-gl-worker.mjs
  globIgnores: ['og.png', '**/workerSource-*.js', '**/*.map'],
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
  swDest: 'dist/sw.js',
  navigateFallback: '/index.html',
  clientsClaim: true,
  skipWaiting: true,
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org' && /\.(pbf|mvt)$/.test(url.pathname),
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles-v1',
        expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'map-meta-v1',
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
};
