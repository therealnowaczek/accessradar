import type { AuditEvent } from '../../src/db/audit';

const events: AuditEvent[] = [];
let nextId = 1;

export async function audit(
  actor: string,
  action: string,
  target: string | null,
  detail?: Record<string, unknown>,
) {
  events.push({ id: nextId++, at: Date.now(), actor, action, target, detail: detail ?? null });
}

export async function listAudit(limit = 200): Promise<AuditEvent[]> {
  return [...events].reverse().slice(0, limit);
}

audit('system', 'snapshot.started', '#1', { trigger: 'onboarding' });
audit('acc-admin', 'settings.saved', null, { frequency: 'daily', retentionDays: 365 });
