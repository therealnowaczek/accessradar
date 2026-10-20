import { useEffect, useMemo, useState } from 'react';
import { Inline, Stack, Text } from '@atlaskit/primitives';
import Button from '@atlaskit/button/new';
import DynamicTable from '../Table';
import {
  call,
  errorText,
  type PersonAccess,
  type PersonRow,
  type SettingsView,
  type WithSnapshot,
} from '../api';
import { ReasonList, SearchField, Section, SnapshotPicker, SubjectCell, Hash } from '../components';
import { useCall } from '../data';
import { DrawerBody, StackDrawer, type DrawerLevel } from '../Drawer';
import { formatLocal, permissionLabel, plural } from '../format';
import { navItem } from '../routes';
import { NoSnapshot, PartialBanner, useApp, useSnapshots } from '../shared';
import {
  Details,
  ErrorState,
  FilterBar,
  FilterSelect,
  LinkButton,
  Loading,
  PageFrame,
  PageHeader,
  Pill,
  ToggleField,
  DividedListItem,
  DividedList,
} from '../ui';

type Opt = { label: string; value: string };
const FILTERS: Opt[] = [
  { label: 'Everyone', value: 'all' },
  { label: 'With space access', value: 'access' },
  { label: 'Inactive with access', value: 'inactive' },
  { label: 'Jira administrators', value: 'admins' },
  { label: 'Admin of several spaces', value: 'project-admins' },
];

export function PeopleView() {
  const { params, go, status } = useApp();
  const meta = navItem('explore-people');
  const [seq, setSeq] = useState<number | null>(null);
  const snaps = useSnapshots();
  const latest = status.data?.latest?.seq ?? 0;
  const list = useCall<WithSnapshot<PersonRow[]>>('explorePeople', { seq, latest });
  const settings = useCall<SettingsView>('getSettings');
  const wide = settings.data?.settings.wideAdminProjects ?? 3;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(params.filter ?? 'all');
  const [showApps, setShowApps] = useState(false);
  const [drawer, setDrawer] = useState<DrawerLevel[]>([]);

  const open = (accountId: string, name: string) =>
    setDrawer([
      {
        key: accountId,
        title: name,
        description: 'What this person can do, and why',
        content: <PersonDrawer accountId={accountId} seq={seq} />,
      },
    ]);

  useEffect(() => {
    if (params.accountId) open(params.accountId, 'Person');
    // open once when navigated here with a person
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list.data?.data ?? []).filter(
      (p) =>
        (showApps || p.accountType === 'atlassian') &&
        (!q || p.name.toLowerCase().includes(q) || p.accountId.toLowerCase() === q) &&
        (filter === 'all' ||
          (filter === 'access' && p.projects > 0) ||
          (filter === 'inactive' && !p.active && (p.projects > 0 || p.groups > 0)) ||
          (filter === 'admins' && p.jiraAdmin) ||
          (filter === 'project-admins' && p.adminProjects >= wide)),
    );
  }, [list.data, query, filter, showApps, wide]);

  const snapshot = list.data?.snapshot ?? null;
  return (
    <PageFrame header={<PageHeader title={meta.title} description={meta.description} />}>
      <Stack space="space.300">
        {list.error && !list.data ? (
          <ErrorState title="People unavailable" message={list.error} retry={list.reload} />
        ) : !list.data ? (
          <Loading />
        ) : !snapshot ? (
          <NoSnapshot what="what each person can do" />
        ) : (
          <>
            <PartialBanner
              snapshot={snapshot}
              onDetails={() => go('snapshots', { seq: String(snapshot.seq) })}
            />
            <FilterBar>
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Search by name or account ID"
              />
              <FilterSelect<Opt>
                label="Filter people"
                options={FILTERS}
                value={FILTERS.find((f) => f.value === filter)}
                onChange={(o) => setFilter(o?.value ?? 'all')}
              />
              <ToggleField label="Show app accounts" isChecked={showApps} onChange={setShowApps} />
              <SnapshotPicker
                snapshots={snaps.data?.snapshots ?? []}
                value={seq}
                onChange={setSeq}
              />
            </FilterBar>
            <DynamicTable
              head={{
                cells: [
                  { key: 'name', content: 'Person', isSortable: true },
                  { key: 'projects', content: 'Spaces', isSortable: true },
                  { key: 'admin', content: 'Admin of', isSortable: true },
                  { key: 'groups', content: 'Groups', isSortable: true },
                  { key: 'flags', content: '' },
                ],
              }}
              rows={rows.map((p) => ({
                key: p.accountId,
                cells: [
                  {
                    key: p.name.toLowerCase(),
                    content: (
                      <SubjectCell
                        subject={{
                          key: p.accountId,
                          type: 'user',
                          id: p.accountId,
                          name: p.name,
                          accountType: p.accountType,
                          active: p.active,
                        }}
                        compact
                        onSelect={() => open(p.accountId, p.name)}
                      />
                    ),
                  },
                  { key: p.projects, content: p.projects },
                  {
                    key: p.adminProjects,
                    content: p.adminProjects ? (
                      plural(p.adminProjects, 'space')
                    ) : (
                      <Text color="color.text.subtle">—</Text>
                    ),
                  },
                  { key: p.groups, content: p.groups },
                  {
                    key: 'flags',
                    content: p.jiraAdmin ? <Pill tone="danger">Jira admin</Pill> : null,
                  },
                ],
              }))}
              rowsPerPage={25}
              defaultPage={1}
              defaultSortKey="name"
              defaultSortOrder="ASC"
              emptyView={
                <Text as="p" color="color.text.subtle">
                  Nobody matches.
                </Text>
              }
            />
          </>
        )}
      </Stack>
      <StackDrawer
        levels={drawer}
        onBack={() => setDrawer((l) => l.slice(0, -1))}
        onClose={() => setDrawer([])}
      />
    </PageFrame>
  );
}

