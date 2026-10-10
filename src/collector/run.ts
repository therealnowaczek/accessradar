import { InvocationError, InvocationErrorCode, type AsyncEvent } from '@forge/events';
import { exec, q } from '../db/sql';
import { getSettings } from '../db/settings';
import { effectiveSchedule } from '../domain/edition';
import { backgroundEdition } from '../api/edition';
import {
  addUsage,
  applyRetention,
  createSnapshot,
  activeSnapshot,
  getSnapshot,
  updateSnapshot,
} from '../db/snapshots';
import { audit } from '../db/audit';
import { push, type CollectEvent } from '../lib/queue';
import { CollectorClient, RateLimitedError } from './client';
import { hourBucket, secondsToNextHour } from './points';
import { errInfo } from '../lib/errors';
import {
  directory,
  finalize,
  groupsStep,
  plan,
  projectsStep,
  type StepContext,
  type StepName,
} from './steps';
import { refreshGate } from './gate';
import { isDue } from './schedule';

export { isDue };

const MAX_ATTEMPTS = 3;

// ---------- idempotency (job_step) ----------
async function stepState(seq: number, step: string, batch: number) {
  const rows = await q<{ status: string; attempts: number }>(
    'SELECT status, attempts FROM job_step WHERE snapshot_id = ? AND step = ? AND batch = ?',
    String(seq),
    step,
    batch,
  );
  return rows[0] ? { status: rows[0].status, attempts: Number(rows[0].attempts) } : null;
}

async function markStep(
  seq: number,
  step: string,
  batch: number,
  status: string,
  errorCode: string | null = null,
) {
  await exec(
    `INSERT INTO job_step (snapshot_id, step, batch, status, attempts, error_code) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), attempts = attempts + ?, error_code = VALUES(error_code)`,
    String(seq),
    step,
    batch,
    status,
    status === 'failed' ? 1 : 0,
    errorCode,
    status === 'failed' ? 1 : 0,
  );
}

// ---------- own rate-point budget (per site, per UTC hour) ----------
export async function hourUsage(now = Date.now()): Promise<{ points: number; calls: number }> {
  const rows = await q<{ points: number; calls: number }>(
    'SELECT points, calls FROM rate_usage WHERE hour_utc = ?',
    hourBucket(now),
  );
  return rows[0]
    ? { points: Number(rows[0].points), calls: Number(rows[0].calls) }
    : { points: 0, calls: 0 };
}

async function addRate(points: number, calls: number) {
  if (!points && !calls) return;
  await exec(
    'INSERT INTO rate_usage (hour_utc, points, calls) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE points = points + VALUES(points), calls = calls + VALUES(calls)',
    hourBucket(),
    points,
    calls,
  );
}

/** Starts a snapshot unless one is already running. Returns the snapshot seq and whether it is new. */
export async function startSnapshot(
  trigger: 'manual' | 'scheduled' | 'onboarding',
): Promise<{ seq: number; created: boolean }> {
  const active = await activeSnapshot();
  if (active) return { seq: active.seq, created: false };
  const seq = await createSnapshot(trigger);
  await push({ step: 'PLAN', snapshotSeq: seq, batch: 0 });
  await refreshGate().catch(() => undefined);
  console.log('[snapshot] queued', { seq, trigger });
  return { seq, created: true };
}

const STEPS: Record<
  Exclude<StepName, 'FINALIZE'>,
  (ctx: StepContext) => ReturnType<typeof plan>
> = {
  PLAN: plan,
  PROJECTS: projectsStep,
  DIRECTORY: directory,
  GROUPS: groupsStep,
};

