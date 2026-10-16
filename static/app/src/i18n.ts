/**
 * UI copy catalog. AccessRadar ships one locale today (English); every user-facing string of the
 * Advanced plan pattern lives here under a stable key so a locale can be added without touching
 * components. A new locale is a catalog typed `Record<MessageKey, string>`, so the compiler
 * enforces key parity.
 *
 * "Advanced" is a product name and is never translated.
 */
const en = {
  'planGate.badge': 'Advanced',
  'planGate.advancedHint': 'Ask your Jira admin to enable Advanced.',
  'planGate.sample': 'Sample data',
  // One benefit sentence per locked feature: what the user gains, never the restriction.
  'planGate.schedules': 'Take snapshots every day or on a custom schedule to catch changes sooner.',
  'planGate.history': 'Keep snapshot history beyond 90 days for longer audit trails.',
  'planGate.alerts':
    'Get an in-app alert when a new admin, public grant or inactive account with access appears.',
  'planGate.campaigns':
    'Schedule recurring access reviews and delegate them to space owners with reminders.',
  'planGate.remediation':
    'See whether each revoked access really disappeared in the next snapshot.',
  'planGate.projectReview':
    'Let space owners review access to their own space, with in-app reminders.',
  'schedule.freeTier': 'Free plan: every two weeks; manual snapshots any time',
  // Sample data shown (faded, aria-hidden) above the note of a locked panel.
  'planGate.sample.subject1': 'Sample user A',
  'planGate.sample.subject2': 'Sample user B',
  'planGate.sample.subject3': 'Sample group C',
  'planGate.sample.closedOf': '{closed} of {total} closed',
  'planGate.sample.verified': 'Verified',
  'planGate.sample.pending': 'Pending',
  'planGate.sample.stillPresent': 'Still present',
  'planGate.sample.colSubject': 'Subject',
  'planGate.sample.colStatus': 'Status',
  'planGate.sample.colSnapshot': 'Checked in snapshot',
} as const;

export type MessageKey = keyof typeof en;

const catalog: Record<MessageKey, string> = en;

/** Looks up a message; `{name}` placeholders are replaced from `vars`. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const text = catalog[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
