import { useMemo, useState, type ReactNode } from 'react';
import DynamicTable from '@atlaskit/dynamic-table';
import Tabs, { Tab, TabList, TabPanel } from '@atlaskit/tabs';
import type { AccessChange, Changes, FactChange } from '../api';
import { ExportMenu, SearchField, SnapshotPicker, SubjectCell } from '../components';
import { useCall } from '../data';
import { downloadCsv, downloadPdf } from '../export/download';
import { changesCsv, changesFileName, changesPdf } from '../export/evidence';
import { permissionLabel } from '../format';
import { navItem } from '../routes';
import { exportContext, logExport, NoSnapshot, useApp, useExporter, useSnapshots } from '../shared';
import {
  Empty,
  ErrorState,
  FilterBar,
  FilterSelect,
  Loading,
  PageFrame,
  PageHeader,
  PageScroll,
  PageTabBar,
  PageTabs,
  Pill,
  ToggleField,
} from '../ui';

type Opt = { label: string; value: string };
const ALL: Opt = { label: 'All', value: '' };

function AccessTable({ rows, empty }: { rows: AccessChange[]; empty: string }) {
  return (
    <DynamicTable
      head={{
        cells: [
          { key: 'project', content: 'Project', isSortable: true },
          { key: 'who', content: 'Who', isSortable: true },
          { key: 'perm', content: 'Permission', isSortable: true },
          { key: 'why', content: 'Why' },
        ],
      }}
      rows={rows.map((c, i) => ({
        key: `${c.subject.key}-${c.project.id}-${c.permission}-${i}`,
        cells: [
          { key: c.project.key, content: <strong>{c.project.key}</strong> },
          {
            key: c.subject.name.toLowerCase(),
            content: <SubjectCell subject={c.subject} compact />,
          },
          { key: c.permission, content: permissionLabel(c.permission) },
          {
            key: 'why',
            content: (
              <span className="subtle wrap-anywhere">
                {c.reasons[0]}
                {c.reasons.length > 1 ? ` (+${c.reasons.length - 1} more)` : ''}
              </span>
            ),
          },
        ],
      }))}
      rowsPerPage={25}
      defaultPage={1}
      emptyView={<p className="subtle">{empty}</p>}
    />
  );
}

const CHANGE_TONE = { added: 'success', removed: 'danger', changed: 'warning' } as const;

function FactTable({ rows }: { rows: FactChange[] }) {
  return (
    <DynamicTable
      head={{
        cells: [
          { key: 'change', content: 'Change', isSortable: true },
          { key: 'cat', content: 'Area', isSortable: true },
          { key: 'what', content: 'What' },
          { key: 'detail', content: 'Detail' },
        ],
      }}
      rows={rows.map((f, i) => ({
        key: `${f.kind}-${i}`,
        cells: [
          { key: f.change, content: <Pill tone={CHANGE_TONE[f.change]}>{f.change}</Pill> },
          { key: f.category, content: f.category },
          { key: 'what', content: f.label },
          { key: 'detail', content: <span className="subtle wrap-anywhere">{f.detail}</span> },
        ],
      }))}
      rowsPerPage={25}
      defaultPage={1}
      emptyView={<p className="subtle">No configuration changes match.</p>}
    />
  );
}

