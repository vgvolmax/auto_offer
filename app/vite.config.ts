import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appRoot = new URL('.', import.meta.url).pathname;
const buildOutput = new URL('../dist/app', import.meta.url).pathname;

export default defineConfig({
  root: appRoot,
  plugins: [react()],
  build: {
    outDir: buildOutput,
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: true,
  },
});
