import EmptyState from '@atlaskit/empty-state';
import { useEffect, useState } from 'react';
import { Inline, Stack, Text } from '@atlaskit/primitives';
import Button, { IconButton } from '@atlaskit/button/new';
import DynamicTable from '../Table';
import RefreshIcon from '@atlaskit/icon/core/refresh';
import type { Coverage, Limitations, Snapshot } from '../api';
import { CoverageLimitations, ExportMenu, Hash, Section, SnapshotLozenge } from '../components';
import { useCall } from '../data';
import { DrawerBody, LevelDrawer, type DrawerLevel } from '../Drawer';
import { exportMatrix } from '../export/actions';
import { downloadCsv } from '../export/download';
import { coverageOnlyCsv } from '../export/evidence';
import { duration, formatLocal, formatUtc, relative } from '../format';
import { navItem } from '../routes';
import {
  exportContext,
  SnapshotProgress,
  useApp,
  useExporter,
  useRefresh,
  useSnapshots,
  useTakeSnapshot,
} from '../shared';
import { Details, ErrorState, LinkButton, PageFrame, PageHeader, staleNotice } from '../ui';
import { DrawerPhantom, SkeletonRoot } from '../skeletons';
import { SkeletonTable } from '../skeletonTable';

const STAT_LABEL: Record<string, string> = {
  project: 'Spaces',
  scheme: 'Permission schemes',
  grant: 'Permission grants',
  role: 'Space roles',
  role_actor: 'Role actors',
  group: 'Groups',
  group_access: 'Group admin/application access',
  group_member: 'Group memberships',
  app_role: 'Applications',
  app_role_group: 'Application access groups',
  person: 'People and app accounts',
};

const TRIGGER: Record<string, string> = {
  manual: 'Manual',
  scheduled: 'Scheduled',
  onboarding: 'First snapshot',
  dev: 'Dev self-test',
};

export function SnapshotsView() {
  const { params, status } = useApp();
  const meta = navItem('snapshots');
  const snaps = useSnapshots();
  const take = useTakeSnapshot(snaps.reload);
  const [drawer, setDrawer] = useState<DrawerLevel[]>([]);
  const active = status.data?.active ?? snaps.data?.active ?? null;
  const latest = status.data?.latest?.seq;
  const { refresh, refreshing } = useRefresh(async () => {
    const [listOk, statusOk] = await Promise.all([snaps.reload(), status.reload()]);
    return listOk && statusOk;
  });

  useEffect(() => {
    void snaps.reload();
    // refresh the list when a running snapshot finishes
  }, [latest, active?.status]);

  const open = (s: Snapshot) =>
    setDrawer([
      {
        key: String(s.seq),
        title: `Snapshot #${s.seq}`,
        description: formatLocal(s.startedAt),
        content: <SnapshotDrawer seq={s.seq} />,
      },
    ]);

  useEffect(() => {
    const s = snaps.data?.snapshots.find((x) => String(x.seq) === params.seq);
    if (s && !drawer.length) open(s);
  }, [snaps.data]);

  const list = snaps.data?.snapshots ?? [];
  const header = (
    <PageHeader
      title={meta.title}
      description={meta.description}
      actions={
        <>
          <IconButton
            icon={RefreshIcon}
            label="Refresh"
            isLoading={refreshing}
            onClick={() => void refresh()}
          />
          {/* No duplicate CTA: with no snapshots the empty state carries "Take snapshot now". */}
          {snaps.data && !list.length && !active ? null : (
            <Button
              appearance="primary"
              isLoading={take.busy}
              isDisabled={Boolean(active)}
              onClick={() => void take.run()}
            >
              Take snapshot now
            </Button>
          )}
        </>
      }
    />
  );
  return (
    <PageFrame notice={staleNotice(snaps)} header={header}>
      <Stack space="space.300">
        {active ? <SnapshotProgress active={active} /> : null}
        {snaps.error && !snaps.data ? (
          <ErrorState title="Snapshots unavailable" message={snaps.error} retry={snaps.reload} />
        ) : !snaps.data ? (
          <SkeletonRoot>
            <SkeletonTable
              columns={['Snapshot', 'Status', 'Trigger', 'Duration', 'Contents', 'API cost']}
            />
          </SkeletonRoot>
        ) : !list.length ? (
          <EmptyState
            header="No snapshots yet"
            description="A snapshot records permission schemes, roles, groups and application access at one point in time."
            primaryAction={
              <Button appearance="primary" isLoading={take.busy} onClick={() => void take.run()}>
                Take snapshot now
              </Button>
            }
          />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'seq', content: 'Snapshot', isSortable: true },
                { key: 'status', content: 'Status' },
                { key: 'trigger', content: 'Trigger' },
                { key: 'duration', content: 'Duration' },
                { key: 'size', content: 'Contents' },
                { key: 'cost', content: 'API cost' },
              ],
            }}
            rows={list.map((s) => ({
              key: String(s.seq),
              cells: [
                {
                  key: s.seq,
                  content: (
                    <>
                      <LinkButton onClick={() => open(s)}>
                        #{s.seq} · {formatLocal(s.startedAt)}
                      </LinkButton>
                      <Text as="p" color="color.text.subtle">
                        {relative(s.startedAt)}
                      </Text>
                    </>
                  ),
                },
                { key: 'status', content: <SnapshotLozenge status={s.status} /> },
                { key: 'trigger', content: TRIGGER[s.trigger] ?? s.trigger },
                { key: 'd', content: duration(s.startedAt, s.finishedAt) },
                {
                  key: 'size',
                  content: s.stats ? (
                    <Text color="color.text.subtle">
                      {s.stats.project ?? 0} spaces · {s.stats.group ?? 0} groups ·{' '}
                      {s.stats.person ?? 0} people
                    </Text>
                  ) : (
                    <Text color="color.text.subtle">—</Text>
                  ),
                },
                {
                  key: 'cost',
                  content: (
                    <Text color="color.text.subtle">
                      {s.calls} calls · {s.points.toLocaleString()} points
                    </Text>
                  ),
                },
              ],
            }))}
            rowsPerPage={25}
            defaultPage={1}
            defaultSortKey="seq"
            defaultSortOrder="DESC"
          />
        )}
      </Stack>
      <LevelDrawer
        levels={drawer}
        onBack={() => setDrawer((l) => l.slice(0, -1))}
        onClose={() => setDrawer([])}
      />
    </PageFrame>
  );
}

