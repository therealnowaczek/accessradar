import { t } from '../i18n';
import EmptyState from '@atlaskit/empty-state';
import { useState } from 'react';
import { Box, Stack, Text } from '@atlaskit/primitives';
import Button, { IconButton } from '@atlaskit/button/new';
import DynamicTable from '../Table';
import RefreshIcon from '@atlaskit/icon/core/refresh';
import SectionMessage from '@atlaskit/section-message';
import type { Overview, Risk } from '../api';
import { CoverageList, Section, SnapshotLozenge } from '../components';
import { DigestCard, DigestSectionPhantom } from './DigestCard';
import { ReviewPrompt } from './ReviewPrompt';
import { useCall } from '../data';
import { LevelDrawer, DrawerBody, type DrawerLevel } from '../Drawer';
import { formatLocal, relative } from '../format';
import { navItem, type ViewId } from '../routes';
import {
  NoSnapshot,
  PartialBanner,
  SnapshotProgress,
  useApp,
  useRefresh,
  useTakeSnapshot,
  type Params,
} from '../shared';
import {
  ErrorState,
  LinkButton,
  Metric,
  PageFrame,
  PageHeader,
  Pill,
  MetricGrid,
  DividedListItem,
  DividedList,
  SectionHeader,
  staleNotice,
} from '../ui';
import { HeadingPhantom, MetricGridPhantom, Phantom, SkeletonRoot } from '../skeletons';
import { SkeletonTable } from '../skeletonTable';

const SEVERITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const;
const SEVERITY_LABEL = {
  get high() {
    return t('alerts.high');
  },
  get medium() {
    return t('alerts.medium');
  },
  get low() {
    return t('alerts.low');
  },
} as const;

/** Where a risk tile leads: the explore view pre-filtered on the risky items. */
const RISK_TARGET: Record<string, [ViewId, Params]> = {
  anonymous: ['explore-projects', { filter: 'anonymous' }],
  inactive: ['explore-people', { filter: 'inactive' }],
  admins: ['explore-people', { filter: 'admins' }],
  'wide-admin': ['explore-people', { filter: 'project-admins' }],
  'broad-app-role': ['explore-groups', { filter: 'app-access' }],
  'large-groups': ['explore-groups', { filter: 'large' }],
  'project-no-admin': ['explore-projects', {}],
  'direct-user-grants': ['explore-people', {}],
  'unused-schemes': ['explore-projects', {}],
  'empty-groups-in-use': ['explore-groups', {}],
  'app-accounts-admin': ['explore-people', { filter: 'admins' }],
};

