import Button from '@atlaskit/button/new';
import RefreshIcon from '@atlaskit/icon/core/refresh';
import SectionMessage from '@atlaskit/section-message';
import type { ProjectList, Status } from '../api';
import type { Loadable } from '../data';
import { navItem, type ViewId } from '../routes';
import { ErrorState, Metric, PageFrame, PageHeader, SectionHeader } from '../ui';

export function OverviewView({
  status,
  projects,
  goTo,
}: {
  status: Loadable<Status>;
  projects: Loadable<ProjectList>;
  goTo: (id: ViewId) => void;
}) {
  const meta = navItem('overview');
  const list = projects.data?.projects ?? [];
  const team = list.filter((p) => p.managed === 'team').length;
  const pending = (l: Loadable<unknown>) => (l.loading ? '…' : '—');
  return (
    <PageFrame
      header={
        <PageHeader
          title={meta.title}
          description={meta.description}
          actions={
            <Button
              iconBefore={RefreshIcon}
              isLoading={projects.loading}
              onClick={() => {
                projects.reload();
                status.reload();
              }}
            >
              Refresh
            </Button>
          }
        />
      }
    >
      <div className="page-stack settings-content">
        <SectionMessage
          appearance="information"
          title="No snapshot yet"
          actions={[
            <Button key="snapshots" appearance="primary" onClick={() => goTo('snapshots')}>
              View snapshots
            </Button>,
            <Button key="settings" onClick={() => goTo('settings')}>
              Open settings
            </Button>,
          ]}
        >
          <p>
            AccessRadar reads permission schemes, project roles, groups and application access. The
            first scheduled snapshot fills in risk, completeness and changes.
          </p>
        </SectionMessage>
        <div className="section-stack">
          <SectionHeader title="At a glance" />
          <div className="metric-grid">
            <Metric
              label="Projects"
              value={projects.data ? list.length : pending(projects)}
              hint={projects.data ? `${team} team-managed` : undefined}
            />
            <Metric label="Snapshots" value="0" hint="First snapshot pending" />
            <Metric label="Changes since last review" value="—" hint="Needs two snapshots" />
            <Metric
              label="Engine"
              value={status.data?.engineVersion ?? pending(status)}
              hint="Effective-access resolver"
            />
          </div>
        </div>
        {projects.error ? (
          <ErrorState
            title="Projects could not be loaded"
            message={projects.error}
            retry={projects.reload}
          />
        ) : null}
      </div>
    </PageFrame>
  );
}
