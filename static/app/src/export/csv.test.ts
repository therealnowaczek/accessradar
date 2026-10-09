import { describe, expect, it } from 'vitest';
import { csvCell, parseCsv, toCsv } from './csv';

describe('csv', () => {
  it('quotes separators, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(42)).toBe('42');
  });

  it('neutralises spreadsheet formulas (CSV injection)', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('Zażółć gęślą')).toBe('Zażółć gęślą');
  });

  it('writes BOM, metadata, header and CRLF rows that round-trip', () => {
    const text = toCsv(
      ['project_key', 'display_name', 'path'],
      [
        {
          project_key: 'OPS',
          display_name: 'Łukasz, Admin',
          path: 'group “jira-admins” → role “Administrators”',
        },
        { project_key: 'DEV', display_name: 'Ann', path: '' },
      ],
      { meta: [['Snapshot', '#3']] },
    );
    expect(text.startsWith('\uFEFF# Snapshot: #3\r\n')).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
    const rows = parseCsv(text);
    expect(rows[1]).toEqual(['project_key', 'display_name', 'path']);
    expect(rows[2]).toEqual([
      'OPS',
      'Łukasz, Admin',
      'group “jira-admins” → role “Administrators”',
    ]);
    expect(rows[3]).toEqual(['DEV', 'Ann', '']);
    expect(rows).toHaveLength(4);
  });

  it('can omit the BOM', () => {
    expect(toCsv(['a'], [{ a: 1 }], { bom: false })).toBe('a\r\n1\r\n');
  });
});
