import * as svc from '../api/service';
import { getItems } from '../db/reviews';
import { activeSnapshot, latestCommitted, listSnapshots } from '../db/snapshots';
import { startSnapshot } from '../collector/run';
import { spikeEnabled } from './probe';
import { errInfo } from '../lib/errors';

/**
 * Development-only self-test (behind ACCESSRADAR_SPIKE=1, which is set only in the development
 * environment). Exercises the resolver service layer against real snapshot data and logs counts
 * only, never names or accountIds. The UI resolvers wrap exactly these functions.
 */
export async function devSelfTest(): Promise<void> {
  if (!spikeEnabled()) return;
  const log = (name: string, info: Record<string, unknown>) =>
    console.log(`[selftest] ${name}`, info);
  try {
    const status = await svc.status('DEVELOPMENT');
    log('getStatus', { latest: status.latest?.seq ?? null, status: status.latest?.status ?? null });
    if (!status.latest) return;
    const seq = status.latest.seq;
    const ov: any = await svc.overview({});
    log('getOverview', {
      metrics: ov.metrics,
      risks: ov.risks?.map((r: any) => `${r.id}=${r.count}`).join(','),
      changes: ov.changes,
    });
    const snaps = await svc.snapshots();
    log('listSnapshots', { count: snaps.snapshots.length, gaps: snaps.snapshots[0]?.gaps });
    const projects = await svc.exploreProjects({ seq });
    log('exploreProjects', {
      count: projects.data?.length,
      people: projects.data?.map((p) => p.people).join(','),
    });
    const first = projects.data?.[0];
    if (first) {
      const pa = await svc.projectDetail({ seq, projectId: first.id });
      log('projectAccess', {
        rows: pa.data?.rows.length,
        permissions: pa.data?.permissions.length,
        sampleReason: Boolean(pa.data?.rows[0]),
      });
    }
    const groups = await svc.exploreGroups({ seq });
    log('exploreGroups', {
      count: groups.data?.length,
      read: groups.data?.filter((g) => g.members !== null).length,
    });
    const used = groups.data?.find((g) => g.projects > 0) ?? groups.data?.[0];
    if (used) {
      const gd = await svc.groupInfo({ seq, groupId: used.id });
      log('groupDetail', { members: gd.data?.members.length, usage: gd.data?.usage.length });
    }
    const people = await svc.explorePeople({ seq });
    log('explorePeople', {
      count: people.data?.length,
      humans: people.data?.filter((p) => p.accountType === 'atlassian').length,
      inactive: people.data?.filter((p) => !p.active).length,
      withAccess: people.data?.filter((p) => p.projects > 0).length,
    });
    const human = people.data?.find((p) => p.accountType === 'atlassian' && p.projects > 0);
    if (human) {
      const pi = await svc.personInfo({ seq, accountId: human.accountId });
      log('personAccess', {
        projects: pi.data?.projects.length,
        groups: pi.data?.groups.length,
        changes: Boolean(pi.data?.changes),
      });
    }
    const ch = await svc.changes({});
    log('getChanges', {
      a: ch.a?.seq ?? null,
      b: ch.b?.seq ?? null,
      granted: ch.granted.length,
      revoked: ch.revoked.length,
      facts: ch.facts.length,
    });
    const m = await svc.matrix({ seq, keyPermissions: ['BROWSE_PROJECTS', 'ADMINISTER_PROJECTS'] });
    log('accessMatrix', { rows: m.data?.length });
    // Review round-trip on app storage only (never Jira): create, decide, read, delete the draft.
    const r = await svc.createReview(
      { name: '[dev self-test] review', scope: { type: 'site', ids: [] } },
      'system',
    );
    const items = await getItems(r.id);
    await svc.decideItems(
      { id: r.id, idxs: items.slice(0, 3).map((i) => i.idx), decision: 'keep' },
      'system',
    );
    const detail = await svc.reviewDetail({ id: r.id });
    log('review round-trip', {
      items: r.items,
      decided: detail.items.filter((i) => i.decision).length,
    });
    await svc.removeReview({ id: r.id }, 'system');
  } catch (e) {
    console.error('[selftest] failed', errInfo(e));
  }
}

/** Development only: keep one fresh snapshot per day so the collector is exercised. */
export async function devAutoSnapshot(): Promise<void> {
  if (!spikeEnabled()) return;
  const [latest, active, recent] = await Promise.all([
    latestCommitted(),
    activeSnapshot(),
    listSnapshots(1),
  ]);
  if (active) return;
  const last = recent[0]?.startedAt ?? latest?.startedAt ?? 0;
  if (Date.now() - last < 24 * 3600_000) return;
  const r = await startSnapshot('scheduled');
  console.log('[selftest] dev snapshot started', { seq: r.seq });
}
