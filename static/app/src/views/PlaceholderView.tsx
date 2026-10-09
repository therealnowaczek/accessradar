import Button from '@atlaskit/button/new';
import { navItem, type ViewId } from '../routes';
import { Empty, PageFrame, PageHeader } from '../ui';

const COPY: Partial<Record<ViewId, { header: string; body: string }>> = {
  'explore-groups': {
    header: 'Group reach appears after the first snapshot',
    body: 'Pick a group to see every project it reaches, with the permission and the path: scheme grant, project role or application role.',
  },
  'explore-people': {
    header: 'Effective access appears after the first snapshot',
    body: 'Find a person to see their effective permissions per project, and the group or role that grants each one.',
  },
  changes: {
    header: 'No changes to compare yet',
    body: 'Changes need at least two snapshots. AccessRadar compares them and lists every grant that was added or removed.',
  },
  reviews: {
    header: 'No access reviews yet',
    body: 'Start a review from a snapshot, assign reviewers per project and export signed-off evidence for your auditors.',
  },
  snapshots: {
    header: 'No snapshots yet',
    body: 'Snapshots run on the schedule in Settings. Each one records who had access to what across this site at that moment.',
  },
};

export function PlaceholderView({ id, goTo }: { id: ViewId; goTo: (id: ViewId) => void }) {
  const meta = navItem(id);
  const copy = COPY[id] ?? { header: meta.title, body: meta.description };
  return (
    <PageFrame header={<PageHeader title={meta.title} description={meta.description} />}>
      <div className="settings-content">
        <Empty
          title={copy.header}
          description={copy.body}
          action={
            <Button appearance="primary" onClick={() => goTo('settings')}>
              Open settings
            </Button>
          }
        />
      </div>
    </PageFrame>
  );
}
