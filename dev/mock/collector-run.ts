import { activeSnapshot, simulateSnapshot } from './db-snapshots';

export async function hourUsage() {
  return { points: 1240, calls: 318 };
}

export async function startSnapshot(trigger: 'manual' | 'scheduled' | 'onboarding') {
  const active = await activeSnapshot();
  if (active) return { seq: active.seq, created: false };
  return { seq: simulateSnapshot(trigger), created: true };
}
