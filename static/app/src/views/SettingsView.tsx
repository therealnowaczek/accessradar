import Lozenge from '@atlaskit/lozenge';
import SectionMessage from '@atlaskit/section-message';
import type { Status } from '../api';
import type { Loadable } from '../data';
import { navItem } from '../routes';
import { ErrorState, Loading, PageFrame, PageHeader, SectionHeader } from '../ui';
import { SpikePanel } from './SpikePanel';

const SECTIONS: Array<{ title: string; description: string; rows: Array<[string, string]> }> = [
  {
    title: 'Snapshot schedule',
    description: 'How often AccessRadar records the access picture of this site.',
    rows: [
      ['Frequency', 'Daily'],
      ['Time window', 'Outside business hours, site time zone'],
    ],
  },
  {
    title: 'Key permissions',
    description: 'Permissions highlighted in reviews and change reports.',
    rows: [
      ['Global', 'Administer Jira, Browse users and groups'],
      ['Project', 'Administer projects, Browse projects, Delete issues'],
    ],
  },
  {
    title: 'Retention',
    description: 'How long snapshots and review evidence are kept.',
    rows: [
      ['Snapshots', '13 months'],
      ['Review evidence', '7 years'],
    ],
  },
  {
    title: 'Security & data',
    description: 'AccessRadar runs on Atlassian and only reads configuration.',
    rows: [
      ['Jira access', 'Read-only (granular read scopes)'],
      ['Issue content', 'Never read'],
      ['Data egress', 'None'],
    ],
  },
];

export function SettingsView({ status }: { status: Loadable<Status> }) {
  const meta = navItem('settings');
  return (
    <PageFrame
      header={
        <PageHeader
          title={meta.title}
          description={meta.description}
          status={<Lozenge>Preview</Lozenge>}
        />
      }
    >
      <div className="page-stack settings-content">
        <SectionMessage appearance="information">
          <p>
            These defaults apply to the first snapshots. Editing arrives in an upcoming version.
          </p>
        </SectionMessage>
        {SECTIONS.map((section) => (
          <section className="section-stack form-section-top" key={section.title}>
            <SectionHeader title={section.title} description={section.description} />
            <dl className="details settings-form">
              {section.rows.map(([term, value]) => (
                <div className="details-row" key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        {status.error ? (
          <ErrorState title="Status unavailable" message={status.error} retry={status.reload} />
        ) : status.loading && !status.data ? (
          <Loading compact />
        ) : status.data?.spike ? (
          <section className="section-stack form-section-top">
            <SpikePanel />
          </section>
        ) : null}
      </div>
    </PageFrame>
  );
}
