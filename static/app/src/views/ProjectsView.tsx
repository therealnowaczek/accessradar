import { useMemo, useState } from 'react';
import Button from '@atlaskit/button/new';
import DynamicTable from '@atlaskit/dynamic-table';
import ArrowLeftIcon from '@atlaskit/icon/core/arrow-left';
import Lozenge from '@atlaskit/lozenge';
import Select from '@atlaskit/select';
import Toggle from '@atlaskit/toggle';
import type {
  ProjectAccess,
  ProjectRow,
  Reason,
  SettingsView,
  SubjectView,
  WithSnapshot,
} from '../api';
import {
  ExportMenu,
  ReasonList,
  SearchField,
  SnapshotPicker,
  SubjectCell,
  ViaChips,
} from '../components';
import { useCall } from '../data';
import { DrawerBody, StackDrawer, type DrawerLevel } from '../Drawer';
import { exportMatrix } from '../export/actions';
import { permissionLabel } from '../format';
import { navItem } from '../routes';
import {
  exportContext,
  NoSnapshot,
  PartialBanner,
  useApp,
  useExporter,
  useSnapshots,
} from '../shared';
import { ErrorState, FilterBar, Loading, PageFrame, PageHeader, Pill } from '../ui';

type Opt = { label: string; value: string };
const FILTERS: Opt[] = [
  { label: 'All projects', value: 'all' },
  { label: 'Anonymous access', value: 'anonymous' },
  { label: 'Company-managed', value: 'company' },
  { label: 'Team-managed', value: 'team' },
  { label: 'Groups with unknown members', value: 'unexpanded' },
];

export function ProjectsView() {
  const { params, go, siteUrl, status } = useApp();
  const meta = navItem('explore-projects');
  const [seq, setSeq] = useState<number | null>(params.seq ? Number(params.seq) : null);
  const snaps = useSnapshots();
  const latest = status.data?.latest?.seq ?? 0;
  const list = useCall<WithSnapshot<ProjectRow[]>>('exploreProjects', { seq, latest });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(params.filter ?? 'all');
  const exporter = useExporter();
  const projectId = params.projectId;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list.data?.data ?? []).filter(
      (p) =>
        (!q || p.key.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) &&
        (filter === 'all' ||
          (filter === 'anonymous' && p.anonymous) ||
          (filter === 'unexpanded' && p.unexpanded > 0) ||
          p.style === filter),
    );
  }, [list.data, query, filter]);

  if (projectId)
    return (
      <ProjectDetail
        projectId={projectId}
        seq={seq}
        onBack={() => go('explore-projects', seq ? { seq: String(seq) } : {})}
      />
    );

  const snapshot = list.data?.snapshot ?? null;
  const header = (
    <PageHeader
      title={meta.title}
      description={meta.description}
      actions={
        <ExportMenu
          label="Export access matrix"
          isDisabled={!snapshot}
          onCsv={() =>
            void exporter('Access matrix CSV', () =>
              exportMatrix('csv', snapshot?.seq ?? null, exportContext(siteUrl)),
            )
          }
          onPdf={() =>
            void exporter('Access matrix PDF', () =>
              exportMatrix('pdf', snapshot?.seq ?? null, exportContext(siteUrl)),
            )
          }
        />
      }
    />
  );
  return (
    <PageFrame header={header}>
      <div className="page-stack">
        {list.error && !list.data ? (
          <ErrorState title="Projects unavailable" message={list.error} retry={list.reload} />
        ) : !list.data ? (
          <Loading />
        ) : !snapshot ? (
          <NoSnapshot what="who has access to each project" />
        ) : (
          <>
            <PartialBanner
              snapshot={snapshot}
              onDetails={() => go('snapshots', { seq: String(snapshot.seq) })}
            />
            <FilterBar>
              <SearchField value={query} onChange={setQuery} placeholder="Search projects" />
              <div style={{ width: 240 }}>
                <Select<Opt>
                  aria-label="Filter projects"
                  options={FILTERS}
                  value={FILTERS.find((f) => f.value === filter)}
                  onChange={(o) => setFilter(o?.value ?? 'all')}
                  spacing="compact"
                  isSearchable={false}
                />
              </div>
              <SnapshotPicker
                snapshots={snaps.data?.snapshots ?? []}
                value={seq}
                onChange={setSeq}
              />
            </FilterBar>
            <DynamicTable
              head={{
                cells: [
                  { key: 'key', content: 'Project', isSortable: true },
                  { key: 'style', content: 'Type', isSortable: true },
                  { key: 'scheme', content: 'Permission scheme', isSortable: true },
                  { key: 'people', content: 'People with access', isSortable: true },
                  { key: 'admins', content: 'Project admins', isSortable: true },
                  { key: 'flags', content: 'Flags' },
                ],
              }}
              rows={rows.map((p) => ({
                key: p.id,
                cells: [
                  {
                    key: p.key,
                    content: (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() =>
                          go('explore-projects', {
                            projectId: p.id,
                            ...(seq ? { seq: String(seq) } : {}),
                          })
                        }
                      >
                        <strong>{p.key}</strong> {p.name}
                      </button>
                    ),
                  },
                  {
                    key: p.style,
                    content: p.style === 'team' ? 'Team-managed' : 'Company-managed',
                  },
                  {
                    key: p.schemeName ?? '',
                    content: p.schemeName ?? <span className="subtle">Per-project</span>,
                  },
                  {
                    key: p.people,
                    content: `${p.people}${p.appAccounts ? ` (+${p.appAccounts} apps)` : ''}`,
                  },
                  { key: p.admins, content: p.admins },
                  {
                    key: 'flags',
                    content: (
                      <span className="chip-row">
                        {p.anonymous ? <Lozenge appearance="removed">Anonymous</Lozenge> : null}
                        {p.unexpanded ? (
                          <Pill tone="warning">{p.unexpanded} unread groups</Pill>
                        ) : null}
                        {p.conditional ? <Pill tone="discovery">Issue-dependent</Pill> : null}
                      </span>
                    ),
                  },
                ],
              }))}
              rowsPerPage={25}
              defaultPage={1}
              defaultSortKey="key"
              defaultSortOrder="ASC"
              emptyView={<p className="subtle">No projects match.</p>}
            />
          </>
        )}
      </div>
    </PageFrame>
  );
}

