import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const buildOutput = fileURLToPath(new URL('../dist/app', import.meta.url));

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