type GlobalCheck = { checked: string[]; granted: string[]; at: number };

function PersonDrawer({ accountId, seq }: { accountId: string; seq: number | null }) {
  const { go } = useApp();
  const r = useCall<WithSnapshot<PersonAccess>>('personAccess', { accountId, seq });
  const [global, setGlobal] = useState<{ busy: boolean; data?: GlobalCheck; error?: string }>({
    busy: false,
  });
  const check = async () => {
    setGlobal({ busy: true });
    try {
      setGlobal({ busy: false, data: await call<GlobalCheck>('globalPermissions', { accountId }) });
    } catch (e) {
      setGlobal({ busy: false, error: errorText(e) });
    }
  };
  if (r.error && !r.data)
    return (
      <DrawerBody>
        <ErrorState title="Person unavailable" message={r.error} retry={r.reload} />
      </DrawerBody>
    );
  const d = r.data?.data;
  if (!d)
    return (
      <DrawerBody>
        <Loading compact />
      </DrawerBody>
    );
  return (
    <DrawerBody>
      <SubjectCell subject={d.person} />
      <Details
        rows={[
          ['Account ID', <Hash key="id" value={d.person.id} />],
          ['Account type', d.person.accountType ?? 'unknown'],
          ['Status', d.person.active === false ? <Pill tone="danger">Inactive</Pill> : 'Active'],
          [
            'Jira administrator',
            d.adminVia.length
              ? `Yes, via ${d.adminVia.join(', ')}`
              : 'Not via groups (see live check)',
          ],
        ]}
      />
      <Section
        title="Global permissions"
        description="Jira cannot list global permission holders, so this is checked live for this person."
        action={
          <Button isLoading={global.busy} onClick={() => void check()}>
            Check now
          </Button>
        }
      >
        {global.error ? (
          <Text as="p" color="color.text.danger">
            {global.error}
          </Text>
        ) : null}
        {global.data ? (
          <DividedList>
            {global.data.checked.map((p) => (
              <DividedListItem key={p}>
                {global.data!.granted.includes(p) ? (
                  <Pill tone="warning">Granted</Pill>
                ) : (
                  <Pill>No</Pill>
                )}
                {permissionLabel(p)}
              </DividedListItem>
            ))}
            <DividedListItem>
              <Text color="color.text.subtle">Checked {formatLocal(global.data.at)}</Text>
            </DividedListItem>
          </DividedList>
        ) : null}
      </Section>
      {d.changes && (d.changes.granted.length || d.changes.revoked.length) ? (
        <Section title="Changes" description={`Since snapshot #${d.changes.fromSeq}`}>
          <DividedList>
            {d.changes.granted.map((c, i) => (
              <DividedListItem key={`g${i}`}>
                <Pill tone="success">Granted</Pill>
                {permissionLabel(c.permission)} in {c.project.key}
                <Text color="color.text.subtle"> — {c.reasons[0]}</Text>
              </DividedListItem>
            ))}
            {d.changes.revoked.map((c, i) => (
              <DividedListItem key={`r${i}`}>
                <Pill tone="danger">Revoked</Pill>
                {permissionLabel(c.permission)} in {c.project.key}
              </DividedListItem>
            ))}
          </DividedList>
        </Section>
      ) : null}
      <Section title={`Groups (${d.groups.length})`}>
        {d.groups.length ? (
          <Inline as="span" space="space.050" shouldWrap>
            {d.groups.map((g) => (
              <Pill key={g.id} tone={g.access.some((a) => a !== 'user') ? 'danger' : 'neutral'}>
                {g.name}
              </Pill>
            ))}
          </Inline>
        ) : (
          <Text as="p" color="color.text.subtle">
            Not a member of any group.
          </Text>
        )}
      </Section>
      <Section
        title={`Spaces (${d.projects.length})`}
        description="Permissions in each space, with the path that grants them."
      >
        {d.projects.length ? (
          <DividedList>
            {d.projects.map((p) => (
              <DividedListItem key={p.project.id} loose>
                {/* Inline keeps the link at its own width on the left (a Stack child stretches and centres it). */}
                <Inline>
                  <LinkButton onClick={() => go('explore-projects', { projectId: p.project.id })}>
                    {p.project.key} · {p.project.name}
                  </LinkButton>
                </Inline>
                <ReasonList perms={p.perms} keyPermissions={d.keyPermissions} />
              </DividedListItem>
            ))}
          </DividedList>
        ) : (
          <Text as="p" color="color.text.subtle">
            No space access.
          </Text>
        )}
      </Section>
    </DrawerBody>
  );
}
