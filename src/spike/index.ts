/**
 * Development-only spike/self-test facade. Production builds replace this file with
 * scripts/prod/spike-index.ts and delete probe.ts/selftest.ts (scripts/strip-spike.sh),
 * so no probe or self-test code ships to production.
 */
import { push } from '../lib/queue';
import { formatProbeLog, runProbes, spikeEnabled } from './probe';
import { devAutoSnapshot, devSelfTest } from './selftest';

export const SPIKE_INCLUDED = true;
export { spikeEnabled };

/** Both the env flag and the development environment are required. */
export const spikeAllowed = (environmentType?: string) =>
  spikeEnabled() && environmentType === 'DEVELOPMENT';

export async function runSpikeResolver(accountId: string) {
  const [asUser, asApp] = await Promise.all([
    runProbes({ kind: 'user' }),
    runProbes({ kind: 'app' }),
  ]);
  console.log(formatProbeLog('asUser', asUser));
  console.log(formatProbeLog('asApp', asApp));
  if (accountId) await push({ step: 'SPIKE', impersonateAccountId: accountId });
  return { asUser, asApp, impersonationQueued: Boolean(accountId) };
}

export async function spikeOnInstall(who?: string) {
  if (!spikeEnabled()) return;
  // app-user permissions are granted eventually-consistently after install; give it time.
  await push({ step: 'SPIKE' }, 120);
  if (who) await push({ step: 'SPIKE', impersonateAccountId: who }, 150);
}

export async function spikeOnTick() {
  if (!spikeEnabled()) return;
  await devAutoSnapshot();
  await push({ step: 'SPIKE' });
  await push({ step: 'SELFTEST' }, 30);
}

export async function spikeProbe(impersonateAccountId?: string) {
  if (!spikeEnabled()) return;
  const results = await runProbes(
    impersonateAccountId
      ? { kind: 'impersonate', accountId: impersonateAccountId }
      : { kind: 'app' },
  );
  console.log(
    formatProbeLog(impersonateAccountId ? 'asUser(accountId) offline' : 'asApp (async)', results),
  );
}

export async function spikeSelfTest() {
  if (!spikeEnabled()) return;
  await devSelfTest();
}
