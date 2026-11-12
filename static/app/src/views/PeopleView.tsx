import { t } from '../i18n';
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
import { DrawerBody, LevelDrawer, type DrawerLevel } from '../Drawer';
import { formatLocal, permissionLabel } from '../format';
import { navItem } from '../routes';
import { NoSnapshot, PartialBanner, useApp, useSnapshots } from '../shared';
import { useToast } from '../Toast';
import {
  Details,
  ErrorState,
  FilterBar,
  FilterSelect,
  LinkButton,
  PageFrame,
  PageHeader,
  Pill,
  ToggleField,
  DividedListItem,
  DividedList,
  staleNotice,
} from '../ui';
import {
  DetailsPhantom,
  FilterBarPhantom,
  LinesPhantom,
  Phantom,
  SkeletonRoot,
  SubjectPhantom,
} from '../skeletons';
import { ActionsHeader, SkeletonTable } from '../skeletonTable';

type Opt = { label: string; value: string };
const FILTERS: Opt[] = [
  {
    get label() {
      return t('people.everyone');
    },
    value: 'all',
  },
  {
    get label() {
      return t('people.withSpaceAccess');
    },
    value: 'access',
  },
  {
    get label() {
      return t('people.inactiveWithAccess');
    },
    value: 'inactive',
  },
  {
    get label() {
      return t('people.jiraAdministrators');
    },
    value: 'admins',
  },
  {
    get label() {
      return t('people.adminOfSeveralSpaces');
    },
    value: 'project-admins',
  },
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
        description: t('people.whatThisPersonCanDoAnd'),
        content: <PersonDrawer accountId={accountId} seq={seq} />,
      },
    ]);

  useEffect(() => {
    if (params.accountId) open(params.accountId, t('people.person'));
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
    <PageFrame
      notice={staleNotice(list)}
      header={<PageHeader title={meta.title} description={meta.description} />}
    >
      <Stack space="space.300">
        {list.error && !list.data ? (
          <ErrorState
            title={t('people.peopleUnavailable')}
            message={list.error}
            retry={list.reload}
          />
        ) : !list.data ? (
          <SkeletonRoot>
            <FilterBarPhantom controls={4} />
            <SkeletonTable
              columns={[
                t('people.person'),
                t('campaigns.spaces'),
                t('people.adminOf'),
                t('changes.groups'),
                <ActionsHeader key="f" label={t('people.flags')} />,
              ]}
            />
          </SkeletonRoot>
        ) : !snapshot ? (
          <NoSnapshot what={t('people.whatEachPersonCanDo')} />
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
                label={t('people.searchByNameOrAccountId')}
              />
              <FilterSelect<Opt>
                label={t('people.filterPeople')}
                options={FILTERS}
                value={FILTERS.find((f) => f.value === filter)}
                onChange={(o) => setFilter(o?.value ?? 'all')}
              />
              <ToggleField
                label={t('people.showAppAccounts')}
                isChecked={showApps}
                onChange={setShowApps}
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
                  { key: 'name', content: t('people.person'), isSortable: true },
                  { key: 'projects', content: t('campaigns.spaces'), isSortable: true },
                  { key: 'admin', content: t('people.adminOf'), isSortable: true },
                  { key: 'groups', content: t('changes.groups'), isSortable: true },
                  { key: 'flags', content: <ActionsHeader label={t('people.flags')} /> },
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
                      t('people.spaceCount', { count: p.adminProjects })
                    ) : (
                      <Text color="color.text.subtle">—</Text>
                    ),
                  },
                  { key: p.groups, content: p.groups },
                  {
                    key: 'flags',
                    content: p.jiraAdmin ? (
                      <Pill tone="danger">{t('people.jiraAdmin')}</Pill>
                    ) : null,
                  },
                ],
              }))}
              rowsPerPage={25}
              defaultPage={1}
              defaultSortKey="name"
              defaultSortOrder="ASC"
              emptyView={
                <Text as="p" color="color.text.subtle">
                  {t('people.nobodyMatches')}
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

type GlobalCheck = { checked: string[]; granted: string[]; at: number };

function PersonDrawer({ accountId, seq }: { accountId: string; seq: number | null }) {
  const { go } = useApp();
  const r = useCall<WithSnapshot<PersonAccess>>('personAccess', { accountId, seq });
  const toast = useToast();
  const [global, setGlobal] = useState<{ busy: boolean; data?: GlobalCheck }>({
    busy: false,
  });
  const check = async () => {
    setGlobal({ busy: true });
    try {
      setGlobal({ busy: false, data: await call<GlobalCheck>('globalPermissions', { accountId }) });
    } catch (e) {
      // R-8.7: an action without a form reports failure as a toast.
      setGlobal({ busy: false });
      toast.error(t('people.couldNotCheckGlobalPermissions'), errorText(e));
    }
  };
  if (r.error && !r.data)
    return (
      <DrawerBody>
        <ErrorState title={t('people.personUnavailable')} message={r.error} retry={r.reload} />
      </DrawerBody>
    );
  const d = r.data?.data;
  if (!d)
    return (
      <DrawerBody>
        {/* Subject, the real Details terms and section titles; only the values load (R-10.1). */}
        <SkeletonRoot>
          <SubjectPhantom />
          <DetailsPhantom
            terms={[
              t('people.accountId'),
              t('people.accountType'),
              t('campaigns.status'),
              t('people.jiraAdministrator'),
            ]}
          />
          <Section
            title={t('people.globalPermissions')}
            description={t('people.jiraCannotListGlobalPermissionHolders')}
          >
            <Phantom width={96} height={32} />
          </Section>
          <Section title={t('changes.groups')}>
            <Phantom width={200} height={20} radius="full" />
          </Section>
          <Section
            title={t('campaigns.spaces')}
            description={t('people.permissionsInEachSpaceWithThe')}
          >
            <LinesPhantom lines={4} />
          </Section>
        </SkeletonRoot>
      </DrawerBody>
    );
  return (
    <DrawerBody>
      <SubjectCell subject={d.person} />
      <Details
        rows={[
          [t('people.accountId'), <Hash key="id" value={d.person.id} />],
          [t('people.accountType'), d.person.accountType ?? t('people.unknown')],
          [
            t('campaigns.status'),
            d.person.active === false ? (
              <Pill tone="danger">{t('components.inactive')}</Pill>
            ) : (
              t('exceptions.active')
            ),
          ],
          [
            t('people.jiraAdministrator'),
            d.adminVia.length
              ? t('people.yesVia', { groups: d.adminVia.join(', ') })
              : t('people.notViaGroups'),
          ],
        ]}
      />
      <Section
        title={t('people.globalPermissions')}
        description={t('people.jiraCannotListGlobalPermissionHolders')}
        action={
          <Button isLoading={global.busy} onClick={() => void check()}>
            {t('people.checkNow')}
          </Button>
        }
      >
        {global.data ? (
          <DividedList>
            {global.data.checked.map((p) => (
              <DividedListItem key={p}>
                {global.data!.granted.includes(p) ? (
                  <Pill tone="warning">{t('changes.granted')}</Pill>
                ) : (
                  <Pill>{t('people.no')}</Pill>
                )}
                {permissionLabel(p)}
              </DividedListItem>
            ))}
            <DividedListItem>
              <Text color="color.text.subtle">
                {t('people.checkedAt', { date: formatLocal(global.data.at) })}
              </Text>
            </DividedListItem>
          </DividedList>
        ) : null}
      </Section>
      {d.changes && (d.changes.granted.length || d.changes.revoked.length) ? (
        <Section
          title={t('people.changes')}
          description={t('overview.sinceSnapshot', { seq: d.changes.fromSeq })}
        >
          <DividedList>
            {d.changes.granted.map((c, i) => (
              <DividedListItem key={`g${i}`}>
                <Pill tone="success">{t('changes.granted')}</Pill>
                {t('people.permissionInSpace', {
                  permission: permissionLabel(c.permission),
                  key: c.project.key,
                })}
                <Text color="color.text.subtle"> — {c.reasons[0]}</Text>
              </DividedListItem>
            ))}
            {d.changes.revoked.map((c, i) => (
              <DividedListItem key={`r${i}`}>
                <Pill tone="danger">{t('changes.revoked')}</Pill>
                {t('people.permissionInSpace', {
                  permission: permissionLabel(c.permission),
                  key: c.project.key,
                })}
              </DividedListItem>
            ))}
          </DividedList>
        </Section>
      ) : null}
      <Section title={t('people.groupsCount', { count: d.groups.length })}>
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
            {t('people.notAMemberOfAnyGroup')}
          </Text>
        )}
      </Section>
      <Section
        title={t('people.spacesCount', { count: d.projects.length })}
        description={t('people.permissionsInEachSpaceWithThe')}
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
            {t('people.noSpaceAccess')}
          </Text>
        )}
      </Section>
    </DrawerBody>
  );
}
