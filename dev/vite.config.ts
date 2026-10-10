import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Local preview of the Custom UI (`npm run dev:ui`). The browser talks to an in-memory backend:
 * the real engine and `src/api/service.ts` run inside the Vite dev server, with the SQL-backed
 * modules and `@forge/api` swapped for the mocks in `dev/mock`. Nothing here is part of the app build.
 */
const root = resolve(__dirname, '..');
const mock = (name: string) => resolve(__dirname, 'mock', name);

function rpc(): Plugin {
  return {
    name: 'accessradar-dev-rpc',
    configureServer(server) {
      server.middlewares.use('/__rpc', (req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          try {
            const { key, payload } = JSON.parse(body || '{}');
            const mod = await server.ssrLoadModule(resolve(__dirname, 'server.ts'));
            const out = await mod.handle(String(key), payload ?? {});
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(out));
          } catch (e) {
            res.statusCode = 500;
            res.end(String((e as Error)?.stack ?? e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  root: resolve(root, 'static/app'),
  plugins: [react(), rpc()],
  resolve: {
    alias: [
      { find: '@forge/bridge', replacement: mock('bridge.ts') },
      { find: '@forge/api', replacement: mock('forge-api.ts') },
      { find: /^(\.\.?\/)+db\/audit$/, replacement: mock('db-audit.ts') },
      { find: /^(\.\.?\/)+db\/reviews$/, replacement: mock('db-reviews.ts') },
      { find: /^(\.\.?\/)+db\/settings$/, replacement: mock('db-settings.ts') },
      { find: /^(\.\.?\/)+db\/snapshots$/, replacement: mock('db-snapshots.ts') },
      { find: /^(\.\.?\/)+collector\/run$/, replacement: mock('collector-run.ts') },
    ],
  },
  server: { port: 5199, fs: { allow: [root] } },
});