/** Queue consumer for one collector step. At-least-once safe via job_step. */
export async function runCollectStep(
  event: AsyncEvent<CollectEvent>,
): Promise<InvocationError | void> {
  const body = event.body;
  const seq = Number(body.snapshotSeq);
  const step = body.step as StepName;
  const batch = Number(body.batch ?? 0);
  if (!Number.isInteger(seq) || seq <= 0) return;
  const snap = await getSnapshot(seq, false);
  if (!snap || snap.status === 'complete' || snap.status === 'partial' || snap.status === 'failed')
    return;
  const state = await stepState(seq, step, batch);
  if (state?.status === 'done') {
    console.log('[collector] duplicate delivery ignored', { seq, step, batch });
    return;
  }
  const settings = await getSettings();
  const used = await hourUsage();
  if (used.points >= settings.hourlyPointBudget) {
    const delay = Math.min(900, secondsToNextHour());
    await updateSnapshot(seq, {
      progress: {
        ...(snap.progress ?? { step, batch }),
        message: `Paused: hourly rate budget used (${used.points} points); resuming in ${Math.ceil(delay / 60)} min`,
      },
    });
    await push({ step, snapshotSeq: seq, batch }, delay);
    console.log('[collector] budget pause', { seq, step, batch, points: used.points, delay });
    return;
  }
  if (snap.status === 'queued') await updateSnapshot(seq, { status: 'running' });
  const client = new CollectorClient(settings.fallbackAccountId);
  const ctx: StepContext = { seq, batch, settings, client };
  const started = Date.now();
  try {
    if (step === 'FINALIZE') {
      const r = await finalize(ctx);
      await addUsage(seq, client.points, client.calls);
      await addRate(client.points, client.calls);
      await updateSnapshot(seq, {
        status: r.status,
        coverage: r.coverage,
        stats: r.stats,
        contentHash: r.contentHash,
        finishedAt: Date.now(),
        collectorMode: client.impersonated.size ? 'app+impersonation' : 'app',
        progress: { step: 'DONE', batch: 0, message: `Snapshot ${r.status}`, counts: r.stats },
      });
      await markStep(seq, step, batch, 'done');
      await audit('system', 'snapshot.completed', `#${seq}`, { status: r.status, ...r.merge });
      await refreshGate().catch(() => undefined);
      await push({ step: 'REMEDIATION', seq }).catch(() => undefined);
      await push({ step: 'ALERTS', seq }).catch(() => undefined);
      const after = await getSnapshot(seq, false);
      console.log('[collector] snapshot finished', {
        seq,
        status: r.status,
        facts: r.merge.facts,
        inserted: r.merge.inserted,
        extended: r.merge.extended,
        carried: r.merge.carried,
        points: after?.points,
        calls: after?.calls,
        gaps: r.coverage.filter((c) => c.status !== 'info').length,
      });
      if (process.env.ACCESSRADAR_SPIKE === '1') await push({ step: 'SELFTEST' }, 5);
      const { retentionDays } = effectiveSchedule(settings, (await backgroundEdition()).features);
      const retention = await applyRetention(retentionDays);
      if (retention.snapshots || retention.auditEvents || retention.notices)
        console.log('[retention] deleted', retention);
      return;
    }
    const result = await STEPS[step](ctx);
    await addUsage(seq, client.points, client.calls);
    await addRate(client.points, client.calls);
    await updateSnapshot(seq, { progress: result.progress });
    if (result.next)
      await push({ step: result.next.step, snapshotSeq: seq, batch: result.next.batch });
    await markStep(seq, step, batch, 'done');
    console.log('[collector] step ok', {
      seq,
      step,
      batch,
      points: client.points,
      calls: client.calls,
      ms: Date.now() - started,
    });
  } catch (e) {
    await addUsage(seq, client.points, client.calls).catch(() => undefined);
    await addRate(client.points, client.calls).catch(() => undefined);
    if (e instanceof RateLimitedError) {
      console.warn('[collector] rate limited', {
        seq,
        step,
        batch,
        retryAfter: e.retryAfter,
        reason: e.reason,
      });
      await updateSnapshot(seq, {
        progress: {
          ...(snap.progress ?? { step, batch }),
          message: `Jira asked us to slow down; retrying in ${e.retryAfter}s`,
        },
      });
      if ((event.retryContext?.retryCount ?? 0) < 3)
        return new InvocationError({
          retryAfter: e.retryAfter,
          retryReason: InvocationErrorCode.FUNCTION_UPSTREAM_RATE_LIMITED,
        });
      await push({ step, snapshotSeq: seq, batch }, e.retryAfter);
      return;
    }
    const info = errInfo(e);
    const message = info.message;
    await markStep(seq, step, batch, 'failed', 'ERROR');
    const attempts = (state?.attempts ?? 0) + 1;
    console.error('[collector] step failed', { seq, step, batch, attempts, ...info });
    if (attempts >= MAX_ATTEMPTS) {
      await updateSnapshot(seq, {
        status: 'failed',
        error: `${step}: ${message}`,
        finishedAt: Date.now(),
      });
      await audit('system', 'snapshot.failed', `#${seq}`, { step, message });
      await refreshGate().catch(() => undefined);
      return;
    }
    return new InvocationError({
      retryAfter: 30 * attempts,
      retryReason: InvocationErrorCode.FUNCTION_RETRY_REQUEST,
    });
  }
}

export async function scheduledTick(): Promise<void> {
  // Standard runs a saved daily schedule weekly (server-side edition gate).
  const settings = effectiveSchedule(await getSettings(), (await backgroundEdition()).features);
  const rows = await q<{ started_at: number }>(
    "SELECT MAX(started_at) AS started_at FROM snap WHERE trigger_kind = 'scheduled'",
  );
  const last = rows[0]?.started_at ? Number(rows[0].started_at) : null;
  if (isDue(settings, last)) {
    const r = await startSnapshot('scheduled');
    console.log('[tick] scheduled snapshot', { seq: r.seq, created: r.created });
  } else console.log('[tick] nothing due', { frequency: settings.frequency });
}
