import { randomUUID } from 'node:crypto';
import type { Decision, ReviewItemDraft } from '../../src/engine/review';
import type { ReviewItemRow, ReviewRow } from '../../src/db/reviews.ts';

export { evidenceInput } from '../../src/db/reviews.ts';

const reviews = new Map<string, ReviewRow>();
const items = new Map<string, ReviewItemRow[]>();

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
  >,
  drafts: ReviewItemDraft[],
): Promise<string> {
  const id = randomUUID();
  items.set(
    id,
    drafts.map((it, idx) => ({
      idx,
      itemKey: it.itemKey,
      subjectType: it.subjectType,
      subjectId: it.subjectId,
      projectId: it.projectId,
      groupId: it.groupId,
      permissions: it.permissions,
      reasons: it.reasons.slice(0, 20),
      pathCodes: it.pathCodes.slice(0, 20),
      change: it.change,
      risk: it.risk,
      decision: null,
      note: null,
      decidedBy: null,
      decidedAt: null,
    })),
  );
  reviews.set(id, {
    ...r,
    id,
    status: 'draft',
    itemCount: drafts.length,
    signedBy: null,
    signedAt: null,
    signerTz: null,
    attestation: null,
    evidenceHash: null,
  });
  return id;
}

export async function listReviews() {
  return [...reviews.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => {
      const list = items.get(r.id) ?? [];
      return {
        ...r,
        decided: list.filter((i) => i.decision).length,
        flagged: list.filter((i) => i.decision === 'revoke').length,
      };
    });
}

export async function getReview(id: string) {
  return reviews.get(id) ?? null;
}

export async function getItems(id: string) {
  return (items.get(id) ?? []).map((i) => ({ ...i }));
}

export async function decide(
  id: string,
  idxs: number[],
  decision: Decision,
  note: string | null | undefined,
  actor: string,
): Promise<number> {
  const review = reviews.get(id);
  if (!review || review.status === 'signed') return 0;
  let changed = 0;
  for (const i of items.get(id) ?? []) {
    if (!idxs.includes(i.idx)) continue;
    i.decision = decision;
    if (note !== undefined) i.note = note;
    i.decidedBy = decision || note !== undefined ? actor : null;
    i.decidedAt = decision || note !== undefined ? Date.now() : null;
    changed++;
  }
  if (review.status === 'draft') review.status = 'in_progress';
  return changed;
}

export async function markSigned(
  id: string,
  signedBy: string,
  signedAt: number,
  tz: string,
  attestation: string,
  hash: string,
): Promise<boolean> {
  const r = reviews.get(id);
  if (!r || r.status === 'signed') return false;
  Object.assign(r, {
    status: 'signed',
    signedBy,
    signedAt,
    signerTz: tz,
    attestation,
    evidenceHash: hash,
  });
  return true;
}

export async function deleteDraftReview(id: string): Promise<boolean> {
  const r = reviews.get(id);
  if (!r || r.status === 'signed') return false;
  reviews.delete(id);
  items.delete(id);
  return true;
}
