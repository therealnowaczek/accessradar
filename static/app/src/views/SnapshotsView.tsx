import { useEffect, useState } from 'react';
import Button from '@atlaskit/button/new';
import DynamicTable from '@atlaskit/dynamic-table';
import RefreshIcon from '@atlaskit/icon/core/refresh';
import type { Coverage, Snapshot } from '../api';
import { CoverageList, ExportMenu, Hash, Section, SnapshotLozenge } from '../components';
import { useCall } from '../data';
import { DrawerBody, StackDrawer, type DrawerLevel } from '../Drawer';
import { exportMatrix } from '../export/actions';
import { duration, formatLocal, formatUtc, relative } from '../format';
import { navItem } from '../routes';
import {
  exportContext,
  SnapshotProgress,
  useApp,
  useExporter,
  useSnapshots,
  useTakeSnapshot,
} from '../shared';
import { Details, Empty, ErrorState, LinkButton, Loading, PageFrame, PageHeader } from '../ui';

const STAT_LABEL: Record<string, string> = {
  project: 'Projects',
  scheme: 'Permission schemes',
  grant: 'Permission grants',
  role: 'Project roles',
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
  dev: 'Development',
};

export function SnapshotsView() {
  const { params, status } = useApp();
  const meta = navItem('snapshots');
  const snaps = useSnapshots();
  const take = useTakeSnapshot(snaps.reload);
  const [drawer, setDrawer] = useState<DrawerLevel[]>([]);
  const active = status.data?.active ?? snaps.data?.active ?? null;
  const latest = status.data?.latest?.seq;

  useEffect(() => {
    snaps.reload();
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

  const header = (
    <PageHeader
      title={meta.title}
      description={meta.description}
      actions={
        <>
          <Button iconBefore={RefreshIcon} onClick={snaps.reload}>
            Refresh
          </Button>
          <Button
            appearance="primary"
            isLoading={take.busy}
            isDisabled={Boolean(active)}
            onClick={() => void take.run()}
          >
            Take snapshot now
          </Button>
        </>
      }
    />
  );
  const list = snaps.data?.snapshots ?? [];
  return (
    <PageFrame header={header}>
      <div className="page-stack">
        {active ? <SnapshotProgress active={active} /> : null}
        {snaps.error && !snaps.data ? (
          <ErrorState title="Snapshots unavailable" message={snaps.error} retry={snaps.reload} />
        ) : !snaps.data ? (
          <Loading />
        ) : !list.length ? (
          <Empty
            title="No snapshots yet"
            description="A snapshot records permission schemes, roles, groups and application access at one point in time."
            action={
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
                      <div className="subtle">{relative(s.startedAt)}</div>
                    </>
                  ),
                },
                { key: 'status', content: <SnapshotLozenge status={s.status} /> },
                { key: 'trigger', content: TRIGGER[s.trigger] ?? s.trigger },
                { key: 'd', content: duration(s.startedAt, s.finishedAt) },
                {
                  key: 'size',
                  content: s.stats ? (
                    <span className="subtle">
                      {s.stats.project ?? 0} projects · {s.stats.group ?? 0} groups ·{' '}
                      {s.stats.person ?? 0} people
                    </span>
                  ) : (
                    <span className="subtle">—</span>
                  ),
                },
                {
                  key: 'cost',
                  content: (
                    <span className="subtle">
                      {s.calls} calls · {s.points.toLocaleString()} points
                    </span>
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
      </div>
      <StackDrawer
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
  const r = useCall<Snapshot & { coverage: Coverage[] }>('getSnapshot', { seq });
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
        <Loading compact />
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
      <Section
        title="What we could not see"
        description="Areas that could not be read completely in this snapshot."
      >
        <CoverageList coverage={s.coverage} />
      </Section>
      {committed ? (
        <Section
          title="Export"
          description="Access matrix: who has which permission in which project, and why."
        >
          <div>
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
          </div>
        </Section>
      ) : null}
    </DrawerBody>
  );
}
