import EmptyState from '@atlaskit/empty-state';
import Tooltip from '@atlaskit/tooltip';
import DynamicTable from '../Table';
import { Stack, Text } from '@atlaskit/primitives';
import type { ActivityEvent } from '../api';
import { useCall } from '../data';
import { activityDetail, activityLabel, activityTarget } from '../activity';
import { formatLocal, formatUtc } from '../format';
import { navItem } from '../routes';
import { ErrorState, PageFrame, PageHeader, staleNotice, WrapAnywhere } from '../ui';
import { SkeletonRoot } from '../skeletons';
import { SkeletonTable } from '../skeletonTable';

export function ActivityView() {
  const meta = navItem('activity');
  const r = useCall<{ events: ActivityEvent[] }>('getActivity');
  return (
    <PageFrame
      header={<PageHeader title={meta.title} description={meta.description} />}
      notice={staleNotice(r, 'Activity could not refresh')}
    >
      <Stack space="space.300">
        {r.error && !r.data ? (
          <ErrorState title="Activity unavailable" message={r.error} retry={r.reload} />
        ) : !r.data ? (
          <SkeletonRoot>
            <SkeletonTable columns={['When', 'Who', 'What', 'Detail']} rows={8} />
          </SkeletonRoot>
        ) : !r.data.events.length ? (
          <EmptyState
            header="No activity yet"
            description="Snapshots, reviews, sign-offs, exports and settings changes appear here."
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
                {
                  key: e.at,
                  content: (
                    <Tooltip content={formatUtc(e.at)}>
                      <Text>{formatLocal(e.at)}</Text>
                    </Tooltip>
                  ),
                },
                { key: e.actorName, content: e.actorName },
                {
                  key: activityLabel(e.action),
                  content: (() => {
                    const target = activityTarget(e);
                    return (
                      <WrapAnywhere>
                        {activityLabel(e.action)}
                        {target ? <Text color="color.text.subtle"> · {target}</Text> : null}
                      </WrapAnywhere>
                    );
                  })(),
                },
                { key: 'd', content: <Text color="color.text.subtle">{activityDetail(e)}</Text> },
              ],
            }))}
            rowsPerPage={50}
            defaultPage={1}
            defaultSortKey="at"
            defaultSortOrder="DESC"
          />
        )}
      </Stack>
    </PageFrame>
  );
}
