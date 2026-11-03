import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Облако Музыки',
        short_name: 'Музыка',
        description: 'Локальная коллекция музыки',
        lang: 'ru',
        theme_color: '#0b0b0b',
        background_color: '#0b0b0b',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2,ico,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      vue: fileURLToPath(new URL('../../node_modules/vue', import.meta.url)),
    },
    dedupe: ['vue'],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/': {
        target: process.env.MH_API_URL ?? 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
    fs: {
      allow: [fileURLToPath(new URL('../..', import.meta.url))],
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../dist/client', import.meta.url)),
    emptyOutDir: true,
  },
});
