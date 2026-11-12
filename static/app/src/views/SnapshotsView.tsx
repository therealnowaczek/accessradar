import { t } from '../i18n';
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
import { DetailsPhantom, SkeletonRoot } from '../skeletons';
import { SkeletonTable } from '../skeletonTable';

const STAT_LABEL: Record<string, string> = {
  get project() {
    return t('snapshots.statProject');
  },
  get scheme() {
    return t('snapshots.statScheme');
  },
  get grant() {
    return t('snapshots.statGrant');
  },
  get role() {
    return t('snapshots.statRole');
  },
  get role_actor() {
    return t('snapshots.statRoleActor');
  },
  get group() {
    return t('snapshots.statGroup');
  },
  get group_access() {
    return t('snapshots.statGroupAccess');
  },
  get group_member() {
    return t('snapshots.statGroupMember');
  },
  get app_role() {
    return t('snapshots.statAppRole');
  },
  get app_role_group() {
    return t('snapshots.statAppRoleGroup');
  },
  get person() {
    return t('snapshots.statPerson');
  },
};

const TRIGGER: Record<string, string> = {
  get manual() {
    return t('snapshots.triggerManual');
  },
  get scheduled() {
    return t('snapshots.triggerScheduled');
  },
  get onboarding() {
    return t('snapshots.triggerOnboarding');
  },
  get dev() {
    return t('snapshots.triggerDev');
  },
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
        title: t('snapshots.snapshotNumber', { seq: s.seq }),
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
            label={t('getStarted.refresh')}
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
              {t('shared.takeSnapshotNow')}
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
          <ErrorState
            title={t('snapshots.snapshotsUnavailable')}
            message={snaps.error}
            retry={snaps.reload}
          />
        ) : !snaps.data ? (
          <SkeletonRoot>
            <SkeletonTable
              columns={[
                t('alerts.snapshot'),
                t('campaigns.status'),
                t('snapshots.trigger'),
                t('snapshots.duration'),
                t('snapshots.contents'),
                t('snapshots.apiCost'),
              ]}
            />
          </SkeletonRoot>
        ) : !list.length ? (
          <EmptyState
            header={t('snapshots.noSnapshotsYet')}
            description={t('snapshots.aSnapshotRecordsPermissionSchemesRoles')}
            // R-3.2: while a snapshot runs the header keeps its (disabled) button; no second CTA.
            primaryAction={
              active ? undefined : (
                <Button appearance="primary" isLoading={take.busy} onClick={() => void take.run()}>
                  {t('shared.takeSnapshotNow')}
                </Button>
              )
            }
          />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'seq', content: t('alerts.snapshot'), isSortable: true },
                { key: 'status', content: t('campaigns.status') },
                { key: 'trigger', content: t('snapshots.trigger') },
                { key: 'duration', content: t('snapshots.duration') },
                { key: 'size', content: t('snapshots.contents') },
                { key: 'cost', content: t('snapshots.apiCost') },
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
                      {t('snapshots.contentsSummary', {
                        spaces: s.stats.project ?? 0,
                        groups: s.stats.group ?? 0,
                        people: s.stats.person ?? 0,
                      })}
                    </Text>
                  ) : (
                    <Text color="color.text.subtle">—</Text>
                  ),
                },
                {
                  key: 'cost',
                  content: (
                    <Text color="color.text.subtle">
                      {t('snapshots.costSummary', {
                        calls: s.calls,
                        points: s.points.toLocaleString(),
                      })}
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
        <ErrorState title={t('snapshots.snapshotUnavailable')} message={r.error} retry={r.reload} />
      </DrawerBody>
    );
  const s = r.data;
  if (!s)
    return (
      <DrawerBody>
        {/* The loaded level starts with these Details terms (R-10.1). */}
        <SkeletonRoot>
          <DetailsPhantom
            terms={[
              t('campaigns.status'),
              t('snapshots.started'),
              t('snapshots.finished'),
              t('snapshots.trigger'),
              t('snapshots.identity'),
              t('snapshots.apiCost'),
              t('snapshots.engineVersion'),
              t('snapshots.contentHash'),
            ]}
          />
        </SkeletonRoot>
      </DrawerBody>
    );
  const committed = s.status === 'complete' || s.status === 'partial';
  return (
    <DrawerBody>
      <Details
        rows={[
          [t('campaigns.status'), <SnapshotLozenge key="s" status={s.status} />],
          [t('snapshots.started'), `${formatLocal(s.startedAt)} · ${formatUtc(s.startedAt)}`],
          [
            t('snapshots.finished'),
            s.finishedAt
              ? `${formatLocal(s.finishedAt)} (${duration(s.startedAt, s.finishedAt)})`
              : '—',
          ],
          [t('snapshots.trigger'), TRIGGER[s.trigger] ?? s.trigger],
          [
            t('snapshots.identity'),
            s.collectorMode === 'app+impersonation'
              ? t('snapshots.identityAppWithFallback')
              : t('components.app'),
          ],
          [
            t('snapshots.apiCost'),
            t('snapshots.costSummaryDetailed', {
              calls: s.calls,
              points: s.points.toLocaleString(),
            }),
          ],
          [t('snapshots.engineVersion'), s.engineVersion],
          [t('snapshots.contentHash'), <Hash key="h" value={s.contentHash} />],
          ...(s.error ? ([[t('toast.error'), s.error]] as Array<[string, string]>) : []),
        ]}
      />
      {s.stats ? (
        <Section title={t('snapshots.contents')}>
          <Details
            rows={Object.entries(s.stats).map(([k, v]) => [STAT_LABEL[k] ?? k, v.toLocaleString()])}
          />
        </Section>
      ) : null}
      <CoverageLimitations coverage={s.coverage ?? []} limitations={s.limitations} />
      {committed ? (
        <Section
          title={t('snapshots.export')}
          description={t('snapshots.accessMatrixWhoHasWhichPermission')}
        >
          <Inline space="space.100" alignBlock="center" shouldWrap>
            <ExportMenu
              label={t('projects.exportAccessMatrix')}
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
              onMarkdown={() =>
                void exporter('Access matrix Markdown', () =>
                  exportMatrix('md', s.seq, exportContext(siteUrl)),
                )
              }
              onJson={() =>
                void exporter('Access matrix JSON', () =>
                  exportMatrix('json', s.seq, exportContext(siteUrl)),
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
              {t('snapshots.downloadCoverageCsv')}
            </Button>
          </Inline>
        </Section>
      ) : null}
    </DrawerBody>
  );
}
