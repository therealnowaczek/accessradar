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
  {
    get label() {
      return t('alerts.unread');
    },
    value: 'undismissed',
  },
  {
    get label() {
      return t('alerts.dismissed');
    },
    value: 'dismissed',
  },
  {
    get label() {
      return t('alerts.all');
    },
    value: 'all',
  },
];

const RULE_LABEL: Record<string, string> = {
  get 'new-admin'() {
    return t('alerts.ruleNewAdmin');
  },
  get 'new-anonymous-grant'() {
    return t('projects.anonymousAccess');
  },
  get 'inactive-with-access'() {
    return t('people.inactiveWithAccess');
  },
  get 'new-project-admin'() {
    return t('alerts.ruleSpaceAdmin');
  },
  get 'new-app-account-admin'() {
    return t('alerts.ruleAppAccountAdmin');
  },
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
        <ErrorState
          title={t('alerts.alertsUnavailable')}
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
              t('alerts.severity'),
              t('alerts.rule'),
              t('alerts.alert'),
              t('activity.when'),
              t('alerts.snapshot'),
              <ActionsHeader key="a" />,
            ]}
          />
        </SkeletonRoot>
      </PageFrame>
    );

  const items = list.data.items;
  const dismiss = async (ids: number[]) => {
    setBusy(true);
    try {
      await call('dismissAlerts', { ids });
      toast.success(ids.length === 1 ? t('alerts.alertDismissed') : t('alerts.alertsDismissed'));
      list.reload();
      status.reload();
    } catch (e) {
      toast.error(t('alerts.couldNotDismiss'), errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageFrame notice={staleNotice(list)} header={header}>
      <Stack space="space.300">
        <FilterBar>
          <FilterSelect
            label={t('alerts.alertStatus')}
            inputId="alert-status"
            options={STATUS_OPTS}
            value={STATUS_OPTS.find((o) => o.value === filter) ?? STATUS_OPTS[0]}
            onChange={(o) => setFilter(o?.value ?? 'undismissed')}
          />
        </FilterBar>
        {!items.length ? (
          <EmptyState
            headingSize="xsmall"
            header={t('alerts.noAlerts')}
            description={t('alerts.whenASnapshotDetectsNewAdmins')}
          />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'sev', content: t('alerts.severity') },
                { key: 'rule', content: t('alerts.rule') },
                { key: 'title', content: t('alerts.alert') },
                { key: 'when', content: t('activity.when') },
                { key: 'snap', content: t('alerts.snapshot') },
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
                      {a.severity === 'high'
                        ? t('alerts.high')
                        : a.severity === 'medium'
                          ? t('alerts.medium')
                          : t('alerts.low')}
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
                      {t('alerts.dismiss')}
                    </LinkButton>
                  ) : (
                    t('alerts.dismissed')
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
