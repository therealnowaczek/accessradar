import Button from '@atlaskit/button/new';
import DynamicTable from '@atlaskit/dynamic-table';
import RefreshIcon from '@atlaskit/icon/core/refresh';
import Lozenge from '@atlaskit/lozenge';
import SectionMessage from '@atlaskit/section-message';
import type { ProjectList } from '../api';
import type { Loadable } from '../data';
import { navItem } from '../routes';
import { Empty, ErrorState, PageFrame, PageHeader } from '../ui';

const head = {
  cells: [
    { key: 'key', content: 'Key', isSortable: true, width: 12 },
    { key: 'name', content: 'Name', isSortable: true },
    { key: 'type', content: 'Type', isSortable: true, width: 16 },
    { key: 'managed', content: 'Management', isSortable: true, width: 20 },
    { key: 'category', content: 'Category', isSortable: true, width: 18 },
  ],
};

const humanize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

export function ProjectsView({ projects }: { projects: Loadable<ProjectList> }) {
  const meta = navItem('explore-projects');
  const rows = (projects.data?.projects ?? []).map((p) => ({
    key: p.id,
    cells: [
      { key: p.key, content: <strong>{p.key}</strong> },
      { key: p.name.toLowerCase(), content: p.name },
      { key: p.typeKey, content: humanize(p.typeKey) },
      {
        key: p.managed,
        content: (
          <Lozenge appearance={p.managed === 'team' ? 'new' : 'default'}>
            {p.managed === 'team' ? 'Team-managed' : 'Company-managed'}
          </Lozenge>
        ),
      },
      { key: p.category ?? '', content: p.category ?? <span className="subtle">—</span> },
    ],
  }));

  return (
    <PageFrame
      header={
        <PageHeader
          title={meta.title}
          description={meta.description}
          status={projects.data ? <Lozenge>{rows.length}</Lozenge> : undefined}
          actions={
            <Button iconBefore={RefreshIcon} isLoading={projects.loading} onClick={projects.reload}>
              Refresh
            </Button>
          }
        />
      }
    >
      <div className="page-stack settings-content">
        {projects.error ? (
          <ErrorState
            title="Projects could not be loaded"
            message={projects.error}
            retry={projects.reload}
          />
        ) : (
          <>
            <p className="subtle">
              Effective access per project (scheme grants, roles and groups) appears after the first
              snapshot.
            </p>
            {projects.data && !projects.data.complete ? (
              <SectionMessage appearance="warning">
                <p>Showing the first {rows.length} projects. Snapshots collect the full list.</p>
              </SectionMessage>
            ) : null}
            <DynamicTable
              label="Projects"
              head={head}
              rows={rows}
              isLoading={projects.loading && !projects.data}
              rowsPerPage={25}
              defaultSortKey="key"
              defaultSortOrder="ASC"
              emptyView={
                <Empty
                  title="No projects"
                  description="You can't browse any projects in this site yet."
                  action={<Button onClick={projects.reload}>Try again</Button>}
                />
              }
            />
          </>
        )}
      </div>
    </PageFrame>
  );
}
