import EmptyState from '@atlaskit/empty-state';
import { useMemo, useState } from 'react';
import { Stack, Text, Inline } from '@atlaskit/primitives';
import Button from '@atlaskit/button/new';
import DynamicTable from '../Table';
import { DropdownItem } from '@atlaskit/dropdown-menu';
import { RadioGroup } from '@atlaskit/radio';
import Select from '@atlaskit/select';
import Textfield from '@atlaskit/textfield';
import ProgressBar from '@atlaskit/progress-bar';
import SectionMessage from '@atlaskit/section-message';
import { call, errorText } from '../api';
import { RowMenu } from '../components';
import { useCall } from '../data';
import { useConfirm } from '../Confirm';
import { DrawerBody, DrawerFooter, LevelDrawer, type DrawerLevel } from '../Drawer';
import { CharacterCounter } from '@atlaskit/form';
import { NAME_MAX_LENGTH, isCampaignDraftValid } from '../formRules';
import { formatLocal } from '../format';
import { t } from '../i18n';
import { navItem } from '../routes';
import { useApp, useRefresh } from '../shared';
import { useToast } from '../Toast';
import {
  dateHelper,
  DateField,
  ErrorState,
  FormField,
  PageFrame,
  PageHeader,
  Pill,
  PlanNote,
  RadioField,
  staleNotice,
} from '../ui';
import { Phantom, SkeletonRoot } from '../skeletons';
import { ActionsHeader, SkeletonTable } from '../skeletonTable';

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
  { name: 'scope', value: 'projects', label: 'Selected spaces' },
  { name: 'scope', value: 'category', label: 'Space categories' },
];

const DELEGATE_RADIOS = [
  { name: 'delegate', value: 'projectLead', label: 'Space lead' },
  { name: 'delegate', value: 'admin', label: 'Campaign owner (me)' },
];

