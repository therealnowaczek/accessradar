import { Inline, Stack, Text } from '@atlaskit/primitives';
import SectionMessage from '@atlaskit/section-message';
import { useState } from 'react';
import DynamicTable from '../Table';
import type { SeatReport, WithSnapshot } from '../api';
import { Section, SnapshotPicker } from '../components';
import { useCall } from '../data';
import { t } from '../i18n';
import { navItem } from '../routes';
import { NoSnapshot, PartialBanner, useApp, useSnapshots } from '../shared';
import {
  ErrorState,
  FilterBar,
  LinkButton,
  Metric,
  MetricGrid,
  PageFrame,
  PageHeader,
  Pill,
  staleNotice,
} from '../ui';
import { FilterBarPhantom, MetricGridPhantom, SkeletonRoot } from '../skeletons';
import { SkeletonTable } from '../skeletonTable';

/**
 * Seat view: which groups grant product access, who is in them and which seat holders deserve a look.
 * No activity claim: Jira does not tell apps when someone last signed in.
 */
export function SeatsView() {
  const { go, status } = useApp();
  const meta = navItem('seats');
  const [seq, setSeq] = useState<number | null>(null);
  const snaps = useSnapshots();
  const latest = status.data?.latest?.seq ?? 0;
  const r = useCall<WithSnapshot<SeatReport>>('exploreSeats', { seq, latest });
  const snapshot = r.data?.snapshot ?? null;
  const d = r.data?.data ?? null;

  return (
    <PageFrame
      notice={staleNotice(r)}
      header={<PageHeader title={meta.title} description={meta.description} />}
    >
      <Stack space="space.300">
        {r.error && !r.data ? (
          <ErrorState title={t('seats.unavailable')} message={r.error} retry={r.reload} />
        ) : !r.data ? (
          <SkeletonRoot>
            <FilterBarPhantom controls={1} />
            <MetricGridPhantom count={4} />
            <SkeletonTable
              columns={[t('groups.group'), t('groups.members'), t('seats.deactivated')]}
              rows={4}
            />
          </SkeletonRoot>
        ) : !snapshot || !d ? (
          <NoSnapshot what={t('seats.whatItShows')} />
        ) : (
          <>
            <PartialBanner
              snapshot={snapshot}
              onDetails={() => go('snapshots', { seq: String(snapshot.seq) })}
            />
            <FilterBar>
              <SnapshotPicker
                snapshots={snaps.data?.snapshots ?? []}
                value={seq}
                onChange={setSeq}
              />
            </FilterBar>
            <SectionMessage
              appearance="information"
              title={t('seats.noActivityTitle')}
              headingLevel="h2"
            >
              <Text as="p">{t('seats.noActivityBody')}</Text>
            </SectionMessage>
            {d.noProducts ? (
              <Text as="p" color="color.text.subtle">
                {t('seats.noProducts')}
              </Text>
            ) : (
              <>
                <MetricGrid>
                  <Metric label={t('seats.seatHolders')} value={d.totals.seatHolders} />
                  <Metric
                    label={t('seats.noSpaceAccess')}
                    value={d.totals.noSpaceAccess}
                    hint={t('seats.noSpaceAccessHint')}
                  />
                  <Metric label={t('seats.multipleProducts')} value={d.totals.multipleProducts} />
                  <Metric label={t('seats.deactivated')} value={d.totals.deactivated} />
                </MetricGrid>
                {d.accessPartial ? (
                  <SectionMessage appearance="warning">
                    <Text as="p">{t('seats.accessPartial')}</Text>
                  </SectionMessage>
                ) : null}
                {d.products.map((p) => (
                  <Section
                    key={p.key}
                    title={p.name}
                    description={t('seats.productSummary', {
                      seats: p.seats,
                      groups: p.groups.length,
                    })}
                  >
                    <Stack space="space.100">
                      {p.partial ? (
                        <Text as="p" color="color.text.subtle">
                          {t('seats.productPartial')}
                        </Text>
                      ) : null}
                      <DynamicTable
                        head={{
                          cells: [
                            { key: 'group', content: t('groups.group') },
                            { key: 'members', content: t('groups.members'), isSortable: true },
                            { key: 'deact', content: t('seats.deactivated'), isSortable: true },
                          ],
                        }}
                        rows={p.groups.map((g) => ({
                          key: g.id,
                          cells: [
                            {
                              key: g.name.toLowerCase(),
                              content: (
                                <Inline as="span" space="space.100" alignBlock="center" shouldWrap>
                                  <LinkButton
                                    onClick={() => go('explore-groups', { filter: 'app-access' })}
                                  >
                                    {g.name}
                                  </LinkButton>
                                  {g.members === 0 ? (
                                    <Pill tone="warning">{t('seats.emptyGroup')}</Pill>
                                  ) : null}
                                </Inline>
                              ),
                            },
                            {
                              key: g.members ?? -1,
                              content: g.members ?? t('seats.notRead'),
                            },
                            { key: g.deactivated, content: g.deactivated },
                          ],
                        }))}
                        rowsPerPage={20}
                        defaultPage={1}
                        defaultSortKey="members"
                        defaultSortOrder="DESC"
                      />
                    </Stack>
                  </Section>
                ))}
                <Section title={t('seats.reviewTitle')} description={t('seats.reviewDescription')}>
                  {d.people.length ? (
                    <DynamicTable
                      head={{
                        cells: [
                          { key: 'person', content: t('seats.person') },
                          { key: 'products', content: t('seats.products') },
                          { key: 'spaces', content: t('seats.spaces'), isSortable: true },
                          { key: 'why', content: t('seats.why') },
                        ],
                      }}
                      rows={d.people.map((p) => ({
                        key: p.accountId,
                        cells: [
                          {
                            key: p.name.toLowerCase(),
                            content: (
                              <LinkButton
                                onClick={() => go('explore-people', { accountId: p.accountId })}
                              >
                                {p.name}
                              </LinkButton>
                            ),
                          },
                          { key: p.products.join(), content: p.products.join(', ') },
                          { key: p.spaces, content: p.spaces },
                          {
                            key: p.flags.length,
                            content: (
                              <Inline as="span" space="space.050" shouldWrap>
                                {p.flags.map((f) => (
                                  <Pill key={f} tone="warning">
                                    {f === 'no-space-access'
                                      ? t('seats.flagNoSpace')
                                      : t('seats.flagMultiple')}
                                  </Pill>
                                ))}
                              </Inline>
                            ),
                          },
                        ],
                      }))}
                      rowsPerPage={50}
                      defaultPage={1}
                    />
                  ) : (
                    <Text as="p" color="color.text.subtle">
                      {t('seats.nothingToReview')}
                    </Text>
                  )}
                </Section>
              </>
            )}
          </>
        )}
      </Stack>
    </PageFrame>
  );
}
