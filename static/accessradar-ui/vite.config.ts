import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Custom UI is served from a relative path inside the Forge iframe.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'build', sourcemap: false },
});