export function ChangesView() {
  const { siteUrl, status } = useApp();
  const meta = navItem('changes');
  const snaps = useSnapshots();
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const latest = status.data?.latest?.seq ?? 0;
  const r = useCall<Changes>('getChanges', { a, b, allPermissions: all, latest });
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('');
  const [group, setGroup] = useState('');
  const [perm, setPerm] = useState('');
  const exporter = useExporter();
  const d = r.data;
  const tabbed = Boolean(d?.a && d?.b);

  const options = useMemo(() => {
    const projects = new Map<string, string>();
    const perms = new Set<string>();
    const groups = new Set<string>();
    for (const c of [...(d?.granted ?? []), ...(d?.revoked ?? [])]) {
      projects.set(c.project.id, c.project.key);
      perms.add(c.permission);
      for (const reason of c.reasons)
        for (const m of reason.matchAll(/group “([^”]+)”/g)) groups.add(m[1]);
    }
    return {
      projects: [
        ALL,
        ...[...projects]
          .map(([value, label]) => ({ value, label }))
          .sort((x, y) => x.label.localeCompare(y.label)),
      ],
      perms: [ALL, ...[...perms].sort().map((value) => ({ value, label: permissionLabel(value) }))],
      groups: [ALL, ...[...groups].sort().map((value) => ({ value, label: value }))],
    };
  }, [d]);

  const match = (c: AccessChange) =>
    (!project || c.project.id === project) &&
    (!perm || c.permission === perm) &&
    (!group || c.reasons.some((x) => x.includes(`group “${group}”`))) &&
    (!query ||
      `${c.subject.name} ${c.project.key} ${c.reasons.join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()));
  const granted = (d?.granted ?? []).filter(match);
  const revoked = (d?.revoked ?? []).filter(match);
  const facts = (d?.facts ?? []).filter(
    (f) =>
      (!project || f.projectIds.includes(project)) &&
      (!perm || f.permission === perm) &&
      (!query || `${f.label} ${f.detail}`.toLowerCase().includes(query.toLowerCase())),
  );
  const filtered: Changes | undefined = d ? { ...d, granted, revoked, facts } : undefined;

  const header = (
    <PageHeader
      flush={tabbed}
      title={meta.title}
      description={meta.description}
      actions={
        <ExportMenu
          isDisabled={!d?.a || !d?.b}
          onCsv={() =>
            void exporter('Changes CSV', () => {
              downloadCsv(
                changesFileName(filtered!, 'csv'),
                changesCsv(filtered!, exportContext(siteUrl)),
              );
              logExport('changes-csv', `#${d!.a!.seq}-#${d!.b!.seq}`);
            })
          }
          onPdf={() =>
            void exporter('Changes PDF', async () => {
              downloadPdf(
                changesFileName(filtered!, 'pdf'),
                await changesPdf(filtered!, exportContext(siteUrl)),
              );
              logExport('changes-pdf', `#${d!.a!.seq}-#${d!.b!.seq}`);
            })
          }
        />
      }
    />
  );
  const list = snaps.data?.snapshots ?? [];

  const pickers = (
    <FilterBar>
      <SnapshotPicker
        snapshots={list}
        value={a}
        onChange={setA}
        label="From"
        allowLatest={false}
        size="medium"
      />
      <span className="subtle">→</span>
      <SnapshotPicker snapshots={list} value={b} onChange={setB} label="To" size="medium" />
      <ToggleField label="All permissions" isChecked={all} onChange={() => setAll((v) => !v)} />
    </FilterBar>
  );

  if (!tabbed) {
    return (
      <PageFrame header={header}>
        <div className="page-stack">
          {pickers}
          {r.error && !d ? (
            <ErrorState title="Changes unavailable" message={r.error} retry={r.reload} />
          ) : !d ? (
            <Loading />
          ) : !d.b ? (
            <NoSnapshot what="what changed" />
          ) : (
            <Empty
              title="One snapshot so far"
              description="Changes compare two snapshots. The next scheduled or manual snapshot will show what changed since this one."
              action={null}
            />
          )}
        </div>
      </PageFrame>
    );
  }

  // Search and filters scroll with each tab's content; the snapshot pickers and tab bar stay pinned.
  const filters = (
    <FilterBar>
      <SearchField value={query} onChange={setQuery} placeholder="Search people, projects, paths" />
      {(
        [
          ['Project', options.projects, project, setProject],
          ['Group', options.groups, group, setGroup],
          ['Permission', options.perms, perm, setPerm],
        ] as Array<[string, Opt[], string, (v: string) => void]>
      ).map(([label, opts, value, set]) => (
        <FilterSelect<Opt>
          key={label}
          label={label}
          options={opts}
          value={value ? opts.find((o) => o.value === value) : null}
          onChange={(o) => set(o?.value ?? '')}
          size="narrow"
        />
      ))}
    </FilterBar>
  );
  const panel = (content: ReactNode) => (
    <TabPanel>
      <PageScroll>
        {filters}
        {content}
      </PageScroll>
    </TabPanel>
  );
  const groupFacts = facts.filter((f) => f.category === 'groups');
  const schemeFacts = facts.filter((f) => f.category === 'schemes' || f.category === 'projects');
  const peopleFacts = facts.filter((f) => f.category === 'people');

  return (
    <PageFrame header={header} fixed>
      <div className="page-pinned">
        {pickers}
        <p className="subtle">
          Comparing snapshot #{d!.a!.seq} with #{d!.b!.seq} ·{' '}
          {all
            ? 'all permissions'
            : `key permissions: ${d!.keyPermissions.map(permissionLabel).join(', ')}`}
        </p>
      </div>
      <PageTabs>
        <Tabs id="changes-tabs">
          <PageTabBar>
            <TabList>
              <Tab>Granted ({granted.length})</Tab>
              <Tab>Revoked ({revoked.length})</Tab>
              <Tab>Groups ({groupFacts.length})</Tab>
              <Tab>Schemes & roles ({schemeFacts.length})</Tab>
              <Tab>People ({peopleFacts.length})</Tab>
            </TabList>
          </PageTabBar>
          {panel(<AccessTable rows={granted} empty="No access was granted." />)}
          {panel(<AccessTable rows={revoked} empty="No access was revoked." />)}
          {panel(<FactTable rows={groupFacts} />)}
          {panel(<FactTable rows={schemeFacts} />)}
          {panel(<FactTable rows={peopleFacts} />)}
        </Tabs>
      </PageTabs>
    </PageFrame>
  );
}
