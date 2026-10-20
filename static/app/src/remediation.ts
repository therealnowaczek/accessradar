import type { ReviewItem } from './api';

/** Tracking row from `listRemediation` (Advanced: re-checked against later snapshots). */
export type RemediationRow = {
  idx: number;
  itemKey: string;
  status: 'pending' | 'verified' | 'still_present' | 'inconclusive' | 'accepted';
  checkedSeq: number | null;
  verifiedSeq: number | null;
  detail: string | null;
  checkCount: number;
};

/** `untracked`: a Revoke decision with no verification row (plan without verification, or signed before it existed). */
export type RemediationStatus = RemediationRow['status'] | 'untracked';

export type RemediationEntry = {
  item: ReviewItem;
  status: RemediationStatus;
  checkedSeq: number | null;
  verifiedSeq: number | null;
  detail: string | null;
  checkCount: number;
};

/**
 * Revoke decisions of a review. The single source for both the "Revoke" summary card and the
 * Remediation section, so the two can never disagree. Items removed since the comparison
 * snapshot cannot be decided and are excluded.
 */
export function revokeDecisions(items: ReviewItem[]): ReviewItem[] {
  return items.filter((i) => i.change !== 'removed' && i.decision === 'revoke');
}

/**
 * One remediation entry per Revoke decision, enriched with its verification row when there is
 * one. `closed` counts verified and accepted-risk entries.
 */
export function deriveRemediation(
  items: ReviewItem[],
  rows: RemediationRow[] | null | undefined,
): { entries: RemediationEntry[]; closed: number; total: number; untracked: number } {
  const byIdx = new Map((rows ?? []).map((r) => [r.idx, r]));
  const entries = revokeDecisions(items).map((item): RemediationEntry => {
    const row = byIdx.get(item.idx);
    return {
      item,
      status: row?.status ?? 'untracked',
      checkedSeq: row?.checkedSeq ?? null,
      verifiedSeq: row?.verifiedSeq ?? null,
      detail: row?.detail ?? null,
      checkCount: row?.checkCount ?? 0,
    };
  });
  return {
    entries,
    closed: entries.filter((e) => e.status === 'verified' || e.status === 'accepted').length,
    total: entries.length,
    untracked: entries.filter((e) => e.status === 'untracked').length,
  };
}
