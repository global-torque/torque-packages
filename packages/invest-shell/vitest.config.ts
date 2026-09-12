import { configDefaults, defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';
import path from 'node:path';

export default defineConfig({
  plugins: [vue(), svgLoader({ svgo: false })],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'scripts/**/*.test.mjs'],
  },
  resolve: {
    dedupe: ['vue'],
    alias: {
    },
  },
});