export function OverviewView() {
  const { status, go } = useApp();
  const meta = navItem('overview');
  const latest = status.data?.latest?.seq ?? 0;
  const ov = useCall<Overview>('getOverview', { latest });
  const take = useTakeSnapshot(ov.reload);
  const [drawer, setDrawer] = useState<DrawerLevel[]>([]);
  const active = status.data?.active ?? ov.data?.active ?? null;
  const { refresh, refreshing } = useRefresh(async () => {
    const [overviewOk, statusOk] = await Promise.all([ov.reload(), status.reload()]);
    return overviewOk && statusOk;
  });

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
          {/* No duplicate CTA: without a snapshot the empty state carries "Take snapshot now". */}
          {ov.data && !ov.data.snapshot && !active ? null : (
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

  if (ov.error && !ov.data)
    return (
      <PageFrame header={header}>
        <ErrorState
          title={t('overview.overviewUnavailable')}
          message={ov.error}
          retry={ov.reload}
        />
      </PageFrame>
    );
  if (!ov.data)
    return (
      <PageFrame header={header}>
        <SkeletonRoot>
          <HeadingPhantom />
          <MetricGridPhantom count={5} />
          <Section
            title={t('overview.riskIndicators')}
            description={t('overview.signalsWorthCheckingInTheNext')}
          >
            <SkeletonTable
              columns={[t('alerts.severity'), t('overview.indicator'), t('overview.count')]}
              rows={4}
            />
          </Section>
          <Section
            title={t('overview.changesSinceThePreviousSnapshot')}
            description={t('overview.keyPermissionsOnlyOpenChangesFor')}
            action={<Phantom width={112} height={32} />}
          >
            <MetricGridPhantom count={2} />
          </Section>
          <DigestSectionPhantom />
          <Section
            title={t('overview.accessReviews')}
            description={t('overview.periodicReviewsWithSignOffAnd')}
            action={<Phantom width={112} height={32} />}
          >
            <MetricGridPhantom count={3} />
          </Section>
          <Phantom width={320} />
        </SkeletonRoot>
      </PageFrame>
    );
  const d = ov.data;
  const openRisk = (r: Risk) =>
    setDrawer([
      {
        key: r.id,
        title: r.title,
        description: r.description,
        content: (
          <DrawerBody>
            {r.learnMore ? (
              <Text as="p" color="color.text.subtle">
                {r.learnMore}
              </Text>
            ) : null}
            {r.partial ? (
              <SectionMessage appearance="warning">
                <Text as="p">{t('overview.someRelatedDataWasIncompleteThis')}</Text>
              </SectionMessage>
            ) : null}
            <DividedList>
              {r.items.map((i) => (
                <DividedListItem key={i.id}>
                  <Text>
                    <Text weight="bold">{i.label}</Text>
                    {i.detail ? <Text color="color.text.subtle"> — {i.detail}</Text> : null}
                  </Text>
                </DividedListItem>
              ))}
            </DividedList>
            {r.count > r.items.length ? (
              <Text as="p" color="color.text.subtle">
                {t('overview.showingOf', { shown: r.items.length, total: r.count })}
              </Text>
            ) : null}
            {RISK_TARGET[r.id] ? (
              <Box>
                <Button onClick={() => go(...RISK_TARGET[r.id])}>
                  {t('overview.openInExplore')}
                </Button>
              </Box>
            ) : null}
          </DrawerBody>
        ),
      },
    ]);

  return (
    <PageFrame header={header} notice={staleNotice(ov, t('overview.overviewCouldNotRefresh'))}>
      <Stack space="space.300">
        {active ? <SnapshotProgress active={active} /> : null}
        {d.reviewPrompt?.show ? <ReviewPrompt url={d.reviewPrompt.url} /> : null}
        {(status.data?.alertCount ?? 0) > 0 ? (
          <SectionMessage
            appearance="warning"
            title={t('overview.unreadChangeAlerts', { count: status.data?.alertCount ?? 0 })}
            headingLevel="h2"
          >
            <Text as="p">
              {t('overview.newAdminsAnonymousGrantsOrInactive')}{' '}
              <LinkButton onClick={() => go('alerts')}>{t('overview.openAlerts')}</LinkButton>
            </Text>
          </SectionMessage>
        ) : null}
        {status.data?.lastAttempt?.status === 'failed' && !active ? (
          <SectionMessage
            appearance="error"
            title={t('overview.snapshotFailed', { seq: status.data.lastAttempt.seq })}
            headingLevel="h2"
          >
            <Text as="p">
              {status.data.lastAttempt.error ?? t('overview.theCollectorStoppedTryAgainCompleted')}
            </Text>
          </SectionMessage>
        ) : null}
        {!d.snapshot ? (
          active ? null : (
            <NoSnapshot what={t('overview.whoHasAccessToWhat')} headingSize="xsmall" />
          )
        ) : (
          <>
            <PartialBanner
              snapshot={d.snapshot}
              onDetails={() =>
                setDrawer([
                  {
                    key: 'coverage',
                    title: t('shared.whatWeCouldNotSee'),
                    description: t('overview.snapshotSeq', { seq: d.snapshot!.seq }),
                    content: (
                      <DrawerBody>
                        <CoverageList coverage={d.coverage ?? []} />
                      </DrawerBody>
                    ),
                  },
                ])
              }
            />
            <SectionHeader
              title={t('overview.snapshotSeq', { seq: d.snapshot.seq })}
              status={<SnapshotLozenge status={d.snapshot.status} />}
              description={
                <>
                  {formatLocal(d.snapshot.startedAt)} ({relative(d.snapshot.startedAt)}) ·{' '}
                  <LinkButton onClick={() => go('snapshots')}>
                    {t('overview.snapshotHistory')}
                  </LinkButton>
                </>
              }
            />
            {d.metrics ? (
              <MetricGrid>
                <Metric
                  label={t('campaigns.spaces')}
                  value={d.metrics.projects}
                  hint={t('overview.teamManagedCount', { count: d.metrics.teamManaged })}
                />
                <Metric
                  label={t('changes.people')}
                  value={d.metrics.people}
                  hint={t('overview.exclAppAccountsInactive', {
                    appAccounts: d.metrics.appAccounts,
                    inactive: d.metrics.inactivePeople,
                  })}
                />
                <Metric
                  label={t('changes.groups')}
                  value={d.metrics.groups}
                  hint={t('overview.groupsWithMembersRead', { count: d.metrics.groupsRead })}
                />
                <Metric
                  label={t('overview.permissionGrants')}
                  value={d.metrics.grants}
                  hint={t('overview.schemeCount', { count: d.metrics.schemes })}
                />
                <Metric
                  label={t('overview.accessEntries')}
                  value={d.metrics.accessEntries}
                  hint={t('overview.whoSpacePermission')}
                />
              </MetricGrid>
            ) : null}
            <Section
              title={t('overview.riskIndicators')}
              description={t('overview.signalsWorthCheckingInTheNext')}
            >
              {d.risks && d.risks.some((r) => r.count || r.partial) ? (
                <DynamicTable
                  head={{
                    cells: [
                      { key: 'severity', content: t('alerts.severity'), width: 12 },
                      { key: 'indicator', content: t('overview.indicator') },
                      { key: 'count', content: t('overview.count'), width: 10 },
                    ],
                  }}
                  rows={d.risks
                    .filter((r) => r.count || r.partial)
                    .map((r) => ({
                      key: r.id,
                      cells: [
                        {
                          key: 'severity',
                          content: (
                            <Pill tone={SEVERITY_TONE[r.severity]}>
                              {SEVERITY_LABEL[r.severity]}
                            </Pill>
                          ),
                        },
                        {
                          key: 'indicator',
                          content: (
                            <>
                              <LinkButton onClick={() => openRisk(r)}>{r.title}</LinkButton>
                              <Text as="p" color="color.text.subtle">
                                {r.description}
                              </Text>
                            </>
                          ),
                        },
                        {
                          key: 'count',
                          content: r.partial && !r.count ? 'partial' : r.count,
                        },
                      ],
                    }))}
                />
              ) : (
                <Text as="p" color="color.text.subtle">
                  {t('overview.noRiskIndicatorsInThisSnapshot')}
                </Text>
              )}
            </Section>
            <Section
              title={t('overview.changesSinceThePreviousSnapshot')}
              description={t('overview.keyPermissionsOnlyOpenChangesFor')}
              action={<Button onClick={() => go('changes')}>{t('overview.openChanges')}</Button>}
            >
              {d.changes ? (
                <MetricGrid>
                  <Metric
                    label={t('overview.accessGranted')}
                    value={d.changes.granted}
                    hint={t('overview.sinceSnapshot', { seq: d.changes.fromSeq })}
                  />
                  <Metric
                    label={t('overview.accessRevoked')}
                    value={d.changes.revoked}
                    hint={t('overview.sinceSnapshot', { seq: d.changes.fromSeq })}
                  />
                </MetricGrid>
              ) : (
                <Text as="p" color="color.text.subtle">
                  {t('overview.theNextSnapshotWillShowWhat')}
                </Text>
              )}
            </Section>
          </>
        )}
        <DigestCard />
        <Section
          title={t('overview.accessReviews')}
          description={t('overview.periodicReviewsWithSignOffAnd')}
          action={<Button onClick={() => go('reviews')}>{t('overview.openReviews')}</Button>}
        >
          {d.reviews.open || d.reviews.signed ? (
            <Stack space="space.200">
              <MetricGrid>
                <Metric label={t('overview.open')} value={d.reviews.open} />
                <Metric
                  label={t('overview.signed')}
                  value={d.reviews.signed}
                  hint={
                    d.reviews.lastSigned
                      ? t('overview.lastSigned', {
                          date: formatLocal(d.reviews.lastSigned.signedAt),
                        })
                      : undefined
                  }
                />
                <Metric
                  label={t('overview.openRemediations')}
                  value={d.remediation?.open ?? 0}
                  hint={
                    d.remediation?.stillPresent
                      ? t('overview.stillPresent', { count: d.remediation.stillPresent })
                      : undefined
                  }
                />
              </MetricGrid>
              {d.reviews.overdue.length ? (
                <SectionMessage
                  appearance="warning"
                  title={t('overview.reviewsPastDue', { count: d.reviews.overdue.length })}
                  headingLevel="h3"
                >
                  <Text as="p">{d.reviews.overdue.map((r) => r.name).join(', ')}</Text>
                </SectionMessage>
              ) : null}
            </Stack>
          ) : d.snapshot ? (
            <EmptyState
              headingSize="xsmall"
              header={t('overview.noReviewsYet')}
              description={t('overview.startAReviewOfTheLatest')}
              primaryAction={
                <Button onClick={() => go('reviews', { create: '1' })}>
                  {t('overview.startAReview')}
                </Button>
              }
              secondaryAction={
                <Button appearance="subtle" onClick={() => go('campaigns')}>
                  {t('sample.try')}
                </Button>
              }
            />
          ) : (
            <Text as="p" color="color.text.subtle">
              {t('overview.reviewsStartFromASnapshot')}
            </Text>
          )}
        </Section>
        <Text as="p" color="color.text.subtle">
          {t('overview.collectorUsage', {
            points: d.usage.points.toLocaleString(),
            budget: d.budget.toLocaleString(),
            calls: d.usage.calls,
          })}
        </Text>
      </Stack>
      <LevelDrawer
        levels={drawer}
        onBack={() => setDrawer((l) => l.slice(0, -1))}
        onClose={() => setDrawer([])}
      />
    </PageFrame>
  );
}
