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

let contextTimeZone: string | null = null;

/** English fallback for a missing or invalid Jira locale (the app's historic date format). */
export const FALLBACK_FORMAT_LOCALE = 'en-GB';
let formatLocale = FALLBACK_FORMAT_LOCALE;

/**
 * Canonical BCP 47 tag from the Jira user locale (`context.locale`, e.g. "pl_PL" -> "pl-PL").
 * Missing or invalid values fall back to English.
 */
export function resolveFormatLocale(raw: string | null | undefined): string {
  if (!raw) return FALLBACK_FORMAT_LOCALE;
  try {
    const tag = Intl.getCanonicalLocales(raw.replace(/_/g, '-'))[0];
    return tag && Intl.DateTimeFormat.supportedLocalesOf(tag).length ? tag : FALLBACK_FORMAT_LOCALE;
  } catch {
    return FALLBACK_FORMAT_LOCALE;
  }
}

/**
 * The one place that sets the locale of displayed dates (layout standard R-6.1): called once
 * with `context.locale` when the Forge context arrives. Exports keep their fixed ISO formats.
 */
export function setFormatLocale(raw: string | null | undefined): void {
  formatLocale = resolveFormatLocale(raw);
}

export function getFormatLocale(): string {
  return formatLocale;
}

/** Valid IANA zone, or null (Intl throws a RangeError on unknown zones). */
function validZone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/**
 * Uses the time zone from the user's Jira profile (Forge `context.timezone`) for every displayed
 * date, instead of the browser zone. Called once when the Forge context arrives.
 */
export function setContextTimeZone(tz: string | null | undefined): void {
  contextTimeZone = validZone(tz);
}

/** The viewer's zone: Jira profile setting first, then the browser, then UTC. */
export function timeZone(): string {
  if (contextTimeZone) return contextTimeZone;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Local date-time in the viewer's zone and Jira locale, e.g. "9 Oct 2026, 18:30" (en-GB) or
 * "9 paź 2026, 18:30" (pl-PL).
 */
export function formatLocal(ms: number | null | undefined, tz = timeZone()): string {
  if (!ms) return '—';
  return new Intl.DateTimeFormat(getFormatLocale(), {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

/** Local calendar date in the viewer's zone and Jira locale, e.g. "9 Oct 2026" (en-GB). */
export function formatLocalDate(ms: number | null | undefined, tz = timeZone()): string {
  if (!ms) return '—';
  return new Intl.DateTimeFormat(getFormatLocale(), {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms));
}

/** Local wall-clock time in the viewer's zone and Jira locale, e.g. "18:30" (en-GB). */
export function formatLocalTime(ms: number, tz = timeZone()): string {
  return new Intl.DateTimeFormat(getFormatLocale(), {
    timeZone: tz,
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

/**
 * DatePicker input format (date-fns tokens via ADS): "27 Oct 2026". The typed format stays fixed
 * because parseDateInput (and DATE_HELPER) are day-first English; displayed dates follow the Jira
 * locale through formatLocal / formatIsoDate.
 */
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

/** ISO date (YYYY-MM-DD) in the Jira locale: "27 Oct 2026" (en-GB). A calendar day, no zone shift. */
export function formatIsoDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '—';
  const date = validDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!date) return '—';
  return new Intl.DateTimeFormat(getFormatLocale(), {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}
