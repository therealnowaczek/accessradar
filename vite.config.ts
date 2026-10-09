import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Custom UI (resource `custom-ui`) is served from a relative path inside the Forge iframe.
export default defineConfig({
  root: resolve(__dirname, 'static/app'),
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
