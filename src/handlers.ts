import Resolver from '@forge/resolver';
import { InvocationError, InvocationErrorCode, type AsyncEvent } from '@forge/events';
import { assertJiraAdmin } from './lib/auth';
import { push, type CollectEvent } from './lib/queue';
import { runMigrations } from './db/migrations';
import { formatProbeLog, runProbes, spikeEnabled } from './spike/probe';
import { ENGINE_VERSION } from './engine/resolve';

// ---------- UI resolver (jira:adminPage) ----------
const resolver = new Resolver();

resolver.define('getStatus', async () => {
  await assertJiraAdmin();
  console.log('[ui] getStatus ok');
  return { engineVersion: ENGINE_VERSION, spike: spikeEnabled() };
});

/** Dev-only spike: probes as interactive user + as app, and enqueues an offline-impersonation probe
 *  for the caller (accountId taken from the server-side context, never from the payload). */
resolver.define('runSpike', async ({ context }) => {
  if (!spikeEnabled()) throw new Error('Spike disabled');
  await assertJiraAdmin();
  const [asUser, asApp] = await Promise.all([runProbes({ kind: 'user' }), runProbes({ kind: 'app' })]);
  console.log(formatProbeLog('asUser', asUser));
  console.log(formatProbeLog('asApp', asApp));
  const accountId = (context as { accountId?: string }).accountId;
  if (accountId) await push({ step: 'SPIKE', impersonateAccountId: accountId });
  return { asUser, asApp, impersonationQueued: Boolean(accountId) };
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
  console.log('[lifecycle] enqueued migrations', { spike: spikeEnabled(), hasAccount: Boolean(who) });
}

// ---------- scheduled triggers ----------
export async function tickHandler() {
  // Week 2: read settings, decide if a snapshot is due, create snapshot row, push PLAN.
  await push({ step: 'MIGRATE' });
  if (spikeEnabled()) await push({ step: 'SPIKE' });
  console.log('[tick] ok');
  return { statusCode: 204 };
}

export async function privacyHandler() {
  // Week 7: privacy.reportPersonalData(person rows) -> anonymise closed accounts.
  console.log('[privacy] stub – no personal data stored yet');
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
        return new InvocationError({ retryAfter: 60, retryReason: InvocationErrorCode.FUNCTION_RETRY_REQUEST });
      }
      return;
    }
    case 'SPIKE': {
      if (!spikeEnabled()) return;
      const imp = body.impersonateAccountId;
      const results = await runProbes(imp ? { kind: 'impersonate', accountId: imp } : { kind: 'app' });
      console.log(formatProbeLog(imp ? 'asUser(accountId) offline' : 'asApp (async)', results));
      return;
    }
    default:
      console.log('[collector] step not implemented yet', body.step);
  }
}
