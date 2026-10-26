import type { ActivityEvent } from './api';
import { plural } from './format';

/** Readable names for audit-log actions (src/**: audit(actor, action, ...)). */
export const ACTIVITY_LABELS: Record<string, string> = {
  'snapshot.started': 'Started a snapshot',
  'snapshot.completed': 'Snapshot completed',
  'snapshot.failed': 'Snapshot failed',
  'review.created': 'Started a review',
  'review.decided': 'Recorded decisions',
  'review.signed': 'Signed a review',
  'review.deleted': 'Deleted a review',
  'review.verified': 'Verified a review',
  'review.verify_started': 'Started a snapshot integrity check',
  'review.chain_verified': 'Verified the signature chain',
  'exception.granted': 'Granted exceptions',
  'exception.superseded': 'Replaced exceptions',
  'exception.expired': 'Exceptions expired',
  'exception.revoked': 'Revoked exceptions',
  'exception.withdrawn': 'Withdrew exceptions',
  'remediation.created': 'Tracking revocations',
  'remediation.checked': 'Checked revocations',
  'remediation.accepted': 'Accepted a remediation risk',
  'alert.raised': 'Raised change alerts',
  'alert.dismissed': 'Dismissed alerts',
  'notice.dismissed': 'Dismissed a notice',
  'campaign.created': 'Created a campaign',
  'campaign.updated': 'Updated a campaign',
  'campaign.paused': 'Paused a campaign',
  'campaign.deleted': 'Deleted a campaign',
  'campaign.run_started': 'Campaign run started',
  'campaign.run_materialized': 'Campaign reviews created',
  'campaign.run_completed': 'Campaign run completed',
  'assignment.reassigned': 'Reassigned a space review',
  'assignment.submitted': 'Submitted a space review',
  'reminder.issued': 'Sent review reminders',
  'edition.override': 'Changed the plan override',
  'settings.saved': 'Saved settings',
  'rovo.action': 'Rovo agent answered',
  export: 'Exported',
};

/** "alert.raised" → "Raised change alerts"; unknown keys become "Foo bar" instead of raw keys. */
export function activityLabel(action: string): string {
  const known = ACTIVITY_LABELS[action];
  if (known) return known;
  const words = action.replace(/[._]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : action;
}

const SNAPSHOT_TARGET = /^#(\d+)$/;
const SNAPSHOT_RANGE = /^#(\d+)-#(\d+)$/;

/**
 * What the event refers to, readable: the review/campaign name when the server knows it,
 * "snapshot #10" for snapshot targets, otherwise a short id.
 */
export function activityTarget(
  e: Pick<ActivityEvent, 'action' | 'target' | 'targetLabel'>,
): string {
  if (e.targetLabel) return `“${e.targetLabel}”`;
  const t = e.target;
  if (!t || t === 'edition') return '';
  let m = SNAPSHOT_TARGET.exec(t);
  if (m) return e.action.startsWith('snapshot.') ? `#${m[1]}` : `snapshot #${m[1]}`;
  m = SNAPSHOT_RANGE.exec(t);
  if (m) return `snapshots #${m[1]} → #${m[2]}`;
  const kind = e.action.startsWith('campaign.run_')
    ? 'campaign run'
    : e.action.startsWith('campaign.')
      ? 'campaign'
      : e.action.startsWith('review.') ||
          e.action.startsWith('exception.') ||
          e.action.startsWith('remediation.') ||
          e.action.startsWith('assignment.')
        ? 'review'
        : '';
  const short = t.length > 20 ? `${t.slice(0, 8)}…` : t;
  return kind ? `${kind} ${short}` : short;
}

const EXPORT_KIND: Record<string, string> = {
  'review-csv': 'Review CSV',
  'review-pdf': 'Review PDF',
  'evidence-pack': 'Evidence pack PDF',
  'changes-csv': 'Changes CSV',
  'changes-pdf': 'Changes PDF',
};

/** Short, readable detail column. */
export function activityDetail(e: Pick<ActivityEvent, 'action' | 'detail'>): string {
  const d = e.detail ?? {};
  const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
  switch (e.action) {
    case 'review.decided':
      return `${plural(n(d.count), 'item')} → ${d.decision ?? 'undecided'}`;
    case 'review.signed': {
      const hash = String(d.evidenceHash ?? d.hash ?? '');
      return hash ? `Evidence hash ${hash.slice(0, 16)}…` : '';
    }
    case 'export':
      return EXPORT_KIND[String(d.kind ?? '')] ?? String(d.kind ?? '');
    case 'review.created':
      return `${plural(n(d.items), 'item')}, scope ${d.scope ?? ''}`;
    case 'settings.saved':
      return `Schedule ${d.frequency ?? ''}, retention ${d.retentionDays ?? ''} days`;
    case 'snapshot.started':
      return String(d.trigger ?? '');
    case 'snapshot.completed':
      return String(d.status ?? '');
    case 'snapshot.failed':
      return String(d.message ?? d.step ?? '');
    case 'alert.raised':
      return plural(n(d.total), 'alert');
    case 'alert.dismissed':
    case 'exception.granted':
    case 'exception.superseded':
    case 'exception.expired':
    case 'exception.revoked':
    case 'exception.withdrawn':
    case 'remediation.created':
    case 'reminder.issued':
      return d.count !== undefined ? String(d.count) : '';
    case 'remediation.checked':
      return `${n(d.verified)} verified, ${n(d.stillPresent)} still present, ${n(d.inconclusive)} inconclusive`;
    case 'review.verified':
      return [d.mode, d.result ?? (d.ok === true ? 'ok' : d.ok === false ? 'mismatch' : '')]
        .filter(Boolean)
        .join(' · ');
    default:
      return '';
  }
}
