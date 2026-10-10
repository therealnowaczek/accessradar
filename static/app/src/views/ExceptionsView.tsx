import { useState } from 'react';
import DynamicTable from '@atlaskit/dynamic-table';
import { useCall } from '../data';
import { formatLocal, permissionLabel } from '../format';
import { navItem } from '../routes';
import { useApp } from '../shared';
import {
  Empty,
  ErrorState,
  FilterBar,
  FilterSelect,
  LinkButton,
  Loading,
  PageFrame,
  PageHeader,
  Pill,
} from '../ui';

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
        <Loading />
      </PageFrame>
    );

  const items = list.data.items;
  return (
    <PageFrame header={header}>
      <div className="page-stack">
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
          <Empty
            title="No exceptions yet"
            description="Exceptions you grant during a review appear here with their expiry date."
            action={null}
          />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'subject', content: 'Subject' },
                { key: 'scope', content: 'Project/Group' },
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
                      <div>{expiryLozenge(e.status, e.expiresAt, now)}</div>
                      <div className="subtle nowrap">{formatLocal(e.expiresAt)}</div>
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
              <Empty
                title="No exceptions"
                description="Nothing matches this filter."
                action={null}
              />
            }
          />
        )}
      </div>
    </PageFrame>
  );
}
