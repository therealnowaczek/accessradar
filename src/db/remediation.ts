import { exec, limitClause, q } from './sql';

export type RemediationStatus =
  'pending' | 'verified' | 'still_present' | 'inconclusive' | 'accepted';

export interface RemediationRow {
  reviewId: string;
  idx: number;
  itemKey: string;
  status: RemediationStatus;
  createdAt: number;
  checkedSeq: number | null;
  checkedAt: number | null;
  verifiedSeq: number | null;
  detail: string | null;
  checkCount: number;
}

function rowOf(r: Record<string, unknown>): RemediationRow {
  return {
    reviewId: String(r.review_id),
    idx: Number(r.idx),
    itemKey: String(r.item_key),
    status: r.status as RemediationStatus,
    createdAt: Number(r.created_at),
    checkedSeq: r.checked_seq == null ? null : Number(r.checked_seq),
    checkedAt: r.checked_at == null ? null : Number(r.checked_at),
    verifiedSeq: r.verified_seq == null ? null : Number(r.verified_seq),
    detail: (r.detail as string | null) ?? null,
    checkCount: Number(r.check_count ?? 0),
  };
}

export async function insertRemediations(
  reviewId: string,
  items: Array<{ idx: number; itemKey: string }>,
  now = Date.now(),
): Promise<number> {
  if (!items.length) return 0;
  let n = 0;
  for (let i = 0; i < items.length; i += 100) {
    const part = items.slice(i, i + 100);
    const ph = part.map(() => '(?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 0)').join(', ');
    n += await exec(
      `INSERT IGNORE INTO remediation
        (review_id, idx, item_key, status, created_at, checked_seq, checked_at, verified_seq, detail, check_count)
       VALUES ${ph}`,
      ...part.flatMap((it) => [reviewId, it.idx, it.itemKey.slice(0, 512), 'pending', now]),
    );
  }
  return n;
}

export async function listRemediation(reviewId: string): Promise<RemediationRow[]> {
  const rows = await q('SELECT * FROM remediation WHERE review_id = ? ORDER BY idx', reviewId);
  return rows.map(rowOf);
}

export async function getRemediation(
  reviewId: string,
  idx: number,
): Promise<RemediationRow | null> {
  const rows = await q('SELECT * FROM remediation WHERE review_id = ? AND idx = ?', reviewId, idx);
  return rows[0] ? rowOf(rows[0]) : null;
}

export async function updateRemediationCheck(
  reviewId: string,
  idx: number,
  patch: {
    status: RemediationStatus;
    checkedSeq: number;
    checkedAt: number;
    verifiedSeq?: number | null;
    detail?: string | null;
  },
): Promise<void> {
  await exec(
    `UPDATE remediation SET status = ?, checked_seq = ?, checked_at = ?,
        verified_seq = COALESCE(?, verified_seq), detail = ?, check_count = check_count + 1
     WHERE review_id = ? AND idx = ?`,
    patch.status,
    patch.checkedSeq,
    patch.checkedAt,
    patch.verifiedSeq ?? null,
    patch.detail ?? null,
    reviewId,
    idx,
  );
}

export async function markRemediationAccepted(
  reviewId: string,
  idx: number,
  detail: string,
  now = Date.now(),
): Promise<boolean> {
  const n = await exec(
    `UPDATE remediation SET status = 'accepted', checked_at = ?, detail = ?
     WHERE review_id = ? AND idx = ? AND status IN ('pending', 'still_present', 'inconclusive')`,
    now,
    detail.slice(0, 500),
    reviewId,
    idx,
  );
  return n > 0;
}

/** Rows still open for checking (not verified/accepted), optionally not yet checked at seq. */
export async function openRemediations(seq?: number): Promise<RemediationRow[]> {
  const lim = limitClause(2000);
  if (seq === undefined) {
    const rows = await q(
      `SELECT * FROM remediation WHERE status IN ('pending', 'still_present', 'inconclusive')
       ORDER BY created_at ${lim}`,
    );
    return rows.map(rowOf);
  }
  const rows = await q(
    `SELECT * FROM remediation
     WHERE status IN ('pending', 'still_present', 'inconclusive')
       AND (checked_seq IS NULL OR checked_seq < ?)
     ORDER BY created_at ${lim}`,
    seq,
  );
  return rows.map(rowOf);
}

export async function remediationSummarySite(): Promise<{
  open: number;
  stillPresent: number;
  verified: number;
}> {
  const rows = await q<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM remediation GROUP BY status`,
  );
  let open = 0;
  let stillPresent = 0;
  let verified = 0;
  for (const r of rows) {
    const n = Number(r.n);
    if (r.status === 'pending' || r.status === 'inconclusive') open += n;
    if (r.status === 'still_present') {
      stillPresent += n;
      open += n;
    }
    if (r.status === 'verified') verified += n;
  }
  return { open, stillPresent, verified };
}
