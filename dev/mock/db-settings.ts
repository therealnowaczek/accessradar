import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '../../src/db/settings.ts';

const kv = new Map<string, unknown>([['settings', { ...DEFAULT_SETTINGS, frequency: 'daily' }]]);

export async function kvGet<T>(k: string): Promise<T | null> {
  return (kv.get(k) as T | undefined) ?? null;
}

export async function getSettings(): Promise<Settings & { saved: boolean }> {
  const stored = kv.get('settings') as Partial<Settings> | undefined;
  return { ...sanitizeSettings(stored ?? {}, DEFAULT_SETTINGS), saved: stored !== undefined };
}

export async function saveSettings(input: unknown): Promise<Settings> {
  const current = await getSettings();
  const next = sanitizeSettings({ ...current, ...(input as object) }, current);
  kv.set('settings', next);
  return next;
}
