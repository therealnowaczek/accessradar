import { sha256 } from './facts';
import type { ReviewItemDraft } from './review';

/**
 * Recheck (C5): a keep, revoke or exception decision goes stale when the access it was made on
 * changed in a later snapshot. The fingerprint covers what the reviewer judged: the permissions and
 * the paths (direct, group, role) that grant them. Display names and counts are not part of it.
 */
export function accessFingerprint(permissions: readonly string[], pathCodes: readonly string[]) {
  // Stored items keep at most 20 path codes (db/reviews.ts); compare on the same basis.
  const codes = pathCodes.slice(0, 20);
  return sha256(
    JSON.stringify({ p: [...new Set(permissions)].sort(), c: [...new Set(codes)].sort() }),
  );
}

export interface DecidedItem {
  idx: number;
  itemKey: string;
  permissions: string[];
  pathCodes: string[];
  change: 'new' | 'unchanged' | 'removed' | null;
  decision: 'keep' | 'revoke' | 'exception' | null;
  /** Fingerprint recorded when the decision was last rechecked; null = the review's own snapshot. */
  ackFp: string | null;
}

export interface StaleItem {
  idx: number;
  itemKey: string;
  /** Fingerprint of the access in the latest complete snapshot (recorded when re-decided). */
  currentFp: string;
  currentPermissions: string[];
}

/**
 * Items whose decision no longer matches the access in `current` (the latest complete snapshot).
 * Not stale: no decision yet, removed-since-comparison rows, and access that is gone (nothing left
 * to recheck; revoke is verified by remediation).
 */
export function findStale(
  items: readonly DecidedItem[],
  current: ReadonlyMap<string, ReviewItemDraft>,
): StaleItem[] {
  const out: StaleItem[] = [];
  for (const it of items) {
    if (!it.decision || it.change === 'removed') continue;
    const now = current.get(it.itemKey);
    if (!now) continue;
    const reviewed = it.ackFp ?? accessFingerprint(it.permissions, it.pathCodes);
    const currentFp = accessFingerprint(now.permissions, now.pathCodes);
    if (currentFp !== reviewed)
      out.push({
        idx: it.idx,
        itemKey: it.itemKey,
        currentFp,
        currentPermissions: [...now.permissions],
      });
  }
  return out;
}

export function recheckBlockMessage(count: number): string {
  return `${count} decision(s) need a recheck because access changed after the review snapshot. Decide them again to continue.`;
}
