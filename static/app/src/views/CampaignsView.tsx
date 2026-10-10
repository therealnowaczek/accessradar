import { useMemo, useState } from 'react';
import Button from '@atlaskit/button/new';
import DynamicTable from '@atlaskit/dynamic-table';
import { DropdownItem } from '@atlaskit/dropdown-menu';
import { DatePicker } from '@atlaskit/datetime-picker';
import { RadioGroup } from '@atlaskit/radio';
import Select from '@atlaskit/select';
import Textfield from '@atlaskit/textfield';
import ProgressBar from '@atlaskit/progress-bar';
import SectionMessage from '@atlaskit/section-message';
import { call, errorText } from '../api';
import { RowMenu } from '../components';
import { useCall } from '../data';
import { useConfirm } from '../Confirm';
import { DrawerBody, DrawerFooter, StackDrawer, type DrawerLevel } from '../Drawer';
import { formatLocal } from '../format';
import { navItem } from '../routes';
import { useApp } from '../shared';
import { useToast } from '../Toast';
import {
  Empty,
  ErrorState,
  FormField,
  Loading,
  PageFrame,
  PageHeader,
  Pill,
  PlanGate,
  RadioField,
} from '../ui';

type Campaign = {
  id: string;
  name: string;
  scope:
    { type: 'site' } | { type: 'projects'; ids: string[] } | { type: 'category'; ids: string[] };
  frequency: 'quarterly' | 'semiannual' | 'annual' | 'once';
  startAt: number;
  windowDays: number;
  delegateRule: 'projectLead' | 'map' | 'admin';
  reminderDays: number[];
  status: string;
  nextRunAt: number | null;
};

type Opt<T extends string = string> = { label: string; value: T };

type ProjectOpt = {
  id: string;
  key: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
};

const FREQ: Opt[] = [
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Semi-annual', value: 'semiannual' },
  { label: 'Annual', value: 'annual' },
  { label: 'Once', value: 'once' },
];

const SCOPE_RADIOS = [
  { name: 'scope', value: 'site', label: 'Entire site' },
  { name: 'scope', value: 'projects', label: 'Selected projects' },
  { name: 'scope', value: 'category', label: 'Project categories' },
];

const DELEGATE_RADIOS = [
  { name: 'delegate', value: 'projectLead', label: 'Project lead' },
  { name: 'delegate', value: 'admin', label: 'Campaign owner (me)' },
];

function statusLozenge(status: string) {
  if (status === 'active') return <Pill tone="success">active</Pill>;
  if (status === 'paused' || status === 'paused_edition') return <Pill tone="warning">paused</Pill>;
  return <Pill>{status}</Pill>;
}

function toDateInput(ms: number) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDateInput(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 9, 0, 0, 0);
}

type Draft = {
  name: string;
  scopeType: 'site' | 'projects' | 'category';
  projectIds: string[];
  categoryIds: string[];
  frequency: string;
  startDate: string;
  windowDays: string;
  delegateRule: string;
  reminderDays: string;
};

const emptyDraft = (): Draft => ({
  name: '',
  scopeType: 'site',
  projectIds: [],
  categoryIds: [],
  frequency: 'quarterly',
  startDate: toDateInput(Date.now() + 7 * 86400_000),
  windowDays: '14',
  delegateRule: 'projectLead',
  reminderDays: '7,3,1',
});

function draftToPayload(d: Draft) {
  const scope =
    d.scopeType === 'site'
      ? { type: 'site' as const }
      : d.scopeType === 'projects'
        ? { type: 'projects' as const, ids: d.projectIds }
        : { type: 'category' as const, ids: d.categoryIds };
  return {
    name: d.name.trim(),
    scope,
    frequency: d.frequency,
    startAt: fromDateInput(d.startDate),
    windowDays: Number(d.windowDays) || 14,
    delegateRule: d.delegateRule,
    reminderDays: d.reminderDays,
  };
}

