import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icons/*.png", "pwa-*.png"],
      manifest: {
        name: "املاک علی‌بابا — AREP",
        short_name: "علی‌بابا",
        description: "پلتفرم مدیریت املاک علی‌بابا — ثبت ملک، مشتری، بازدید، معامله",
        theme_color: "#0d9488",
        background_color: "#f4f6f9",
        display: "standalone",
        scope: "/",
        start_url: "/",
        dir: "rtl",
        lang: "fa",
        icons: [
          {
            src: "icons/icon-72.png",
            sizes: "72x72",
            type: "image/png",
          },
          {
            src: "icons/icon-96.png",
            sizes: "96x96",
            type: "image/png",
          },
          {
            src: "icons/icon-144.png",
            sizes: "144x144",
            type: "image/png",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/telegram\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "telegram-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // API calls — NetworkFirst with fallback to cache for offline UX
            urlPattern: /^\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Public API — StaleWhileRevalidate for better offline public pages
            urlPattern: /\/api\/v1\/public\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "public-api-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    hmr: { clientPort: 443 },
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep the initial mobile payload small
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
});
