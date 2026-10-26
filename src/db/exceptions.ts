import { randomUUID } from 'node:crypto';
import type { ExceptionRow } from '../engine/exceptions';
import { exec, limitClause, q } from './sql';

const toRow = (r: any): ExceptionRow => ({
  id: r.id,
  itemKey: r.item_key,
  subjectType: r.subject_type,
  subjectId: r.subject_id,
  projectId: r.project_id ?? null,
  groupId: r.group_id ?? null,
  permissions: JSON.parse(r.permissions),
  justification: r.justification,
  expiresAt: Number(r.expires_at),
  status: r.status,
  reviewId: r.review_id,
  grantedBy: r.granted_by,
  grantedAt: Number(r.granted_at),
});

export async function listExceptions(opts: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ExceptionRow[]; total: number }> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 50)));
  const offset = (page - 1) * pageSize;
  const status = opts.status && opts.status !== 'all' ? opts.status : null;
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const totalRows = await q<{ n: number }>(
    `SELECT COUNT(*) AS n FROM access_exception ${where}`,
    ...params,
  );
  const rows = await q(
    `SELECT * FROM access_exception ${where} ORDER BY expires_at ASC ${limitClause(pageSize)} OFFSET ${offset}`,
    ...params,
  );
  return { items: rows.map(toRow), total: Number(totalRows[0]?.n ?? 0) };
}

export async function activeExceptionsForKeys(itemKeys: string[]): Promise<ExceptionRow[]> {
  if (!itemKeys.length) return [];
  // Chunk to stay within query size; keys are short.
  const out: ExceptionRow[] = [];
  for (let i = 0; i < itemKeys.length; i += 100) {
    const chunk = itemKeys.slice(i, i + 100);
    const ph = chunk.map(() => '?').join(', ');
    const rows = await q(
      `SELECT * FROM access_exception WHERE item_key IN (${ph}) AND status IN ('active', 'expired')`,
      ...chunk,
    );
    out.push(...rows.map(toRow));
  }
  return out;
}

export async function expireExceptions(now = Date.now()): Promise<number> {
  return exec(
    `UPDATE access_exception SET status = 'expired', closed_at = ?, closed_reason = 'expired'
     WHERE status = 'active' AND expires_at < ?`,
    now,
    now,
  );
}

export async function supersedeActive(itemKey: string, now: number): Promise<number> {
  return exec(
    `UPDATE access_exception SET status = 'superseded', closed_at = ?, closed_reason = 'superseded'
     WHERE item_key = ? AND status = 'active'`,
    now,
    itemKey,
  );
}

export async function revokeActive(itemKey: string, now: number): Promise<number> {
  return exec(
    `UPDATE access_exception SET status = 'revoked', closed_at = ?, closed_reason = 'revoked'
     WHERE item_key = ? AND status = 'active'`,
    now,
    itemKey,
  );
}

export async function insertException(
  row: Omit<ExceptionRow, 'id' | 'status'> & { status?: ExceptionRow['status'] },
): Promise<string> {
  const id = randomUUID();
  await exec(
    `INSERT INTO access_exception (
      id, item_key, subject_type, subject_id, project_id, group_id, permissions, justification,
      expires_at, status, review_id, granted_by, granted_at, closed_at, closed_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    id,
    row.itemKey,
    row.subjectType,
    row.subjectId,
    row.projectId,
    row.groupId,
    JSON.stringify(row.permissions),
    row.justification,
    row.expiresAt,
    row.status ?? 'active',
    row.reviewId,
    row.grantedBy,
    row.grantedAt,
  );
  return id;
}

export interface ExceptionSyncItem {
  itemKey: string;
  subjectType: string;
  subjectId: string;
  projectId: string | null;
  groupId: string | null;
  permissions: string[];
  decision: string | null;
  note: string | null;
  expiresAt: number | null;
}

export interface ExceptionSyncResult {
  granted: number;
  superseded: number;
  revoked: number;
  withdrawn: number;
}

/**
 * Brings the exceptions register in line with review decisions (edition decision 2026-10-26:
 * registering exceptions does not depend on sign-off). Runs when a decision is saved and again at
 * sign-off (Advanced) for drafts decided before the change.
 * - Exception with justification and expiry: registered as active unless an identical active row
 *   (same item, justification and expiry) already exists; any other active row for the item is
 *   superseded.
 * - Revoke: active exceptions for the item are revoked.
 * - Keep or cleared: an active exception registered from this review is withdrawn (status
 *   `revoked`, reason `withdrawn`); exceptions from other reviews stay.
 */
export async function syncReviewExceptions(
  reviewId: string,
  items: ExceptionSyncItem[],
  grantedBy: string,
  now = Date.now(),
): Promise<ExceptionSyncResult> {
  const out: ExceptionSyncResult = { granted: 0, superseded: 0, revoked: 0, withdrawn: 0 };
  for (const item of items) {
    if (item.decision === 'exception' && item.note && item.expiresAt) {
      const same = await q(
        `SELECT id FROM access_exception
         WHERE item_key = ? AND status = 'active' AND justification = ? AND expires_at = ?`,
        item.itemKey,
        item.note,
        item.expiresAt,
      );
      if (same.length) continue;
      out.superseded += await supersedeActive(item.itemKey, now);
      await insertException({
        itemKey: item.itemKey,
        subjectType: item.subjectType,
        subjectId: item.subjectId,
        projectId: item.projectId,
        groupId: item.groupId,
        permissions: item.permissions,
        justification: item.note,
        expiresAt: item.expiresAt,
        reviewId,
        grantedBy,
        grantedAt: now,
      });
      out.granted += 1;
    } else if (item.decision === 'revoke') {
      out.revoked += await revokeActive(item.itemKey, now);
    } else if (item.decision === 'keep' || item.decision === null) {
      out.withdrawn += await exec(
        `UPDATE access_exception SET status = 'revoked', closed_at = ?, closed_reason = 'withdrawn'
         WHERE review_id = ? AND item_key = ? AND status = 'active'`,
        now,
        reviewId,
        item.itemKey,
      );
    }
  }
  return out;
}

export async function getException(id: string): Promise<ExceptionRow | null> {
  const rows = await q('SELECT * FROM access_exception WHERE id = ?', id);
  return rows[0] ? toRow(rows[0]) : null;
}
