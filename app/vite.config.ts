import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({ root: resolve(__dirname), plugins:[react()], build:{outDir:resolve(__dirname,'../dist/app'),emptyOutDir:true}, test:{environment:'jsdom',setupFiles:['./src/test/setup.ts'],include:['src/**/*.test.{ts,tsx}'],css:true} });
