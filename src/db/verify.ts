import { createHash, randomUUID } from 'node:crypto';
import { contentHashUpdate, type FactKind } from '../engine/facts';
import { exec, limitClause, q } from './sql';

export type VerifyJobStatus = 'pending' | 'running' | 'ok' | 'mismatch' | 'purged' | 'error';

export interface VerifyJob {
  id: string;
  reviewId: string;
  seq: number;
  status: VerifyJobStatus;
  expectedHash: string | null;
  actualHash: string | null;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
  cursorKind: string | null;
  cursorFkey: string | null;
}

const toJob = (r: any): VerifyJob => ({
  id: r.id,
  reviewId: r.review_id,
  seq: Number(r.seq),
  status: r.status,
  expectedHash: r.expected_hash ?? null,
  actualHash: r.actual_hash ?? null,
  startedAt: Number(r.started_at),
  finishedAt: r.finished_at == null ? null : Number(r.finished_at),
  error: r.error ?? null,
  cursorKind: r.cursor_kind ?? null,
  cursorFkey: r.cursor_fkey ?? null,
});

export async function insertVerifyJob(
  reviewId: string,
  seq: number,
  expectedHash: string | null,
): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await exec(
    `INSERT INTO verify_job (id, review_id, seq, status, expected_hash, actual_hash, started_at, finished_at, error, cursor_kind, cursor_fkey)
     VALUES (?, ?, ?, 'pending', ?, NULL, ?, NULL, NULL, NULL, NULL)`,
    id,
    reviewId,
    seq,
    expectedHash,
    now,
  );
  return id;
}

export async function getVerifyJob(id: string): Promise<VerifyJob | null> {
  const rows = await q('SELECT * FROM verify_job WHERE id = ?', id);
  return rows[0] ? toJob(rows[0]) : null;
}

export async function patchVerifyJob(
  id: string,
  patch: Partial<{
    status: VerifyJobStatus;
    actualHash: string | null;
    finishedAt: number | null;
    error: string | null;
    cursorKind: string | null;
    cursorFkey: string | null;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.status !== undefined) {
    sets.push('status = ?');
    params.push(patch.status);
  }
  if (patch.actualHash !== undefined) {
    sets.push('actual_hash = ?');
    params.push(patch.actualHash);
  }
  if (patch.finishedAt !== undefined) {
    sets.push('finished_at = ?');
    params.push(patch.finishedAt);
  }
  if (patch.error !== undefined) {
    sets.push('error = ?');
    params.push(patch.error);
  }
  if (patch.cursorKind !== undefined) {
    sets.push('cursor_kind = ?');
    params.push(patch.cursorKind);
  }
  if (patch.cursorFkey !== undefined) {
    sets.push('cursor_fkey = ?');
    params.push(patch.cursorFkey);
  }
  if (!sets.length) return;
  params.push(id);
  await exec(`UPDATE verify_job SET ${sets.join(', ')} WHERE id = ?`, ...params);
}

const PAGE = 3000;

/** Stream facts at seq ordered by (kind, fkey); returns whether more pages remain and next cursor. */
export async function streamContentHashPage(
  seq: number,
  cursorKind: string | null,
  cursorFkey: string | null,
  hash = createHash('sha256'),
  started = false,
): Promise<{
  hash: ReturnType<typeof createHash>;
  started: boolean;
  done: boolean;
  cursorKind: string | null;
  cursorFkey: string | null;
  rows: number;
}> {
  const lim = limitClause(PAGE);
  const rows = cursorKind
    ? await q<{ kind: FactKind; fkey: string; vhash: string }>(
        `SELECT kind, fkey, vhash FROM fact
         WHERE first_seen <= ? AND last_seen >= ?
           AND (kind > ? OR (kind = ? AND fkey > ?))
         ORDER BY kind, fkey ${lim}`,
        seq,
        seq,
        cursorKind,
        cursorKind,
        cursorFkey ?? '',
      )
    : await q<{ kind: FactKind; fkey: string; vhash: string }>(
        `SELECT kind, fkey, vhash FROM fact
         WHERE first_seen <= ? AND last_seen >= ?
         ORDER BY kind, fkey ${lim}`,
        seq,
        seq,
      );
  const nextStarted = contentHashUpdate(
    hash,
    rows.map((r) => ({ kind: r.kind, fkey: r.fkey, vhash: r.vhash })),
    started,
  );
  if (rows.length < PAGE) {
    return {
      hash,
      started: nextStarted,
      done: true,
      cursorKind: null,
      cursorFkey: null,
      rows: rows.length,
    };
  }
  const last = rows[rows.length - 1];
  return {
    hash,
    started: nextStarted,
    done: false,
    cursorKind: last.kind,
    cursorFkey: last.fkey,
    rows: rows.length,
  };
}
