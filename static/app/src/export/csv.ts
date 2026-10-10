/** RFC 4180 CSV with UTF-8 BOM (Excel), CRLF line endings and spreadsheet-formula neutralisation. */

const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // A cell starting with = + - @ would run as a formula in Excel/Sheets (CSV injection).
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvOptions {
  /** Metadata lines written above the header as "# key: value". */
  meta?: Array<[string, string]>;
  /** Raw comment lines (already formatted, including leading #). */
  preamble?: string[];
  bom?: boolean;
}

export function toCsv(
  columns: string[],
  rows: Array<Record<string, unknown>>,
  opts: CsvOptions = {},
): string {
  const lines: string[] = [];
  for (const [k, v] of opts.meta ?? []) lines.push(csvCell(`# ${k}: ${v}`));
  for (const p of opts.preamble ?? []) lines.push(p);
  if (opts.preamble?.length) lines.push('');
  lines.push(columns.map(csvCell).join(','));
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(','));
  return `${opts.bom === false ? '' : '\uFEFF'}${lines.join('\r\n')}\r\n`;
}

/** Parses CSV produced by toCsv (used in tests and for hash re-computation docs). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && src[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
