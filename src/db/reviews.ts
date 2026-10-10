import { randomUUID } from 'node:crypto';
import type {
  Decision,
  EvidenceInput,
  ItemChange,
  ReviewItemDraft,
  ReviewScope,
} from '../engine/review';
import { chunk, exec, num, placeholders, q } from './sql';

export type ReviewStatus = 'draft' | 'in_progress' | 'signed';

export interface ReviewRow {
  id: string;
  name: string;
  scope: ReviewScope;
  keyPermissions: string[];
  baseSeq: number;
  compareSeq: number | null;
  status: ReviewStatus;
  createdBy: string;
  createdAt: number;
  dueAt: number | null;
  itemCount: number;
  signedBy: string | null;
  signedAt: number | null;
  signerTz: string | null;
  attestation: string | null;
  evidenceHash: string | null;
  engineVersion: string;
  signatureVersion: number;
  coverageHash: string | null;
  campaignRunId: string | null;
}

export interface ReviewItemRow {
  idx: number;
  itemKey: string;
  subjectType: ReviewItemDraft['subjectType'];
  subjectId: string;
  projectId: string | null;
  groupId: string | null;
  permissions: string[];
  reasons: string[];
  pathCodes: string[];
  change: ItemChange;
  risk: number;
  decision: Decision;
  note: string | null;
  expiresAt: number | null;
  decidedBy: string | null;
  decidedAt: number | null;
}

const toReview = (r: any): ReviewRow => ({
  id: r.id,
  name: r.name,
  scope: JSON.parse(r.scope_json),
  keyPermissions: JSON.parse(r.key_perms),
  baseSeq: Number(r.base_seq),
  compareSeq: num(r.compare_seq),
  status: r.status,
  createdBy: r.created_by,
  createdAt: Number(r.created_at),
  dueAt: num(r.due_at),
  itemCount: Number(r.item_count),
  signedBy: r.signed_by ?? null,
  signedAt: num(r.signed_at),
  signerTz: r.signer_tz ?? null,
  attestation: r.attestation ?? null,
  evidenceHash: r.evidence_hash ?? null,
  engineVersion: r.engine_version,
  signatureVersion: Number(r.signature_version ?? 1),
  coverageHash: r.coverage_hash ?? null,
  campaignRunId: r.campaign_run_id ?? null,
});

const toItem = (r: any): ReviewItemRow => ({
  idx: Number(r.idx),
  itemKey: r.item_key,
  subjectType: r.subject_type,
  subjectId: r.subject_id,
  projectId: r.project_id ?? null,
  groupId: r.group_id ?? null,
  permissions: JSON.parse(r.permissions),
  reasons: JSON.parse(r.reasons),
  pathCodes: JSON.parse(r.path_codes),
  change: r.change_kind ?? null,
  risk: Number(r.risk),
  decision: r.decision ?? null,
  note: r.note ?? null,
  expiresAt: num(r.expires_at),
  decidedBy: r.decided_by ?? null,
  decidedAt: num(r.decided_at),
});

const REVIEW_COLS =
  'id, name, scope_json, key_perms, base_seq, compare_seq, status, created_by, created_at, due_at, item_count, signed_by, signed_at, signer_tz, attestation, evidence_hash, engine_version, signature_version, coverage_hash, campaign_run_id';

