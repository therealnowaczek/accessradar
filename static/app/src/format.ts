/** Formatting helpers shared by views and exports (pure, tested). */
import { t } from './i18n';

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

/** Fallback for a missing or invalid Jira locale: US English (owner decision 2026-11-11, R-6.1). */
export const FALLBACK_FORMAT_LOCALE = 'en-US';
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
 * Local date-time in the viewer's zone and Jira locale, e.g. "Oct 9, 2026, 06:30 PM" (en-US) or
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

/** Local calendar date in the viewer's zone and Jira locale, e.g. "Oct 9, 2026" (en-US). */
export function formatLocalDate(ms: number | null | undefined, tz = timeZone()): string {
  if (!ms) return '—';
  return new Intl.DateTimeFormat(getFormatLocale(), {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ms));
}

/** Local wall-clock time in the viewer's zone and Jira locale, e.g. "06:30 PM" (en-US) or "18:30" (en-GB). */
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
  if (s < 60) return t('format.justNow');
  if (s < 3600) return t('format.minutesAgo', { n: Math.floor(s / 60) });
  if (s < 86400) return t('format.hoursAgo', { n: Math.floor(s / 3600) });
  return t('format.daysAgo', { n: Math.floor(s / 86400) });
}

export function duration(from: number, to: number | null | undefined): string {
  if (!to) return '—';
  const s = Math.max(0, Math.round((to - from) / 1000));
  return s < 60
    ? t('format.seconds', { s })
    : t('format.minutesSeconds', { m: Math.floor(s / 60), s: s % 60 });
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

/** Weekday names, Monday first. Entries resolve through the catalog when read (not at import). */
export const WEEKDAYS: string[] = localizedWeekdays();

function localizedWeekdays(): string[] {
  const keys = [
    'format.monday',
    'format.tuesday',
    'format.wednesday',
    'format.thursday',
    'format.friday',
    'format.saturday',
    'format.sunday',
  ] as const;
  const days: string[] = [];
  keys.forEach((key, i) => Object.defineProperty(days, i, { get: () => t(key), enumerable: true }));
  return days;
}

const PERMISSION_TOKEN = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b(?:ADMINISTER|SYSTEM_ADMIN)\b/g;

/**
 * Replaces raw Jira permission keys inside free text (alert titles and bodies stored by the
 * backend, e.g. "Gained ADMINISTER_PROJECTS") with their labels ("Gained Administer projects").
 * Only keys known to PERMISSION_LABELS are replaced; other upper-case words are left alone.
 */
export function humanizePermissionKeys(text: string): string {
  return text.replace(PERMISSION_TOKEN, (key) => PERMISSION_LABELS[key] ?? key);
}

function validDate(y: number, m: number, d: number): Date | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1000 || y > 9999 || m < 0 || m > 11 || d < 1) return null;
  const date = new Date(y, m, d);
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d ? date : null;
}

export type DateOrder = 'DMY' | 'MDY' | 'YMD';

/** Order of day, month and year in the locale's numeric date: en-US MDY, en-GB/pl/de DMY, ja YMD. */
export function dateOrder(locale = getFormatLocale()): DateOrder {
  const order = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(Date.UTC(2026, 9, 27))
    .filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year')
    .map((p) => p.type[0].toUpperCase())
    .join('');
  return order === 'MDY' || order === 'YMD' ? order : 'DMY';
}

/** Lower case, no accents, no dots: "Paź." -> "paz", "Okt." -> "okt". */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .toLowerCase()
    .trim();

const monthCache = new Map<string, Map<string, number>>();

/** Month names (long and short, standalone and in a date) of the locale, then English. */
function monthNames(locale: string): Map<string, number> {
  const hit = monthCache.get(locale);
  if (hit) return hit;
  const out = new Map<string, number>();
  for (const loc of [locale, 'en-US'])
    for (let m = 0; m < 12; m++) {
      const at = Date.UTC(2026, m, 15);
      for (const month of ['long', 'short'] as const) {
        const alone = new Intl.DateTimeFormat(loc, { timeZone: 'UTC', month }).format(at);
        const inDate = new Intl.DateTimeFormat(loc, { timeZone: 'UTC', month, day: 'numeric' })
          .formatToParts(at)
          .find((p) => p.type === 'month')?.value;
        for (const name of [alone, inDate]) {
          const key = name ? fold(name) : '';
          if (key && !/\d/.test(key) && !out.has(key)) out.set(key, m);
        }
      }
    }
  monthCache.set(locale, out);
  return out;
}

