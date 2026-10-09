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

/** invoke() may wrap the body with metadata; normalise to the body. */
export async function call<T>(key: string): Promise<T> {
  const r = (await invoke<T>(key)) as unknown;
  if (
    r &&
    typeof r === 'object' &&
    'body' in r &&
    Object.keys(r).every((k) => k === 'body' || k === 'metadata')
  ) {
    return (r as { body: T }).body;
  }
  return r as T;
}

export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : 'Something went wrong.';
