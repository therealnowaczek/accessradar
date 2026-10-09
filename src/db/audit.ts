import { exec, limitClause, q } from './sql';

export interface AuditEvent {
  id: number;
  at: number;
  actor: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
}

/** In-app activity log (review created, decisions, sign-off, exports, settings, snapshots). */
export async function audit(
  actor: string,
  action: string,
  target: string | null,
  detail?: Record<string, unknown>,
) {
  await exec(
    'INSERT INTO audit_event (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)',
    Date.now(),
    actor.slice(0, 128),
    action.slice(0, 48),
    target ? target.slice(0, 128) : null,
    detail ? JSON.stringify(detail).slice(0, 4000) : null,
  );
}

export async function listAudit(limit = 200): Promise<AuditEvent[]> {
  const rows = await q<any>(
    `SELECT id, at, actor, action, target, detail FROM audit_event ORDER BY id DESC ${limitClause(limit)}`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    at: Number(r.at),
    actor: r.actor,
    action: r.action,
    target: r.target ?? null,
    detail: r.detail ? JSON.parse(r.detail) : null,
  }));
}
