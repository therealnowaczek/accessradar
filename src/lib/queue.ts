import { Queue } from '@forge/events';

export const COLLECT_QUEUE = 'accessradar-collect';

export type CollectStep =
  | 'MIGRATE'
  | 'PLAN'
  | 'PROJECTS'
  | 'DIRECTORY'
  | 'GROUPS'
  | 'FINALIZE'
  | 'PRIVACY'
  | 'SPIKE'
  | 'SELFTEST'
  | 'VERIFY_SNAPSHOT'
  | 'REMEDIATION'
  | 'ALERTS';

export interface CollectEvent extends Record<string, unknown> {
  step: CollectStep;
  snapshotSeq?: number;
  batch?: number;
  /** SPIKE only: accountId to impersonate (never logged). */
  impersonateAccountId?: string;
  /** VERIFY_SNAPSHOT */
  jobId?: string;
  /** REMEDIATION */
  seq?: number;
}

export const collectQueue = new Queue<CollectEvent>({ key: COLLECT_QUEUE });

/** One concurrent collector invocation per installation (concurrency key is per-install). */
export const PER_INSTALL_CONCURRENCY = { key: 'collect', limit: 1 };

export function push(body: CollectEvent, delayInSeconds?: number) {
  return collectQueue.push({
    body,
    ...(delayInSeconds
      ? { delayInSeconds: Math.min(900, Math.max(0, Math.round(delayInSeconds))) }
      : {}),
    concurrency: PER_INSTALL_CONCURRENCY,
  });
}
