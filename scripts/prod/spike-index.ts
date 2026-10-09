/* eslint-disable @typescript-eslint/no-unused-vars -- stub keeps the dev signatures */
/**
 * Production replacement for src/spike/index.ts (copied by scripts/strip-spike.sh).
 * Same exports, no probe/self-test code: the spike never ships to production.
 */
export const SPIKE_INCLUDED = false;
export const spikeEnabled = () => false;
export const spikeAllowed = (_environmentType?: string) => false;

export async function runSpikeResolver(_accountId: string): Promise<never> {
  throw new Error('Spike is not part of this build');
}
export async function spikeOnInstall(_who?: string) {}
export async function spikeOnTick() {}
export async function spikeProbe(_impersonateAccountId?: string) {}
export async function spikeSelfTest() {}