function ProjectDetail({
  projectId,
  seq,
  onBack,
}: {
  projectId: string;
  seq: number | null;
  onBack: () => void;
}) {
  const { siteUrl } = useApp();
  const detail = useCall<WithSnapshot<ProjectAccess>>('projectAccess', { projectId, seq });
  const [showApps, setShowApps] = useState(false);
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState<DrawerLevel[]>([]);
  const exporter = useExporter();
  const settings = useCall<SettingsView>('getSettings');
  const d = detail.data?.data;
  const keyPerms = settings.data?.settings.keyPermissions ?? [
    'BROWSE_PROJECTS',
    'ADMINISTER_PROJECTS',
  ];
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (d?.rows ?? []).filter(
      (r) =>
        (showApps || r.subject.type !== 'user' || r.subject.accountType === 'atlassian') &&
        (!q || r.subject.name.toLowerCase().includes(q)),
    );
  }, [d, query, showApps]);
  const why = (subject: SubjectView, perms: Record<string, Reason[]>) =>
    setDrawer([
      {
        key: subject.key,
        title: subject.name,
        description: `Why ${subject.type === 'group' ? 'this group has' : 'they have'} access to ${d?.project.key}`,
        content: (
          <DrawerBody>
            <SubjectCell subject={subject} />
            <ReasonList perms={perms} keyPermissions={keyPerms} />
          </DrawerBody>
        ),
      },
    ]);
  const header = (
    <PageHeader
      title={d ? `${d.project.key} · ${d.project.name}` : 'Project'}
      description={
        d
          ? `${d.project.style === 'team' ? 'Team-managed' : 'Company-managed'} · ${d.project.schemeName ?? 'per-project permissions'}`
          : undefined
      }
      actions={
        <>
          <Button iconBefore={ArrowLeftIcon} onClick={onBack}>
            All projects
          </Button>
          <ExportMenu
            isDisabled={!d}
            onCsv={() =>
              void exporter('Project access CSV', () =>
                exportMatrix(
                  'csv',
                  detail.data?.snapshot?.seq ?? null,
                  exportContext(siteUrl),
                  d?.project.key,
                ),
              )
            }
            onPdf={() =>
              void exporter('Project access PDF', () =>
                exportMatrix(
                  'pdf',
                  detail.data?.snapshot?.seq ?? null,
                  exportContext(siteUrl),
                  d?.project.key,
                ),
              )
            }
          />
        </>
      }
    />
  );
  return (
    <PageFrame header={header}>
      <div className="page-stack">
        {detail.error && !detail.data ? (
          <ErrorState title="Project unavailable" message={detail.error} retry={detail.reload} />
        ) : !d ? (
          <Loading />
        ) : (
          <>
            <PartialBanner snapshot={detail.data?.snapshot ?? null} />
            <FilterBar>
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Search people and groups"
              />
              <label className="choice-label">
                <Toggle
                  isChecked={showApps}
                  onChange={() => setShowApps((v) => !v)}
                  label="Show app accounts"
                />
                Show app accounts
              </label>
            </FilterBar>
            <div className="table-wrap">
              <DynamicTable
                head={{
                  cells: [
                    { key: 'who', content: 'Who', isSortable: true },
                    ...keyPerms.map((perm) => ({ key: perm, content: permissionLabel(perm) })),
                    { key: 'all', content: 'All permissions', isSortable: true },
                    { key: 'via', content: 'Through' },
                    { key: 'why', content: '' },
                  ],
                }}
                rows={rows.map((r) => {
                  const all = Object.values(r.perms).flat();
                  return {
                    key: r.subject.key,
                    cells: [
                      { key: r.subject.name, content: <SubjectCell subject={r.subject} compact /> },
                      ...keyPerms.map((perm) => ({
                        key: perm,
                        content: r.perms[perm] ? (
                          <span className="perm-cell">✓</span>
                        ) : (
                          <span className="subtle">—</span>
                        ),
                      })),
                      { key: Object.keys(r.perms).length, content: Object.keys(r.perms).length },
                      { key: 'via', content: <ViaChips reasons={all} /> },
                      {
                        key: 'why',
                        content: (
                          <Button appearance="subtle" onClick={() => why(r.subject, r.perms)}>
                            Why?
                          </Button>
                        ),
                      },
                    ],
                  };
                })}
                rowsPerPage={25}
                defaultPage={1}
                emptyView={
                  <p className="subtle">Nobody has access to this project in this snapshot.</p>
                }
              />
            </div>
          </>
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
