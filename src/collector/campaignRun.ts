/**
 * Campaign queue steps: start run (wait for snapshot), materialize per-project reviews,
 * and issue in-app reminder notices. Advanced edition only.
 */
import { backgroundEdition } from '../api/edition';
import { audit } from '../db/audit';
import {
  getCampaign,
  getCampaignRun,
  insertAssignment,
  insertCampaignRun,
  listCampaigns,
  patchCampaignRun,
  setCampaignNextRunAt,
  soonestCampaignRunAt,
  touchAssignmentReminder,
  type CampaignRow,
} from '../db/campaigns';
import { activeExceptionsForKeys, expireExceptions } from '../db/exceptions';
import { insertNotice } from '../db/notices';
import { insertReview } from '../db/reviews';
import { getSettings } from '../db/settings';
import { activeSnapshot, latestCommitted, loadFacts, previousCommitted } from '../db/snapshots';
import { q } from '../db/sql';
import { nextRunAt, parseReminderDays } from '../domain/campaignSchedule';
import { applyExceptions } from '../engine/exceptions';
import { buildReviewItems } from '../engine/review';
import { ENGINE_VERSION } from '../engine/resolve';
import { buildState } from '../engine/state';
import { push } from '../lib/queue';

const MATERIALIZE_PAGE = 25;
const MAX_PROJECTS_PER_RUN = 1000;
const MAX_SNAPSHOT_WAITS = 36;

export async function soonestReminderAt(now = Date.now()): Promise<number | null> {
  const rows = await q<{ n: number }>(
    `SELECT COUNT(*) AS n FROM review_assignment WHERE status = 'open'`,
  );
  if (!Number(rows[0]?.n)) return null;
  // While open assignments exist, re-check roughly hourly via the tick gate.
  return now + 3600_000;
}

/** Resolve project ids for a campaign from the latest committed snapshot state. */
export function resolveCampaignProjectIds(
  campaign: CampaignRow,
  projectIds: string[],
): { ids: string[]; warnings: string[] } {
  const warnings: string[] = [];
  if (campaign.scope.type === 'site') {
    return { ids: projectIds.slice(0, MAX_PROJECTS_PER_RUN), warnings };
  }
  if (campaign.scope.type === 'projects') {
    const known = new Set(projectIds);
    const ids = campaign.scope.ids.filter((id) => known.has(id)).slice(0, MAX_PROJECTS_PER_RUN);
    const missing = campaign.scope.ids.length - ids.length;
    if (missing) warnings.push(`${missing} scoped project(s) missing from snapshot`);
    return { ids, warnings };
  }
  warnings.push('Project category scope is not available yet; no projects selected');
  return { ids: [], warnings };
}

export function resolveAssignee(
  campaign: CampaignRow,
  projectId: string,
  leadAccountId: string | undefined,
): string | null {
  if (campaign.delegateRule === 'admin') return campaign.createdBy;
  if (campaign.delegateRule === 'map') return campaign.delegateMap?.[projectId] ?? null;
  return leadAccountId ?? null;
}

/** Tick helper: create runs for due campaigns and enqueue CAMPAIGN_RUN. */
export async function enqueueDueCampaigns(now = Date.now()): Promise<number> {
  const edition = await backgroundEdition();
  if (!edition.features.reviewCampaigns) return 0;
  const campaigns = (await listCampaigns()).filter(
    (c) => c.status === 'active' && c.nextRunAt !== null && c.nextRunAt <= now,
  );
  let n = 0;
  for (const c of campaigns.slice(0, 20)) {
    const dueAt = now + c.windowDays * 86400_000;
    const runId = await insertCampaignRun({
      campaignId: c.id,
      status: 'starting',
      startedAt: now,
      dueAt,
    });
    const next = nextRunAt({ frequency: c.frequency, startAt: c.startAt }, now, now);
    await setCampaignNextRunAt(c.id, next, now);
    await push({ step: 'CAMPAIGN_RUN', runId });
    await audit('system', 'campaign.run_started', runId, { campaignId: c.id });
    n += 1;
  }
  return n;
}

export async function runCampaignRun(runId: string, waits = 0): Promise<void> {
  const edition = await backgroundEdition();
  if (!edition.features.reviewCampaigns) return;
  const run = await getCampaignRun(runId);
  if (!run || run.status === 'completed' || run.status === 'failed') return;
  const campaign = await getCampaign(run.campaignId);
  if (!campaign || campaign.status === 'deleted') {
    await patchCampaignRun(runId, {
      status: 'failed',
      error: 'Campaign missing',
      finishedAt: Date.now(),
    });
    return;
  }

  const active = await activeSnapshot();
  if (active) {
    if (waits >= MAX_SNAPSHOT_WAITS) {
      await patchCampaignRun(runId, {
        status: 'failed',
        error: 'Timed out waiting for snapshot',
        finishedAt: Date.now(),
      });
      return;
    }
    await push({ step: 'CAMPAIGN_RUN', runId, waits: waits + 1 }, 300);
    return;
  }

  let snap = run.seq != null ? null : await latestCommitted();
  if (run.seq == null) {
    if (!snap || snap.startedAt < run.startedAt - 60_000) {
      // Dynamic import avoids a circular dependency with collector/run.ts.
      const { startSnapshot } = await import('./run');
      const started = await startSnapshot('manual');
      await patchCampaignRun(runId, { seq: started.seq, status: 'waiting_snapshot' });
      await push({ step: 'CAMPAIGN_RUN', runId, waits: waits + 1 }, 300);
      return;
    }
    await patchCampaignRun(runId, { seq: snap.seq, status: 'materializing' });
  } else {
    // Waiting for the snapshot we started to commit.
    snap = await latestCommitted();
    if (!snap || snap.seq < run.seq) {
      if (waits >= MAX_SNAPSHOT_WAITS) {
        await patchCampaignRun(runId, {
          status: 'failed',
          error: 'Timed out waiting for snapshot',
          finishedAt: Date.now(),
        });
        return;
      }
      await push({ step: 'CAMPAIGN_RUN', runId, waits: waits + 1 }, 300);
      return;
    }
    await patchCampaignRun(runId, { status: 'materializing' });
  }

  await push({ step: 'CAMPAIGN_MATERIALIZE', runId, cursor: 0 });
}