function statusLozenge(status: string) {
  if (status === 'active') return <Pill tone="success">{t('campaigns.active')}</Pill>;
  if (status === 'paused' || status === 'paused_edition')
    return <Pill tone="warning">{t('campaigns.paused')}</Pill>;
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
                      // Errors are thrown back to the form level, which shows them inline (R-8.7).
                      onPreview={async (draft) => {
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
                            description: `${preview.totalProjects} space(s) will get a review.`,
                            content: (
                              <PreviewBody
                                preview={preview}
                                onBack={() => setDrawer((l) => l.slice(0, -1))}
                                onCreate={async () => {
                                  await call('saveCampaign', draftToPayload(draft));
                                  toast.success('Campaign created');
                                  setDrawer([]);
                                  list.reload();
                                }}
                              />
                            ),
                          },
                        ]);
                      }}
                    />
                  ),
                },
              ])
            }
          >
            {t('campaigns.newCampaign')}
          </Button>
        ) : null
      }
    />
  );

  if (status.data && advanced === false) {
    return (
      <PageFrame header={header}>
        <PlanNote benefit={t('planGate.campaigns')} />
      </PageFrame>
    );
  }

  if (list.error && !list.data)
    return (
      <PageFrame header={header}>
        <ErrorState
          title={t('campaigns.campaignsUnavailable')}
          message={list.error}
          retry={list.reload}
        />
      </PageFrame>
    );
  if (!list.data)
    return (
      <PageFrame header={header}>
        <SkeletonRoot>
          <SkeletonTable
            columns={['Name', 'Frequency', 'Next run', 'Status', <ActionsHeader key="a" />]}
            rows={4}
          />
        </SkeletonRoot>
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
      body: <Text as="p">{t('campaigns.theCampaignStopsSchedulingRunsAnd')}</Text>,
    });
  const openRun = (runId: string) => {
    setDrawer([
      {
        key: 'run',
        title: 'Campaign run',
        description: 'Per-space reviews and assignees.',
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
    <PageFrame notice={staleNotice(list)} header={header}>
      <Stack space="space.300">
        <SectionMessage appearance="information">
          <Text as="p">{t('campaigns.delegatesAreRemindedInTheApp')}</Text>
        </SectionMessage>
        {!items.length ? (
          <EmptyState
            header="Schedule your first recurring review"
            description={t('campaigns.campaignsCreatePerSpaceReviewsOn')}
          />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'name', content: 'Name' },
                { key: 'freq', content: 'Frequency' },
                { key: 'next', content: 'Next run' },
                { key: 'status', content: 'Status' },
                { key: 'act', content: <ActionsHeader /> },
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
                    <Inline as="span" space="space.050" alignBlock="center" alignInline="end">
                      {c.status === 'active' ? (
                        <Button isDisabled={busy} onClick={() => void run(c.id)}>
                          {t('campaigns.runNow')}
                        </Button>
                      ) : null}
                      <RowMenu label={`More actions for ${c.name}`}>
                        {c.status === 'active' ? (
                          <DropdownItem onClick={() => void pause(c.id)}>
                            {t('campaigns.pause')}
                          </DropdownItem>
                        ) : null}
                        <DropdownItem onClick={() => confirmDelete(c)}>
                          {t('campaigns.delete')}
                        </DropdownItem>
                      </RowMenu>
                    </Inline>
                  ),
                },
              ],
            }))}
            rowsPerPage={50}
            defaultPage={1}
          />
        )}
      </Stack>
      {confirmDialog}
      <LevelDrawer
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
  const [error, setError] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <>
      <DrawerBody>
        <Stack space="space.300">
          <FormField label={t('campaigns.name')}>
            {(id) => (
              <>
                <Textfield
                  id={id}
                  value={d.name}
                  onChange={(e) => set('name', e.currentTarget.value)}
                  aria-describedby={`${id}-character-counter`}
                />
                <CharacterCounter
                  inputId={id}
                  maxCharacters={NAME_MAX_LENGTH}
                  currentValue={d.name}
                />
              </>
            )}
          </FormField>
          <RadioField label={t('campaigns.scope')}>
            <RadioGroup
              options={SCOPE_RADIOS}
              value={d.scopeType}
              onChange={(e) => set('scopeType', e.currentTarget.value as Draft['scopeType'])}
            />
          </RadioField>
          {d.scopeType === 'projects' ? (
            <FormField label={t('campaigns.spaces')}>
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
            <FormField
              label={t('campaigns.categories')}
              helper="From the latest snapshot’s space categories."
            >
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
          <FormField label={t('campaigns.frequency')}>
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
          <FormField label={t('campaigns.startDateUtc')} helper={dateHelper()}>
            {(id, helperId) => (
              <DateField
                id={id}
                describedBy={helperId}
                value={d.startDate}
                onChange={(v) => set('startDate', v || d.startDate)}
              />
            )}
          </FormField>
          <FormField label={t('campaigns.reviewWindowDays')}>
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
          <RadioField label={t('campaigns.assignTo')}>
            <RadioGroup
              options={DELEGATE_RADIOS}
              value={d.delegateRule}
              onChange={(e) => set('delegateRule', e.currentTarget.value)}
            />
          </RadioField>
          <FormField
            label={t('campaigns.reminderDaysBeforeDue')}
            helper="Comma-separated, e.g. 7,3,1"
          >
            {(id) => (
              <Textfield
                id={id}
                value={d.reminderDays}
                onChange={(e) => set('reminderDays', e.currentTarget.value)}
              />
            )}
          </FormField>
          {error ? (
            <SectionMessage
              appearance="error"
              title={t('campaigns.previewFailed')}
              headingLevel="h3"
            >
              <Text as="p">{error}</Text>
            </SectionMessage>
          ) : null}
        </Stack>
      </DrawerBody>
      <DrawerFooter onCancel={onCancel}>
        <Button
          appearance="primary"
          isDisabled={!isCampaignDraftValid(d) || busy}
          isLoading={busy}
          onClick={() => {
            setBusy(true);
            setError('');
            void onPreview(d)
              .catch((e) => setError(errorText(e)))
              .finally(() => setBusy(false));
          }}
        >
          {t('campaigns.preview')}
        </Button>
      </DrawerFooter>
    </>
  );
}

