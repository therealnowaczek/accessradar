import { call, type Coverage, type Snapshot, type SettingsView } from '../api';
import { downloadCsv, downloadPdf } from './download';
import { matrixCsv, matrixFileName, matrixPdf, type ExportContext } from './evidence';

type Matrix = { snapshot: Snapshot | null; data: Array<Record<string, string>> | null };

/**
 * Access matrix export. CSV carries every permission (complete record for auditors);
 * PDF carries key permissions so it stays readable.
 */
export async function exportMatrix(
  format: 'csv' | 'pdf',
  seq: number | null,
  ctx: ExportContext,
  projectKey?: string,
): Promise<number> {
  const keyPermissions =
    format === 'pdf' ? (await call<SettingsView>('getSettings')).settings.keyPermissions : [];
  const m = await call<Matrix>('accessMatrix', {
    seq,
    allPermissions: format === 'csv',
    keyPermissions,
  });
  if (!m.snapshot || !m.data) throw new Error('No snapshot to export');
  const rows = projectKey ? m.data.filter((r) => r.project_key === projectKey) : m.data;
  const suffix = projectKey ? `_${projectKey}` : '';
  if (format === 'csv') {
    downloadCsv(
      matrixFileName(m.snapshot, 'csv').replace('.csv', `${suffix}.csv`),
      matrixCsv(m.snapshot, rows, ctx),
    );
  } else {
    const detail = await call<Snapshot & { coverage: Coverage[] }>('getSnapshot', {
      seq: m.snapshot.seq,
    });
    downloadPdf(
      matrixFileName(m.snapshot, 'pdf').replace('.pdf', `${suffix}.pdf`),
      matrixPdf(m.snapshot, detail.coverage, rows, ctx),
    );
  }
  void call('logExport', {
    kind: `matrix-${format}`,
    target: `#${m.snapshot.seq}${projectKey ? ` ${projectKey}` : ''}`,
  }).catch(() => undefined);
  return rows.length;
}
