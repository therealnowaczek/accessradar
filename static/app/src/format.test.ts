import { afterEach, describe, expect, it } from 'vitest';
import {
  FALLBACK_FORMAT_LOCALE,
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

describe('date input', () => {
  const iso = (d: Date | null) =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : null;

  it('parses the app format, day-first numeric and ISO', () => {
    expect(iso(parseDateInput('27 Oct 2026'))).toBe('2026-10-27');
    expect(iso(parseDateInput('27 October 2026'))).toBe('2026-10-27');
    expect(iso(parseDateInput('27/10/2026'))).toBe('2026-10-27');
    expect(iso(parseDateInput('2026-10-27'))).toBe('2026-10-27');
  });

  it('rejects invalid dates', () => {
    expect(parseDateInput('31 Feb 2026')).toBeNull();
    expect(parseDateInput('10/27/2026')).toBeNull();
    expect(parseDateInput('soon')).toBeNull();
  });

  it('formats ISO dates like the rest of the app', () => {
    expect(formatIsoDate('2026-10-27')).toBe('27 Oct 2026');
    expect(formatIsoDate('')).toBe('—');
    expect(formatIsoDate('2026-02-31')).toBe('—');
  });
});

describe('date formats follow the Jira locale (R-6.1)', () => {
  const MS = Date.UTC(2026, 9, 9, 16, 30);
  afterEach(() => setFormatLocale(undefined));

  it('canonicalises the Jira locale and falls back to English', () => {
    expect(resolveFormatLocale('pl_PL')).toBe('pl-PL');
    expect(resolveFormatLocale('en-us')).toBe('en-US');
    expect(resolveFormatLocale(undefined)).toBe(FALLBACK_FORMAT_LOCALE);
    expect(resolveFormatLocale('')).toBe(FALLBACK_FORMAT_LOCALE);
    expect(resolveFormatLocale('not a locale!')).toBe(FALLBACK_FORMAT_LOCALE);
  });

  it('keeps the English format until a locale is set', () => {
    expect(getFormatLocale()).toBe('en-GB');
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