export function CampaignsView() {
  const { go, status } = useApp();
  const toast = useToast();
  const meta = navItem('campaigns');
  const list = useCall<{ items: Campaign[] }>('listCampaigns');
  const projects = useCall<{ data: ProjectOpt[]; snapshot: { seq: number } | null }>(
    'exploreProjects',
    {},
  );
  const [drawer, setDrawer] = useState<DrawerLevel[]>([]);
  const [confirmDialog, confirm] = useConfirm();
  const [busy, setBusy] = useState(false);
  const advanced = status.data?.edition?.features?.reviewCampaigns;

  const categoryOpts = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects.data?.data ?? []) {
      if (p.categoryId) map.set(p.categoryId, p.categoryName || p.categoryId);
    }
    return [...map].map(([value, label]) => ({ value, label }));
  }, [projects.data]);

  const projectOpts = useMemo(
    () =>
      (projects.data?.data ?? []).map((p) => ({
        value: p.id,
        label: `${p.key} — ${p.name}`,
      })),
    [projects.data],
  );

  const header = (
    <PageHeader
      title={meta.title}
      description={meta.description}
      actions={
        advanced ? (
          <Button
            appearance="primary"
            onClick={() =>
              setDrawer([
                {
                  key: 'new',
                  title: 'New campaign',
                  description: 'Schedule a recurring access review.',
                  content: (
                    <CampaignForm
                      projects={projectOpts}
                      categories={categoryOpts}
                      onCancel={() => setDrawer([])}
                      onPreview={async (draft) => {
                        try {
                          const preview = await call<{
                            projects: Array<{
                              id: string;
                              key: string;
                              assignee: string | null;
                              items: number;
                            }>;
                            warnings: string[];
                            totalProjects: number;
                          }>('previewCampaign', draftToPayload(draft));
                          setDrawer((levels) => [
                            ...levels,
                            {
                              key: 'preview',
                              title: 'Preview campaign',
                              description: `${preview.totalProjects} project(s) will get a review.`,
                              content: (
                                <PreviewBody
                                  preview={preview}
                                  busy={busy}
                                  onBack={() => setDrawer((l) => l.slice(0, -1))}
                                  onCreate={async () => {
                                    setBusy(true);
                                    try {
                                      await call('saveCampaign', draftToPayload(draft));
                                      toast.success('Campaign created');
                                      setDrawer([]);
                                      list.reload();
                                    } catch (e) {
                                      toast.error('Could not create campaign', errorText(e));
                                    } finally {
                                      setBusy(false);
                                    }
                                  }}
                                />
                              ),
                            },
                          ]);
                        } catch (e) {
                          toast.error('Preview failed', errorText(e));
                        }
                      }}
                    />
                  ),
                },
              ])
            }
          >
            New campaign
          </Button>
        ) : null
      }
    />
  );

  if (status.data && advanced === false) {
    return (
      <PageFrame header={header}>
        <PlanGate
          locked
          title="Campaigns need Advanced"
          description="Advanced schedules recurring reviews and delegates them to project owners."
        >
          {null}
        </PlanGate>
      </PageFrame>
    );
  }

  if (list.error && !list.data)
    return (
      <PageFrame header={header}>
        <ErrorState title="Campaigns unavailable" message={list.error} retry={list.reload} />
      </PageFrame>
    );
  if (!list.data)
    return (
      <PageFrame header={header}>
        <Loading />
      </PageFrame>
    );

  const items = list.data.items;
  const run = async (campaignId: string) => {
    setBusy(true);
    try {
      const r = await call<{ runId: string }>('startCampaignRun', { campaignId });
      toast.success('Campaign run started');
      openRun(r.runId);
      list.reload();
    } catch (e) {
      toast.error('Could not start run', errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const pause = async (id: string) => {
    try {
      await call('pauseCampaign', { id });
      toast.success('Campaign paused');
      list.reload();
    } catch (e) {
      toast.error('Could not pause', errorText(e));
    }
  };
  const remove = async (id: string) => {
    try {
      await call('deleteCampaign', { id });
      toast.success('Campaign deleted');
      list.reload();
    } catch (e) {
      toast.error('Could not delete', errorText(e));
    }
  };
  const confirmDelete = (c: Campaign) =>
    confirm({
      title: `Delete campaign "${c.name}"?`,
      confirmLabel: 'Delete campaign',
      onConfirm: () => remove(c.id),
      body: (
        <p>
          The campaign stops scheduling runs and disappears from this list. Reviews it already
          created are not deleted.
        </p>
      ),
    });
  const openRun = (runId: string) => {
    setDrawer([
      {
        key: 'run',
        title: 'Campaign run',
        description: 'Per-project reviews and assignees.',
        content: (
          <RunDetail
            runId={runId}
            onClose={() => setDrawer([])}
            goReview={(id) => go('reviews', { reviewId: id })}
          />
        ),
      },
    ]);
  };

  return (
    <PageFrame header={header}>
      <div className="page-stack">
        <SectionMessage appearance="information">
          <p>
            Delegates are reminded in the app only (no email). Tell project owners through your
            usual channels. Detection uses your snapshot schedule.
          </p>
        </SectionMessage>
        {!items.length ? (
          <Empty
            title="Schedule your first recurring review"
            description="Campaigns create per-project reviews on a schedule and assign them to project leads."
            action={null}
          />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'name', content: 'Name' },
                { key: 'freq', content: 'Frequency' },
                { key: 'next', content: 'Next run' },
                { key: 'status', content: 'Status' },
                { key: 'act', content: '' },
              ],
            }}
            rows={items.map((c) => ({
              key: c.id,
              cells: [
                { key: 'name', content: c.name },
                { key: 'freq', content: c.frequency },
                {
                  key: 'next',
                  content: c.nextRunAt ? formatLocal(c.nextRunAt) : '—',
                },
                { key: 'status', content: statusLozenge(c.status) },
                {
                  key: 'act',
                  content: (
                    <span className="row-actions">
                      {c.status === 'active' ? (
                        <Button isDisabled={busy} onClick={() => void run(c.id)}>
                          Run now
                        </Button>
                      ) : null}
                      <RowMenu label={`More actions for ${c.name}`}>
                        {c.status === 'active' ? (
                          <DropdownItem onClick={() => void pause(c.id)}>Pause</DropdownItem>
                        ) : null}
                        <DropdownItem onClick={() => confirmDelete(c)}>Delete…</DropdownItem>
                      </RowMenu>
                    </span>
                  ),
                },
              ],
            }))}
            rowsPerPage={50}
            defaultPage={1}
          />
        )}
      </div>
      {confirmDialog}
      <StackDrawer
        levels={drawer}
        onBack={() => setDrawer((l) => l.slice(0, -1))}
        onClose={() => setDrawer([])}
      />
    </PageFrame>
  );
}

