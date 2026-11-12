import type { ActivityEvent } from './api';
import { t } from './i18n';

/** Readable names for audit-log actions (src/**: audit(actor, action, ...)). */
export const ACTIVITY_LABELS: Record<string, string> = {
  get 'snapshot.started'() {
    return t('activity.labelSnapshotStarted');
  },
  get 'snapshot.completed'() {
    return t('activity.labelSnapshotCompleted');
  },
  get 'snapshot.failed'() {
    return t('activity.labelSnapshotFailed');
  },
  get 'review.created'() {
    return t('activity.labelReviewCreated');
  },
  get 'review.decided'() {
    return t('activity.labelReviewDecided');
  },
  get 'review.signed'() {
    return t('activity.labelReviewSigned');
  },
  get 'review.deleted'() {
    return t('activity.labelReviewDeleted');
  },
  get 'review.verified'() {
    return t('activity.labelReviewVerified');
  },
  get 'review.verify_started'() {
    return t('activity.labelReviewVerifyStarted');
  },
  get 'review.chain_verified'() {
    return t('activity.labelReviewChainVerified');
  },
  get 'exception.granted'() {
    return t('activity.labelExceptionGranted');
  },
  get 'exception.superseded'() {
    return t('activity.labelExceptionSuperseded');
  },
  get 'exception.expired'() {
    return t('activity.labelExceptionExpired');
  },
  get 'exception.revoked'() {
    return t('activity.labelExceptionRevoked');
  },
  get 'exception.withdrawn'() {
    return t('activity.labelExceptionWithdrawn');
  },
  get 'remediation.created'() {
    return t('activity.labelRemediationCreated');
  },
  get 'remediation.checked'() {
    return t('activity.labelRemediationChecked');
  },
  get 'remediation.accepted'() {
    return t('activity.labelRemediationAccepted');
  },
  get 'alert.raised'() {
    return t('activity.labelAlertRaised');
  },
  get 'alert.dismissed'() {
    return t('activity.labelAlertDismissed');
  },
  get 'notice.dismissed'() {
    return t('activity.labelNoticeDismissed');
  },
  get 'campaign.created'() {
    return t('activity.labelCampaignCreated');
  },
  get 'campaign.updated'() {
    return t('activity.labelCampaignUpdated');
  },
  get 'campaign.paused'() {
    return t('activity.labelCampaignPaused');
  },
  get 'campaign.deleted'() {
    return t('activity.labelCampaignDeleted');
  },
  get 'campaign.run_started'() {
    return t('activity.labelCampaignRunStarted');
  },
  get 'campaign.run_materialized'() {
    return t('activity.labelCampaignRunMaterialized');
  },
  get 'campaign.run_completed'() {
    return t('activity.labelCampaignRunCompleted');
  },
  get 'assignment.reassigned'() {
    return t('activity.labelAssignmentReassigned');
  },
  get 'assignment.submitted'() {
    return t('activity.labelAssignmentSubmitted');
  },
  get 'reminder.issued'() {
    return t('activity.labelReminderIssued');
  },
  get 'edition.override'() {
    return t('activity.labelEditionOverride');
  },
  get 'settings.saved'() {
    return t('activity.labelSettingsSaved');
  },
  get 'rovo.action'() {
    return t('activity.labelRovoAction');
  },
  get export() {
    return t('activity.labelExport');
  },
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
  const target = e.target;
  if (!target || target === 'edition') return '';
  let m = SNAPSHOT_TARGET.exec(target);
  if (m)
    return e.action.startsWith('snapshot.')
      ? `#${m[1]}`
      : t('activity.targetSnapshot', { seq: m[1]! });
  m = SNAPSHOT_RANGE.exec(target);
  if (m) return t('activity.targetSnapshotRange', { from: m[1]!, to: m[2]! });
  const kind = e.action.startsWith('campaign.run_')
    ? t('activity.kindCampaignRun')
    : e.action.startsWith('campaign.')
      ? t('activity.kindCampaign')
      : e.action.startsWith('review.') ||
          e.action.startsWith('exception.') ||
          e.action.startsWith('remediation.') ||
          e.action.startsWith('assignment.')
        ? t('activity.kindReview')
        : '';
  const short = target.length > 20 ? `${target.slice(0, 8)}…` : target;
  return kind ? t('activity.targetKind', { kind, id: short }) : short;
}

const exportKind = (kind: string): string | undefined => {
  switch (kind) {
    case 'review-csv':
      return t('activity.exportReviewCsv');
    case 'review-pdf':
      return t('activity.exportReviewPdf');
    case 'evidence-pack':
      return t('activity.exportEvidencePack');
    case 'changes-csv':
      return t('activity.exportChangesCsv');
    case 'changes-pdf':
      return t('activity.exportChangesPdf');
    default:
      return undefined;
  }
};

/** Short, readable detail column. */
export function activityDetail(e: Pick<ActivityEvent, 'action' | 'detail'>): string {
  const d = e.detail ?? {};
  const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
  switch (e.action) {
    case 'review.decided':
      return t('activity.detailDecided', {
        count: n(d.count),
        decision: String(d.decision ?? t('activity.undecided')),
      });
    case 'review.signed': {
      const hash = String(d.evidenceHash ?? d.hash ?? '');
      return hash ? t('activity.detailEvidenceHash', { hash: hash.slice(0, 16) }) : '';
    }
    case 'export':
      return exportKind(String(d.kind ?? '')) ?? String(d.kind ?? '');
    case 'review.created':
      return t('activity.detailReviewCreated', { items: n(d.items), scope: String(d.scope ?? '') });
    case 'settings.saved':
      return t('activity.detailSettingsSaved', {
        frequency: String(d.frequency ?? ''),
        days: String(d.retentionDays ?? ''),
      });
    case 'snapshot.started':
      return String(d.trigger ?? '');
    case 'snapshot.completed':
      return String(d.status ?? '');
    case 'snapshot.failed':
      return String(d.message ?? d.step ?? '');
    case 'alert.raised':
      return t('activity.detailAlerts', { total: n(d.total) });
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
      return t('activity.detailRemediationChecked', {
        verified: n(d.verified),
        stillPresent: n(d.stillPresent),
        inconclusive: n(d.inconclusive),
      });
    case 'review.verified':
      return [
        d.mode,
        d.result ??
          (d.ok === true
            ? t('activity.resultOk')
            : d.ok === false
              ? t('activity.resultMismatch')
              : ''),
      ]
        .filter(Boolean)
        .join(' · ');
    default:
      return '';
  }
}
