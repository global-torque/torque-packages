import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';
import path from 'node:path';

export default defineConfig({
  plugins: [
    vue(),
    svgLoader({ svgo: false }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    dedupe: ['vue', 'pinia', 'vue-router'],
    alias: [
      { find: /^@vueuse\/integrations\/(.*)$/, replacement: '@vueuse/integrations/$1.js' },
      { find: /^pinia$/, replacement: path.resolve(import.meta.dirname, 'node_modules/pinia/dist/pinia.mjs') },
    ],
  },
});
