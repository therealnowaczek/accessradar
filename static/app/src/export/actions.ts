import { call, type Coverage, type Overview, type Snapshot, type SettingsView } from '../api';
import { downloadCsv, downloadMarkdown, downloadPdf } from './download';
import {
  matrixCsv,
  matrixFileName,
  matrixMarkdown,
  matrixPdf,
  type ExportContext,
} from './evidence';

type Matrix = { snapshot: Snapshot | null; data: Array<Record<string, string>> | null };

/**
 * Access matrix export. CSV and Markdown carry every permission (complete record for auditors);
 * PDF carries key permissions so it stays readable.
 */
export async function exportMatrix(
  format: 'csv' | 'pdf' | 'md',
  seq: number | null,
  ctx: ExportContext,
  projectKey?: string,
): Promise<number> {
  const keyPermissions =
    format === 'pdf' ? (await call<SettingsView>('getSettings')).settings.keyPermissions : [];
  // A space export asks the server for that space only (E2E 2.2: the whole-site matrix with every
  // permission was fetched and filtered here, slow enough that no file arrived).
  const m = await call<Matrix>('accessMatrix', {
    seq,
    allPermissions: format !== 'pdf',
    keyPermissions,
    ...(projectKey ? { projectKey } : {}),
  });
  if (!m.snapshot || !m.data) throw new Error('No snapshot to export');
  const rows = projectKey ? m.data.filter((r) => r.project_key === projectKey) : m.data;
  const suffix = projectKey ? `_${projectKey}` : '';
  const [detail, overview] = await Promise.all([
    call<Snapshot & { coverage: Coverage[]; limitations?: import('../api').Limitations }>(
      'getSnapshot',
      { seq: m.snapshot.seq },
    ),
    format === 'pdf' ? null : call<Overview>('getOverview', {}).catch(() => null),
  ]);
  if (format === 'csv') {
    downloadCsv(
      matrixFileName(m.snapshot, 'csv').replace('.csv', `${suffix}.csv`),
      matrixCsv(
        m.snapshot,
        rows,
        ctx,
        overview?.risks ?? [],
        detail.coverage ?? [],
        detail.limitations,
      ),
    );
  } else if (format === 'md') {
    downloadMarkdown(
      matrixFileName(m.snapshot, 'md').replace('.md', `${suffix}.md`),
      matrixMarkdown(
        m.snapshot,
        rows,
        ctx,
        overview?.risks ?? [],
        detail.coverage ?? [],
        detail.limitations,
      ),
    );
  } else {
    downloadPdf(
      matrixFileName(m.snapshot, 'pdf').replace('.pdf', `${suffix}.pdf`),
      await matrixPdf(m.snapshot, detail.coverage, rows, ctx, detail.limitations),
    );
  }
  void call('logExport', {
    kind: `matrix-${format}`,
    target: `#${m.snapshot.seq}${projectKey ? ` ${projectKey}` : ''}`,
    limitationsVersion: detail.limitations?.version,
  }).catch(() => undefined);
  return rows.length;
}