function CampaignForm({
  projects,
  categories,
  onCancel,
  onPreview,
}: {
  projects: Opt[];
  categories: Opt[];
  onCancel: () => void;
  onPreview: (d: Draft) => Promise<void>;
}) {
  const [d, setD] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <>
      <DrawerBody>
        <div className="page-stack">
          <FormField label="Name">
            {(id) => (
              <Textfield
                id={id}
                value={d.name}
                onChange={(e) => set('name', e.currentTarget.value)}
                maxLength={200}
              />
            )}
          </FormField>
          <RadioField label="Scope">
            <RadioGroup
              options={SCOPE_RADIOS}
              value={d.scopeType}
              onChange={(e) => set('scopeType', e.currentTarget.value as Draft['scopeType'])}
            />
          </RadioField>
          {d.scopeType === 'projects' ? (
            <FormField label="Projects">
              {(id) => (
                <Select
                  menuPosition="fixed"
                  inputId={id}
                  isMulti
                  options={projects}
                  value={projects.filter((o) => d.projectIds.includes(o.value))}
                  onChange={(opts) =>
                    set(
                      'projectIds',
                      ((opts as Opt[] | null) ?? []).map((o) => o.value),
                    )
                  }
                />
              )}
            </FormField>
          ) : null}
          {d.scopeType === 'category' ? (
            <FormField label="Categories" helper="From the latest snapshot’s project categories.">
              {(id) => (
                <Select
                  menuPosition="fixed"
                  inputId={id}
                  isMulti
                  options={categories}
                  value={categories.filter((o) => d.categoryIds.includes(o.value))}
                  onChange={(opts) =>
                    set(
                      'categoryIds',
                      ((opts as Opt[] | null) ?? []).map((o) => o.value),
                    )
                  }
                />
              )}
            </FormField>
          ) : null}
          <FormField label="Frequency">
            {(id) => (
              <Select
                menuPosition="fixed"
                inputId={id}
                options={FREQ}
                value={FREQ.find((o) => o.value === d.frequency) ?? FREQ[0]}
                onChange={(o) => set('frequency', (o as Opt | null)?.value ?? 'quarterly')}
              />
            )}
          </FormField>
          <FormField label="Start date (UTC)">
            {(id) => (
              <DatePicker
                id={id}
                value={d.startDate}
                onChange={(v) => set('startDate', v || d.startDate)}
              />
            )}
          </FormField>
          <FormField label="Review window (days)">
            {(id) => (
              <Textfield
                id={id}
                type="number"
                value={d.windowDays}
                onChange={(e) => set('windowDays', e.currentTarget.value)}
                min={1}
                max={90}
              />
            )}
          </FormField>
          <RadioField label="Assign to">
            <RadioGroup
              options={DELEGATE_RADIOS}
              value={d.delegateRule}
              onChange={(e) => set('delegateRule', e.currentTarget.value)}
            />
          </RadioField>
          <FormField label="Reminder days before due" helper="Comma-separated, e.g. 7,3,1">
            {(id) => (
              <Textfield
                id={id}
                value={d.reminderDays}
                onChange={(e) => set('reminderDays', e.currentTarget.value)}
              />
            )}
          </FormField>
        </div>
      </DrawerBody>
      <DrawerFooter onCancel={onCancel}>
        <Button
          appearance="primary"
          isDisabled={!d.name.trim() || busy}
          isLoading={busy}
          onClick={() => {
            setBusy(true);
            void onPreview(d).finally(() => setBusy(false));
          }}
        >
          Preview
        </Button>
      </DrawerFooter>
    </>
  );
}

