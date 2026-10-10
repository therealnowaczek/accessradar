import { useMemo, useState } from 'react';
import DynamicTable from '@atlaskit/dynamic-table';
import type { GroupDetail, GroupRow, SettingsView, WithSnapshot } from '../api';
import { ReasonList, SearchField, Section, SnapshotPicker, SubjectCell } from '../components';
import { useCall } from '../data';
import { DrawerBody, StackDrawer, type DrawerLevel } from '../Drawer';
import { permissionLabel, plural } from '../format';
import { navItem } from '../routes';
import { NoSnapshot, PartialBanner, useApp, useSnapshots } from '../shared';
import {
  ErrorState,
  FilterBar,
  FilterSelect,
  LinkButton,
  Loading,
  PageFrame,
  PageHeader,
  Pill,
} from '../ui';

type Opt = { label: string; value: string };
const FILTERS: Opt[] = [
  { label: 'All groups', value: 'all' },
  { label: 'Used in projects', value: 'used' },
  { label: 'Admin access', value: 'admin' },
  { label: 'Application access', value: 'app-access' },
  { label: 'Large groups', value: 'large' },
  { label: 'Members not read', value: 'unread' },
];

const ACCESS_LABEL: Record<string, string> = {
  admin: 'Jira admin',
  'site-admin': 'Site admin',
  user: 'Product user',
};

