import { call, type Coverage, type Overview, type Snapshot, type SettingsView } from '../api';
import { downloadCsv, downloadJson, downloadMarkdown, downloadPdf } from './download';
import {
  matrixCsv,
  matrixFileName,
  matrixMarkdown,
  matrixPdf,
  type ExportContext,
} from './evidence';
import { jsonFileName, matrixJson, serializeJson } from './json';

type Matrix = { snapshot: Snapshot | null; data: Array<Record<string, string>> | null };

async function fetchMatrix(
  seq: number | null,
  projectKey: string | undefined,
  ask: (key: string | undefined, at: number | null) => Promise<Matrix>,
): Promise<Matrix> {
  if (projectKey) return ask(projectKey, seq);
  const list = await call<{ snapshot: Snapshot | null; data: Array<{ key: string }> | null }>(
    'exploreProjects',
    { seq },
  );
  if (!list.snapshot || !list.data) return { snapshot: null, data: null };
  const at = list.snapshot.seq;
  const rows: Array<Record<string, string>> = [];
  const keys = list.data.map((p) => p.key);
  for (let i = 0; i < keys.length; i += 3) {
    const parts = await Promise.all(keys.slice(i, i + 3).map((k) => ask(k, at)));
    for (const part of parts) rows.push(...(part.data ?? []));
  }
  return { snapshot: list.snapshot, data: rows };
}

/**
 * Access matrix export. CSV and Markdown carry every permission (complete record for auditors);
 * PDF carries key permissions so it stays readable.
 */
export async function exportMatrix(
  format: 'csv' | 'pdf' | 'md' | 'json',
  seq: number | null,
  ctx: ExportContext,
  projectKey?: string,
): Promise<number> {
  const keyPermissions =
    format === 'pdf' ? (await call<SettingsView>('getSettings')).settings.keyPermissions : [];
  // A space export asks the server for that space only. The whole-site matrix is fetched one space
  // per call: with every permission it passes the 5 MB Forge response limit on a real site.
  const ask = (key: string | undefined, at: number | null) =>
    call<Matrix>('accessMatrix', {
      seq: at,
      allPermissions: format !== 'pdf',
      keyPermissions,
      ...(key ? { projectKey: key } : {}),
    });
  const m = await fetchMatrix(seq, projectKey, ask);
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
  } else if (format === 'json') {
    downloadJson(
      jsonFileName(matrixFileName(m.snapshot, 'json')).replace('.json', `${suffix}.json`),
      serializeJson(
        matrixJson(
          m.snapshot,
          rows,
          ctx,
          overview?.risks ?? [],
          detail.coverage ?? [],
          detail.limitations,
        ),
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
