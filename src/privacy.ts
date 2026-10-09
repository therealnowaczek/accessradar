import { privacy } from '@forge/api';
import { sha256 } from './engine/facts';
import { exec, q, chunk } from './db/sql';
import { invalidateFactCache } from './db/snapshots';
import { reviewAccountIds } from './db/reviews';
import { kvSet } from './db/settings';

/** Pseudonym that stays stable for the same account but reveals nothing about it. */
export function pseudonym(accountId: string): string {
  return `Closed account ${sha256(accountId).slice(0, 8)}`;
}

/** Replaces the cached display name of closed accounts in every stored version. */
export async function anonymize(accountIds: string[]): Promise<number> {
  let rows = 0;
  for (const accountId of accountIds) {
    const facts = await q<{ id: number; attrs: string }>(
      "SELECT id, attrs FROM fact WHERE kind = 'person' AND fkey = ?",
      accountId,
    );
    for (const f of facts) {
      const attrs = JSON.parse(f.attrs);
      if (attrs.anonymized) continue;
      attrs.displayName = pseudonym(accountId);
      attrs.anonymized = true;
      rows += await exec('UPDATE fact SET attrs = ? WHERE id = ?', JSON.stringify(attrs), f.id);
    }
    await exec(
      "UPDATE stage SET attrs = ? WHERE kind = 'person' AND fkey = ?",
      JSON.stringify({
        displayName: pseudonym(accountId),
        accountType: 'atlassian',
        active: false,
        anonymized: true,
      }),
      accountId,
    );
  }
  if (rows) invalidateFactCache();
  return rows;
}

/**
 * Daily personal-data report (report:personal-data). AccessRadar stores accountIds, cached display
 * names, account type and active flag; never e-mail addresses. Closed accounts are anonymised.
 */
export async function runPrivacyReport(): Promise<{
  reported: number;
  closed: number;
  updated: number;
}> {
  const persons = await q<{ fkey: string; last_seen: number }>(
    "SELECT fkey, MAX(last_seen) AS last_seen FROM fact WHERE kind = 'person' GROUP BY fkey",
  );
  const seqTimes = new Map(
    (await q<{ seq: number; started_at: number }>('SELECT seq, started_at FROM snap')).map((r) => [
      Number(r.seq),
      Number(r.started_at),
    ]),
  );
  const accounts = new Map<string, string>();
  for (const p of persons)
    accounts.set(p.fkey, new Date(seqTimes.get(Number(p.last_seen)) ?? Date.now()).toISOString());
  for (const id of await reviewAccountIds())
    if (!accounts.has(id)) accounts.set(id, new Date().toISOString());
  const closed: string[] = [];
  let updated = 0;
  for (const part of chunk([...accounts], 90)) {
    const res = await privacy.reportPersonalData(
      part.map(([accountId, updatedAt]) => ({ accountId, updatedAt })),
    );
    for (const u of res ?? []) {
      if (u.status === 'closed') closed.push(u.accountId);
      else updated += 1;
    }
  }
  // Idempotent: already anonymised rows are skipped, so no list of closed accounts is kept.
  if (closed.length) await anonymize(closed);
  await kvSet('privacy:lastRun', {
    at: Date.now(),
    reported: accounts.size,
    closed: closed.length,
    updated,
  });
  return { reported: accounts.size, closed: closed.length, updated };
}