export function GroupsView() {
  const { params, go, status } = useApp();
  const meta = navItem('explore-groups');
  const [seq, setSeq] = useState<number | null>(null);
  const snaps = useSnapshots();
  const latest = status.data?.latest?.seq ?? 0;
  const list = useCall<WithSnapshot<GroupRow[]>>('exploreGroups', { seq, latest });
  const settings = useCall<SettingsView>('getSettings');
  const large = settings.data?.settings.largeGroupThreshold ?? 50;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(params.filter ?? 'all');
  const [drawer, setDrawer] = useState<DrawerLevel[]>([]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list.data?.data ?? []).filter(
      (g) =>
        (!q || g.name.toLowerCase().includes(q)) &&
        (filter === 'all' ||
          (filter === 'used' && g.projects > 0) ||
          (filter === 'admin' && g.access.some((a) => a !== 'user')) ||
          (filter === 'app-access' && g.applications.length > 0) ||
          (filter === 'large' && (g.members ?? 0) >= large) ||
          (filter === 'unread' && g.membersStatus !== 'collected')),
    );
  }, [list.data, query, filter, large]);

  const open = (g: GroupRow) =>
    setDrawer([
      {
        key: g.id,
        title: g.name,
        description: 'Group',
        content: <GroupDrawer groupId={g.id} seq={seq} />,
      },
    ]);

  const snapshot = list.data?.snapshot ?? null;
  return (
    <PageFrame header={<PageHeader title={meta.title} description={meta.description} />}>
      <div className="page-stack">
        {list.error && !list.data ? (
          <ErrorState title="Groups unavailable" message={list.error} retry={list.reload} />
        ) : !list.data ? (
          <Loading />
        ) : !snapshot ? (
          <NoSnapshot what="where each group reaches" />
        ) : (
          <>
            <PartialBanner
              snapshot={snapshot}
              onDetails={() => go('snapshots', { seq: String(snapshot.seq) })}
            />
            <FilterBar>
              <SearchField value={query} onChange={setQuery} placeholder="Search groups" />
              <FilterSelect<Opt>
                label="Filter groups"
                options={FILTERS}
                value={FILTERS.find((f) => f.value === filter)}
                onChange={(o) => setFilter(o?.value ?? 'all')}
              />
              <SnapshotPicker
                snapshots={snaps.data?.snapshots ?? []}
                value={seq}
                onChange={setSeq}
              />
            </FilterBar>
            <DynamicTable
              head={{
                cells: [
                  { key: 'name', content: 'Group', isSortable: true },
                  { key: 'members', content: 'Members', isSortable: true },
                  { key: 'access', content: 'Access' },
                  { key: 'projects', content: 'Projects reached', isSortable: true },
                  { key: 'grants', content: 'Direct grants', isSortable: true },
                ],
              }}
              rows={rows.map((g) => ({
                key: g.id,
                cells: [
                  {
                    key: g.name.toLowerCase(),
                    content: <LinkButton onClick={() => open(g)}>{g.name}</LinkButton>,
                  },
                  {
                    key: g.members ?? -1,
                    content:
                      g.membersStatus === 'collected' ? (
                        <span className="status-row tight">
                          {g.members}
                          {g.inactiveMembers ? (
                            <span className="subtle">({g.inactiveMembers} inactive)</span>
                          ) : null}
                          {(g.members ?? 0) >= large ? <Pill tone="warning">Large</Pill> : null}
                        </span>
                      ) : (
                        <Pill tone="warning">
                          {g.membersStatus === 'not-collected'
                            ? 'Not read (not used)'
                            : 'Not readable'}
                        </Pill>
                      ),
                  },
                  {
                    key: 'access',
                    content: (
                      <span className="chip-row">
                        {g.access
                          .filter((a) => a !== 'user')
                          .map((a) => (
                            <Pill key={a} tone="danger">
                              {ACCESS_LABEL[a] ?? a}
                            </Pill>
                          ))}
                        {g.applications.map((a) => (
                          <Pill key={a} tone="info">
                            {a}
                          </Pill>
                        ))}
                      </span>
                    ),
                  },
                  { key: g.projects, content: g.projects },
                  { key: g.grants, content: g.grants },
                ],
              }))}
              rowsPerPage={25}
              defaultPage={1}
              defaultSortKey="name"
              defaultSortOrder="ASC"
              emptyView={<p className="subtle">No groups match.</p>}
            />
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

function GroupDrawer({ groupId, seq }: { groupId: string; seq: number | null }) {
  const { go } = useApp();
  const r = useCall<WithSnapshot<GroupDetail>>('groupDetail', { groupId, seq });
  if (r.error && !r.data)
    return (
      <DrawerBody>
        <ErrorState title="Group unavailable" message={r.error} retry={r.reload} />
      </DrawerBody>
    );
  const g = r.data?.data;
  if (!g)
    return (
      <DrawerBody>
        <Loading compact />
      </DrawerBody>
    );
  return (
    <DrawerBody>
      <Section title="Access" description="Application and administration access from this group.">
        {g.access.length || g.applications.length ? (
          <span className="chip-row">
            {g.access.map((a) => (
              <Pill key={a} tone={a === 'user' ? 'neutral' : 'danger'}>
                {ACCESS_LABEL[a] ?? a}
              </Pill>
            ))}
            {g.applications.map((a) => (
              <Pill key={a} tone="info">
                {a}
              </Pill>
            ))}
          </span>
        ) : (
          <p className="subtle">No application or admin access.</p>
        )}
      </Section>
      <Section title="Projects" description="Where membership of this group grants access.">
        {g.usage.length ? (
          <ul className="reason-list">
            {g.usage.map((u) => (
              <li key={u.project.id}>
                <LinkButton onClick={() => go('explore-projects', { projectId: u.project.id })}>
                  {u.project.key} · {u.project.name}
                </LinkButton>
                <ReasonList
                  perms={Object.fromEntries(u.permissions.map((p) => [p.permission, p.reasons]))}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="subtle">This group grants no project permissions.</p>
        )}
      </Section>
      {g.schemeGrants.length || g.roles.length ? (
        <Section title="Configuration" description="Scheme grants and project role memberships.">
          <ul className="plain-list">
            {g.schemeGrants.map((s, i) => (
              <li key={`s${i}`}>
                Scheme “{s.scheme}” grants {permissionLabel(s.permission)}
              </li>
            ))}
            {g.roles.map((x) => (
              <li key={`r${x.projectId}-${x.roleId}`}>
                Role “{x.roleName}” in {x.project.key}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section
        title={`Members${g.membersStatus === 'collected' ? ` (${g.members.length})` : ''}`}
        description={
          g.membersStatus === 'collected'
            ? undefined
            : 'Members of this group were not read in this snapshot.'
        }
      >
        {g.membersStatus === 'collected' ? (
          g.members.length ? (
            <ul className="plain-list">
              {g.members.slice(0, 500).map((m) => (
                <li key={m.key}>
                  <SubjectCell
                    subject={m}
                    compact
                    onSelect={() => go('explore-people', { accountId: m.id })}
                  />
                </li>
              ))}
              {g.members.length > 500 ? (
                <li className="subtle">{plural(g.members.length - 500, 'more member')}</li>
              ) : null}
            </ul>
          ) : (
            <p className="subtle">This group has no members.</p>
          )
        ) : null}
      </Section>
    </DrawerBody>
  );
}
