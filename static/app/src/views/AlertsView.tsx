import EmptyState from '@atlaskit/empty-state';
import { useState } from 'react';
import { Box, Stack, Text } from '@atlaskit/primitives';
import DynamicTable from '../Table';
import { call, errorText } from '../api';
import { useCall } from '../data';
import { formatLocal, humanizePermissionKeys } from '../format';
import { t } from '../i18n';
import { navItem } from '../routes';
import { useApp } from '../shared';
import { useToast } from '../Toast';
import { DigestCard } from './DigestCard';
import {
  ErrorState,
  FilterBar,
  FilterSelect,
  LinkButton,
  PageFrame,
  PageHeader,
  Pill,
  PlanNote,
  NoWrap,
  staleNotice,
} from '../ui';
import { FilterBarPhantom, SkeletonRoot } from '../skeletons';
import { ActionsHeader, SkeletonTable } from '../skeletonTable';

type AlertRow = {
  id: number;
  rule: string;
  severity: string;
  title: string;
  body: string | null;
  seq: number | null;
  createdAt: number;
  dismissedAt: number | null;
};

const STATUS_OPTS = [
  { label: 'Unread', value: 'undismissed' },
  { label: 'Dismissed', value: 'dismissed' },
  { label: 'All', value: 'all' },
];

const RULE_LABEL: Record<string, string> = {
  'new-admin': 'New admin',
  'new-anonymous-grant': 'Anonymous access',
  'inactive-with-access': 'Inactive with access',
  'new-project-admin': 'Space admin',
  'new-app-account-admin': 'App account admin',
};

export function AlertsView() {
  const { go, status } = useApp();
  const toast = useToast();
  const meta = navItem('alerts');
  const [filter, setFilter] = useState('undismissed');
  const [busy, setBusy] = useState(false);
  const list = useCall<{ items: AlertRow[]; total: number }>('listAlerts', {
    status: filter,
    page: 1,
  });
  const advanced = status.data?.edition?.features?.changeAlerts;

  const header = <PageHeader title={meta.title} description={meta.description} />;

  if (status.data && advanced === false) {
    return (
      <PageFrame header={header}>
        <Stack space="space.300">
          <PlanNote benefit={t('planGate.alerts')} />
          <DigestCard planNote={false} />
        </Stack>
      </PageFrame>
    );
  }

  if (list.error && !list.data)
    return (
      <PageFrame header={header}>
        <ErrorState title="Alerts unavailable" message={list.error} retry={list.reload} />
      </PageFrame>
    );
  if (!list.data)
    return (
      <PageFrame header={header}>
        <SkeletonRoot>
          <FilterBarPhantom controls={1} />
          <SkeletonTable
            columns={['Severity', 'Rule', 'Alert', 'When', 'Snapshot', <ActionsHeader key="a" />]}
          />
        </SkeletonRoot>
      </PageFrame>
    );

  const items = list.data.items;
  const dismiss = async (ids: number[]) => {
    setBusy(true);
    try {
      await call('dismissAlerts', { ids });
      toast.success(ids.length === 1 ? 'Alert dismissed' : 'Alerts dismissed');
      list.reload();
      status.reload();
    } catch (e) {
      toast.error('Could not dismiss', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageFrame notice={staleNotice(list)} header={header}>
      <Stack space="space.300">
        <FilterBar>
          <FilterSelect
            label="Alert status"
            inputId="alert-status"
            options={STATUS_OPTS}
            value={STATUS_OPTS.find((o) => o.value === filter) ?? STATUS_OPTS[0]}
            onChange={(o) => setFilter(o?.value ?? 'undismissed')}
          />
        </FilterBar>
        {!items.length ? (
          <EmptyState
            header="No alerts"
            description="When a snapshot detects new admins, anonymous access, or inactive accounts with access, alerts appear here. Detection latency follows your snapshot schedule (typically ≤24h on Advanced daily)."
          />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'sev', content: 'Severity' },
                { key: 'rule', content: 'Rule' },
                { key: 'title', content: 'Alert' },
                { key: 'when', content: 'When' },
                { key: 'snap', content: 'Snapshot' },
                { key: 'act', content: <ActionsHeader /> },
              ],
            }}
            rows={items.map((a) => ({
              key: String(a.id),
              cells: [
                {
                  key: 'sev',
                  content: (
                    <Pill tone={a.severity === 'high' ? 'danger' : 'warning'}>
                      {a.severity === 'high' ? 'High' : a.severity === 'medium' ? 'Medium' : 'Low'}
                    </Pill>
                  ),
                },
                { key: 'rule', content: RULE_LABEL[a.rule] ?? a.rule },
                {
                  key: 'title',
                  content: (
                    <Box>
                      <Box>{humanizePermissionKeys(a.title)}</Box>
                      {a.body ? (
                        <Text as="p" color="color.text.subtle">
                          {humanizePermissionKeys(a.body)}
                        </Text>
                      ) : null}
                    </Box>
                  ),
                },
                {
                  key: 'when',
                  content: <NoWrap>{formatLocal(a.createdAt)}</NoWrap>,
                },
                {
                  key: 'snap',
                  content: a.seq ? (
                    <LinkButton onClick={() => go('snapshots', { seq: String(a.seq) })}>
                      #{a.seq}
                    </LinkButton>
                  ) : (
                    '—'
                  ),
                },
                {
                  key: 'act',
                  content: !a.dismissedAt ? (
                    <LinkButton isDisabled={busy} onClick={() => void dismiss([a.id])}>
                      Dismiss
                    </LinkButton>
                  ) : (
                    'Dismissed'
                  ),
                },
              ],
            }))}
          />
        )}
      </Stack>
    </PageFrame>
  );
}
