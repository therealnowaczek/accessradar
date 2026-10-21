/** GitHub-flavored Markdown tables for lightweight copy/share exports. */

export function mdCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\|/g, '/')
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n]/g, ' ');
}

export interface MarkdownOptions {
  /** Leading `# title`. */
  title?: string;
  /** Bullet lines written as `- text`. */
  summary?: string[];
  /** Key/value bullets written as `- **key:** value`. */
  meta?: Array<[string, string]>;
}

/** Builds a GFM document: optional title + summary, then one pipe table. */
export function toMarkdown(
  columns: string[],
  rows: Array<Record<string, unknown>>,
  opts: MarkdownOptions = {},
): string {
  const lines: string[] = [];
  if (opts.title) {
    lines.push(`# ${opts.title}`, '');
  }
  for (const [k, v] of opts.meta ?? []) lines.push(`- **${mdCell(k)}:** ${mdCell(v)}`);
  for (const s of opts.summary ?? []) lines.push(`- ${mdCell(s)}`);
  if ((opts.meta?.length || opts.summary?.length) && columns.length) lines.push('');
  if (columns.length) {
    lines.push(`| ${columns.map(mdCell).join(' | ')} |`);
    lines.push(`| ${columns.map(() => '---').join(' | ')} |`);
    for (const row of rows) {
      lines.push(`| ${columns.map((c) => mdCell(row[c])).join(' | ')} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Appends another titled GFM table to an existing Markdown document. */
export function appendMarkdownTable(
  doc: string,
  title: string,
  columns: string[],
  rows: Array<Record<string, unknown>>,
): string {
  const body = toMarkdown(columns, rows, { title }).replace(/^# /, '## ');
  const base = doc.endsWith('\n') ? doc : `${doc}\n`;
  return `${base}\n${body}`;
}
