import { describe, expect, it } from 'vitest';
import { formatIsoDate, humanizePermissionKeys, parseDateInput, permissionLabel } from './format';

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
  });
});
