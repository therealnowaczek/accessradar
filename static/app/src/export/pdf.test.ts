import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { PdfDoc, pdfSafe, textWidth, wrap } from './pdf';

/** Inflate FlateDecode streams so tests can inspect ToUnicode / content. */
function inflatePdf(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  let decoded = '';
  let i = 0;
  while ((i = raw.indexOf(Buffer.from('stream'), i)) !== -1) {
    let s = i + 6;
    if (raw[s] === 0x0d) s++;
    if (raw[s] === 0x0a) s++;
    const end = raw.indexOf(Buffer.from('endstream'), s);
    if (end < 0) break;
    const chunk = raw.subarray(s, end);
    try {
      decoded += inflateSync(chunk).toString('binary');
    } catch {
      decoded += chunk.toString('binary');
    }
    i = end + 9;
  }
  return decoded;
}

describe('pdf', () => {
  it('keeps Polish letters and normalises fancy punctuation', () => {
    expect(pdfSafe('Zażółć gęślą jaźń')).toBe('Zażółć gęślą jaźń');
    expect(pdfSafe('group “a” → role ‘b’ – ok…')).toBe('group "a" -> role \'b\' - ok...');
  });

  it('wraps to the width and hard-breaks long words', () => {
    const lines = wrap('alpha beta gamma delta epsilon zeta eta theta', 80, 10);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l, 10)).toBeLessThanOrEqual(80);
    const long = wrap('x'.repeat(200), 50, 10);
    expect(long.length).toBeGreaterThan(3);
    expect(long.join('')).toBe('x'.repeat(200));
  });

  it('produces a valid PDF with Polish glyphs and multiple pages', async () => {
    const doc = new PdfDoc('AccessRadar test');
    doc.title('Evidence (pack)', 'subtitle \\ backslash');
    doc.keyValues([['Hash', 'a'.repeat(64)]]);
    doc.paragraph('Zażółć gęślą jaźń');
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
    const bytes = await doc.toBytes();
    const ascii = Buffer.from(bytes).toString('latin1');
    expect(ascii.startsWith('%PDF')).toBe(true);
    expect(ascii.trimEnd().endsWith('%%EOF')).toBe(true);

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThan(1);

    const decoded = inflatePdf(bytes);
    // Content uses glyph ids; ToUnicode cmap must map Polish codepoints.
    expect(decoded.toLowerCase()).toContain('00f3'); // ó
    expect(decoded.toLowerCase()).toContain('017c'); // ż
    expect(decoded).toContain('NotoSans');
    expect(decoded).toContain(' Tj');
  });
});
