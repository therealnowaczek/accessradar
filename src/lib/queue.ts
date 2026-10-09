import { Queue } from '@forge/events';

export const COLLECT_QUEUE = 'accessradar-collect';

export type CollectStep = 'MIGRATE' | 'PLAN' | 'SCHEMES' | 'ROLES' | 'GROUPS' | 'FINALIZE' | 'SPIKE';

export interface CollectEvent extends Record<string, unknown> {
  step: CollectStep;
  snapshotId?: string;
  batch?: number;
  /** SPIKE only: accountId to impersonate (never logged). */
  impersonateAccountId?: string;
}

export const collectQueue = new Queue<CollectEvent>({ key: COLLECT_QUEUE });

/** One concurrent collector invocation per installation (concurrency key is per-install). */
export const PER_INSTALL_CONCURRENCY = { key: 'collect', limit: 1 };

export function push(body: CollectEvent, delayInSeconds?: number) {
  return collectQueue.push({ body, delayInSeconds, concurrency: PER_INSTALL_CONCURRENCY });
}
