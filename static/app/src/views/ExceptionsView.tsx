import EmptyState from '@atlaskit/empty-state';
import { useState } from 'react';
import { Box, Stack, Text } from '@atlaskit/primitives';
import DynamicTable from '../Table';
import { useCall } from '../data';
import { formatLocal, permissionLabel } from '../format';
import { navItem } from '../routes';
import { useApp } from '../shared';
import {
  ErrorState,
  FilterBar,
  FilterSelect,
  LinkButton,
  PageFrame,
  PageHeader,
  Pill,
  NoWrap,
  staleNotice,
} from '../ui';
import { t } from '../i18n';
import { FilterBarPhantom, SkeletonRoot } from '../skeletons';
import { SkeletonTable } from '../skeletonTable';

type ExceptionRow = {
  id: string;
  itemKey: string;
  subjectType: string;
  subjectId: string;
  projectId: string | null;
  groupId: string | null;
  permissions: string[];
  justification: string;
  expiresAt: number;
  status: 'active' | 'expired' | 'superseded' | 'revoked';
  reviewId: string;
  grantedBy: string;
  grantedAt: number;
};

const STATUS_OPTS = [
  { label: 'Active', value: 'active' },
  { label: 'Expired', value: 'expired' },
  { label: 'Superseded', value: 'superseded' },
  { label: 'Revoked', value: 'revoked' },
  { label: 'All', value: 'all' },
];

function expiryLozenge(status: ExceptionRow['status'], expiresAt: number, now: number) {
  if (status === 'expired' || status === 'revoked' || status === 'superseded') {
    return <Pill tone={status === 'expired' ? 'danger' : 'neutral'}>{status}</Pill>;
  }
  const days = Math.ceil((expiresAt - now) / 86400_000);
  if (days <= 14) return <Pill tone="warning">expires in {days}d</Pill>;
  return <Pill tone="success">active</Pill>;
}

export function ExceptionsView() {
  const { go } = useApp();
  const meta = navItem('exceptions');
  const [status, setStatus] = useState('active');
  const [now] = useState(() => Date.now());
  const list = useCall<{ items: ExceptionRow[]; total: number }>('listExceptions', {
    status,
    page: 1,
  });

  const header = <PageHeader title={meta.title} description={meta.description} />;

  if (list.error && !list.data)
    return (
      <PageFrame header={header}>
        <ErrorState title="Exceptions unavailable" message={list.error} retry={list.reload} />
      </PageFrame>
    );
  if (!list.data)
    return (
      <PageFrame header={header}>
        <SkeletonRoot>
          <FilterBarPhantom controls={1} />
          <SkeletonTable
            columns={[
              'Subject',
              'Space/Group',
              'Permissions',
              'Justification',
              'Expires',
              'Granted by',
              'Review',
            ]}
          />
        </SkeletonRoot>
      </PageFrame>
    );

  const items = list.data.items;
  return (
    <PageFrame notice={staleNotice(list)} header={header}>
      <Stack space="space.300">
        <FilterBar>
          <FilterSelect
            label="Exception status"
            inputId="exc-status"
            options={STATUS_OPTS}
            value={STATUS_OPTS.find((o) => o.value === status) ?? STATUS_OPTS[0]}
            onChange={(o) => setStatus(o?.value ?? 'active')}
          />
        </FilterBar>
        {!items.length ? (
          <EmptyState header="No exceptions yet" description={t('exceptions.emptyDescription')} />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'subject', content: 'Subject' },
                { key: 'scope', content: 'Space/Group' },
                { key: 'perms', content: 'Permissions' },
                { key: 'why', content: 'Justification' },
                { key: 'exp', content: 'Expires' },
                { key: 'by', content: 'Granted by' },
                { key: 'review', content: 'Review' },
              ],
            }}
            rows={items.map((e) => ({
              key: e.id,
              cells: [
                { key: 's', content: e.subjectId },
                { key: 'p', content: e.projectId ?? e.groupId ?? '—' },
                { key: 'perm', content: e.permissions.map(permissionLabel).join(', ') },
                { key: 'j', content: e.justification },
                {
                  key: 'exp',
                  content: (
                    <>
                      <Box>{expiryLozenge(e.status, e.expiresAt, now)}</Box>
                      <NoWrap>
                        <Text color="color.text.subtle">{formatLocal(e.expiresAt)}</Text>
                      </NoWrap>
                    </>
                  ),
                },
                { key: 'by', content: e.grantedBy },
                {
                  key: 'r',
                  content: (
                    <LinkButton onClick={() => go('reviews', { reviewId: e.reviewId })}>
                      Open review
                    </LinkButton>
                  ),
                },
              ],
            }))}
            rowsPerPage={50}
            defaultPage={1}
            emptyView={
              <EmptyState
                headingSize="xsmall"
                header="No exceptions"
                description="Nothing matches this filter."
              />
            }
          />
        )}
      </Stack>
    </PageFrame>
  );
}
