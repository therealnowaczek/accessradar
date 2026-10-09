import { privacy } from '@forge/api';
import { sha256 } from './engine/facts';
import { exec, q, chunk, placeholders } from './db/sql';
import { invalidateFactCache } from './db/snapshots';
import { reviewAccountIds } from './db/reviews';
import { kvSet } from './db/settings';

/**
 * Personal data AccessRadar stores: Atlassian accountIds, cached display names, account type and
 * active flag (never e-mail addresses or issue content).
 *
 * Closed accounts are PSEUDONYMISED, not erased: the display name is replaced everywhere it is
 * cached by a stable pseudonym, while the accountId is kept as the key of snapshots, review items,
 * sign-offs and the audit log (evidence integrity: the signed hash covers accountIds only).
 */

/** Atlassian's default reporting cycle per accountId ("Cycle-Period", 7 days). */
export const REPORT_CYCLE_MS = 7 * 24 * 3600_000;
const BATCH = 90;

/** Stable pseudonym for a closed account; reveals nothing about it. */
export function pseudonym(accountId: string): string {
  return `Closed account ${sha256(accountId).slice(0, 8)}`;
}

const isPseudonymised = (attrs: Record<string, unknown>) =>
  attrs.pseudonymized === true || attrs.anonymized === true;

/** Replaces the cached display name of closed accounts in every stored version. Idempotent. */
export async function pseudonymize(accountIds: string[]): Promise<number> {
  let rows = 0;
  for (const part of chunk(accountIds, 100)) {
    const facts = await q<{ id: number; fkey: string; attrs: string }>(
      `SELECT id, fkey, attrs FROM fact WHERE kind = 'person' AND fkey IN (${part.map(() => '?').join(', ')})`,
      ...part,
    );
    for (const f of facts) {
      const attrs = JSON.parse(f.attrs) as Record<string, unknown>;
      if (isPseudonymised(attrs) && attrs.displayName === pseudonym(f.fkey)) continue;
      attrs.displayName = pseudonym(f.fkey);
      attrs.pseudonymized = true;
      delete attrs.anonymized;
      rows += await exec('UPDATE fact SET attrs = ? WHERE id = ?', JSON.stringify(attrs), f.id);
    }
    for (const accountId of part)
      await exec(
        "UPDATE stage SET attrs = ? WHERE kind = 'person' AND fkey = ?",
        JSON.stringify({
          displayName: pseudonym(accountId),
          accountType: 'atlassian',
          active: false,
          pseudonymized: true,
        }),
        accountId,
      );
  }
  if (rows) invalidateFactCache();
  return rows;
}

export type ReportState = Map<string, { lastReported: number; closed: boolean }>;

/** Accounts to report now: never reported, or reported a full cycle ago and not closed. */
export function dueAccounts(
  accounts: Map<string, number>,
  state: ReportState,
  now: number,
): Array<[string, number]> {
  return [...accounts].filter(([id]) => {
    const s = state.get(id);
    return !s || (!s.closed && now - s.lastReported >= REPORT_CYCLE_MS);
  });
}

/** Every accountId AccessRadar stores, with the time its data was last refreshed. */
async function storedAccounts(): Promise<Map<string, number>> {
  const persons = await q<{ fkey: string; last_seen: number }>(
    "SELECT fkey, MAX(last_seen) AS last_seen FROM fact WHERE kind = 'person' GROUP BY fkey",
  );
  const seqTimes = new Map(
    (await q<{ seq: number; started_at: number }>('SELECT seq, started_at FROM snap')).map((r) => [
      Number(r.seq),
      Number(r.started_at),
    ]),
  );
  const now = Date.now();
  const accounts = new Map<string, number>();
  for (const p of persons) accounts.set(p.fkey, seqTimes.get(Number(p.last_seen)) ?? now);
  for (const id of await reviewAccountIds()) if (!accounts.has(id)) accounts.set(id, now);
  const actors = await q<{ actor: string }>(
    "SELECT DISTINCT actor FROM audit_event WHERE actor <> 'system'",
  );
  for (const a of actors) if (!accounts.has(a.actor)) accounts.set(a.actor, now);
  return accounts;
}

/**
 * Personal-data report (report:personal-data). Runs daily but reports each accountId at most
 * once per 7-day cycle, and never re-reports an account Atlassian has reported as closed.
 */
export async function runPrivacyReport(now = Date.now()): Promise<{
  stored: number;
  reported: number;
  closed: number;
  updated: number;
  closedTotal: number;
}> {
  const accounts = await storedAccounts();
  const state = new Map(
    (
      await q<{ account_id: string; last_reported: number; closed_at: number | null }>(
        'SELECT account_id, last_reported, closed_at FROM privacy_account',
      )
    ).map((r) => [
      r.account_id,
      {
        lastReported: Number(r.last_reported),
        closed: r.closed_at !== null && r.closed_at !== undefined,
      },
    ]),
  );
  const due = dueAccounts(accounts, state, now);
  const closed: string[] = [];
  let updated = 0;
  for (const part of chunk(due, BATCH)) {
    const res = await privacy.reportPersonalData(
      part.map(([accountId, at]) => ({ accountId, updatedAt: new Date(at).toISOString() })),
    );
    const closedHere = new Set<string>();
    for (const u of res ?? []) {
      if (u.status === 'closed') closedHere.add(u.accountId);
      else updated += 1; // display names are refreshed by the next snapshot
    }
    await exec(
      `INSERT INTO privacy_account (account_id, last_reported, closed_at) VALUES ${placeholders(part.length, 3)}
       ON DUPLICATE KEY UPDATE last_reported = VALUES(last_reported),
         closed_at = COALESCE(privacy_account.closed_at, VALUES(closed_at))`,
      ...part.flatMap(([id]) => [id, now, closedHere.has(id) ? now : null]),
    );
    closed.push(...closedHere);
  }
  // Re-apply pseudonyms for every closed account: a later snapshot may have stored a new version.
  const allClosed = [
    ...new Set([...closed, ...[...state].filter(([, s]) => s.closed).map(([id]) => id)]),
  ].filter((id) => accounts.has(id));
  if (allClosed.length) await pseudonymize(allClosed);
  // Forget reporting state for accounts no longer stored anywhere (e.g. removed by retention).
  const gone = [...state.keys()].filter((id) => !accounts.has(id));
  for (const part of chunk(gone, 200))
    await exec(
      `DELETE FROM privacy_account WHERE account_id IN (${part.map(() => '?').join(', ')})`,
      ...part,
    );
  const summary = {
    stored: accounts.size,
    reported: due.length,
    closed: closed.length,
    updated,
    closedTotal: allClosed.length,
  };
  await kvSet('privacy:lastRun', { at: now, ...summary });
  return summary;
}
