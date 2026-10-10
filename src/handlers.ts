import Resolver from '@forge/resolver';
import { InvocationError, InvocationErrorCode, type AsyncEvent } from '@forge/events';
import { assertJiraAdmin, ForbiddenError } from './lib/auth';
import { push, type CollectEvent } from './lib/queue';
import { ensureMigrated, runMigrations } from './db/migrations';
import { failStale, purgeAudit } from './db/snapshots';
import { getSettings } from './db/settings';
import {
  runSpikeResolver,
  spikeAllowed,
  spikeEnabled,
  spikeOnInstall,
  spikeOnTick,
  spikeProbe,
  spikeSelfTest,
} from './spike';
import { listProjectsAsUser } from './ui/projects';
import { runCollectStep, scheduledTick } from './collector/run';
import { runPrivacyReport } from './privacy';
import * as svc from './api/service';
import { errInfo } from './lib/errors';
import { backgroundEdition, decideForInvocation, setEditionOverride } from './api/edition';
import { effectiveSchedule, type EditionLicense } from './domain/edition';
import { isLicensed, UNLICENSED_MESSAGE } from './domain/license';

// ---------- UI resolver (jira:adminPage) ----------
const resolver = new Resolver();

type Ctx = {
  accountId: string;
  environmentType?: string;
  license?: EditionLicense | null;
  edition: Awaited<ReturnType<typeof decideForInvocation>>;
};
type Handler = (payload: any, ctx: Ctx) => Promise<unknown>;

/**
 * Every resolver: migrations applied, caller verified as Jira admin (accountId from the
 * server-side context), payload validated inside the handler. Errors become { ok: false }.
 */
function def(name: string, fn: Handler) {
  resolver.define(name, async ({ payload, context }) => {
    const started = Date.now();
    try {
      const license = (context as { license?: EditionLicense | null }).license ?? null;
      if (!isLicensed({ license })) return { ok: false, error: UNLICENSED_MESSAGE };
      const accountId = (context as { accountId?: string }).accountId ?? '';
      await assertJiraAdmin(accountId);
      await ensureMigrated();
      const environmentType = (context as { environmentType?: string }).environmentType;
      // Edition is resolved on the server for every call; resolvers enforce features.
      const edition = await decideForInvocation(license);
      const data = await fn(payload ?? {}, { accountId, environmentType, license, edition });
      console.log(`[ui] ${name} ok`, { ms: Date.now() - started });
      return { ok: true, data };
    } catch (e) {
      const message = String((e as Error)?.message ?? e).slice(0, 300);
      const known = e instanceof ForbiddenError || e instanceof svc.BadRequest;
      if (!known) {
        console.error(`[ui] ${name} failed`, errInfo(e));
      }
      return {
        ok: false,
        error: known ? message : `Something went wrong: ${message}`,
        forbidden: e instanceof ForbiddenError,
      };
    }
  });
}

def('getStatus', async (_p, c) => ({
  ...(await svc.status(spikeAllowed(c.environmentType))),
  edition: svc.editionView(c.edition),
}));
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
def('getSettings', (_p, c) => svc.settingsView(c.accountId, c.edition));
def('saveSettings', (p, c) => svc.updateSettings(p, c.accountId, c.edition));
def('getEdition', async (_p, c) => svc.editionView(c.edition));
def('setEditionOverride', async (p, c) =>
  svc.editionView(await setEditionOverride(c.accountId, p.edition ?? null, c.license)),
);
def('getActivity', () => svc.activity());
def('logExport', (p, c) => svc.logExport(p, c.accountId));

/** Dev-only spike: probes as interactive user + as app, and enqueues an offline-impersonation probe
 *  for the caller (accountId taken from the server-side context, never from the payload). */
def('runSpike', async (_p, c) => {
  // Dev-only: needs the ACCESSRADAR_SPIKE=1 variable AND the development environment.
  if (!spikeAllowed(c.environmentType)) throw new svc.BadRequest('Spike disabled');
  return runSpikeResolver(c.accountId);
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
  await spikeOnInstall(who);
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
    await spikeOnTick();
  } catch (e) {
    console.error('[tick] failed', errInfo(e));
  }
  return { statusCode: 204 };
}

/** Daily tick: personal-data report (each account at most once per 7 days) + pseudonymisation of closed accounts. */
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
        console.error('[migrate] failed', errInfo(e));
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
      // Audit log retention also runs daily, so it applies even when no snapshots are taken.
      const settings = effectiveSchedule(await getSettings(), (await backgroundEdition()).features);
      const auditEvents = await purgeAudit(Date.now() - settings.retentionDays * 86400_000);
      if (auditEvents) console.log('[retention] audit events deleted', { auditEvents });
      return;
    }
    case 'SELFTEST':
      await ensureMigrated();
      await spikeSelfTest();
      return;
    case 'SPIKE':
      await spikeProbe(body.impersonateAccountId);
      return;
    default:
      await ensureMigrated();
      return runCollectStep(event);
  }
}
