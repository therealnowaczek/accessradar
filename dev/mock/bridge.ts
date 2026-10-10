import { setGlobalTheme } from '@atlaskit/tokens/set-global-theme';

/** Browser stand-in for @forge/bridge: resolvers are served by the Vite dev server. */
export async function invoke(key: string, payload: unknown) {
  const res = await fetch('/__rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, payload }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const view = {
  getContext: async () => ({
    moduleKey: 'accessradar-admin',
    siteUrl: 'https://example.atlassian.net',
  }),
  theme: {
    enable: async () => {
      await setGlobalTheme({ colorMode: 'light', typography: 'typography' });
    },
  },
};

export const router = {
  navigate: async (to: unknown) => console.log('[bridge] navigate', to),
  open: async (to: unknown) => console.log('[bridge] open', to),
};
