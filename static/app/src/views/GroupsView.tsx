import { t } from '../i18n';
import { useMemo, useState } from 'react';
import { Inline, Stack, Text } from '@atlaskit/primitives';
import DynamicTable from '../Table';
import type { GroupDetail, GroupRow, SettingsView, WithSnapshot } from '../api';
import { ReasonList, SearchField, Section, SnapshotPicker, SubjectCell } from '../components';
import { useCall } from '../data';
import { DrawerBody, LevelDrawer, type DrawerLevel } from '../Drawer';
import { permissionLabel, plural } from '../format';
import { navItem } from '../routes';
import { NoSnapshot, PartialBanner, useApp, useSnapshots } from '../shared';
import {
  ErrorState,
  FilterBar,
  FilterSelect,
  LinkButton,
  PageFrame,
  PageHeader,
  Pill,
  DividedListItem,
  DividedList,
  staleNotice,
} from '../ui';
import { FilterBarPhantom, LinesPhantom, Phantom, SkeletonRoot } from '../skeletons';
import { SkeletonTable } from '../skeletonTable';

type Opt = { label: string; value: string };
const FILTERS: Opt[] = [
  {
    get label() {
      return t('groups.allGroups');
    },
    value: 'all',
  },
  {
    get label() {
      return t('groups.usedInSpaces');
    },
    value: 'used',
  },
  {
    get label() {
      return t('groups.adminAccess');
    },
    value: 'admin',
  },
  {
    get label() {
      return t('groups.applicationAccess');
    },
    value: 'app-access',
  },
  {
    get label() {
      return t('groups.largeGroups');
    },
    value: 'large',
  },
  {
    get label() {
      return t('groups.membersNotRead');
    },
    value: 'unread',
  },
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
        description: t('groups.group'),
        content: <GroupDrawer groupId={g.id} seq={seq} />,
      },
    ]);

  const snapshot = list.data?.snapshot ?? null;
  return (
    <PageFrame
      notice={staleNotice(list)}
      header={<PageHeader title={meta.title} description={meta.description} />}
    >
      <Stack space="space.300">
        {list.error && !list.data ? (
          <ErrorState
            title={t('groups.groupsUnavailable')}
            message={list.error}
            retry={list.reload}
          />
        ) : !list.data ? (
          <SkeletonRoot>
            <FilterBarPhantom controls={3} />
            <SkeletonTable
              columns={[
                t('groups.group'),
                t('groups.members'),
                t('groups.access'),
                t('groups.spacesReached'),
                t('groups.directGrants'),
              ]}
            />
          </SkeletonRoot>
        ) : !snapshot ? (
          <NoSnapshot what={t('groups.whereEachGroupReaches')} />
        ) : (
          <>
            <PartialBanner
              snapshot={snapshot}
              onDetails={() => go('snapshots', { seq: String(snapshot.seq) })}
            />
            <FilterBar>
              <SearchField value={query} onChange={setQuery} label={t('groups.searchGroups')} />
              <FilterSelect<Opt>
                label={t('groups.filterGroups')}
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
                  { key: 'name', content: t('groups.group'), isSortable: true },
                  { key: 'members', content: t('groups.members'), isSortable: true },
                  { key: 'access', content: t('groups.access') },
                  { key: 'projects', content: t('groups.spacesReached'), isSortable: true },
                  { key: 'grants', content: t('groups.directGrants'), isSortable: true },
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
                        <Inline as="span" space="space.075" alignBlock="center" shouldWrap>
                          {g.members}
                          {g.inactiveMembers ? (
                            <Text color="color.text.subtle">({g.inactiveMembers} inactive)</Text>
                          ) : null}
                          {(g.members ?? 0) >= large ? (
                            <Pill tone="warning">{t('groups.large')}</Pill>
                          ) : null}
                        </Inline>
                      ) : (
                        <Pill tone="warning">
                          {g.membersStatus === 'not-collected'
                            ? t('groups.notReadNotUsed')
                            : t('groups.notReadable')}
                        </Pill>
                      ),
                  },
                  {
                    key: 'access',
                    content: (
                      <Inline as="span" space="space.050" shouldWrap>
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
                      </Inline>
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
              emptyView={
                <Text as="p" color="color.text.subtle">
                  {t('groups.noGroupsMatch')}
                </Text>
              }
            />
          </>
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

function GroupDrawer({ groupId, seq }: { groupId: string; seq: number | null }) {
  const { go } = useApp();
  const r = useCall<WithSnapshot<GroupDetail>>('groupDetail', { groupId, seq });
  if (r.error && !r.data)
    return (
      <DrawerBody>
        <ErrorState title={t('groups.groupUnavailable')} message={r.error} retry={r.reload} />
      </DrawerBody>
    );
  const g = r.data?.data;
  if (!g)
    return (
      <DrawerBody>
        {/* The loaded level's own sections with placeholder content (R-10.1). */}
        <SkeletonRoot>
          <Section
            title={t('groups.access')}
            description={t('groups.applicationAndAdministrationAccessFromThis')}
          >
            <Phantom width={160} height={20} radius="full" />
          </Section>
          <Section
            title={t('campaigns.spaces')}
            description={t('groups.whereMembershipOfThisGroupGrants')}
          >
            <LinesPhantom lines={4} />
          </Section>
          <Section title={t('groups.members')}>
            <LinesPhantom lines={4} />
          </Section>
        </SkeletonRoot>
      </DrawerBody>
    );
  return (
    <DrawerBody>
      <Section
        title={t('groups.access')}
        description={t('groups.applicationAndAdministrationAccessFromThis')}
      >
        {g.access.length || g.applications.length ? (
          <Inline as="span" space="space.050" shouldWrap>
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
          </Inline>
        ) : (
          <Text as="p" color="color.text.subtle">
            {t('groups.noApplicationOrAdminAccess')}
          </Text>
        )}
      </Section>
      <Section
        title={t('campaigns.spaces')}
        description={t('groups.whereMembershipOfThisGroupGrants')}
      >
        {g.usage.length ? (
          <DividedList>
            {g.usage.map((u) => (
              <DividedListItem key={u.project.id} loose>
                {/* Inline keeps the link at its own width on the left (a Stack child stretches and centres it). */}
                <Inline>
                  <LinkButton onClick={() => go('explore-projects', { projectId: u.project.id })}>
                    {u.project.key} · {u.project.name}
                  </LinkButton>
                </Inline>
                <ReasonList
                  perms={Object.fromEntries(u.permissions.map((p) => [p.permission, p.reasons]))}
                />
              </DividedListItem>
            ))}
          </DividedList>
        ) : (
          <Text as="p" color="color.text.subtle">
            {t('groups.thisGroupGrantsNoSpacePermissions')}
          </Text>
        )}
      </Section>
      {g.schemeGrants.length || g.roles.length ? (
        <Section
          title={t('groups.configuration')}
          description={t('groups.schemeGrantsAndSpaceRoleMemberships')}
        >
          <DividedList>
            {g.schemeGrants.map((s, i) => (
              <DividedListItem key={`s${i}`}>
                Scheme “{s.scheme}” grants {permissionLabel(s.permission)}
              </DividedListItem>
            ))}
            {g.roles.map((x) => (
              <DividedListItem key={`r${x.projectId}-${x.roleId}`}>
                Role “{x.roleName}” in {x.project.key}
              </DividedListItem>
            ))}
          </DividedList>
        </Section>
      ) : null}
      <Section
        title={`Members${g.membersStatus === 'collected' ? ` (${g.members.length})` : ''}`}
        description={
          g.membersStatus === 'collected' ? undefined : t('groups.membersOfThisGroupWereNot')
        }
      >
        {g.membersStatus === 'collected' ? (
          g.members.length ? (
            <DividedList>
              {g.members.slice(0, 500).map((m) => (
                <DividedListItem key={m.key}>
                  <SubjectCell
                    subject={m}
                    compact
                    onSelect={() => go('explore-people', { accountId: m.id })}
                  />
                </DividedListItem>
              ))}
              {g.members.length > 500 ? (
                <DividedListItem>
                  <Text color="color.text.subtle">
                    {plural(g.members.length - 500, 'more member')}
                  </Text>
                </DividedListItem>
              ) : null}
            </DividedList>
          ) : (
            <Text as="p" color="color.text.subtle">
              {t('groups.thisGroupHasNoMembers')}
            </Text>
          )
        ) : null}
      </Section>
    </DrawerBody>
  );
}