/**
 * Parses what a user types into a date field, in the user's Jira locale (R-6.1, owner decision
 * 2026-11-11): numeric dates follow the locale's order ("12/1/2026" is December 1 in en-US and
 * 12 January in en-GB or pl-PL), month names come from the locale or English ("Oct 27, 2026",
 * "27 paź 2026"), and ISO "2026-10-27" (or any year-first form) is always accepted.
 * Returns null for anything else, including impossible dates such as 31 February.
 */
export function parseDateInput(text: string, locale = getFormatLocale()): Date | null {
  const s = text
    .replace(/[\u200e\u200f\u061c]/g, '')
    .trim()
    .replace(/\s*[年년]\s*/g, '-')
    .replace(/\s*[月월]\s*/g, '-')
    .replace(/\s*[日일]\s*$/, '');
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return validDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{1,4})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{1,4})\.?$/.exec(s);
  if (m) {
    const [a, b, c] = [m[1], m[2], m[3]];
    if (a.length === 4) return validDate(Number(a), Number(b) - 1, Number(c));
    if (c.length !== 4 || a.length > 2) return null;
    const order = dateOrder(locale);
    if (order === 'MDY') return validDate(Number(c), Number(a) - 1, Number(b));
    if (order === 'DMY') return validDate(Number(c), Number(b) - 1, Number(a));
    return null;
  }
  // Month written as a word: one month name, a day and a four-digit year, in any order.
  const names = monthNames(locale);
  let month = -1;
  const numbers: string[] = [];
  for (const token of s.split(/[\s,./-]+/).filter(Boolean)) {
    if (/^\d+$/.test(token)) {
      numbers.push(token);
      continue;
    }
    const found = names.get(fold(token));
    if (found !== undefined && month < 0) month = found;
    // Short connector words of written dates ("de" in pt/es, "г." in ru) are ignored.
    else if (found !== undefined || fold(token).length > 2) return null;
  }
  if (month < 0 || numbers.length !== 2) return null;
  const yearAt = numbers.findIndex((n) => n.length === 4);
  const day = numbers[1 - yearAt];
  if (yearAt < 0 || day.length > 2) return null;
  return validDate(Number(numbers[yearAt]), month, Number(day));
}

/** Example dates for the date field helper, in the user's locale: "10/27/2026" and "Oct 27, 2026". */
export function dateExamples(locale = getFormatLocale()): { numeric: string; written: string } {
  const at = Date.UTC(2026, 9, 27);
  return {
    numeric: new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      numberingSystem: 'latn',
    })
      .format(at)
      .replace(/[\u200e\u200f\u061c]/g, ''),
    written: formatIsoDate('2026-10-27', locale),
  };
}

/** ISO date (YYYY-MM-DD) in the Jira locale: "Oct 27, 2026" (en-US). A calendar day, no zone shift. */
export function formatIsoDate(iso: string | null | undefined, locale = getFormatLocale()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '—';
  const date = validDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/**
 * Helper text for every DateField (the format hint lives here, not in a placeholder). The
 * examples follow the user's Jira locale: "10/27/2026 or Oct 27, 2026" in en-US.
 */
export function dateHelper(locale = getFormatLocale()): string {
  const ex = dateExamples(locale);
  return `Type a date such as ${ex.numeric} or ${ex.written}, or pick one from the calendar.`;
}

/** Field error under a DateField when the typed text is not a date in the user's locale. */
export function dateError(locale = getFormatLocale()): string {
  return `Enter a valid date, for example ${dateExamples(locale).numeric}.`;
}

/**
 * True when the text typed into a date input is not a date in the locale (empty text is fine:
 * the field may be optional, and the ADS picker keeps the last valid value).
 */
export function isInvalidDateText(text: string, locale = getFormatLocale()): boolean {
  return text.trim() !== '' && parseDateInput(text, locale) === null;
}
