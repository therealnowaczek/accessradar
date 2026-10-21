import { describe, expect, it } from 'vitest';
import { appendMarkdownTable, mdCell, toMarkdown } from './markdown';

describe('markdown', () => {
  it('escapes pipes and newlines in cells', () => {
    expect(mdCell('a|b')).toBe('a/b');
    expect(mdCell('line\nbreak')).toBe('line break');
    expect(mdCell(null)).toBe('');
    expect(mdCell(42)).toBe('42');
  });

  it('writes title, meta bullets and a GFM table', () => {
    const text = toMarkdown(
      ['project_key', 'display_name'],
      [{ project_key: 'OPS', display_name: 'Ann' }],
      {
        title: 'Access matrix',
        meta: [['Snapshot', '#3']],
        summary: ['Partial coverage'],
      },
    );
    expect(text).toContain('# Access matrix\n');
    expect(text).toContain('- **Snapshot:** #3\n');
    expect(text).toContain('- Partial coverage\n');
    expect(text).toContain('| project_key | display_name |\n');
    expect(text).toContain('| --- | --- |\n');
    expect(text).toContain('| OPS | Ann |\n');
  });

  it('appends a second table section', () => {
    const base = toMarkdown(['a'], [{ a: 1 }], { title: 'Main' });
    const out = appendMarkdownTable(base, 'Risks', ['id'], [{ id: 'r1' }]);
    expect(out).toContain('# Main\n');
    expect(out).toContain('## Risks\n');
    expect(out).toContain('| id |\n');
    expect(out).toContain('| r1 |\n');
  });
});
