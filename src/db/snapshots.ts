import { contentHash, factVersionHash, type FactKind, type StoredFact } from '../engine/facts';
import { ENGINE_VERSION } from '../engine/resolve';
import { chunk, exec, limitClause, num, placeholders, q } from './sql';

export type SnapshotStatus = 'queued' | 'running' | 'complete' | 'partial' | 'failed';
export const COMMITTED: SnapshotStatus[] = ['complete', 'partial'];

export interface CoverageEntry {
  area: string;
  target: string;
  status: 'unreadable' | 'skipped' | 'partial' | 'carried' | 'info' | 'impersonated';
  reason: string;
}

export interface Progress {
  step: string;
  batch: number;
  batches?: number;
  message?: string;
  counts?: Record<string, number>;
}

export interface SnapshotRow {
  seq: number;
  status: SnapshotStatus;
  trigger: string;
  collectorMode: string;
  engineVersion: string;
  startedAt: number;
  updatedAt: number;
  finishedAt: number | null;
  progress: Progress | null;
  coverage: CoverageEntry[];
  stats: Record<string, number> | null;
  points: number;
  calls: number;
  contentHash: string | null;
  error: string | null;
}

const json = <T>(v: unknown, fallback: T): T => {
  if (typeof v !== 'string' || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};

function toRow(r: Record<string, any>, withCoverage = true): SnapshotRow {
  return {
    seq: Number(r.seq),
    status: r.status,
    trigger: r.trigger_kind,
    collectorMode: r.collector_mode,
    engineVersion: r.engine_version,
    startedAt: Number(r.started_at),
    updatedAt: Number(r.updated_at),
    finishedAt: num(r.finished_at),
    progress: json(r.progress_json, null),
    coverage: withCoverage ? json(r.coverage_json, []) : [],
    stats: json(r.stats_json, null),
    points: Number(r.points ?? 0),
    calls: Number(r.calls ?? 0),
    contentHash: r.content_hash ?? null,
    error: r.error ?? null,
  };
}

const COLS =
  'seq, status, trigger_kind, collector_mode, engine_version, started_at, updated_at, finished_at, progress_json, stats_json, points, calls, content_hash, error';

export async function createSnapshot(
  trigger: 'manual' | 'scheduled' | 'onboarding',
): Promise<number> {
  const now = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await exec(
        `INSERT INTO snap (seq, status, trigger_kind, collector_mode, engine_version, started_at, updated_at, progress_json, points, calls)
         SELECT COALESCE(MAX(seq), 0) + 1, 'queued', ?, 'app', ?, ?, ?, ?, 0, 0 FROM snap`,
        trigger,
        ENGINE_VERSION,
        now,
        now,
        JSON.stringify({ step: 'QUEUED', batch: 0, message: 'Waiting for the collector' }),
      );
      const rows = await q<{ seq: number }>(
        'SELECT MAX(seq) AS seq FROM snap WHERE started_at = ?',
        now,
      );
      return Number(rows[0].seq);
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  throw new Error('Could not create snapshot');
}

export async function getSnapshot(seq: number, withCoverage = true): Promise<SnapshotRow | null> {
  const rows = await q(`SELECT ${COLS}, coverage_json FROM snap WHERE seq = ?`, seq);
  return rows.length ? toRow(rows[0], withCoverage) : null;
}

export async function listSnapshots(limit = 200): Promise<SnapshotRow[]> {
  const rows = await q(`SELECT ${COLS} FROM snap ORDER BY seq DESC ${limitClause(limit)}`);
  return rows.map((r) => toRow(r, false));
}

export async function latestCommitted(): Promise<SnapshotRow | null> {
  const rows = await q(
    `SELECT ${COLS}, coverage_json FROM snap WHERE status IN ('complete', 'partial') ORDER BY seq DESC LIMIT 1`,
  );
  return rows.length ? toRow(rows[0]) : null;
}

export async function previousCommitted(seq: number): Promise<SnapshotRow | null> {
  const rows = await q(
    `SELECT ${COLS} FROM snap WHERE status IN ('complete', 'partial') AND seq < ? ORDER BY seq DESC LIMIT 1`,
    seq,
  );
  return rows.length ? toRow(rows[0], false) : null;
}

/** A snapshot that is queued/running and has shown progress in the last 2 hours. */
export async function activeSnapshot(): Promise<SnapshotRow | null> {
  const rows = await q(
    `SELECT ${COLS} FROM snap WHERE status IN ('queued', 'running') AND updated_at > ? ORDER BY seq DESC LIMIT 1`,
    Date.now() - 2 * 3600_000,
  );
  return rows.length ? toRow(rows[0], false) : null;
}

/** Marks queued/running snapshots without progress for 2 hours as failed. */
export async function failStale(): Promise<number> {
  return exec(
    `UPDATE snap SET status = 'failed', error = 'Stopped: no progress for 2 hours', finished_at = ? WHERE status IN ('queued', 'running') AND updated_at < ?`,
    Date.now(),
    Date.now() - 2 * 3600_000,
  );
}

export async function updateSnapshot(
  seq: number,
  patch: Partial<{
    status: SnapshotStatus;
    progress: Progress;
    coverage: CoverageEntry[];
    stats: Record<string, number>;
    finishedAt: number;
    contentHash: string;
    error: string | null;
    collectorMode: string;
  }>,
): Promise<void> {
  const sets: string[] = ['updated_at = ?'];
  const params: unknown[] = [Date.now()];
  const add = (col: string, v: unknown) => {
    sets.push(`${col} = ?`);
    params.push(v);
  };
  if (patch.status) add('status', patch.status);
  if (patch.progress) add('progress_json', JSON.stringify(patch.progress));
  if (patch.coverage) add('coverage_json', JSON.stringify(patch.coverage));
  if (patch.stats) add('stats_json', JSON.stringify(patch.stats));
  if (patch.finishedAt) add('finished_at', patch.finishedAt);
  if (patch.contentHash) add('content_hash', patch.contentHash);
  if (patch.error !== undefined) add('error', patch.error ? patch.error.slice(0, 500) : null);
  if (patch.collectorMode) add('collector_mode', patch.collectorMode);
  params.push(seq);
  await exec(`UPDATE snap SET ${sets.join(', ')} WHERE seq = ?`, ...params);
}

export async function addUsage(seq: number, points: number, calls: number): Promise<void> {
  if (!points && !calls) return;
  await exec(
    'UPDATE snap SET points = points + ?, calls = calls + ?, updated_at = ? WHERE seq = ?',
    points,
    calls,
    Date.now(),
    seq,
  );
}

// ---------- staging (facts observed by the running snapshot) ----------

export interface StageFact {
  kind: FactKind | 'coverage' | 'carry';
  fkey: string;
  attrs: unknown;
}

/** Idempotent: re-staging the same fact (queue redelivery) overwrites it. */
export async function stage(seq: number, facts: StageFact[]): Promise<void> {
  for (const part of chunk(facts, 150)) {
    if (!part.length) continue;
    await exec(
      `INSERT INTO stage (seq, kind, fkey, attrs) VALUES ${placeholders(part.length, 4)} ON DUPLICATE KEY UPDATE attrs = VALUES(attrs)`,
      ...part.flatMap((f) => [seq, f.kind, f.fkey.slice(0, 400), JSON.stringify(f.attrs ?? {})]),
    );
  }
}

export async function readStage<A = any>(
  seq: number,
  kind?: string,
): Promise<Array<{ kind: string; fkey: string; attrs: A }>> {
  const out: Array<{ kind: string; fkey: string; attrs: A }> = [];
  let after = '';
  let afterKind = '';
  for (;;) {
    const rows = kind
      ? await q<{ kind: string; fkey: string; attrs: string }>(
          'SELECT kind, fkey, attrs FROM stage WHERE seq = ? AND kind = ? AND fkey > ? ORDER BY fkey LIMIT 2000',
          seq,
          kind,
          after,
        )
      : await q<{ kind: string; fkey: string; attrs: string }>(
          'SELECT kind, fkey, attrs FROM stage WHERE seq = ? AND (kind > ? OR (kind = ? AND fkey > ?)) ORDER BY kind, fkey LIMIT 2000',
          seq,
          afterKind,
          afterKind,
          after,
        );
    for (const r of rows) out.push({ kind: r.kind, fkey: r.fkey, attrs: JSON.parse(r.attrs) as A });
    if (rows.length < 2000) return out;
    after = rows[rows.length - 1].fkey;
    afterKind = rows[rows.length - 1].kind;
  }
}

export async function clearStage(seq: number): Promise<void> {
  for (;;) {
    const n = await exec('DELETE FROM stage WHERE seq = ? LIMIT 5000', seq);
    if (n < 5000) return;
  }
}

// ---------- facts (SCD2 validity intervals) ----------

interface FactRow {
  id: number;
  kind: string;
  fkey: string;
  vhash: string;
  last_seen: number;
}

async function openFacts(prevSeq: number, seq: number): Promise<FactRow[]> {
  const out: FactRow[] = [];
  let after = 0;
  for (;;) {
    const rows = await q<FactRow>(
      'SELECT id, kind, fkey, vhash, last_seen FROM fact WHERE last_seen IN (?, ?) AND id > ? ORDER BY id LIMIT 3000',
      prevSeq,
      seq,
      after,
    );
    out.push(...rows.map((r) => ({ ...r, id: Number(r.id), last_seen: Number(r.last_seen) })));
    if (rows.length < 3000) return out;
    after = Number(rows[rows.length - 1].id);
  }
}

export interface MergeResult {
  extended: number;
  inserted: number;
  carried: number;
  facts: number;
}

/**
 * Merges the staged facts of snapshot `seq` into the fact table. Facts still present with the
 * same version extend their interval (last_seen = seq); new or changed facts open a new interval.
 * `carry` markers extend open facts by key prefix (e.g. members of a group that could not be read
 * this time). Safe to re-run: already-merged rows (last_seen = seq) are recognised.
 */
export async function mergeStage(seq: number, prevSeq: number | null): Promise<MergeResult> {
  const staged = await readStage(seq);
  const facts = staged.filter((f) => f.kind !== 'coverage' && f.kind !== 'carry');
  const carry = staged.filter((f) => f.kind === 'carry').map((f) => f.fkey);
  const open = prevSeq === null ? [] : await openFacts(prevSeq, seq);
  const byKey = new Map(open.map((r) => [`${r.kind}\u0000${r.fkey}`, r]));
  const toExtend: number[] = [];
  const toInsert: Array<[string, string, string, string]> = [];
  const present = new Set<string>();
  for (const f of facts) {
    const vhash = factVersionHash(f.kind as FactKind, f.attrs);
    const k = `${f.kind}\u0000${f.fkey}`;
    present.add(k);
    const o = byKey.get(k);
    if (o && o.vhash === vhash) {
      if (o.last_seen !== seq) toExtend.push(o.id);
    } else toInsert.push([f.kind, f.fkey, vhash, JSON.stringify(f.attrs)]);
  }
  let carried = 0;
  if (carry.length)
    for (const o of open) {
      const k = `${o.kind}\u0000${o.fkey}`;
      if (present.has(k) || o.last_seen === seq) continue;
      if (carry.some((prefix) => `${o.kind}:${o.fkey}`.startsWith(prefix))) {
        toExtend.push(o.id);
        carried += 1;
      }
    }
  for (const ids of chunk(toExtend, 500))
    await exec(
      `UPDATE fact SET last_seen = ? WHERE id IN (${ids.map(() => '?').join(', ')})`,
      seq,
      ...ids,
    );
  for (const rows of chunk(toInsert, 100))
    await exec(
      `INSERT IGNORE INTO fact (kind, fkey, vhash, attrs, first_seen, last_seen) VALUES ${placeholders(rows.length, 6)}`,
      ...rows.flatMap((r) => [...r, seq, seq]),
    );
  invalidateFactCache();
  return {
    extended: toExtend.length - carried,
    inserted: toInsert.length,
    carried,
    facts: facts.length + carried,
  };
}

// Snapshot facts are immutable once committed (except privacy anonymisation), so a short cache helps.
const cache = new Map<number, { at: number; facts: StoredFact<any>[] }>();
const CACHE_TTL_MS = 60_000;

export function invalidateFactCache() {
  cache.clear();
}

export async function loadFacts(seq: number): Promise<StoredFact<any>[]> {
  const hit = cache.get(seq);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.facts;
  const out: StoredFact<any>[] = [];
  let after = 0;
  for (;;) {
    const rows = await q<{ id: number; kind: string; fkey: string; vhash: string; attrs: string }>(
      'SELECT id, kind, fkey, vhash, attrs FROM fact WHERE first_seen <= ? AND last_seen >= ? AND id > ? ORDER BY id LIMIT 3000',
      seq,
      seq,
      after,
    );
    for (const r of rows)
      out.push({
        kind: r.kind as FactKind,
        fkey: r.fkey,
        vhash: r.vhash,
        attrs: JSON.parse(r.attrs),
      });
    if (rows.length < 3000) break;
    after = Number(rows[rows.length - 1].id);
  }
  if (cache.size > 3) cache.delete(cache.keys().next().value as number);
  cache.set(seq, { at: Date.now(), facts: out });
  return out;
}

export async function computeContentHash(seq: number): Promise<string> {
  invalidateFactCache();
  return contentHash(await loadFacts(seq));
}

// ---------- retention ----------

/** Deletes snapshots older than the retention window that no review pins, then orphaned facts. */
export async function applyRetention(
  retentionDays: number,
): Promise<{ snapshots: number; facts: number }> {
  const cutoff = Date.now() - retentionDays * 86400_000;
  const latest = await latestCommitted();
  const candidates = await q<{ seq: number }>(
    `SELECT seq FROM snap WHERE started_at < ? AND seq NOT IN (SELECT base_seq FROM review)
       AND seq NOT IN (SELECT compare_seq FROM review WHERE compare_seq IS NOT NULL)`,
    cutoff,
  );
  const drop = candidates.map((r) => Number(r.seq)).filter((s) => s !== latest?.seq);
  for (const ids of chunk(drop, 200))
    await exec(`DELETE FROM snap WHERE seq IN (${ids.map(() => '?').join(', ')})`, ...ids);
  // Facts are kept while any remaining snapshot falls inside their interval.
  const kept = (await q<{ seq: number }>('SELECT seq FROM snap ORDER BY seq')).map((r) =>
    Number(r.seq),
  );
  let facts = 0;
  if (!kept.length) return { snapshots: drop.length, facts };
  facts += await exec('DELETE FROM fact WHERE last_seen < ?', kept[0]);
  // Facts that lived only between two kept snapshots (inside a deleted gap) are orphaned too.
  for (let i = 0; i + 1 < kept.length; i++) {
    if (kept[i + 1] - kept[i] <= 1) continue;
    facts += await exec(
      'DELETE FROM fact WHERE first_seen > ? AND last_seen < ?',
      kept[i],
      kept[i + 1],
    );
  }
  for (const s of drop) await exec('DELETE FROM stage WHERE seq = ?', s);
  if (facts) invalidateFactCache();
  return { snapshots: drop.length, facts };
}
