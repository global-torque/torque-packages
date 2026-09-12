import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';
import path from 'node:path';

export default defineConfig({
  plugins: [
    vue(),
    svgLoader({ svgo: false }),
  ],
  resolve: {
    alias: {
      UiKit: path.resolve(import.meta.dirname, '../ui-kit/src'),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
