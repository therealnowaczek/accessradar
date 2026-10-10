import { useState } from 'react';
import Button from '@atlaskit/button/new';
import DynamicTable from '@atlaskit/dynamic-table';
import RefreshIcon from '@atlaskit/icon/core/refresh';
import SectionMessage from '@atlaskit/section-message';
import type { Overview, Risk } from '../api';
import { CoverageList, Section, SnapshotLozenge } from '../components';
import { useCall } from '../data';
import { StackDrawer, DrawerBody, type DrawerLevel } from '../Drawer';
import { formatLocal, plural, relative } from '../format';
import { navItem, type ViewId } from '../routes';
import {
  NoSnapshot,
  PartialBanner,
  SnapshotProgress,
  useApp,
  useTakeSnapshot,
  type Params,
} from '../shared';
import { Empty, ErrorState, LinkButton, Loading, Metric, PageFrame, PageHeader, Pill } from '../ui';

const SEVERITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const;

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

  const header = (
    <PageHeader
      title={meta.title}
      description={meta.description}
      status={ov.data?.snapshot ? <SnapshotLozenge status={ov.data.snapshot.status} /> : null}
      actions={
        <>
          <Button iconBefore={RefreshIcon} onClick={ov.reload}>
            Refresh
          </Button>
          <Button
            appearance="primary"
            isLoading={take.busy}
            isDisabled={Boolean(active)}
            onClick={() => void take.run()}
          >
            Take snapshot now
          </Button>
        </>
      }
    />
  );

  if (ov.error && !ov.data)
    return (
      <PageFrame header={header}>
        <ErrorState title="Overview unavailable" message={ov.error} retry={ov.reload} />
      </PageFrame>
    );
  if (!ov.data)
    return (
      <PageFrame header={header}>
        <Loading />
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
            {r.learnMore ? <p className="subtle">{r.learnMore}</p> : null}
            {r.partial ? (
              <SectionMessage appearance="warning">
                <p>Some related data was incomplete; this list may be partial.</p>
              </SectionMessage>
            ) : null}
            <ul className="plain-list">
              {r.items.map((i) => (
                <li key={i.id}>
                  <span>
                    <strong>{i.label}</strong>
                    {i.detail ? <span className="subtle"> — {i.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            {r.count > r.items.length ? (
              <p className="subtle">
                Showing {r.items.length} of {r.count}.
              </p>
            ) : null}
            {RISK_TARGET[r.id] ? (
              <div>
                <Button onClick={() => go(...RISK_TARGET[r.id])}>Open in Explore</Button>
              </div>
            ) : null}
          </DrawerBody>
        ),
      },
    ]);

  return (
    <PageFrame header={header}>
      <div className="page-stack">
        {active ? <SnapshotProgress active={active} /> : null}
        {(status.data?.alertCount ?? 0) > 0 ? (
          <SectionMessage
            appearance="warning"
            title={`${status.data!.alertCount} unread change alert${status.data!.alertCount === 1 ? '' : 's'}`}
          >
            <p>
              New admins, anonymous grants, or inactive accounts with access were detected since a
              recent snapshot. <LinkButton onClick={() => go('alerts')}>Open alerts</LinkButton>
            </p>
          </SectionMessage>
        ) : null}
        {status.data?.lastAttempt?.status === 'failed' && !active ? (
          <SectionMessage
            appearance="error"
            title={`Snapshot #${status.data.lastAttempt.seq} failed`}
          >
            <p>
              {status.data.lastAttempt.error ??
                'The collector stopped. Try again; completed data is kept.'}
            </p>
          </SectionMessage>
        ) : null}
        {!d.snapshot ? (
          active ? null : (
            <NoSnapshot what="who has access to what" />
          )
        ) : (
          <>
            <PartialBanner
              snapshot={d.snapshot}
              onDetails={() =>
                setDrawer([
                  {
                    key: 'coverage',
                    title: 'What we could not see',
                    description: `Snapshot #${d.snapshot!.seq}`,
                    content: (
                      <DrawerBody>
                        <CoverageList coverage={d.coverage ?? []} />
                      </DrawerBody>
                    ),
                  },
                ])
              }
            />
            <p className="subtle">
              Snapshot #{d.snapshot.seq} · {formatLocal(d.snapshot.startedAt)} (
              {relative(d.snapshot.startedAt)}) ·{' '}
              <LinkButton onClick={() => go('snapshots')}>Snapshot history</LinkButton>
            </p>
            {d.metrics ? (
              <div className="metric-grid">
                <Metric
                  label="Projects"
                  value={d.metrics.projects}
                  hint={`${d.metrics.teamManaged} team-managed`}
                />
                <Metric
                  label="People"
                  value={d.metrics.people}
                  hint={`${d.metrics.inactivePeople} inactive · ${d.metrics.appAccounts} app accounts`}
                />
                <Metric
                  label="Groups"
                  value={d.metrics.groups}
                  hint={`${d.metrics.groupsRead} with members read`}
                />
                <Metric
                  label="Permission grants"
                  value={d.metrics.grants}
                  hint={plural(d.metrics.schemes, 'scheme')}
                />
                <Metric
                  label="Access entries"
                  value={d.metrics.accessEntries}
                  hint="Who × project × permission"
                />
              </div>
            ) : null}
            <Section
              title="Risk indicators"
              description="Signals worth checking in the next review. Select one to see the details."
            >
              {d.risks && d.risks.some((r) => r.count || r.partial) ? (
                <DynamicTable
                  head={{
                    cells: [
                      { key: 'severity', content: 'Severity', width: 12 },
                      { key: 'indicator', content: 'Indicator' },
                      { key: 'count', content: 'Count', width: 10 },
                    ],
                  }}
                  rows={d.risks
                    .filter((r) => r.count || r.partial)
                    .map((r) => ({
                      key: r.id,
                      cells: [
                        {
                          key: 'severity',
                          content: <Pill tone={SEVERITY_TONE[r.severity]}>{r.severity}</Pill>,
                        },
                        {
                          key: 'indicator',
                          content: (
                            <>
                              <LinkButton onClick={() => openRisk(r)}>{r.title}</LinkButton>
                              <div className="subtle">{r.description}</div>
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
                <p className="subtle">No risk indicators in this snapshot.</p>
              )}
            </Section>
            <Section
              title="Changes since the previous snapshot"
              description="Key permissions only. Open Changes for every difference."
              action={<Button onClick={() => go('changes')}>Open Changes</Button>}
            >
              {d.changes ? (
                <div className="metric-grid">
                  <Metric
                    label="Access granted"
                    value={d.changes.granted}
                    hint={`Since snapshot #${d.changes.fromSeq}`}
                  />
                  <Metric
                    label="Access revoked"
                    value={d.changes.revoked}
                    hint={`Since snapshot #${d.changes.fromSeq}`}
                  />
                </div>
              ) : (
                <p className="subtle">The next snapshot will show what changed since this one.</p>
              )}
            </Section>
          </>
        )}
        <Section
          title="Access reviews"
          description="Periodic reviews with sign-off and evidence export."
          action={<Button onClick={() => go('reviews')}>Open Reviews</Button>}
        >
          {d.reviews.open || d.reviews.signed ? (
            <div className="section-stack">
              <div className="metric-grid">
                <Metric label="Open" value={d.reviews.open} />
                <Metric
                  label="Signed"
                  value={d.reviews.signed}
                  hint={
                    d.reviews.lastSigned
                      ? `Last: ${formatLocal(d.reviews.lastSigned.signedAt)}`
                      : undefined
                  }
                />
                <Metric
                  label="Open remediations"
                  value={d.remediation?.open ?? 0}
                  hint={
                    d.remediation?.stillPresent
                      ? `${d.remediation.stillPresent} still present`
                      : undefined
                  }
                />
              </div>
              {d.reviews.overdue.length ? (
                <SectionMessage
                  appearance="warning"
                  title={`${plural(d.reviews.overdue.length, 'review')} past due`}
                >
                  <p>{d.reviews.overdue.map((r) => r.name).join(', ')}</p>
                </SectionMessage>
              ) : null}
            </div>
          ) : d.snapshot ? (
            <Empty
              title="No reviews yet"
              description="Start a review of the latest snapshot: reviewers mark each access as keep or revoke and sign off."
              action={
                <Button appearance="primary" onClick={() => go('reviews', { create: '1' })}>
                  Start a review
                </Button>
              }
            />
          ) : (
            <p className="subtle">Reviews start from a snapshot.</p>
          )}
        </Section>
        <p className="subtle">
          Collector usage this hour: {d.usage.points.toLocaleString()} of{' '}
          {d.budget.toLocaleString()} rate points · {plural(d.usage.calls, 'call')}
        </p>
      </div>
      <StackDrawer
        levels={drawer}
        onBack={() => setDrawer((l) => l.slice(0, -1))}
        onClose={() => setDrawer([])}
      />
    </PageFrame>
  );
}