function SnapshotDrawer({ seq }: { seq: number }) {
  const { siteUrl } = useApp();
  const exporter = useExporter();
  const r = useCall<Snapshot & { coverage: Coverage[]; limitations?: Limitations }>('getSnapshot', {
    seq,
  });
  if (r.error && !r.data)
    return (
      <DrawerBody>
        <ErrorState title="Snapshot unavailable" message={r.error} retry={r.reload} />
      </DrawerBody>
    );
  const s = r.data;
  if (!s)
    return (
      <DrawerBody>
        <DrawerPhantom />
      </DrawerBody>
    );
  const committed = s.status === 'complete' || s.status === 'partial';
  return (
    <DrawerBody>
      <Details
        rows={[
          ['Status', <SnapshotLozenge key="s" status={s.status} />],
          ['Started', `${formatLocal(s.startedAt)} · ${formatUtc(s.startedAt)}`],
          [
            'Finished',
            s.finishedAt
              ? `${formatLocal(s.finishedAt)} (${duration(s.startedAt, s.finishedAt)})`
              : '—',
          ],
          ['Trigger', TRIGGER[s.trigger] ?? s.trigger],
          [
            'Identity',
            s.collectorMode === 'app+impersonation'
              ? 'App, with admin fallback for some calls'
              : 'App',
          ],
          ['API cost', `${s.calls} calls · ${s.points.toLocaleString()} rate points`],
          ['Engine version', s.engineVersion],
          ['Content hash (SHA-256)', <Hash key="h" value={s.contentHash} />],
          ...(s.error ? ([['Error', s.error]] as Array<[string, string]>) : []),
        ]}
      />
      {s.stats ? (
        <Section title="Contents">
          <Details
            rows={Object.entries(s.stats).map(([k, v]) => [STAT_LABEL[k] ?? k, v.toLocaleString()])}
          />
        </Section>
      ) : null}
      <CoverageLimitations coverage={s.coverage ?? []} limitations={s.limitations} />
      {committed ? (
        <Section
          title="Export"
          description="Access matrix: who has which permission in which space, and why."
        >
          <Inline space="space.100" alignBlock="center" shouldWrap>
            <ExportMenu
              label="Export access matrix"
              onCsv={() =>
                void exporter('Access matrix CSV', () =>
                  exportMatrix('csv', s.seq, exportContext(siteUrl)),
                )
              }
              onPdf={() =>
                void exporter('Access matrix PDF', () =>
                  exportMatrix('pdf', s.seq, exportContext(siteUrl)),
                )
              }
            />
            <Button
              onClick={() =>
                void exporter('Coverage CSV', () => {
                  downloadCsv(
                    `accessradar_coverage_snapshot-${s.seq}.csv`,
                    coverageOnlyCsv(s.coverage ?? [], s.limitations, exportContext(siteUrl)),
                  );
                })
              }
            >
              Download coverage CSV
            </Button>
          </Inline>
        </Section>
      ) : null}
    </DrawerBody>
  );
}