export async function runCampaignMaterialize(runId: string, cursor = 0): Promise<void> {
  const edition = await backgroundEdition();
  if (!edition.features.reviewCampaigns) return;
  const run = await getCampaignRun(runId);
  if (!run?.seq) return;
  const campaign = await getCampaign(run.campaignId);
  if (!campaign) return;
  const state = buildState(await loadFacts(run.seq));
  const allIds = [...state.projects.keys()].sort();
  const { ids, warnings } = resolveCampaignProjectIds(campaign, allIds);
  if (warnings.length && cursor === 0)
    console.log('[campaign] materialize warnings', { runId, count: warnings.length });

  const slice = ids.slice(cursor, cursor + MATERIALIZE_PAGE);
  const settings = await getSettings();
  const keyPerms = campaign.keyPermissions.length
    ? campaign.keyPermissions
    : settings.keyPermissions;
  const compare = await previousCommitted(run.seq);
  const compareState = compare ? buildState(await loadFacts(compare.seq)) : undefined;
  const now = Date.now();
  await expireExceptions(now);
  let created = 0;

  for (const projectId of slice) {
    const project = state.projects.get(projectId);
    if (!project) continue;
    const scope = { type: 'projects' as const, ids: [projectId] };
    const drafts = buildReviewItems(state, scope, keyPerms, compareState);
    const active = await activeExceptionsForKeys(drafts.map((i) => i.itemKey));
    const items = applyExceptions(drafts, active, now);
    const reviewId = await insertReview(
      {
        name: `${campaign.name} — ${project.key}`,
        scope,
        keyPermissions: keyPerms,
        baseSeq: run.seq,
        compareSeq: compare?.seq ?? null,
        createdBy: campaign.createdBy,
        createdAt: now,
        dueAt: run.dueAt,
        engineVersion: ENGINE_VERSION,
        campaignRunId: runId,
      },
      items,
    );
    await insertAssignment({
      reviewId,
      projectId,
      assignee: resolveAssignee(campaign, projectId, project.leadAccountId),
      status: 'open',
      dueAt: run.dueAt,
      submittedAt: null,
      submittedBy: null,
      lastReminderAt: null,
      reminderCount: 0,
    });
    created += 1;
  }

  const nextCursor = cursor + slice.length;
  const reviewCount = run.reviewCount + created;
  await patchCampaignRun(runId, { reviewCount });
  await audit('system', 'campaign.run_materialized', runId, {
    cursor,
    created,
    total: reviewCount,
  });

  if (nextCursor < ids.length) {
    await push({ step: 'CAMPAIGN_MATERIALIZE', runId, cursor: nextCursor });
    return;
  }

  await patchCampaignRun(runId, { status: 'completed', finishedAt: Date.now() });
  await audit('system', 'campaign.run_completed', runId, {
    campaignId: campaign.id,
    reviews: reviewCount,
  });
  console.log('[campaign] run completed', { runId, reviews: reviewCount });
}

export async function runReminders(now = Date.now()): Promise<number> {
  const edition = await backgroundEdition();
  if (!edition.features.reviewCampaigns && !edition.features.delegatedReviews) return 0;
  const rows = await q<any>(
    `SELECT a.review_id, a.project_id, a.assignee, a.due_at, a.last_reminder_at, a.reminder_count, a.status,
            c.reminder_days, c.name AS campaign_name
     FROM review_assignment a
     INNER JOIN review r ON r.id = a.review_id
     INNER JOIN campaign_run cr ON cr.id = r.campaign_run_id
     INNER JOIN campaign c ON c.id = cr.campaign_id
     WHERE a.status = 'open'
     LIMIT 200`,
  );
  let issued = 0;
  for (const row of rows) {
    const dueAt = Number(row.due_at);
    const reminderDays = parseReminderDays(String(row.reminder_days || '7,3,1'));
    const last = row.last_reminder_at != null ? Number(row.last_reminder_at) : null;
    const overdue = now >= dueAt;
    let should = false;
    let kind = 'reminder';
    let title = `Access review reminder: ${row.campaign_name}`;

    if (overdue) {
      if (!last || now - last >= 20 * 3600_000) {
        should = true;
        kind = 'overdue';
        title = `Overdue access review: ${row.campaign_name}`;
      }
    } else {
      for (const d of reminderDays) {
        const at = dueAt - d * 86400_000;
        if (Math.abs(at - now) <= 3600_000) {
          if (!last || Math.abs(last - at) > 3600_000) {
            should = true;
            title = `Access review due in ${d} day${d === 1 ? '' : 's'}: ${row.campaign_name}`;
            break;
          }
        }
      }
    }
    if (!should) continue;
    await insertNotice({
      kind,
      audience: 'project',
      projectId: row.project_id,
      accountId: row.assignee,
      refId: row.review_id,
      severity: overdue ? 'high' : 'medium',
      title,
      body: 'Open the project Access review page in Jira to continue.',
    });
    await touchAssignmentReminder(row.review_id, now);
    issued += 1;
  }
  if (issued) await audit('system', 'reminder.issued', null, { count: issued });
  return issued;
}

export { soonestCampaignRunAt };