export async function insertReview(
  r: Omit<
    ReviewRow,
    | 'id'
    | 'status'
    | 'itemCount'
    | 'signedBy'
    | 'signedAt'
    | 'signerTz'
    | 'attestation'
    | 'evidenceHash'
    | 'signatureVersion'
    | 'coverageHash'
  >,
  items: Array<
    ReviewItemDraft & {
      decision?: Decision;
      note?: string | null;
      expiresAt?: number | null;
      decidedBy?: string | null;
    }
  >,
): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  for (const [n, part] of chunk(items, 100).entries()) {
    await exec(
      `INSERT INTO review_item (review_id, idx, item_key, subject_type, subject_id, project_id, group_id, permissions, reasons, path_codes, change_kind, risk, decision, note, expires_at, decided_by, decided_at) VALUES ${placeholders(part.length, 17)}`,
      ...part.flatMap((it, i) => [
        id,
        n * 100 + i,
        it.itemKey.slice(0, 512),
        it.subjectType,
        it.subjectId,
        it.projectId,
        it.groupId,
        JSON.stringify(it.permissions),
        JSON.stringify(it.reasons.slice(0, 20)),
        JSON.stringify(it.pathCodes.slice(0, 20)),
        it.change,
        it.risk,
        it.decision ?? null,
        it.note ?? null,
        it.expiresAt ?? null,
        it.decision ? (it.decidedBy ?? null) : null,
        it.decision ? now : null,
      ]),
    );
  }
  await exec(
    `INSERT INTO review (id, name, scope_json, key_perms, base_seq, compare_seq, status, created_by, created_at, due_at, item_count, engine_version, campaign_run_id)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
    id,
    r.name,
    JSON.stringify(r.scope),
    JSON.stringify(r.keyPermissions),
    r.baseSeq,
    r.compareSeq,
    r.createdBy,
    r.createdAt,
    r.dueAt,
    items.length,
    r.engineVersion,
    r.campaignRunId,
  );
  return id;
}

export async function listReviews(): Promise<
  Array<ReviewRow & { decided: number; flagged: number }>
> {
  const rows = await q<any>(`SELECT ${REVIEW_COLS} FROM review ORDER BY created_at DESC LIMIT 200`);
  const counts = await q<{ review_id: string; decided: number; flagged: number }>(
    `SELECT review_id, SUM(CASE WHEN decision IS NOT NULL THEN 1 ELSE 0 END) AS decided,
            SUM(CASE WHEN decision = 'revoke' THEN 1 ELSE 0 END) AS flagged
       FROM review_item GROUP BY review_id`,
  );
  const byId = new Map(counts.map((c) => [c.review_id, c]));
  return rows.map((r) => ({
    ...toReview(r),
    decided: Number(byId.get(r.id)?.decided ?? 0),
    flagged: Number(byId.get(r.id)?.flagged ?? 0),
  }));
}

export async function getReview(id: string): Promise<ReviewRow | null> {
  const rows = await q<any>(`SELECT ${REVIEW_COLS} FROM review WHERE id = ?`, id);
  return rows.length ? toReview(rows[0]) : null;
}

export async function getItems(id: string): Promise<ReviewItemRow[]> {
  const out: ReviewItemRow[] = [];
  let after = -1;
  for (;;) {
    const rows = await q<any>(
      'SELECT * FROM review_item WHERE review_id = ? AND idx > ? ORDER BY idx LIMIT 2000',
      id,
      after,
    );
    out.push(...rows.map(toItem));
    if (rows.length < 2000) return out;
    after = Number(rows[rows.length - 1].idx);
  }
}

/** Records a decision; the WHERE clause guarantees signed reviews stay immutable. */
export async function decide(
  id: string,
  idxs: number[],
  decision: Decision,
  note: string | null | undefined,
  actor: string,
  expiresAt: number | null = null,
): Promise<number> {
  let changed = 0;
  const now = Date.now();
  for (const part of chunk(idxs, 500)) {
    const ph = part.map(() => '?').join(', ');
    const expiry = decision === 'exception' ? expiresAt : null;
    changed +=
      note === undefined
        ? await exec(
            `UPDATE review_item SET decision = ?, expires_at = ?, decided_by = ?, decided_at = ?
             WHERE review_id = ? AND idx IN (${ph})
               AND review_id IN (SELECT id FROM review WHERE status <> 'signed')`,
            decision,
            expiry,
            decision ? actor : null,
            decision ? now : null,
            id,
            ...part,
          )
        : await exec(
            `UPDATE review_item SET decision = ?, note = ?, expires_at = ?, decided_by = ?, decided_at = ?
             WHERE review_id = ? AND idx IN (${ph})
               AND review_id IN (SELECT id FROM review WHERE status <> 'signed')`,
            decision,
            note,
            expiry,
            decision ? actor : null,
            decision ? now : null,
            id,
            ...part,
          );
  }
  await exec("UPDATE review SET status = 'in_progress' WHERE id = ? AND status = 'draft'", id);
  return changed;
}

export async function markSigned(
  id: string,
  signedBy: string,
  signedAt: number,
  tz: string,
  attestation: string,
  hash: string,
  opts: { signatureVersion: number; coverageHash: string | null } = {
    signatureVersion: 2,
    coverageHash: null,
  },
): Promise<boolean> {
  const n = await exec(
    `UPDATE review SET status = 'signed', signed_by = ?, signed_at = ?, signer_tz = ?, attestation = ?, evidence_hash = ?,
        signature_version = ?, coverage_hash = ?
     WHERE id = ? AND status <> 'signed'`,
    signedBy,
    signedAt,
    tz,
    attestation,
    hash,
    opts.signatureVersion,
    opts.coverageHash,
    id,
  );
  return n > 0;
}

export async function deleteDraftReview(id: string): Promise<boolean> {
  const n = await exec("DELETE FROM review WHERE id = ? AND status <> 'signed'", id);
  if (n) await exec('DELETE FROM review_item WHERE review_id = ?', id);
  return n > 0;
}

export function evidenceInput(
  review: ReviewRow,
  items: ReviewItemRow[],
  base: { seq: number; contentHash: string | null },
  compare: { seq: number; contentHash: string | null } | null,
  signedBy: string,
  signedAt: number,
  opts?: {
    signatureVersion?: 1 | 2;
    coverageHash?: string | null;
    limitationsVersion?: number;
    prevReviewHash?: string | null;
    signerTz?: string | null;
  },
): EvidenceInput {
  const version = opts?.signatureVersion ?? 1;
  const baseItems = items.map((i) => ({
    itemKey: i.itemKey,
    subjectType: i.subjectType,
    subjectId: i.subjectId,
    projectId: i.projectId,
    groupId: i.groupId,
    permissions: i.permissions,
    pathCodes: i.pathCodes,
    change: i.change,
    decision: i.decision,
    note: i.note,
    decidedBy: i.decidedBy,
    decidedAt: i.decidedAt ? new Date(i.decidedAt).toISOString() : null,
    ...(version >= 2
      ? { expiresAt: i.expiresAt ? new Date(i.expiresAt).toISOString() : null }
      : {}),
  }));
  return {
    reviewId: review.id,
    name: review.name,
    scope: review.scope,
    base,
    compare,
    engineVersion: review.engineVersion,
    signedBy,
    signedAt: new Date(signedAt).toISOString(),
    items: baseItems,
    ...(version >= 2
      ? {
          signatureVersion: 2 as const,
          coverageHash: opts?.coverageHash ?? null,
          limitationsVersion: opts?.limitationsVersion ?? 1,
          prevReviewHash: opts?.prevReviewHash ?? null,
          signerTz: opts?.signerTz ?? review.signerTz ?? null,
        }
      : {}),
  };
}

/** All accountIds held outside the fact table (for privacy reporting). */
export async function reviewAccountIds(): Promise<string[]> {
  const ids = new Set<string>();
  for (const r of await q<any>('SELECT created_by, signed_by FROM review')) {
    if (r.created_by) ids.add(r.created_by);
    if (r.signed_by) ids.add(r.signed_by);
  }
  for (const r of await q<any>(
    "SELECT DISTINCT subject_id FROM review_item WHERE subject_type = 'user'",
  ))
    ids.add(r.subject_id);
  for (const r of await q<any>(
    'SELECT DISTINCT decided_by FROM review_item WHERE decided_by IS NOT NULL',
  ))
    ids.add(r.decided_by);
  for (const r of await q<any>("SELECT DISTINCT actor FROM audit_event WHERE actor <> 'system'"))
    ids.add(r.actor);
  return [...ids];
}
