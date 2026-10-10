/** Minimal coverage row shape (matches snapshot coverage JSON). */
export interface CoverageLike {
  area: string;
  target: string;
  status: string;
  reason: string;
}

/** Bump when static limitation statements change (included in signature v2). */
export const LIMITATIONS_VERSION = 1;

/** Fixed method limitations — single source for UI, PDF, CSV. */
export const LIMITATION_STATEMENTS: readonly string[] = [
  'Team-managed projects use a simplified permission model; findings for those projects are limited accordingly.',
  'Conditional holders (reporter, assignee, user/group custom fields) are listed, not expanded to people.',
  'Issue security levels are not evaluated.',
  'Confluence and Jira Service Management customers are out of scope.',
  '“Inactive” means a deactivated Atlassian account, not last-login age.',
  'Global admin view is partial: derived from admin/site-admin group membership only.',
  'Data is a point-in-time snapshot (timestamp, sequence, and content hash identify the capture).',
];

export type Completeness = 'complete' | 'partial' | 'failed';

export function completenessOf(
  status: string | undefined,
  coverage: CoverageLike[] | undefined,
): { completeness: Completeness; gapCount: number } {
  const gaps = (coverage ?? []).filter((c) => c.status !== 'info').length;
  if (status === 'failed') return { completeness: 'failed', gapCount: gaps };
  if (status === 'partial' || gaps > 0) return { completeness: 'partial', gapCount: gaps };
  return { completeness: 'complete', gapCount: 0 };
}

export function completenessLabel(c: Completeness, gapCount: number): string {
  if (c === 'complete') return 'complete';
  if (c === 'failed') return 'failed';
  return `partial (${gapCount} gap${gapCount === 1 ? '' : 's'})`;
}

export function limitationsPayload(
  status: string | undefined,
  coverage: CoverageLike[] | undefined,
) {
  const { completeness, gapCount } = completenessOf(status, coverage);
  return {
    version: LIMITATIONS_VERSION,
    statements: [...LIMITATION_STATEMENTS],
    completeness,
    gapCount,
    label: completenessLabel(completeness, gapCount),
  };
}

/** Leading CSV rows: `# coverage,<status>,<area>,<target>,<reason>` then blank line. */
export function coverageCsvPrefix(coverage: CoverageLike[]): string[] {
  return coverage.map(
    (c) =>
      `# coverage,${csvEscape(c.status)},${csvEscape(c.area)},${csvEscape(c.target)},${csvEscape(c.reason)}`,
  );
}

function csvEscape(value: string): string {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
