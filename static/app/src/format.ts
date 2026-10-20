/** Formatting helpers shared by views and exports (pure, tested). */

export const PERMISSION_LABELS: Record<string, string> = {
  BROWSE_PROJECTS: 'Browse projects',
  CREATE_ISSUES: 'Create issues',
  EDIT_ISSUES: 'Edit issues',
  DELETE_ISSUES: 'Delete issues',
  ADMINISTER_PROJECTS: 'Administer projects',
  ASSIGN_ISSUES: 'Assign issues',
  ASSIGNABLE_USER: 'Assignable user',
  CLOSE_ISSUES: 'Close issues',
  RESOLVE_ISSUES: 'Resolve issues',
  TRANSITION_ISSUES: 'Transition issues',
  MOVE_ISSUES: 'Move issues',
  LINK_ISSUES: 'Link issues',
  SCHEDULE_ISSUES: 'Schedule issues',
  MODIFY_REPORTER: 'Modify reporter',
  SET_ISSUE_SECURITY: 'Set issue security',
  MANAGE_WATCHERS: 'Manage watchers',
  VIEW_VOTERS_AND_WATCHERS: 'View voters and watchers',
  ADD_COMMENTS: 'Add comments',
  EDIT_ALL_COMMENTS: 'Edit all comments',
  EDIT_OWN_COMMENTS: 'Edit own comments',
  DELETE_ALL_COMMENTS: 'Delete all comments',
  DELETE_OWN_COMMENTS: 'Delete own comments',
  CREATE_ATTACHMENTS: 'Create attachments',
  DELETE_ALL_ATTACHMENTS: 'Delete all attachments',
  DELETE_OWN_ATTACHMENTS: 'Delete own attachments',
  WORK_ON_ISSUES: 'Work on issues',
  EDIT_OWN_WORKLOGS: 'Edit own worklogs',
  EDIT_ALL_WORKLOGS: 'Edit all worklogs',
  DELETE_OWN_WORKLOGS: 'Delete own worklogs',
  DELETE_ALL_WORKLOGS: 'Delete all worklogs',
  VIEW_DEV_TOOLS: 'View development tools',
  VIEW_READONLY_WORKFLOW: 'View read-only workflow',
  MANAGE_SPRINTS_PERMISSION: 'Manage sprints',
  SERVICEDESK_AGENT: 'Service project agent',
  VIEW_AGGREGATED_DATA: 'View aggregated data',
  ARCHIVE_ISSUES: 'Archive issues',
  UNARCHIVE_ISSUES: 'Unarchive issues',
  EDIT_ISSUE_LAYOUT: 'Edit issue layout',
  EDIT_WORKFLOW: 'Edit workflows',
  GLOBAL_ADMIN: 'Jira administrator',
  ADMINISTER: 'Administer Jira',
  SYSTEM_ADMIN: 'System administrator',
  USER_PICKER: 'Browse users and groups',
  CREATE_PROJECT: 'Create team-managed projects',
  CREATE_SHARED_OBJECTS: 'Share dashboards and filters',
  MANAGE_GROUP_FILTER_SUBSCRIPTIONS: 'Manage group filter subscriptions',
  BULK_CHANGE: 'Make bulk changes',
};

export const SELECTABLE_PERMISSIONS = Object.keys(PERMISSION_LABELS).filter(
  (k) =>
    ![
      'GLOBAL_ADMIN',
      'ADMINISTER',
      'SYSTEM_ADMIN',
      'USER_PICKER',
      'CREATE_PROJECT',
      'CREATE_SHARED_OBJECTS',
      'MANAGE_GROUP_FILTER_SUBSCRIPTIONS',
      'BULK_CHANGE',
    ].includes(k),
);

export function permissionLabel(key: string): string {
  return (
    PERMISSION_LABELS[key] ??
    key
      .toLowerCase()
      .split('_')
      .map((w, i) => (i === 0 ? w[0]?.toUpperCase() + w.slice(1) : w))
      .join(' ')
  );
}

export function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Local date-time in the viewer's zone, e.g. "9 Oct 2026, 18:30". */
export function formatLocal(ms: number | null | undefined, tz = timeZone()): string {
  if (!ms) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

/** ISO-like UTC timestamp for evidence: "2026-10-09 16:30:05 UTC". */
export function formatUtc(ms: number | null | undefined): string {
  if (!ms) return '';
  return `${new Date(ms).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

/** Local time with offset for exports: "2026-10-09 18:30:05 (Europe/Warsaw)". */
export function formatLocalExport(ms: number | null | undefined, tz = timeZone()): string {
  if (!ms) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')} (${tz})`;
}

export function relative(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return '—';
  const s = Math.round((now - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function duration(from: number, to: number | null | undefined): string {
  if (!to) return '—';
  const s = Math.max(0, Math.round((to - from) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'export'
  );
}

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const PERMISSION_TOKEN = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b(?:ADMINISTER|SYSTEM_ADMIN)\b/g;

/**
 * Replaces raw Jira permission keys inside free text (alert titles and bodies stored by the
 * backend, e.g. "Gained ADMINISTER_PROJECTS") with their labels ("Gained Administer projects").
 * Only keys known to PERMISSION_LABELS are replaced; other upper-case words are left alone.
 */
export function humanizePermissionKeys(text: string): string {
  return text.replace(PERMISSION_TOKEN, (key) => PERMISSION_LABELS[key] ?? key);
}

/** DatePicker display format (date-fns tokens via ADS): "27 Oct 2026", same as formatLocal. */
export const DATE_PICKER_FORMAT = 'D MMM YYYY';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function validDate(y: number, m: number, d: number): Date | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1000 || y > 9999 || m < 0 || m > 11 || d < 1) return null;
  const date = new Date(y, m, d);
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d ? date : null;
}

/**
 * Parses what a user types into a date field: "27 Oct 2026", "27 October 2026", "27/10/2026",
 * "27.10.2026" (day first, as in the app's format) or ISO "2026-10-27". Returns null otherwise.
 */
export function parseDateInput(text: string): Date | null {
  const s = text.trim().toLowerCase();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return validDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return validDate(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = /^(\d{1,2})\s+([a-z]{3,})\.?,?\s+(\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3));
    return month < 0 ? null : validDate(Number(m[3]), month, Number(m[1]));
  }
  return null;
}

/** ISO date (YYYY-MM-DD) in the app's format: "27 Oct 2026". */
export function formatIsoDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '—';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return '—';
  return `${Number(m[3])} ${month[0].toUpperCase()}${month.slice(1)} ${m[1]}`;
}
