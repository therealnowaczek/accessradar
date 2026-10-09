import Resolver from '@forge/resolver';
import { InvocationError, InvocationErrorCode, type AsyncEvent } from '@forge/events';
import { assertJiraAdmin, ForbiddenError } from './lib/auth';
import { push, type CollectEvent } from './lib/queue';
import { ensureMigrated, runMigrations } from './db/migrations';
import { failStale } from './db/snapshots';
import { formatProbeLog, runProbes, spikeEnabled } from './spike/probe';
import { devAutoSnapshot, devSelfTest } from './spike/selftest';
import { listProjectsAsUser } from './ui/projects';
import { runCollectStep, scheduledTick } from './collector/run';
import { runPrivacyReport } from './privacy';
import * as svc from './api/service';

// ---------- UI resolver (jira:adminPage) ----------
const resolver = new Resolver();

type Ctx = { accountId: string; environmentType?: string };
type Handler = (payload: any, ctx: Ctx) => Promise<unknown>;

/**
 * Every resolver: migrations applied, caller verified as Jira admin (accountId from the
 * server-side context), payload validated inside the handler. Errors become { ok: false }.
 */
function def(name: string, fn: Handler) {
  resolver.define(name, async ({ payload, context }) => {
    const started = Date.now();
    try {
      const accountId = (context as { accountId?: string }).accountId ?? '';
      await assertJiraAdmin(accountId);
      await ensureMigrated();
      const environmentType = (context as { environmentType?: string }).environmentType;
      const data = await fn(payload ?? {}, { accountId, environmentType });
      console.log(`[ui] ${name} ok`, { ms: Date.now() - started });
      return { ok: true, data };
    } catch (e) {
      const message = String((e as Error)?.message ?? e).slice(0, 300);
      const known = e instanceof ForbiddenError || e instanceof svc.BadRequest;
      if (!known) console.error(`[ui] ${name} failed`, { message });
      return {
        ok: false,
        error: known ? message : `Something went wrong: ${message}`,
        forbidden: e instanceof ForbiddenError,
      };
    }
  });
}

def('getStatus', (_p, c) => svc.status(c.environmentType));
def('getOverview', (p) => svc.overview(p));
def('listSnapshots', () => svc.snapshots());
def('getSnapshot', (p) => svc.snapshotDetail(p));
def('startSnapshot', (p, c) =>
  svc.takeSnapshot(c.accountId, p.trigger === 'onboarding' ? 'onboarding' : 'manual'),
);
def('listProjects', () => listProjectsAsUser());
def('exploreProjects', (p) => svc.exploreProjects(p));
def('projectAccess', (p) => svc.projectDetail(p));
def('exploreGroups', (p) => svc.exploreGroups(p));
def('groupDetail', (p) => svc.groupInfo(p));
def('explorePeople', (p) => svc.explorePeople(p));
def('personAccess', (p) => svc.personInfo(p));
def('globalPermissions', (p) => svc.globalPermissions(p));
def('getChanges', (p) => svc.changes(p));
def('accessMatrix', (p) => svc.matrix(p));
def('listReviews', () => svc.reviews());
def('createReview', (p, c) => svc.createReview(p, c.accountId));
def('getReview', (p) => svc.reviewDetail(p));
def('decideItems', (p, c) => svc.decideItems(p, c.accountId));
def('signReview', (p, c) => svc.signReview(p, c.accountId));
def('verifyReview', (p) => svc.verifyReview(p));
def('deleteReview', (p, c) => svc.removeReview(p, c.accountId));
def('getSettings', (_p, c) => svc.settingsView(c.accountId));
def('saveSettings', (p, c) => svc.updateSettings(p, c.accountId));
def('getActivity', () => svc.activity());
def('logExport', (p, c) => svc.logExport(p, c.accountId));

/** Dev-only spike: probes as interactive user + as app, and enqueues an offline-impersonation probe
 *  for the caller (accountId taken from the server-side context, never from the payload). */
def('runSpike', async (_p, c) => {
  // Dev-only: needs the ACCESSRADAR_SPIKE=1 variable AND the development environment.
  if (!spikeEnabled() || c.environmentType !== 'DEVELOPMENT')
    throw new svc.BadRequest('Spike disabled');
  const [asUser, asApp] = await Promise.all([
    runProbes({ kind: 'user' }),
    runProbes({ kind: 'app' }),
  ]);
  console.log(formatProbeLog('asUser', asUser));
  console.log(formatProbeLog('asApp', asApp));
  if (c.accountId) await push({ step: 'SPIKE', impersonateAccountId: c.accountId });
  return { asUser, asApp, impersonationQueued: Boolean(c.accountId) };
});

export const resolverHandler = resolver.getDefinitions();

// ---------- lifecycle trigger ----------
interface LifecycleEvent {
  eventType?: string;
  installerAccountId?: string;
  upgraderAccountId?: string;
}
export async function lifecycleHandler(event: LifecycleEvent) {
  await push({ step: 'MIGRATE' });
  const who = event.installerAccountId ?? event.upgraderAccountId;
  if (spikeEnabled()) {
    // app-user permissions are granted eventually-consistently after install; give it time.
    await push({ step: 'SPIKE' }, 120);
    if (who) await push({ step: 'SPIKE', impersonateAccountId: who }, 150);
  }
  console.log('[lifecycle] enqueued migrations', {
    spike: spikeEnabled(),
    hasAccount: Boolean(who),
  });
}

// ---------- scheduled triggers ----------
export async function tickHandler() {
  try {
    await ensureMigrated();
    const stale = await failStale();
    if (stale) console.warn('[tick] marked stale snapshots failed', { stale });
    await scheduledTick();
    await devAutoSnapshot();
  } catch (e) {
    console.error('[tick] failed', String((e as Error)?.message ?? e).slice(0, 300));
  }
  if (spikeEnabled()) {
    await push({ step: 'SPIKE' });
    await push({ step: 'SELFTEST' }, 30);
  }
  return { statusCode: 204 };
}

/** Daily: personal-data report + anonymisation (via the queue for the longer timeout). */
export async function privacyHandler() {
  await push({ step: 'PRIVACY' });
  console.log('[privacy] report queued');
  return { statusCode: 204 };
}

// ---------- queue consumer ----------
export async function collectorHandler(event: AsyncEvent<CollectEvent>) {
  const body = event.body;
  switch (body.step) {
    case 'MIGRATE': {
      try {
        const applied = await runMigrations();
        console.log('[migrate] applied', applied.length);
      } catch (e) {
        console.error('[migrate] failed', String((e as Error)?.message ?? e));
        return new InvocationError({
          retryAfter: 60,
          retryReason: InvocationErrorCode.FUNCTION_RETRY_REQUEST,
        });
      }
      return;
    }
    case 'PRIVACY': {
      await ensureMigrated();
      const r = await runPrivacyReport();
      console.log('[privacy] reported', r);
      return;
    }
    case 'SELFTEST':
      await ensureMigrated();
      await devSelfTest();
      return;
    case 'SPIKE': {
      if (!spikeEnabled()) return;
      const imp = body.impersonateAccountId;
      const results = await runProbes(
        imp ? { kind: 'impersonate', accountId: imp } : { kind: 'app' },
      );
      console.log(formatProbeLog(imp ? 'asUser(accountId) offline' : 'asApp (async)', results));
      return;
    }
    default:
      await ensureMigrated();
      return runCollectStep(event);
  }
}