function PreviewBody({
  preview,
  busy,
  onBack,
  onCreate,
}: {
  preview: {
    projects: Array<{ id: string; key: string; assignee: string | null; items: number }>;
    warnings: string[];
    totalProjects: number;
  };
  busy: boolean;
  onBack: () => void;
  onCreate: () => void;
}) {
  return (
    <>
      <DrawerBody>
        <div className="page-stack">
          {preview.warnings.map((w) => (
            <SectionMessage key={w} appearance="warning">
              <p>{w}</p>
            </SectionMessage>
          ))}
          <DynamicTable
            head={{
              cells: [
                { key: 'p', content: 'Project' },
                { key: 'a', content: 'Assignee' },
                { key: 'i', content: 'Items (est.)' },
              ],
            }}
            rows={preview.projects.map((p) => ({
              key: p.id,
              cells: [
                { key: 'p', content: p.key },
                { key: 'a', content: p.assignee ?? 'Unassigned' },
                { key: 'i', content: String(p.items) },
              ],
            }))}
            rowsPerPage={50}
            defaultPage={1}
            emptyView={
              <Empty
                title="No projects"
                description="Adjust the scope and try again."
                action={null}
              />
            }
          />
        </div>
      </DrawerBody>
      <DrawerFooter onCancel={onBack} cancelLabel="Back">
        <Button
          appearance="primary"
          isDisabled={!preview.totalProjects || busy}
          isLoading={busy}
          onClick={onCreate}
        >
          Create campaign
        </Button>
      </DrawerFooter>
    </>
  );
}

function RunDetail({
  runId,
  onClose,
  goReview,
}: {
  runId: string;
  onClose: () => void;
  goReview: (reviewId: string) => void;
}) {
  const r = useCall<{
    run: {
      id: string;
      status: string;
      reviewCount: number;
      dueAt: number;
      seq: number | null;
      error: string | null;
    };
    assignments: Array<{
      reviewId: string;
      projectId: string;
      assignee: string | null;
      status: string;
      dueAt: number;
    }>;
  }>('getCampaignRun', { runId });

  if (r.error && !r.data)
    return (
      <DrawerBody>
        <ErrorState title="Run unavailable" message={r.error} retry={r.reload} />
      </DrawerBody>
    );
  if (!r.data)
    return (
      <DrawerBody>
        <Loading compact />
      </DrawerBody>
    );

  const { run, assignments } = r.data;
  const done = assignments.filter((a) => a.status === 'submitted' || a.status === 'signed').length;
  const progress = assignments.length ? done / assignments.length : 0;

  return (
    <>
      <DrawerBody>
        <div className="page-stack">
          <p className="subtle">
            Status {run.status}
            {run.seq != null ? ` · snapshot #${run.seq}` : ''} · {run.reviewCount} review(s) · due{' '}
            {formatLocal(run.dueAt)}
          </p>
          {run.error ? (
            <SectionMessage appearance="error">
              <p>{run.error}</p>
            </SectionMessage>
          ) : null}
          {assignments.length ? (
            <ProgressBar value={progress} ariaLabel="Assignment progress" />
          ) : null}
          <DynamicTable
            head={{
              cells: [
                { key: 'p', content: 'Project' },
                { key: 'a', content: 'Assignee' },
                { key: 's', content: 'Status' },
                { key: 'd', content: 'Due' },
                { key: 'act', content: '' },
              ],
            }}
            rows={assignments.map((a) => ({
              key: a.reviewId,
              cells: [
                { key: 'p', content: a.projectId },
                { key: 'a', content: a.assignee ?? 'Unassigned' },
                { key: 's', content: a.status },
                { key: 'd', content: formatLocal(a.dueAt) },
                {
                  key: 'act',
                  content: (
                    <Button appearance="subtle" onClick={() => goReview(a.reviewId)}>
                      Open review
                    </Button>
                  ),
                },
              ],
            }))}
            rowsPerPage={50}
            defaultPage={1}
          />
          {run.status === 'materializing' ||
          run.status === 'waiting_snapshot' ||
          run.status === 'starting' ? (
            <Button onClick={() => r.reload()}>Refresh</Button>
          ) : null}
        </div>
      </DrawerBody>
      <DrawerFooter>
        <Button appearance="primary" onClick={onClose}>
          Close
        </Button>
      </DrawerFooter>
    </>
  );
}
