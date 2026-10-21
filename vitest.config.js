import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['js/**/*.test.{js,mjs,cjs,ts,mts,cts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['js/*.js'],
      exclude: ['js/app.js', 'js/test-*.js', 'js/browser-e2e.js', 'js/capture-themes.js'],
    },
    setupFiles: ['js/test-setup.js'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'js'),
    },
  },
});