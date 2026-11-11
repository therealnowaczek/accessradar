import { afterEach, describe, expect, it } from 'vitest';
import {
  FALLBACK_FORMAT_LOCALE,
  dateError,
  dateExamples,
  dateHelper,
  dateOrder,
  isInvalidDateText,
  formatIsoDate,
  formatLocal,
  formatLocalExport,
  formatUtc,
  getFormatLocale,
  humanizePermissionKeys,
  parseDateInput,
  permissionLabel,
  resolveFormatLocale,
  setFormatLocale,
} from './format';

describe('permission labels', () => {
  it('reuses the label map for alert text', () => {
    expect(humanizePermissionKeys('Gained ADMINISTER_PROJECTS')).toBe('Gained Administer projects');
    expect(humanizePermissionKeys('Permission BROWSE_PROJECTS via scheme on space PAY')).toBe(
      'Permission Browse projects via scheme on space PAY',
    );
    expect(humanizePermissionKeys('Anyone grant: SYSTEM_ADMIN')).toBe(
      'Anyone grant: System administrator',
    );
  });

  it('leaves unknown upper-case words and space keys alone', () => {
    expect(humanizePermissionKeys('New space admin: Ann on PAY_OPS')).toBe(
      'New space admin: Ann on PAY_OPS',
    );
  });

  it('falls back to a readable label for unknown keys', () => {
    expect(permissionLabel('SOME_NEW_PERMISSION')).toBe('Some new permission');
  });
});

describe('date input follows the Jira locale (owner decision 2026-11-11)', () => {
  const iso = (d: Date | null) =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : null;
  afterEach(() => setFormatLocale(undefined));

  it('knows the numeric order of each locale', () => {
    expect(dateOrder('en-US')).toBe('MDY');
    expect(dateOrder('en-GB')).toBe('DMY');
    expect(dateOrder('pl-PL')).toBe('DMY');
    expect(dateOrder('de-DE')).toBe('DMY');
    expect(dateOrder('ja-JP')).toBe('YMD');
  });

  it('en-US (month first): 12/1/2026 is December 1', () => {
    expect(iso(parseDateInput('12/1/2026', 'en-US'))).toBe('2026-12-01');
    expect(iso(parseDateInput('10/27/2026', 'en-US'))).toBe('2026-10-27');
    expect(iso(parseDateInput('Oct 27, 2026', 'en-US'))).toBe('2026-10-27');
    expect(iso(parseDateInput('October 27 2026', 'en-US'))).toBe('2026-10-27');
    expect(parseDateInput('27/10/2026', 'en-US')).toBeNull();
  });

  it('day-first locales: 12/1/2026 is 12 January', () => {
    for (const locale of ['en-GB', 'pl-PL', 'de-DE', 'fr-FR']) {
      expect(iso(parseDateInput('12/1/2026', locale))).toBe('2026-01-12');
      expect(iso(parseDateInput('27.10.2026', locale))).toBe('2026-10-27');
      expect(parseDateInput('10/27/2026', locale)).toBeNull();
    }
    expect(iso(parseDateInput('27 Oct 2026', 'en-GB'))).toBe('2026-10-27');
    expect(iso(parseDateInput('27 paź 2026', 'pl-PL'))).toBe('2026-10-27');
    expect(iso(parseDateInput('27 października 2026', 'pl-PL'))).toBe('2026-10-27');
    expect(iso(parseDateInput('27. Okt. 2026', 'de-DE'))).toBe('2026-10-27');
  });

  it('accepts ISO (and other year-first forms) in every locale', () => {
    for (const locale of ['en-US', 'en-GB', 'pl-PL', 'ja-JP']) {
      expect(iso(parseDateInput('2026-10-27', locale))).toBe('2026-10-27');
      expect(iso(parseDateInput('2026-12-01', locale))).toBe('2026-12-01');
    }
    expect(iso(parseDateInput('2026/10/27', 'ja-JP'))).toBe('2026-10-27');
    expect(iso(parseDateInput('2026年10月27日', 'ja-JP'))).toBe('2026-10-27');
  });

  it('uses the current Jira locale by default, en-US when it is missing', () => {
    expect(iso(parseDateInput('12/1/2026'))).toBe('2026-12-01');
    setFormatLocale('en_GB');
    expect(iso(parseDateInput('12/1/2026'))).toBe('2026-01-12');
    setFormatLocale('not a locale!');
    expect(iso(parseDateInput('12/1/2026'))).toBe('2026-12-01');
  });

  it('reads back every displayed date in its own locale', () => {
    for (const locale of ['en-US', 'en-GB', 'pl-PL', 'de-DE', 'fr-FR', 'pt-BR', 'ja-JP']) {
      expect(iso(parseDateInput(formatIsoDate('2026-10-27', locale), locale))).toBe('2026-10-27');
      expect(iso(parseDateInput(dateExamples(locale).numeric, locale))).toBe('2026-10-27');
    }
  });

  it('rejects invalid input', () => {
    for (const locale of ['en-US', 'en-GB']) {
      expect(parseDateInput('31 Feb 2026', locale)).toBeNull();
      expect(parseDateInput('2/31/2026', locale)).toBeNull();
      expect(parseDateInput('2026-02-31', locale)).toBeNull();
      expect(parseDateInput('13/13/2026', locale)).toBeNull();
      expect(parseDateInput('12/1/26', locale)).toBeNull();
      expect(parseDateInput('soon', locale)).toBeNull();
      expect(parseDateInput('27 Smarch 2026', locale)).toBeNull();
      expect(parseDateInput('', locale)).toBeNull();
    }
  });

  it('flags invalid typed text with a visible message (empty text is not an error)', () => {
    expect(isInvalidDateText('31 Feb 2026', 'en-US')).toBe(true);
    expect(isInvalidDateText('27/10/2026', 'en-US')).toBe(true);
    expect(isInvalidDateText('27/10/2026', 'en-GB')).toBe(false);
    expect(isInvalidDateText('  ', 'en-US')).toBe(false);
    expect(dateError('en-US')).toBe('Enter a valid date, for example 10/27/2026.');
    expect(dateError('en-GB')).toBe('Enter a valid date, for example 27/10/2026.');
  });

  it('helper examples follow the locale', () => {
    expect(dateHelper('en-US')).toBe(
      'Type a date such as 10/27/2026 or Oct 27, 2026, or pick one from the calendar.',
    );
    expect(dateHelper('en-GB')).toBe(
      'Type a date such as 27/10/2026 or 27 Oct 2026, or pick one from the calendar.',
    );
    expect(dateHelper('pl-PL')).toContain('27.10.2026');
  });

  it('formats ISO dates in the locale', () => {
    expect(formatIsoDate('2026-10-27')).toBe('Oct 27, 2026');
    expect(formatIsoDate('2026-10-27', 'en-GB')).toBe('27 Oct 2026');
    expect(formatIsoDate('')).toBe('—');
    expect(formatIsoDate('2026-02-31')).toBe('—');
  });
});

