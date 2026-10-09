import { invoke } from '@forge/bridge';

export type Status = { engineVersion: string; spike: boolean };
export type ProjectRow = {
  id: string;
  key: string;
  name: string;
  typeKey: string;
  managed: 'company' | 'team';
  category?: string;
};
export type ProjectList = { projects: ProjectRow[]; complete: boolean };
export type Probe = { name: string; status: number; count?: number; error?: string };
export type SpikeResult = { asUser: Probe[]; asApp: Probe[]; impersonationQueued: boolean };

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; forbidden?: boolean };

/** Resolvers answer { ok, data } | { ok: false, error } (MarginRadar convention); unwrap or throw. */
export async function call<T>(key: string, payload: Record<string, unknown> = {}): Promise<T> {
  const r = (await invoke(key, payload)) as Result<T> | undefined;
  if (!r || typeof r !== 'object' || !('ok' in r))
    throw new Error('Unexpected response from AccessRadar.');
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : 'Something went wrong.';
