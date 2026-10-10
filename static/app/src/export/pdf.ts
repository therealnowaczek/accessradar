/**
 * PDF writer for evidence packs (A4, Noto Sans, text + tables).
 * Generated in the browser with pdf-lib + bundled fonts: no CDN, no egress (Runs on Atlassian).
 */

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { loadNotoFonts } from './fonts';

// Approximate Helvetica advance widths (AFM, 1/1000 em) for wrap layout only.
const W = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Punctuation / symbol normalisations; letters (incl. Polish) are kept as-is for Noto Sans. */
const MAP: Record<string, string> = {
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

/** Normalises punctuation; keeps Unicode letters (Polish) for the bundled Noto Sans font. */
export function pdfSafe(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    if (MAP[ch] !== undefined) out += MAP[ch];
    else if (ch === '\n' || ch === '\t') out += ' ';
    else if (ch.codePointAt(0)! < 32) out += ' ';
    else out += ch;
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

export interface Column {
  header: string;
  /** Relative width. */
  width: number;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 42;

type Op =
  | { t: 'text'; x: number; y: number; s: string; size: number; bold: boolean; gray: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; gray: number; width: number };

function drawable(font: PDFFont, s: string): string {
  let out = '';
  for (const ch of s) {
    try {
      font.widthOfTextAtSize(ch, 10);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

export class PdfDoc {
  private pages: Op[][] = [];
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
    this.ops.push({ t: 'text', x, y, s: pdfSafe(s), size, bold, gray });
  }

  private line(x1: number, y1: number, x2: number, y2: number, gray = 0.8, width = 0.5) {
    this.ops.push({ t: 'line', x1, y1, x2, y2, gray, width });
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

  private paint(page: PDFPage, ops: Op[], f1: PDFFont, f2: PDFFont) {
    for (const op of ops) {
      if (op.t === 'line') {
        page.drawLine({
          start: { x: op.x1, y: op.y1 },
          end: { x: op.x2, y: op.y2 },
          thickness: op.width,
          color: rgb(op.gray, op.gray, op.gray),
        });
        continue;
      }
      const font = op.bold ? f2 : f1;
      const g = Math.min(1, Math.max(0, op.gray));
      page.drawText(drawable(font, op.s), {
        x: op.x,
        y: op.y,
        size: op.size,
        font,
        color: rgb(g, g, g),
      });
    }
  }

  /** Serialises to PDF bytes with subsetted Noto Sans (Polish letters preserved). */
  async toBytes(): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const { regular, bold } = await loadNotoFonts();
    const f1 = await pdf.embedFont(regular, { subset: true });
    const f2 = await pdf.embedFont(bold, { subset: true });
    const n = this.pages.length;
    this.pages.forEach((ops, i) => {
      const page = pdf.addPage([PAGE_W, PAGE_H]);
      this.paint(page, ops, f1, f2);
      page.drawText(drawable(f1, `${this.footer}  |  Page ${i + 1} of ${n}`), {
        x: M,
        y: M - 14,
        size: 8,
        font: f1,
        color: rgb(0.45, 0.45, 0.45),
      });
    });
    return pdf.save();
  }
}
