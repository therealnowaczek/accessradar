import { describe, expect, it } from 'vitest';
import { PdfDoc, pdfSafe, textWidth, wrap } from './pdf';

const text = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

describe('pdf', () => {
  it('transliterates text outside WinAnsi', () => {
    expect(pdfSafe('Zażółć gęślą jaźń')).toBe('Zazolc gesla jazn');
    expect(pdfSafe('group “a” → role ‘b’ – ok…')).toBe('group "a" -> role \'b\' - ok...');
    expect(pdfSafe('日本')).toBe('??');
  });

  it('wraps to the width and hard-breaks long words', () => {
    const lines = wrap('alpha beta gamma delta epsilon zeta eta theta', 80, 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l, 10)).toBeLessThanOrEqual(80);
    const long = wrap('x'.repeat(200), 50, 10);
    expect(long.length).toBeGreaterThan(3);
    expect(long.join('')).toBe('x'.repeat(200));
  });

  it('produces a structurally valid PDF with correct xref offsets and page footers', () => {
    const doc = new PdfDoc('AccessRadar test');
    doc.title('Evidence (pack)', 'subtitle \\ backslash');
    doc.keyValues([['Hash', 'a'.repeat(64)]]);
    doc.table(
      [
        { header: 'Who', width: 1 },
        { header: 'Why', width: 3 },
      ],
      Array.from({ length: 150 }, (_, i) => [
        `Person ${i}`,
        `group “g${i}” → role “Developers” → scheme “Default”`,
      ]),
    );
    const out = text(doc.toBytes());
    expect(out.startsWith('%PDF-1.4')).toBe(true);
    expect(out.trimEnd().endsWith('%%EOF')).toBe(true);
    const pages = Number(/\/Count (\d+)/.exec(out)![1]);
    expect(pages).toBeGreaterThan(1);
    expect(out).toContain(`Page ${pages} of ${pages}`);
    expect(out).toContain('Evidence \\(pack\\)');
    // every xref entry points at "<n> 0 obj"
    const xrefAt = Number(/startxref\n(\d+)/.exec(out)![1]);
    expect(out.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const entries = out
      .slice(xrefAt)
      .split('\n')
      .slice(3)
      .filter((l) => / n $/.test(l));
    entries.forEach((line, i) => {
      const offset = Number(line.slice(0, 10));
      expect(out.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    // stream lengths match
    for (const m of out.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const start = m.index! + m[0].length;
      expect(out.slice(start + Number(m[1]), start + Number(m[1]) + 10)).toBe('\nendstream');
    }
  });
});
