/**
 * Minimal dependency-free PDF writer for the evidence pack (A4, Helvetica, text + tables).
 * Generated in the browser, bundled with the app: no CDN, no egress (Runs on Atlassian).
 * Standard fonts only cover WinAnsi, so text is transliterated (ą→a, “→", →→->).
 */

// Helvetica advance widths (AFM, 1/1000 em) for ASCII 32..126.
const W = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const MAP: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  Ą: 'A',
  Ć: 'C',
  Ę: 'E',
  Ł: 'L',
  Ń: 'N',
  Ó: 'O',
  Ś: 'S',
  Ź: 'Z',
  Ż: 'Z',
  '→': '->',
  '←': '<-',
  '“': '"',
  '”': '"',
  '„': '"',
  '‘': "'",
  '’': "'",
  '–': '-',
  '—': '-',
  '…': '...',
  '·': '-',
  '\u00a0': ' ',
  '✓': 'v',
  '•': '-',
};

/** Restricts text to printable Latin-1 so standard PDF fonts can render it. */
export function pdfSafe(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    if (MAP[ch] !== undefined) out += MAP[ch];
    else {
      const c = ch.charCodeAt(0);
      if ((c >= 32 && c <= 126) || (c >= 0xa0 && c <= 0xff)) out += ch;
      else if (ch === '\n' || ch === '\t') out += ' ';
      else {
        const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        out += base && base.charCodeAt(0) < 127 ? base : '?';
      }
    }
  }
  return out;
}

export function textWidth(text: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c <= 126 ? W[c - 32] : 556;
  }
  return (w * size * (bold ? 1.06 : 1)) / 1000;
}

/** Greedy word wrap; very long words are hard-broken. */
export function wrap(text: string, width: number, size: number, bold = false): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const push = (w: string) => {
    let rest = w;
    while (textWidth(rest, size, bold) > width && rest.length > 1) {
      let n = rest.length - 1;
      while (n > 1 && textWidth(rest.slice(0, n), size, bold) > width) n--;
      lines.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    return rest;
  };
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, bold) <= width) line = candidate;
    else {
      if (line) lines.push(line);
      line = push(word);
    }
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export interface Column {
  header: string;
  /** Relative width. */
  width: number;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 42;

export class PdfDoc {
  private pages: string[][] = [];
  private y = 0;
  private readonly contentW = PAGE_W - 2 * M;

  constructor(private readonly footer: string) {
    this.newPage();
  }

  private get ops() {
    return this.pages[this.pages.length - 1];
  }

  newPage() {
    this.pages.push([]);
    this.y = PAGE_H - M;
  }

  private ensure(h: number) {
    if (this.y - h < M + 20) this.newPage();
  }

  private text(x: number, y: number, s: string, size: number, bold = false, gray = 0) {
    this.ops.push(
      `BT ${gray ? `${gray} g ` : '0 g '}/${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(pdfSafe(s))}) Tj ET`,
    );
  }

  private line(x1: number, y1: number, x2: number, y2: number, gray = 0.8, width = 0.5) {
    this.ops.push(
      `${gray} G ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`,
    );
  }

  title(text: string, subtitle?: string) {
    this.ensure(60);
    for (const l of wrap(text, this.contentW, 20, true)) {
      this.y -= 24;
      this.text(M, this.y, l, 20, true);
    }
    if (subtitle) {
      this.y -= 16;
      this.text(M, this.y, subtitle, 10, false, 0.35);
    }
    this.y -= 12;
    this.line(M, this.y, PAGE_W - M, this.y, 0.6, 0.8);
    this.y -= 6;
  }

  heading(text: string) {
    this.ensure(40);
    this.y -= 22;
    this.text(M, this.y, text, 13, true);
    this.y -= 6;
  }

  paragraph(text: string, size = 9.5, gray = 0) {
    for (const l of wrap(text, this.contentW, size)) {
      this.ensure(size + 4);
      this.y -= size + 3.5;
      this.text(M, this.y, l, size, false, gray);
    }
    this.y -= 4;
  }

  keyValues(rows: Array<[string, string]>) {
    const keyW = 150;
    for (const [k, v] of rows) {
      const lines = wrap(v || '-', this.contentW - keyW, 9.5);
      this.ensure(lines.length * 13 + 4);
      this.y -= 13;
      this.text(M, this.y, k, 9.5, true, 0.25);
      lines.forEach((l, i) => {
        if (i) this.y -= 12.5;
        this.text(M + keyW, this.y, l, 9.5);
      });
      this.y -= 3;
    }
  }

  table(columns: Column[], rows: string[][], size = 8) {
    const total = columns.reduce((s, c) => s + c.width, 0);
    const widths = columns.map((c) => (c.width / total) * this.contentW);
    const pad = 3;
    const lh = size + 2.5;
    const header = () => {
      const cells = columns.map((c, i) => wrap(c.header, widths[i] - 2 * pad, size, true));
      const h = Math.max(...cells.map((c) => c.length)) * lh + 2 * pad;
      this.ensure(h + lh * 2);
      let x = M;
      cells.forEach((lines, i) => {
        lines.forEach((l, j) =>
          this.text(x + pad, this.y - pad - (j + 1) * lh + 2.5, l, size, true),
        );
        x += widths[i];
      });
      this.y -= h;
      this.line(M, this.y, PAGE_W - M, this.y, 0.3, 0.8);
    };
    header();
    for (const row of rows) {
      const cells = row.map((v, i) => wrap(v ?? '', widths[i] - 2 * pad, size));
      const h = Math.max(1, ...cells.map((c) => c.length)) * lh + 2 * pad;
      if (this.y - h < M + 20) {
        this.newPage();
        header();
      }
      let x = M;
      cells.forEach((lines, i) => {
        lines.forEach((l, j) => this.text(x + pad, this.y - pad - (j + 1) * lh + 2.5, l, size));
        x += widths[i];
      });
      this.y -= h;
      this.line(M, this.y, PAGE_W - M, this.y);
    }
    this.y -= 6;
  }

  /** Serialises to PDF bytes (all text is Latin-1, so one char = one byte). */
  toBytes(): Uint8Array {
    const n = this.pages.length;
    const objects: string[] = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    const pageIds = this.pages.map((_, i) => 5 + i * 2);
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${n} >>`;
    objects[3] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    this.pages.forEach((ops, i) => {
      const footer = `BT 0.45 g /F1 8 Tf ${M} ${M - 14} Td (${esc(pdfSafe(`${this.footer}  |  Page ${i + 1} of ${n}`))}) Tj ET`;
      const stream = [...ops, footer].join('\n');
      objects[pageIds[i]] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`;
      objects[pageIds[i] + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });
    let out = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id++) {
      offsets[id] = out.length;
      out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xref = out.length;
    out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id++)
      out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