function PreviewBody({
  preview,
  onBack,
  onCreate,
}: {
  preview: {
    projects: Array<{ id: string; key: string; assignee: string | null; items: number }>;
    warnings: string[];
    totalProjects: number;
  };
  onBack: () => void;
  /** Throws on failure; the error is shown inline under the table. */
  onCreate: () => Promise<void>;
}) {
  // Local state: a level's content is built once, so a parent flag would never update here.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const create = () => {
    setBusy(true);
    setError('');
    void onCreate()
      .catch((e) => setError(errorText(e)))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <DrawerBody>
        <Stack space="space.300">
          {preview.warnings.map((w) => (
            <SectionMessage key={w} appearance="warning">
              <Text as="p">{w}</Text>
            </SectionMessage>
          ))}
          <DynamicTable
            head={{
              cells: [
                { key: 'p', content: 'Space' },
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
              <EmptyState
                headingSize="xsmall"
                header="No spaces"
                description={t('campaigns.adjustTheScopeAndTryAgain')}
              />
            }
          />
          {error ? (
            <SectionMessage
              appearance="error"
              title={t('campaigns.couldNotCreateCampaign')}
              headingLevel="h3"
            >
              <Text as="p">{error}</Text>
            </SectionMessage>
          ) : null}
        </Stack>
      </DrawerBody>
      <DrawerFooter onCancel={onBack} cancelLabel={t('drawer.back')}>
        <Button
          appearance="primary"
          isDisabled={!preview.totalProjects || busy}
          isLoading={busy}
          onClick={create}
        >
          {t('campaigns.createCampaign')}
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
  const { refresh, refreshing } = useRefresh(() => r.reload());

  // The footer stays real in every state; only the body loads (R-10.7).
  const footer = (
    <DrawerFooter>
      <Button appearance="primary" onClick={onClose}>
        {t('adminNav.close')}
      </Button>
    </DrawerFooter>
  );
  if (r.error && !r.data)
    return (
      <>
        <DrawerBody>
          <ErrorState title={t('campaigns.runUnavailable')} message={r.error} retry={r.reload} />
        </DrawerBody>
        {footer}
      </>
    );
  if (!r.data)
    return (
      <>
        <DrawerBody>
          <SkeletonRoot>
            <Phantom width="70%" />
            <SkeletonTable
              columns={['Space', 'Assignee', 'Status', 'Due', <ActionsHeader key="a" />]}
              rows={4}
            />
          </SkeletonRoot>
        </DrawerBody>
        {footer}
      </>
    );

  const { run, assignments } = r.data;
  const done = assignments.filter((a) => a.status === 'submitted' || a.status === 'signed').length;
  const progress = assignments.length ? done / assignments.length : 0;
  const notice = staleNotice(r);

  return (
    <>
      <DrawerBody>
        <Stack space="space.300">
          {notice}
          <Text as="p" color="color.text.subtle">
            Status {run.status}
            {run.seq != null ? ` · snapshot #${run.seq}` : ''} · {run.reviewCount} review(s) · due{' '}
            {formatLocal(run.dueAt)}
          </Text>
          {run.error ? (
            <SectionMessage appearance="error">
              <Text as="p">{run.error}</Text>
            </SectionMessage>
          ) : null}
          {assignments.length ? (
            <ProgressBar value={progress} ariaLabel="Assignment progress" />
          ) : null}
          <DynamicTable
            head={{
              cells: [
                { key: 'p', content: 'Space' },
                { key: 'a', content: 'Assignee' },
                { key: 's', content: 'Status' },
                { key: 'd', content: 'Due' },
                { key: 'act', content: <ActionsHeader /> },
              ],
            }}
            rows={assignments.map((a) => ({
              key: a.reviewId,
              cells: [
                { key: 'p', content: a.projectId },
                { key: 'a', content: a.assignee ?? 'Unassigned' },
                {
                  key: 's',
                  content: (
                    <Pill
                      tone={
                        a.status === 'submitted' || a.status === 'signed' ? 'success' : 'neutral'
                      }
                    >
                      {a.status}
                    </Pill>
                  ),
                },
                { key: 'd', content: formatLocal(a.dueAt) },
                {
                  key: 'act',
                  content: (
                    <Button appearance="subtle" onClick={() => goReview(a.reviewId)}>
                      {t('campaigns.openReview')}
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
            <Button isLoading={refreshing} isDisabled={refreshing} onClick={() => void refresh()}>
              {t('getStarted.refresh')}
            </Button>
          ) : null}
        </Stack>
      </DrawerBody>
      {footer}
    </>
  );
}
