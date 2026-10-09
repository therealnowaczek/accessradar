import DynamicTable from '@atlaskit/dynamic-table';
import type { ActivityEvent } from '../api';
import { useCall } from '../data';
import { formatLocal, formatUtc } from '../format';
import { navItem } from '../routes';
import { Empty, ErrorState, Loading, PageFrame, PageHeader } from '../ui';

const ACTION: Record<string, string> = {
  'snapshot.started': 'Started a snapshot',
  'review.created': 'Started a review',
  'review.decided': 'Recorded decisions',
  'review.signed': 'Signed a review',
  'review.deleted': 'Deleted a review',
  'settings.saved': 'Saved settings',
  export: 'Exported',
};

function detailText(e: ActivityEvent): string {
  const d = e.detail ?? {};
  if (e.action === 'review.decided') return `${d.count ?? 0} items → ${d.decision ?? 'undecided'}`;
  if (e.action === 'review.signed') return `hash ${String(d.hash ?? '').slice(0, 16)}…`;
  if (e.action === 'export') return String(d.kind ?? '');
  if (e.action === 'review.created') return `${d.items ?? 0} items, scope ${d.scope ?? ''}`;
  if (e.action === 'settings.saved')
    return `${d.frequency ?? ''}, retention ${d.retentionDays ?? ''} days`;
  if (e.action === 'snapshot.started') return String(d.trigger ?? '');
  return '';
}

export function ActivityView() {
  const meta = navItem('activity');
  const r = useCall<{ events: ActivityEvent[] }>('getActivity');
  return (
    <PageFrame header={<PageHeader title={meta.title} description={meta.description} />}>
      <div className="page-stack">
        {r.error && !r.data ? (
          <ErrorState title="Activity unavailable" message={r.error} retry={r.reload} />
        ) : !r.data ? (
          <Loading />
        ) : !r.data.events.length ? (
          <Empty
            title="No activity yet"
            description="Snapshots, reviews, sign-offs, exports and settings changes appear here."
            action={null}
          />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'at', content: 'When', isSortable: true },
                { key: 'who', content: 'Who', isSortable: true },
                { key: 'what', content: 'What', isSortable: true },
                { key: 'detail', content: 'Detail' },
              ],
            }}
            rows={r.data.events.map((e) => ({
              key: String(e.id),
              cells: [
                { key: e.at, content: <span title={formatUtc(e.at)}>{formatLocal(e.at)}</span> },
                { key: e.actorName, content: e.actorName },
                {
                  key: e.action,
                  content: `${ACTION[e.action] ?? e.action}${e.target ? ` · ${e.target.length > 20 ? `${e.target.slice(0, 8)}…` : e.target}` : ''}`,
                },
                { key: 'd', content: <span className="subtle">{detailText(e)}</span> },
              ],
            }))}
            rowsPerPage={50}
            defaultPage={1}
            defaultSortKey="at"
            defaultSortOrder="DESC"
          />
        )}
      </div>
    </PageFrame>
  );
}
