import DynamicTable from '../Table';
import type { ActivityEvent } from '../api';
import { useCall } from '../data';
import { activityDetail, activityLabel, activityTarget } from '../activity';
import { formatLocal, formatUtc } from '../format';
import { navItem } from '../routes';
import { Empty, ErrorState, Loading, PageFrame, PageHeader } from '../ui';

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
                  key: activityLabel(e.action),
                  content: (() => {
                    const target = activityTarget(e);
                    return (
                      <span className="wrap-anywhere">
                        {activityLabel(e.action)}
                        {target ? <span className="subtle"> · {target}</span> : null}
                      </span>
                    );
                  })(),
                },
                { key: 'd', content: <span className="subtle">{activityDetail(e)}</span> },
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
