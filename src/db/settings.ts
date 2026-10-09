import { DEFAULT_KEY_PERMISSIONS } from '../engine/resolve';
import { exec, q } from './sql';

export type Frequency = 'off' | 'daily' | 'weekly';

export interface Settings {
  frequency: Frequency;
  /** Hour of day (UTC) when scheduled snapshots start. */
  hourUtc: number;
  /** ISO weekday for weekly snapshots, 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** Snapshots older than this are deleted unless a review pins them. */
  retentionDays: number;
  keyPermissions: string[];
  /** Collect members of groups that grant access only, or of every group. */
  groupMembers: 'referenced' | 'all';
  largeGroupThreshold: number;
  wideAdminProjects: number;
  /** Fallback identity when the app user is denied: offline impersonation of this admin. */
  fallbackAccountId: string | null;
  /** Own rate-point budget per hour for this site (Jira app quota is shared by all sites). */
  hourlyPointBudget: number;
  showAppAccounts: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  frequency: 'weekly',
  hourUtc: 2,
  weekday: 1,
  retentionDays: 395,
  keyPermissions: DEFAULT_KEY_PERMISSIONS,
  groupMembers: 'referenced',
  largeGroupThreshold: 50,
  wideAdminProjects: 3,
  fallbackAccountId: null,
  hourlyPointBudget: 20000,
  showAppAccounts: false,
};

const PERMISSION_KEY = /^[A-Z][A-Z0-9_]{1,63}$/;

const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** Runtime validation of untrusted input; unknown fields are dropped, bad values fall back. */
export function sanitizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const perms = Array.isArray(i.keyPermissions)
    ? [
        ...new Set(
          i.keyPermissions.filter(
            (p): p is string => typeof p === 'string' && PERMISSION_KEY.test(p),
          ),
        ),
      ]
    : base.keyPermissions;
  return {
    frequency: ['off', 'daily', 'weekly'].includes(i.frequency as string)
      ? (i.frequency as Frequency)
      : base.frequency,
    hourUtc: int(i.hourUtc, 0, 23, base.hourUtc),
    weekday: int(i.weekday, 1, 7, base.weekday),
    retentionDays: int(i.retentionDays, 30, 3650, base.retentionDays),
    keyPermissions: perms.length ? perms.slice(0, 20) : base.keyPermissions,
    groupMembers:
      i.groupMembers === 'all' || i.groupMembers === 'referenced'
        ? i.groupMembers
        : base.groupMembers,
    largeGroupThreshold: int(i.largeGroupThreshold, 2, 100000, base.largeGroupThreshold),
    wideAdminProjects: int(i.wideAdminProjects, 1, 10000, base.wideAdminProjects),
    fallbackAccountId:
      i.fallbackAccountId === null
        ? null
        : typeof i.fallbackAccountId === 'string' && /^[\w:-]{1,128}$/.test(i.fallbackAccountId)
          ? i.fallbackAccountId
          : base.fallbackAccountId,
    hourlyPointBudget: int(i.hourlyPointBudget, 500, 65000, base.hourlyPointBudget),
    showAppAccounts:
      typeof i.showAppAccounts === 'boolean' ? i.showAppAccounts : base.showAppAccounts,
  };
}

export async function kvGet<T>(k: string): Promise<T | null> {
  const rows = await q<{ v: string }>('SELECT v FROM kv WHERE k = ?', k);
  if (!rows.length) return null;
  try {
    return JSON.parse(rows[0].v) as T;
  } catch {
    return null;
  }
}

export async function kvSet(k: string, value: unknown): Promise<void> {
  await exec(
    'INSERT INTO kv (k, v, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = VALUES(updated_at)',
    k,
    JSON.stringify(value),
    Date.now(),
  );
}

export async function getSettings(): Promise<Settings & { saved: boolean }> {
  const stored = await kvGet<Partial<Settings>>('settings');
  return { ...sanitizeSettings(stored ?? {}, DEFAULT_SETTINGS), saved: stored !== null };
}

export async function saveSettings(input: unknown): Promise<Settings> {
  const current = await getSettings();
  const next = sanitizeSettings({ ...current, ...(input as object) }, current);
  await kvSet('settings', next);
  return next;
}
