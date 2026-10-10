/** Bundled Noto Sans (SIL OFL) — loaded from the Custom UI bundle, no CDN/egress. */

import boldUrl from './fonts/NotoSans-Bold.ttf?url';
import regularUrl from './fonts/NotoSans-Regular.ttf?url';

let cache: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function readFont(viteUrl: string, fileName: string): Promise<Uint8Array> {
  // Node / Vitest: read the source TTF next to this module (import.meta.url).
  if (typeof process !== 'undefined' && process.versions?.node) {
    // @vite-ignore — node-only path for Vitest; browser uses fetch(viteUrl) below.
    const { readFileSync } = await import(/* @vite-ignore */ 'node:fs');
    const { fileURLToPath } = await import(/* @vite-ignore */ 'node:url');
    return new Uint8Array(
      readFileSync(fileURLToPath(new URL(`./fonts/${fileName}`, import.meta.url))),
    );
  }
  // Browser (Forge Custom UI): Vite emits a hashed asset URL inside the bundle.
  const res = await fetch(viteUrl);
  if (!res.ok) throw new Error(`Failed to load font ${fileName}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function loadNotoFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  if (cache) return cache;
  const [regular, bold] = await Promise.all([
    readFont(regularUrl, 'NotoSans-Regular.ttf'),
    readFont(boldUrl, 'NotoSans-Bold.ttf'),
  ]);
  cache = { regular, bold };
  return cache;
}
