import { useState } from 'react';
import Button from '@atlaskit/button/new';
import DynamicTable from '@atlaskit/dynamic-table';
import { call, errorText } from '../api';
import { useCall } from '../data';
import { formatLocal } from '../format';
import { navItem } from '../routes';
import { useApp } from '../shared';
import { useToast } from '../Toast';
import {
  Empty,
  ErrorState,
  FilterBar,
  FilterSelect,
  LinkButton,
  Loading,
  PageFrame,
  PageHeader,
  PlanGate,
  Pill,
} from '../ui';

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
  'new-project-admin': 'Project admin',
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
        <PlanGate
          locked
          title="Change alerts need Advanced"
          description="Advanced raises in-app alerts when admins, anonymous grants, or inactive accounts change."
        >
          {null}
        </PlanGate>
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
        <Loading />
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
    <PageFrame header={header}>
      <div className="page-stack">
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
          <Empty
            title="No alerts"
            description="When a snapshot detects new admins, anonymous access, or inactive accounts with access, alerts appear here. Detection latency follows your snapshot schedule (typically ≤24h on Advanced daily)."
            action={null}
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
                { key: 'act', content: '' },
              ],
            }}
            rows={items.map((a) => ({
              key: String(a.id),
              cells: [
                {
                  key: 'sev',
                  content: (
                    <Pill tone={a.severity === 'high' ? 'danger' : 'warning'}>{a.severity}</Pill>
                  ),
                },
                { key: 'rule', content: RULE_LABEL[a.rule] ?? a.rule },
                {
                  key: 'title',
                  content: (
                    <div>
                      <div>{a.title}</div>
                      {a.body ? <div className="subtle">{a.body}</div> : null}
                    </div>
                  ),
                },
                {
                  key: 'when',
                  content: <span className="nowrap">{formatLocal(a.createdAt)}</span>,
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
                    <Button
                      appearance="subtle"
                      isDisabled={busy}
                      onClick={() => void dismiss([a.id])}
                    >
                      Dismiss
                    </Button>
                  ) : (
                    'Dismissed'
                  ),
                },
              ],
            }))}
          />
        )}
      </div>
    </PageFrame>
  );
}
