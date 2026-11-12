import { t } from '../i18n';
import { useMemo, useState } from 'react';
import { Inline, Stack, Text } from '@atlaskit/primitives';
import DynamicTable from '../Table';
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
import { DrawerBody, LevelDrawer, type DrawerLevel } from '../Drawer';
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
import {
  ErrorState,
  FilterBar,
  FilterSelect,
  LinkButton,
  PageFrame,
  PageHeader,
  pageBreadcrumbs,
  Pill,
  ToggleField,
  NoWrap,
  staleNotice,
} from '../ui';
import { FilterBarPhantom, SkeletonRoot } from '../skeletons';
import { ActionsHeader, SkeletonTable } from '../skeletonTable';

type Opt = { label: string; value: string };
const FILTERS: Opt[] = [
  {
    get label() {
      return t('projects.allSpaces');
    },
    value: 'all',
  },
  {
    get label() {
      return t('projects.anonymousAccess');
    },
    value: 'anonymous',
  },
  {
    get label() {
      return t('projects.companyManaged');
    },
    value: 'company',
  },
  {
    get label() {
      return t('projects.teamManaged');
    },
    value: 'team',
  },
  {
    get label() {
      return t('projects.groupsWithUnknownMembers');
    },
    value: 'unexpanded',
  },
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
          label={t('projects.exportAccessMatrix')}
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
          onMarkdown={() =>
            void exporter('Access matrix Markdown', () =>
              exportMatrix('md', snapshot?.seq ?? null, exportContext(siteUrl)),
            )
          }
          onJson={() =>
            void exporter('Access matrix JSON', () =>
              exportMatrix('json', snapshot?.seq ?? null, exportContext(siteUrl)),
            )
          }
        />
      }
    />
  );
  return (
    <PageFrame notice={staleNotice(list)} header={header}>
      <Stack space="space.300">
        {list.error && !list.data ? (
          <ErrorState
            title={t('projects.spacesUnavailable')}
            message={list.error}
            retry={list.reload}
          />
        ) : !list.data ? (
          <SkeletonRoot>
            <FilterBarPhantom controls={3} />
            <SkeletonTable
              columns={[
                t('campaigns.space'),
                t('exposure.type'),
                t('projects.permissionScheme'),
                t('projects.peopleWithAccess'),
                t('projects.spaceAdminsPeople'),
                t('people.flags'),
              ]}
            />
          </SkeletonRoot>
        ) : !snapshot ? (
          <NoSnapshot what={t('projects.whoHasAccessToEachSpace')} />
        ) : (
          <>
            <PartialBanner
              snapshot={snapshot}
              onDetails={() => go('snapshots', { seq: String(snapshot.seq) })}
            />
            <FilterBar>
              <SearchField value={query} onChange={setQuery} label={t('projects.searchSpaces')} />
              <FilterSelect<Opt>
                label={t('projects.filterSpaces')}
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
                  { key: 'key', content: t('campaigns.space'), isSortable: true },
                  { key: 'style', content: t('exposure.type'), isSortable: true },
                  { key: 'scheme', content: t('projects.permissionScheme'), isSortable: true },
                  { key: 'people', content: t('projects.peopleWithAccess'), isSortable: true },
                  { key: 'admins', content: t('projects.spaceAdminsPeople'), isSortable: true },
                  { key: 'flags', content: t('people.flags') },
                ],
              }}
              rows={rows.map((p) => ({
                key: p.id,
                cells: [
                  {
                    key: p.key,
                    content: (
                      <LinkButton
                        onClick={() =>
                          go('explore-projects', {
                            projectId: p.id,
                            ...(seq ? { seq: String(seq) } : {}),
                          })
                        }
                      >
                        {p.key} · {p.name}
                      </LinkButton>
                    ),
                  },
                  {
                    key: p.style,
                    content:
                      p.style === 'team' ? t('projects.teamManaged') : t('projects.companyManaged'),
                  },
                  {
                    key: p.schemeName ?? '',
                    content: p.schemeName ?? (
                      <Text color="color.text.subtle">{t('projects.perSpace')}</Text>
                    ),
                  },
                  {
                    key: p.people,
                    content: (
                      <Text>
                        {p.people}
                        {p.appAccounts ? (
                          <Text color="color.text.subtle">
                            {' '}
                            · {t('projects.appAccountCount', { count: p.appAccounts })}
                          </Text>
                        ) : null}
                      </Text>
                    ),
                  },
                  {
                    key: p.admins,
                    content: (
                      <Text>
                        {p.admins}
                        {p.appAdmins ? (
                          <Text color="color.text.subtle">
                            {' '}
                            · {t('projects.appAccountCount', { count: p.appAdmins })}
                          </Text>
                        ) : null}
                      </Text>
                    ),
                  },
                  {
                    key: 'flags',
                    content: (
                      <Inline as="span" space="space.050" shouldWrap>
                        {p.anonymous ? (
                          <Pill tone="danger">{t('components.anonymous')}</Pill>
                        ) : null}
                        {p.unexpanded ? (
                          <Pill tone="warning">
                            {t('projects.unreadGroups', { count: p.unexpanded })}
                          </Pill>
                        ) : null}
                        {p.conditional ? (
                          <Pill tone="discovery">{t('components.workItemDependent')}</Pill>
                        ) : null}
                      </Inline>
                    ),
                  },
                ],
              }))}
              rowsPerPage={25}
              defaultPage={1}
              defaultSortKey="key"
              defaultSortOrder="ASC"
              emptyView={
                <Text as="p" color="color.text.subtle">
                  {t('projects.noSpacesMatch')}
                </Text>
              }
            />
            <Text as="p" color="color.text.subtle">
              {t('projects.peopleAndSpaceAdminCountsInclude')}
            </Text>
          </>
        )}
      </Stack>
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
        description:
          subject.type === 'group'
            ? t('projects.whyThisGroupHasAccess', { key: d?.project.key ?? '' })
            : t('projects.whyTheyHaveAccess', { key: d?.project.key ?? '' }),
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
      title={d ? `${d.project.key} · ${d.project.name}` : t('campaigns.space')}
      description={
        d
          ? `${d.project.style === 'team' ? t('projects.teamManaged') : t('projects.companyManaged')} · ${d.project.schemeName ?? t('projects.perSpacePermissions')}`
          : undefined
      }
      breadcrumbs={pageBreadcrumbs([
        { text: t('campaigns.spaces'), onClick: onBack },
        { text: d ? `${d.project.key} · ${d.project.name}` : t('campaigns.space') },
      ])}
      actions={
        <>
          <ExportMenu
            isDisabled={!d}
            onCsv={() =>
              void exporter('Space access CSV', () =>
                exportMatrix(
                  'csv',
                  detail.data?.snapshot?.seq ?? null,
                  exportContext(siteUrl),
                  d?.project.key,
                ),
              )
            }
            onPdf={() =>
              void exporter('Space access PDF', () =>
                exportMatrix(
                  'pdf',
                  detail.data?.snapshot?.seq ?? null,
                  exportContext(siteUrl),
                  d?.project.key,
                ),
              )
            }
            onMarkdown={() =>
              void exporter('Space access Markdown', () =>
                exportMatrix(
                  'md',
                  detail.data?.snapshot?.seq ?? null,
                  exportContext(siteUrl),
                  d?.project.key,
                ),
              )
            }
            onJson={() =>
              void exporter('Space access JSON', () =>
                exportMatrix(
                  'json',
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
    <PageFrame notice={staleNotice(detail)} header={header}>
      <Stack space="space.300">
        {detail.error && !detail.data ? (
          <ErrorState
            title={t('projects.spaceUnavailable')}
            message={detail.error}
            retry={detail.reload}
          />
        ) : !d ? (
          <SkeletonRoot>
            <FilterBarPhantom controls={2} />
            {/* Same columns as the loaded table, key permissions included (R-10.1). */}
            <SkeletonTable
              columns={[
                t('activity.who'),
                ...keyPerms.map(permissionLabel),
                t('projects.allPermissions'),
                t('projects.through'),
                <ActionsHeader key="w" label={t('projects.why')} />,
              ]}
            />
          </SkeletonRoot>
        ) : (
          <>
            <PartialBanner snapshot={detail.data?.snapshot ?? null} />
            <FilterBar>
              <SearchField
                value={query}
                onChange={setQuery}
                label={t('projects.searchPeopleAndGroups')}
              />
              <ToggleField
                label={t('people.showAppAccounts')}
                isChecked={showApps}
                onChange={setShowApps}
              />
            </FilterBar>
            <DynamicTable
              head={{
                cells: [
                  { key: 'who', content: t('activity.who'), isSortable: true },
                  ...keyPerms.map((perm) => ({ key: perm, content: permissionLabel(perm) })),
                  { key: 'all', content: t('projects.allPermissions'), isSortable: true },
                  { key: 'via', content: t('projects.through') },
                  { key: 'why', content: <ActionsHeader label={t('projects.why')} /> },
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
                        <NoWrap>✓</NoWrap>
                      ) : (
                        <Text color="color.text.subtle">—</Text>
                      ),
                    })),
                    { key: Object.keys(r.perms).length, content: Object.keys(r.perms).length },
                    { key: 'via', content: <ViaChips reasons={all} /> },
                    {
                      key: 'why',
                      content: (
                        <LinkButton onClick={() => why(r.subject, r.perms)}>
                          {t('projects.why2')}
                        </LinkButton>
                      ),
                    },
                  ],
                };
              })}
              rowsPerPage={25}
              defaultPage={1}
              emptyView={
                <Text as="p" color="color.text.subtle">
                  {t('projects.nobodyHasAccessToThisSpace')}
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
