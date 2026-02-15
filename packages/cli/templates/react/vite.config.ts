import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['nearstack-icon-192.svg', 'nearstack-icon-512.svg'],
      manifest: {
        name: '{{PROJECT_NAME}}',
        short_name: '{{PROJECT_NAME}}',
        description: 'A local-first notes app powered by Nearstack',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/nearstack-icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/nearstack-icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm']
  }
});