describe('date formats follow the Jira locale (R-6.1)', () => {
  const MS = Date.UTC(2026, 9, 9, 16, 30);
  afterEach(() => setFormatLocale(undefined));

  it('canonicalises the Jira locale and falls back to en-US', () => {
    expect(FALLBACK_FORMAT_LOCALE).toBe('en-US');
    expect(resolveFormatLocale('pl_PL')).toBe('pl-PL');
    expect(resolveFormatLocale('en-us')).toBe('en-US');
    expect(resolveFormatLocale(undefined)).toBe(FALLBACK_FORMAT_LOCALE);
    expect(resolveFormatLocale('')).toBe(FALLBACK_FORMAT_LOCALE);
    expect(resolveFormatLocale('not a locale!')).toBe(FALLBACK_FORMAT_LOCALE);
  });

  it('uses US English until a locale is set', () => {
    expect(getFormatLocale()).toBe('en-US');
    expect(formatLocal(MS, 'UTC')).toBe('Oct 9, 2026, 04:30 PM');
    setFormatLocale('en_GB');
    expect(formatLocal(MS, 'UTC')).toBe('9 Oct 2026, 16:30');
  });

  it('formats displayed dates in the user locale', () => {
    setFormatLocale('en_US');
    expect(formatLocal(MS, 'UTC')).toBe(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(MS),
    );
    expect(formatIsoDate('2026-10-27')).toBe('Oct 27, 2026');
    setFormatLocale('de_DE');
    expect(formatIsoDate('2026-10-27')).toBe('27. Okt. 2026');
  });

  it('keeps the time zone separate from the locale and exports fixed', () => {
    setFormatLocale('pl_PL');
    expect(formatLocal(MS, 'Europe/Warsaw')).toContain('18:30');
    expect(formatLocalExport(MS, 'Europe/Warsaw')).toBe('2026-10-09 18:30:00 (Europe/Warsaw)');
    expect(formatUtc(MS)).toBe('2026-10-09 16:30:00 UTC');
  });
});
