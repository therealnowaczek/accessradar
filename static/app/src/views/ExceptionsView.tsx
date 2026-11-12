import EmptyState from '@atlaskit/empty-state';
import { useState } from 'react';
import { Box, Inline, Stack, Text } from '@atlaskit/primitives';
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
  /** Display names resolved on the server from the latest snapshot (never raw ids). */
  subjectName: string;
  subjectKind: 'user' | 'app' | 'group' | 'conditional' | 'anonymous';
  scopeLabel: string;
  grantedByName: string;
};

/** Subject cell: the name, plus a neutral "App" or "Group" marker so apps never read as people. */
function subjectCell(e: Pick<ExceptionRow, 'subjectName' | 'subjectKind'>) {
  const marker =
    e.subjectKind === 'app'
      ? t('components.app')
      : e.subjectKind === 'group'
        ? t('groups.group')
        : null;
  return marker ? (
    <Inline space="space.075" alignBlock="center">
      <Text>{e.subjectName}</Text>
      <Pill tone="neutral">{marker}</Pill>
    </Inline>
  ) : (
    e.subjectName
  );
}

const STATUS_OPTS = [
  {
    get label() {
      return t('exceptions.active');
    },
    value: 'active',
  },
  {
    get label() {
      return t('exceptions.expired');
    },
    value: 'expired',
  },
  {
    get label() {
      return t('exceptions.superseded');
    },
    value: 'superseded',
  },
  {
    get label() {
      return t('changes.revoked');
    },
    value: 'revoked',
  },
  {
    get label() {
      return t('alerts.all');
    },
    value: 'all',
  },
];

function expiryLozenge(status: ExceptionRow['status'], expiresAt: number, now: number) {
  if (status === 'expired' || status === 'revoked' || status === 'superseded') {
    const label = STATUS_OPTS.find((o) => o.value === status)?.label ?? status;
    return <Pill tone={status === 'expired' ? 'danger' : 'neutral'}>{label}</Pill>;
  }
  const days = Math.ceil((expiresAt - now) / 86400_000);
  if (days <= 14) return <Pill tone="warning">{t('exceptions.expiresInDays', { days })}</Pill>;
  return <Pill tone="success">{t('campaigns.active')}</Pill>;
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
        <ErrorState
          title={t('exceptions.exceptionsUnavailable')}
          message={list.error}
          retry={list.reload}
        />
      </PageFrame>
    );
  if (!list.data)
    return (
      <PageFrame header={header}>
        <SkeletonRoot>
          <FilterBarPhantom controls={1} />
          <SkeletonTable
            columns={[
              t('exceptions.subject'),
              t('exceptions.spaceGroup'),
              t('exceptions.permissions'),
              t('reviews.justification'),
              t('exceptions.expires'),
              t('exceptions.grantedBy'),
              t('exceptions.review'),
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
            label={t('exceptions.exceptionStatus')}
            inputId="exc-status"
            options={STATUS_OPTS}
            value={STATUS_OPTS.find((o) => o.value === status) ?? STATUS_OPTS[0]}
            onChange={(o) => setStatus(o?.value ?? 'active')}
          />
        </FilterBar>
        {/* The default filter shows the first-run empty state; other filters say "No exceptions". */}
        {!items.length && status === 'active' ? (
          <EmptyState
            headingSize="xsmall"
            header={t('exceptions.noExceptionsYet')}
            description={t('exceptions.emptyDescription')}
          />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'subject', content: t('exceptions.subject') },
                { key: 'scope', content: t('exceptions.spaceGroup') },
                { key: 'perms', content: t('exceptions.permissions') },
                { key: 'why', content: t('reviews.justification') },
                { key: 'exp', content: t('exceptions.expires') },
                { key: 'by', content: t('exceptions.grantedBy') },
                { key: 'review', content: t('exceptions.review') },
              ],
            }}
            rows={items.map((e) => ({
              key: e.id,
              cells: [
                { key: 's', content: subjectCell(e) },
                { key: 'p', content: e.scopeLabel },
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
                { key: 'by', content: e.grantedByName },
                {
                  key: 'r',
                  content: (
                    <LinkButton onClick={() => go('reviews', { reviewId: e.reviewId })}>
                      {t('campaigns.openReview')}
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
                header={t('exceptions.noExceptions')}
                description={t('exceptions.nothingMatchesThisFilter')}
              />
            }
          />
        )}
      </Stack>
    </PageFrame>
  );
}
