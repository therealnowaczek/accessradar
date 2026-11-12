import EmptyState from '@atlaskit/empty-state';
import { useEffect, useMemo, useState } from 'react';
import { Inline, Stack, Text } from '@atlaskit/primitives';
import Button from '@atlaskit/button/new';
import Checkbox from '@atlaskit/checkbox';
import { DropdownItem } from '@atlaskit/dropdown-menu';
import DynamicTable from '../Table';
import ProgressBar from '@atlaskit/progress-bar';
import { RadioGroup } from '@atlaskit/radio';
import SectionMessage, { SectionMessageAction } from '@atlaskit/section-message';
import Select from '@atlaskit/select';
import Textarea from '@atlaskit/textarea';
import Textfield from '@atlaskit/textfield';
import {
  call,
  errorText,
  type GroupRow,
  type ProjectRow,
  type ReviewDetail,
  type ReviewItem,
  type ReviewSummary,
  type WithSnapshot,
} from '../api';
import {
  CoverageLimitations,
  ExportMenu,
  Hash,
  RowMenu,
  SearchField,
  Section,
  SnapshotPicker,
  SubjectCell,
  recheckDetail,
} from '../components';
import { useCall } from '../data';
import { useConfirm } from '../Confirm';
import { DrawerBody, DrawerFooter, LevelDrawer, type DrawerLevel } from '../Drawer';
import { CharacterCounter } from '@atlaskit/form';
import {
  NAME_MAX_LENGTH,
  NOTE_MAX_LENGTH,
  canStartReview,
  isDecisionChangeValid,
} from '../formRules';
import { downloadCsv, downloadJson, downloadMarkdown, downloadPdf } from '../export/download';
import { evidencePackJson, jsonFileName, reviewJson, serializeJson } from '../export/json';
import { reviewCsv, reviewFileName, reviewMarkdown, reviewPdf } from '../export/evidence';
import {
  evidencePackFileName,
  evidencePackPdf,
  type EvidencePackPayload,
} from '../export/evidencePack';
import { formatLocal, formatLocalDate, formatUtc, permissionLabel, timeZone } from '../format';
import { t, type MessageKey } from '../i18n';
import {
  deriveRemediation,
  revokeDecisions,
  type RemediationRow,
  type RemediationStatus,
} from '../remediation';
import { navItem } from '../routes';
import { exportContext, logExport, NoSnapshot, useApp, useExporter, useSnapshots } from '../shared';
import { useToast } from '../Toast';
import {
  dateHelper,
  DateField,
  Details,
  ErrorState,
  FilterBar,
  FilterSelect,
  FormField,
  LinkButton,
  Metric,
  PageFrame,
  PageHeader,
  pageBreadcrumbs,
  Pill,
  PlanGate,
  PlanNote,
  RadioField,
  WrapAnywhere,
  MetricGrid,
  PathList,
  staleNotice,
} from '../ui';
import {
  DetailsPhantom,
  FilterBarPhantom,
  MetricGridPhantom,
  Phantom,
  SkeletonRoot,
} from '../skeletons';
import { ActionsHeader, SkeletonTable } from '../skeletonTable';

const STATUS: Record<
  ReviewSummary['status'],
  { readonly label: string; tone: 'neutral' | 'info' | 'success' }
> = {
  draft: {
    get label() {
      return t('reviewsView.statusDraft');
    },
    tone: 'neutral',
  },
  in_progress: {
    get label() {
      return t('reviewsView.statusInProgress');
    },
    tone: 'info',
  },
  signed: {
    get label() {
      return t('overview.signed');
    },
    tone: 'success',
  },
};

export function ReviewsView() {
  const { params, go } = useApp();
  if (params.reviewId)
    return <ReviewDetailView id={params.reviewId} onBack={() => go('reviews')} />;
  return <ReviewList autoCreate={params.create === '1'} />;
}

/** All pages of the Advanced evidence pack (the server refuses on Standard). */
async function fetchEvidencePack(id: string) {
  const allItems: EvidencePackPayload['items'] = [];
  let page = 1;
  let first: EvidencePackPayload | null = null;
  for (;;) {
    const pack = await call<EvidencePackPayload>('getEvidencePack', { id, page, pageSize: 500 });
    if (!first) first = pack;
    allItems.push(...pack.items);
    if (!pack.nextPage) break;
    page = pack.nextPage;
  }
  if (!first) throw new Error(t('reviewsView.emptyEvidencePack'));
  return { first, allItems };
}

function ReviewList({ autoCreate }: { autoCreate: boolean }) {
  const { go, status } = useApp();
  const meta = navItem('reviews');
  const list = useCall<{ reviews: ReviewSummary[] }>('listReviews');
  const [drawer, setDrawer] = useState<DrawerLevel[]>([]);
  const [now] = useState(() => Date.now());
  const hasSnapshot = Boolean(status.data?.latest);
  const openCreate = () =>
    setDrawer([
      {
        key: 'create',
        title: t('reviews.startAnAccessReview'),
        description: t('reviews.itemsArePinnedToTheBase'),
        content: (
          <CreateReview
            onCreated={(id) => go('reviews', { reviewId: id })}
            onCancel={() => setDrawer([])}
          />
        ),
      },
    ]);
  useEffect(() => {
    if (autoCreate && hasSnapshot) openCreate();
  }, [autoCreate, hasSnapshot]);
  const reviews = list.data?.reviews ?? [];
  const hasChained = reviews.some((r) => r.status === 'signed' && r.chainSeq != null);
  // Signing, the hash chain and Verify are Advanced; the server refuses them on Standard too.
  const chainLocked =
    Boolean(status.data) && status.data?.edition?.features?.signatureChain === false;
  const openVerifyChain = () =>
    setDrawer([
      {
        key: 'verify-chain',
        title: t('reviews.verifySignatureChain2'),
        description: t('reviews.checksThatSignedReviewsFormA'),
        content: <VerifyChainPanel onDone={() => setDrawer([])} />,
      },
    ]);
  const header = (
    <PageHeader
      title={meta.title}
      description={meta.description}
      actions={
        <>
          {hasChained && !chainLocked ? (
            <Button appearance="subtle" onClick={openVerifyChain}>
              {t('reviews.verifyChain')}
            </Button>
          ) : null}
          {/* No duplicate CTA: an empty list carries "Start a review" in its empty state. */}
          {list.data && !reviews.length ? null : (
            <Button appearance="primary" isDisabled={!hasSnapshot} onClick={openCreate}>
              {t('overview.startAReview')}
            </Button>
          )}
        </>
      }
    />
  );
  return (
    <PageFrame notice={staleNotice(list)} header={header}>
      <Stack space="space.300">
        {chainLocked && list.data ? <PlanNote benefit={t('planGate.signing')} /> : null}
        {list.error && !list.data ? (
          <ErrorState
            title={t('reviews.reviewsUnavailable')}
            message={list.error}
            retry={list.reload}
          />
        ) : !list.data || (status.loading && !status.data) ? (
          <SkeletonRoot>
            <SkeletonTable
              columns={[
                t('exceptions.review'),
                t('campaigns.status'),
                t('reviews.chain'),
                t('projectReview.decided'),
                t('projectReview.revoke'),
                t('campaigns.due'),
                t('overview.signed'),
              ]}
            />
          </SkeletonRoot>
        ) : !hasSnapshot && !reviews.length ? (
          <NoSnapshot what={t('reviews.andReviewAccess')} />
        ) : !reviews.length ? (
          <EmptyState
            header={t('overview.noReviewsYet')}
            description={t('reviews.startAReviewToListWho')}
            primaryAction={
              <Button appearance="primary" onClick={openCreate}>
                {t('overview.startAReview')}
              </Button>
            }
          />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'name', content: t('exceptions.review'), isSortable: true },
                { key: 'status', content: t('campaigns.status'), isSortable: true },
                { key: 'chain', content: t('reviews.chain'), isSortable: true },
                { key: 'progress', content: t('projectReview.decided') },
                { key: 'flagged', content: t('projectReview.revoke'), isSortable: true },
                { key: 'due', content: t('campaigns.due'), isSortable: true },
                { key: 'signed', content: t('overview.signed'), isSortable: true },
              ],
            }}
            rows={reviews.map((r) => ({
              key: r.id,
              cells: [
                {
                  key: r.name.toLowerCase(),
                  content: (
                    <>
                      <LinkButton onClick={() => go('reviews', { reviewId: r.id })}>
                        {r.name}
                      </LinkButton>
                      <Text as="p" color="color.text.subtle">
                        {t('reviewsView.scopeSnapshot', {
                          scope:
                            r.scope.type === 'site'
                              ? t('reviews.wholeSite')
                              : t(
                                  r.scope.type === 'projects'
                                    ? 'reviewsView.spacesCount'
                                    : 'reviewsView.groupsCount',
                                  { count: r.scope.ids.length },
                                ),
                          seq: r.baseSeq,
                        })}
                      </Text>
                    </>
                  ),
                },
                {
                  key: r.status,
                  content: <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>,
                },
                {
                  key: r.chainSeq ?? 0,
                  content:
                    r.status === 'signed' ? (
                      r.chainSeq != null ? (
                        String(r.chainSeq)
                      ) : (
                        <Text color="color.text.subtle">{t('reviews.preChain')}</Text>
                      )
                    ) : (
                      <Text color="color.text.subtle">—</Text>
                    ),
                },
                {
                  key: 'p',
                  content: t('reviewsView.decidedOf', {
                    decided: r.decided ?? 0,
                    total: r.itemCount,
                  }),
                },
                { key: r.flagged ?? 0, content: r.flagged ?? 0 },
                {
                  key: r.dueAt ?? 0,
                  content: r.dueAt ? (
                    <Inline as="span" space="space.075" alignBlock="center" shouldWrap>
                      {formatLocalDate(r.dueAt)}
                      {r.status !== 'signed' && r.dueAt < now ? (
                        <Pill tone="danger">{t('reviews.overdue')}</Pill>
                      ) : null}
                    </Inline>
                  ) : (
                    <Text color="color.text.subtle">—</Text>
                  ),
                },
                {
                  key: r.signedAt ?? 0,
                  content: r.signedAt ? (
                    formatLocal(r.signedAt)
                  ) : (
                    <Text color="color.text.subtle">—</Text>
                  ),
                },
              ],
            }))}
            rowsPerPage={25}
            defaultPage={1}
          />
        )}
      </Stack>
      <LevelDrawer
        levels={drawer}
        onBack={() => setDrawer((l) => l.slice(0, -1))}
        onClose={() => setDrawer([])}
      />
    </PageFrame>
  );
}

type Opt = { label: string; value: string };

function CreateReview({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const snaps = useSnapshots();
  const [name, setName] = useState(
    t('reviewsView.defaultName', { month: new Date().toISOString().slice(0, 7) }),
  );
  const [scope, setScope] = useState<'site' | 'projects' | 'groups'>('site');
  const [ids, setIds] = useState<Opt[]>([]);
  const [base, setBase] = useState<number | null>(null);
  const [compare, setCompare] = useState<number | null>(null);
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const projects = useCall<WithSnapshot<ProjectRow[]>>(
    scope === 'projects' ? 'exploreProjects' : null,
    { seq: base },
  );
  const groups = useCall<WithSnapshot<GroupRow[]>>(scope === 'groups' ? 'exploreGroups' : null, {
    seq: base,
  });
  const options: Opt[] =
    scope === 'projects'
      ? (projects.data?.data ?? []).map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))
      : scope === 'groups'
        ? (groups.data?.data ?? []).map((g) => ({ value: g.id, label: g.name }))
        : [];
  const committed = (snaps.data?.snapshots ?? []).filter(
    (s) => s.status === 'complete' || s.status === 'partial',
  );
  const baseSeq = base ?? committed[0]?.seq ?? 0;
  const older = committed.filter((s) => s.seq < baseSeq);
  // R-9.3: Start review stays disabled until the form is valid (name, and a scope selection).
  const canStart = canStartReview({ name, scope, selected: ids.length });
  const submit = async () => {
    setError('');
    if (!name.trim()) return setError(t('reviews.giveTheReviewAName'));
    if (scope !== 'site' && !ids.length)
      return setError(
        t(
          scope === 'projects'
            ? 'reviewsView.pickAtLeastOneSpace'
            : 'reviewsView.pickAtLeastOneGroup',
        ),
      );
    setBusy(true);
    try {
      const r = await call<{ id: string; items: number }>('createReview', {
        name: name.trim(),
        scope: { type: scope, ids: ids.map((o) => o.value) },
        baseSeq: base,
        compareSeq: compare,
        dueAt: due ? new Date(`${due}T23:59:59`).getTime() : null,
      });
      toast.success(t('reviews.reviewStarted'), t('reviewsView.itemsToReview', { count: r.items }));
      onCreated(r.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <DrawerBody>
        <Stack space="space.150">
          <FormField label={t('campaigns.name')}>
            {(id) => (
              <>
                <Textfield
                  id={id}
                  value={name}
                  onChange={(e) => setName((e.target as HTMLInputElement).value)}
                  aria-describedby={`${id}-character-counter`}
                />
                <CharacterCounter
                  inputId={id}
                  maxCharacters={NAME_MAX_LENGTH}
                  currentValue={name}
                />
              </>
            )}
          </FormField>
          <RadioField label={t('campaigns.scope')}>
            <RadioGroup
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as typeof scope);
                setIds([]);
              }}
              options={[
                {
                  name: 'scope',
                  value: 'site',
                  label: t('reviews.wholeSiteAllSpacesJiraAdmins'),
                },
                { name: 'scope', value: 'projects', label: t('campaigns.selectedSpaces') },
                {
                  name: 'scope',
                  value: 'groups',
                  label: t('reviews.selectedGroupsMembershipReview'),
                },
              ]}
            />
          </RadioField>
          {scope !== 'site' ? (
            <FormField
              label={scope === 'projects' ? t('campaigns.spaces') : t('changes.groups')}
              helper={t('reviews.typeToSearchYouCanSelect')}
            >
              {(id) => (
                <Select<Opt, true>
                  menuPosition="fixed"
                  inputId={id}
                  isMulti
                  options={options}
                  value={ids}
                  onChange={(v) => setIds([...v])}
                  isLoading={projects.loading || groups.loading}
                />
              )}
            </FormField>
          ) : null}
          <FormField label={t('reviews.baseSnapshot')}>
            {(id) => (
              <SnapshotPicker
                inputId={id}
                snapshots={snaps.data?.snapshots ?? []}
                value={base}
                onChange={(v) => {
                  setBase(v);
                  setCompare(null);
                }}
                size="fill"
              />
            )}
          </FormField>
          <FormField
            label={t('reviews.compareWithOptional')}
            helper={t('reviews.marksItemsAsNewSinceThe')}
          >
            {(id) => (
              <Select<{ label: string; value: number }>
                menuPosition="fixed"
                inputId={id}
                options={[
                  { label: t('reviews.noComparison'), value: 0 },
                  ...older.map((s) => ({
                    label: t('reviewsView.snapshotOption', {
                      seq: s.seq,
                      date: formatLocal(s.startedAt),
                    }),
                    value: s.seq,
                  })),
                ]}
                value={
                  compare
                    ? { label: `#${compare}`, value: compare }
                    : { label: t('reviews.noComparison'), value: 0 }
                }
                onChange={(o) => setCompare(o && o.value ? o.value : null)}
                isSearchable={false}
              />
            )}
          </FormField>
          <FormField label={t('reviews.dueDateOptional')} helper={dateHelper()}>
            {(id, helperId) => (
              <DateField id={id} describedBy={helperId} value={due} onChange={(v) => setDue(v)} />
            )}
          </FormField>
          <Text as="p" color="color.text.subtle">
            {t('reviews.reviewersAreJiraAdministratorsKeyPermissions')}
          </Text>
          {error ? (
            <SectionMessage appearance="error">
              <Text as="p">{error}</Text>
            </SectionMessage>
          ) : null}
        </Stack>
      </DrawerBody>
      <DrawerFooter onCancel={onCancel}>
        <Button
          appearance="primary"
          isDisabled={!canStart || busy}
          isLoading={busy}
          onClick={() => void submit()}
        >
          {t('reviews.startReview')}
        </Button>
      </DrawerFooter>
    </>
  );
}

const DECISIONS: Opt[] = [
  {
    get label() {
      return t('reviews.allDecisions');
    },
    value: '',
  },
  {
    get label() {
      return t('reviews.undecided');
    },
    value: 'none',
  },
  {
    get label() {
      return t('projectReview.keep');
    },
    value: 'keep',
  },
  {
    get label() {
      return t('projectReview.revoke');
    },
    value: 'revoke',
  },
  {
    get label() {
      return t('reviews.exception2');
    },
    value: 'exception',
  },
  {
    get label() {
      return t('reviews.recheck');
    },
    value: 'recheck',
  },
];
const CHANGES: Opt[] = [
  {
    get label() {
      return t('reviews.allItems');
    },
    value: '',
  },
  {
    get label() {
      return t('reviews.newSinceComparison');
    },
    value: 'new',
  },
  {
    get label() {
      return t('reviews.unchanged');
    },
    value: 'unchanged',
  },
  {
    get label() {
      return t('reviews.removedSinceComparison');
    },
    value: 'removed',
  },
];

type AiSuggestion = { priority: 'high' | 'medium' | 'low'; reason: string };

function ReviewDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { siteUrl, status } = useApp();
  const toast = useToast();
  const r = useCall<ReviewDetail>('getReview', { id });
  // Advanced only: sign-off, hash chain and Verify. Signed reviews stay readable on Standard.
  const chainLocked =
    Boolean(status.data) && status.data?.edition?.features?.signatureChain === false;
  const [drawer, setDrawer] = useState<DrawerLevel[]>([]);
  const [confirmDialog, confirm] = useConfirm();
  const [query, setQuery] = useState('');
  const [decision, setDecision] = useState('');
  const [change, setChange] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState<Record<number, AiSuggestion>>({});
  const [suggesting, setSuggesting] = useState(false);
  const exporter = useExporter();
  const d = r.data;
  const signed = d?.review.status === 'signed';
  const hasSuggestions = Object.keys(suggest).length > 0;
  const runPresort = async () => {
    setSuggesting(true);
    try {
      const res = await call<{ suggestions: Record<string, AiSuggestion>; considered: number }>(
        'presortReview',
        { id },
      );
      setSuggest(
        Object.fromEntries(Object.entries(res.suggestions).map(([k, v]) => [Number(k), v])),
      );
      toast.success(t('reviews.aiDone', { count: Object.keys(res.suggestions).length }));
    } catch (e) {
      toast.error(t('reviews.aiFailed'), errorText(e));
    } finally {
      setSuggesting(false);
    }
  };

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank = (idx: number) => {
      const p = suggest[idx]?.priority;
      return p === 'high' ? 0 : p === 'medium' ? 1 : p === 'low' ? 2 : 3;
    };
    const filtered = (d?.items ?? []).filter(
      (i) =>
        (!decision ||
          (decision === 'none'
            ? !i.decision && i.change !== 'removed'
            : decision === 'recheck'
              ? Boolean(i.recheck)
              : i.decision === decision && !i.recheck)) &&
        (!change || i.change === change) &&
        (!q ||
          `${i.subject.name} ${i.project?.key ?? ''} ${i.groupName ?? ''} ${i.reasons.join(' ')} ${i.note ?? ''}`
            .toLowerCase()
            .includes(q)),
    );
    return Object.keys(suggest).length
      ? filtered.slice().sort((a, b) => rank(a.idx) - rank(b.idx))
      : filtered;
  }, [d, query, decision, change, suggest]);

  const decidable = (d?.items ?? []).filter((i) => i.change !== 'removed');
  const recheck = decidable.filter((i) => i.recheck).length;
  // A decision that must be rechecked counts as still to do, so the review cannot be signed yet.
  const decided = decidable.filter((i) => i.decision && !i.recheck).length;
  const flagged = revokeDecisions(d?.items ?? []).length;
  const pending = decidable.length - decided;

  const decide = async (
    idxs: number[],
    value: 'keep' | 'revoke' | 'exception' | null,
    note?: string,
    expiresAt?: string | null,
    /** The item drawer shows a failed save inline (R-8.7), so it skips the error toast. */
    inlineErrors = false,
  ) => {
    if (!idxs.length) return;
    setBusy(true);
    try {
      const res = await call<{
        changed: number;
        exceptions?: { granted: number; withdrawn: number };
      }>('decideItems', {
        id,
        idxs,
        decision: value,
        tz: timeZone(),
        ...(note !== undefined ? { note } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      });
      if (idxs.length > 1) toast.success(t('reviewsView.decisionsUpdated', { count: res.changed }));
      if (res.exceptions?.granted)
        toast.success(t('exceptions.registered', { count: res.exceptions.granted }));
      if (res.exceptions?.withdrawn)
        toast.success(t('exceptions.withdrawn', { count: res.exceptions.withdrawn }));
      r.reload();
    } catch (e) {
      if (!inlineErrors) toast.error(t('reviews.decisionNotSaved'), errorText(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const openDecide = (idxs: number[], preset: 'revoke' | 'exception' | null, item?: ReviewItem) => {
    const sample = item ?? items.find((i) => idxs.includes(i.idx));
    if (!sample) return;
    const multi = idxs.length > 1;
    setDrawer([
      {
        key: `note-${idxs.join('-')}`,
        title:
          preset === 'exception'
            ? multi
              ? t('reviewsView.grantExceptionCount', { count: idxs.length })
              : t('reviews.grantException')
            : preset === 'revoke'
              ? multi
                ? t('reviewsView.revokeAccessCount', { count: idxs.length })
                : t('reviews.revokeAccess')
              : sample.subject.name,
        description: multi
          ? t('reviews.oneJustificationAppliesToEverySelected')
          : sample.project
            ? `${sample.project.key} · ${sample.project.name}`
            : (sample.groupName ?? t('reviews.site')),
        content: (
          <ItemDrawer
            item={{ ...sample, decision: preset ?? sample.decision }}
            readOnly={signed}
            onSave={async (value, note, expiresAt) => {
              await decide(idxs, value, note, expiresAt, true);
              setDrawer([]);
            }}
            onCancel={() => setDrawer([])}
          />
        ),
      },
    ]);
  };

  const openNote = (item: ReviewItem, preset?: 'revoke' | 'exception') =>
    openDecide([item.idx], preset ?? null, item);

  const openSign = () =>
    setDrawer([
      {
        key: 'sign',
        title: t('reviews.signOffReview'),
        description: d?.review.name,
        content: (
          <SignDrawer
            detail={d!}
            onSigned={() => {
              setDrawer([]);
              r.reload();
            }}
            onCancel={() => setDrawer([])}
          />
        ),
      },
    ]);

  const openVerify = () =>
    setDrawer([
      {
        key: 'verify',
        title: t('reviews.verifySignatureChain'),
        description: d?.review.name,
        content: (
          <VerifyDrawer
            reviewId={id}
            snapshotSeq={d!.review.baseSeq}
            snapshotHash={d!.base?.contentHash ?? null}
            onClose={() => setDrawer([])}
          />
        ),
      },
    ]);

  const openDelete = () =>
    confirm({
      title: t('reviewsView.deleteReviewTitle', { name: d?.review.name ?? '' }),
      confirmLabel: t('reviews.deleteReview'),
      onConfirm: async () => {
        try {
          await call('deleteReview', { id });
          toast.success(t('reviews.reviewDeleted'));
          onBack();
        } catch (e) {
          toast.error(t('reviews.reviewNotDeleted'), errorText(e));
        }
      },
      body: <Text as="p">{t('reviews.thisDeletesTheDraftReviewAnd')}</Text>,
    });

  const header = (
    <PageHeader
      title={d?.review.name ?? t('exceptions.review')}
      description={
        d
          ? t(d.review.compareSeq ? 'reviewsView.scopeSnapshotVs' : 'reviewsView.scopeSnapshot', {
              scope:
                d.review.scope.type === 'site'
                  ? t('reviews.wholeSite')
                  : t(
                      d.review.scope.type === 'projects'
                        ? 'reviewsView.scopeSpaces'
                        : 'reviewsView.scopeGroups',
                      {
                        labels: `${d.review.scopeLabels.slice(0, 6).join(', ')}${d.review.scopeLabels.length > 6 ? '…' : ''}`,
                      },
                    ),
              seq: d.review.baseSeq,
              compare: d.review.compareSeq ?? 0,
            })
          : undefined
      }
      status={
        d ? <Pill tone={STATUS[d.review.status].tone}>{STATUS[d.review.status].label}</Pill> : null
      }
      breadcrumbs={pageBreadcrumbs([
        { text: t('settings.reviews'), onClick: onBack },
        { text: d?.review.name ?? t('exceptions.review') },
      ])}
      actions={
        <>
          {/* Secondaries → primary last (family header CTA order). Back is breadcrumbs only. */}
          <ExportMenu
            isDisabled={!d}
            onCsv={() =>
              void exporter('Review CSV', () => {
                downloadCsv(reviewFileName(d!, 'csv'), reviewCsv(d!, exportContext(siteUrl)));
                logExport('review-csv', id, d!.limitations?.version);
              })
            }
            onPdf={() =>
              void exporter('Review PDF', async () => {
                downloadPdf(reviewFileName(d!, 'pdf'), await reviewPdf(d!, exportContext(siteUrl)));
                logExport('review-pdf', id, d!.limitations?.version);
              })
            }
            onMarkdown={() =>
              void exporter('Review Markdown', () => {
                downloadMarkdown(
                  reviewFileName(d!, 'md'),
                  reviewMarkdown(d!, exportContext(siteUrl)),
                );
                logExport('review-md', id, d!.limitations?.version);
              })
            }
            onJson={() =>
              void exporter('Review JSON', () => {
                downloadJson(
                  jsonFileName(reviewFileName(d!, 'json')),
                  serializeJson(reviewJson(d!, exportContext(siteUrl))),
                );
                logExport('review-json', id, d!.limitations?.version);
              })
            }
            extraItems={
              d?.review.status === 'signed'
                ? [
                    {
                      label: t('reviews.evidencePackJson'),
                      description: t('reviews.advancedSignedReviewWithMethodologyAnd'),
                      onClick: () =>
                        void exporter('Evidence pack JSON', async () => {
                          const { first, allItems } = await fetchEvidencePack(id);
                          downloadJson(
                            jsonFileName(evidencePackFileName(d.review.name, id)),
                            serializeJson(
                              evidencePackJson(first, allItems, exportContext(siteUrl)),
                            ),
                          );
                          logExport('evidence-pack-json', id, d.limitations?.version);
                        }),
                    },
                  ]
                : undefined
            }
          />
          {signed && !chainLocked ? (
            <Button onClick={openVerify}>{t('reviews.verifySignatureChain')}</Button>
          ) : null}
          {!signed ? (
            <Button appearance="subtle" onClick={openDelete} isDisabled={!d}>
              {t('reviews.delete')}
            </Button>
          ) : null}
          {signed ? (
            <Button
              appearance="primary"
              onClick={() =>
                void exporter('Evidence pack', async () => {
                  const { first, allItems } = await fetchEvidencePack(id);
                  downloadPdf(
                    evidencePackFileName(d!.review.name, id),
                    await evidencePackPdf(first, allItems, exportContext(siteUrl)),
                  );
                  logExport('evidence-pack', id, d!.limitations?.version);
                })
              }
            >
              {t('reviews.downloadEvidencePack')}
            </Button>
          ) : (
            <Button
              appearance="primary"
              isDisabled={!d || pending > 0 || chainLocked}
              onClick={openSign}
            >
              {t('reviews.signOff')}
            </Button>
          )}
        </>
      }
    />
  );

  if (r.error && !d)
    return (
      <PageFrame header={header}>
        <ErrorState title={t('reviews.reviewUnavailable')} message={r.error} retry={r.reload} />
      </PageFrame>
    );
  if (!d)
    return (
      <PageFrame header={header}>
        <SkeletonRoot>
          <MetricGridPhantom count={4} />
          <FilterBarPhantom controls={3} />
          <SkeletonTable
            columns={[
              t('activity.who'),
              t('reviews.where'),
              t('groups.access'),
              t('projects.why'),
              t('reviews.decision'),
              <ActionsHeader key="a" />,
            ]}
          />
          <Section title={t('reviews.reviewRecord')}>
            <DetailsPhantom
              terms={[
                t('reviewsView.created'),
                t('campaigns.due'),
                t('settings.keyPermissions'),
                t('reviewsView.baseSnapshotHash'),
                t('reviewsView.engineVersion'),
              ]}
            />
          </Section>
        </SkeletonRoot>
      </PageFrame>
    );
  // Bulk Keep never confirms a decision that needs a recheck; those are decided one by one.
  const filteredOpen = items.filter((i) => i.change !== 'removed' && !i.recheck).map((i) => i.idx);
  return (
    <PageFrame notice={staleNotice(r)} header={header}>
      <Stack space="space.300">
        {chainLocked ? (
          <PlanNote benefit={t(signed ? 'planGate.verify' : 'planGate.signing')} />
        ) : null}
        {signed ? (
          <SectionMessage
            appearance="success"
            title={t('reviewsView.signedBy', {
              name: d.review.signedByName ?? t('people.jiraAdmin'),
            })}
            headingLevel="h2"
          >
            <Stack space="space.200">
              <Text as="p">
                {t('reviewsView.signedLine', {
                  utc: formatUtc(d.review.signedAt),
                  local: formatLocal(d.review.signedAt, d.review.signerTz ?? timeZone()),
                  tz: d.review.signerTz ?? '',
                })}
              </Text>
              <Details
                rows={[
                  [
                    t('reviewsView.evidenceHashSha256'),
                    <Hash key="h" value={d.review.evidenceHash} />,
                  ],
                  [
                    t('reviewsView.snapshotHash', { seq: d.review.baseSeq }),
                    <Hash key="s" value={d.base?.contentHash} />,
                  ],
                  [
                    t('reviews.chain'),
                    d.review.chainSeq != null ? String(d.review.chainSeq) : t('reviews.preChain'),
                  ],
                  [
                    t('reviewsView.previousHash'),
                    d.review.prevReviewHash ? (
                      <Hash key="p" value={d.review.prevReviewHash} />
                    ) : (
                      '—'
                    ),
                  ],
                  [t('reviews.signature'), `v${d.review.signatureVersion ?? 1}`],
                ]}
              />
            </Stack>
          </SectionMessage>
        ) : null}
        {signed ? <RemediationPanel reviewId={id} items={d.items} /> : null}
        <CoverageLimitations coverage={d.coverage} limitations={d.limitations} />
        {recheck && !signed ? (
          <SectionMessage
            appearance="warning"
            title={t('reviews.recheckTitle', { count: recheck })}
            headingLevel="h2"
          >
            <Text as="p">
              {t('reviews.recheckBody')}{' '}
              <LinkButton onClick={() => setDecision('recheck')}>
                {t('reviews.showRecheck')}
              </LinkButton>
            </Text>
          </SectionMessage>
        ) : null}
        <MetricGrid>
          <Metric
            label={t('projectReview.items')}
            value={decidable.length}
            hint={
              d.review.compareSeq
                ? t('reviewsView.newCount', {
                    count: decidable.filter((i) => i.change === 'new').length,
                  })
                : undefined
            }
          />
          <Metric
            label={t('projectReview.decided')}
            value={decided}
            hint={
              pending ? t('reviewsView.toGo', { count: pending }) : t('projectReview.allDecided')
            }
          />
          <Metric
            label={t('projectReview.keep')}
            value={decidable.filter((i) => i.decision === 'keep').length}
          />
          <Metric
            label={t('projectReview.revoke')}
            value={flagged}
            hint={t('reviews.removeManuallyInJira')}
          />
        </MetricGrid>
        {hasSuggestions ? (
          <SectionMessage
            appearance="discovery"
            title={t('reviews.aiTitle')}
            headingLevel="h2"
            actions={
              <SectionMessageAction onClick={() => setSuggest({})}>
                {t('reviews.aiClear')}
              </SectionMessageAction>
            }
          >
            <Text as="p">{t('reviews.aiBody')}</Text>
          </SectionMessage>
        ) : null}
        <FilterBar>
          <SearchField
            value={query}
            onChange={setQuery}
            label={t('reviews.searchPeopleSpacesPathsNotes')}
          />
          {(
            [
              [t('reviews.decision'), DECISIONS, decision, setDecision],
              ...(d.review.compareSeq ? [[t('changes.change'), CHANGES, change, setChange]] : []),
            ] as Array<[string, Opt[], string, (v: string) => void]>
          ).map(([label, opts, value, set]) => (
            <FilterSelect<Opt>
              key={label}
              label={label}
              options={opts}
              value={opts.find((o) => o.value === value)}
              onChange={(o) => set(o?.value ?? '')}
              size="narrow"
            />
          ))}
          {!signed ? (
            <>
              {!chainLocked ? (
                <Button
                  isLoading={suggesting}
                  isDisabled={busy || !decidable.some((i) => !i.decision)}
                  onClick={() => void runPresort()}
                >
                  {t('reviews.aiSuggest')}
                </Button>
              ) : null}
              <Button
                isDisabled={busy || !filteredOpen.length}
                onClick={() => void decide(filteredOpen, 'keep')}
              >
                {filteredOpen.length === decidable.length - recheck
                  ? t('reviewsView.keepAll')
                  : t('reviewsView.keepShown', { count: filteredOpen.length })}
              </Button>
              <Button
                isDisabled={busy || !filteredOpen.length}
                onClick={() => openDecide(filteredOpen, 'revoke')}
              >
                {filteredOpen.length === decidable.length
                  ? t('reviewsView.revokeAll')
                  : t('reviewsView.revokeShown', { count: filteredOpen.length })}
              </Button>
              <Button
                isDisabled={busy || !filteredOpen.length}
                onClick={() => openDecide(filteredOpen, 'exception')}
              >
                {filteredOpen.length === decidable.length
                  ? t('reviewsView.exceptionAll')
                  : t('reviewsView.exceptionShown', { count: filteredOpen.length })}
              </Button>
            </>
          ) : null}
        </FilterBar>
        <DynamicTable
          head={{
            cells: [
              { key: 'who', content: t('activity.who'), isSortable: true },
              {
                key: 'where',
                content: d.review.scope.type === 'groups' ? t('groups.group') : t('reviews.where'),
                isSortable: true,
              },
              { key: 'access', content: t('groups.access') },
              { key: 'why', content: t('projects.why') },
              { key: 'decision', content: t('reviews.decision'), isSortable: true },
              { key: 'actions', content: <ActionsHeader /> },
            ],
          }}
          rows={items.map((i) => ({
            key: String(i.idx),
            cells: [
              {
                key: i.subject.name.toLowerCase(),
                content: (
                  <Stack as="span" space="space.200">
                    <SubjectCell subject={i.subject} compact />
                    {i.change === 'new' ? (
                      <Pill tone="info">{t('reviews.new')}</Pill>
                    ) : i.change === 'removed' ? (
                      <Pill tone="neutral">{t('reviews.removedSinceComparison')}</Pill>
                    ) : null}
                  </Stack>
                ),
              },
              {
                key: i.project?.key ?? i.groupName ?? 'site',
                content: i.project ? (
                  <Text weight="bold">{i.project.key}</Text>
                ) : (
                  (i.groupName ?? t('reviews.site'))
                ),
              },
              { key: 'access', content: i.permissions.map(permissionLabel).join(', ') },
              {
                key: 'why',
                content: (
                  <Stack as="span" space="space.050">
                    <WrapAnywhere>
                      <Text color="color.text.subtle">
                        {i.reasons[0]}
                        {i.reasons.length > 1 ? ` (+${i.reasons.length - 1})` : ''}
                      </Text>
                    </WrapAnywhere>
                    {suggest[i.idx] ? (
                      <Inline as="span" space="space.100" alignBlock="center" shouldWrap>
                        <Pill tone={suggest[i.idx].priority === 'high' ? 'danger' : 'discovery'}>
                          {t(`reviews.aiPriority.${suggest[i.idx].priority}` as MessageKey)}
                        </Pill>
                        <Text color="color.text.subtle">{suggest[i.idx].reason}</Text>
                      </Inline>
                    ) : null}
                  </Stack>
                ),
              },
              {
                key: i.decision ?? '',
                content:
                  i.change === 'removed' ? (
                    <Text color="color.text.subtle">—</Text>
                  ) : (
                    <Stack as="span" space="space.200">
                      {i.recheck ? (
                        <>
                          <Pill tone="warning">{t('reviews.recheck')}</Pill>
                          <Text color="color.text.subtle">
                            {recheckDetail(i.decision, i.recheck.currentPermissions)}
                          </Text>
                        </>
                      ) : i.decision === 'keep' ? (
                        <Pill tone="success">{t('projectReview.keep')}</Pill>
                      ) : i.decision === 'revoke' ? (
                        <Pill tone="danger">{t('projectReview.revoke')}</Pill>
                      ) : i.decision === 'exception' ? (
                        <Pill tone="warning">
                          {i.expiresAt
                            ? t('reviewsView.exceptionUntil', { date: formatLocal(i.expiresAt) })
                            : t('reviews.exception2')}
                        </Pill>
                      ) : i.reasons.includes('Exception expired') ? (
                        <Pill tone="danger">{t('reviews.exceptionExpired')}</Pill>
                      ) : (
                        <Pill>{t('reviews.undecided')}</Pill>
                      )}
                      {i.note ? <Text color="color.text.subtle">“{i.note}”</Text> : null}
                    </Stack>
                  ),
              },
              {
                key: 'actions',
                content:
                  i.change === 'removed' ? null : signed ? (
                    <Button appearance="subtle" onClick={() => openNote(i)}>
                      {t('reviews.details')}
                    </Button>
                  ) : (
                    <Inline as="span" space="space.100" alignBlock="center" shouldWrap>
                      <Button
                        spacing="compact"
                        isDisabled={busy}
                        isSelected={i.decision === 'keep' && !i.recheck}
                        onClick={() => void decide([i.idx], 'keep')}
                      >
                        {t('projectReview.keep')}
                      </Button>
                      <Button
                        spacing="compact"
                        isDisabled={busy}
                        onClick={() => openNote(i, 'revoke')}
                      >
                        {t('reviews.revoke')}
                      </Button>
                      <RowMenu label={t('reviewsView.moreActionsFor', { name: i.subject.name })}>
                        <DropdownItem isDisabled={busy} onClick={() => openNote(i, 'exception')}>
                          {t('reviews.exception')}
                        </DropdownItem>
                        <DropdownItem onClick={() => openNote(i)}>{t('reviews.note')}</DropdownItem>
                      </RowMenu>
                    </Inline>
                  ),
              },
            ],
          }))}
          rowsPerPage={50}
          defaultPage={1}
          emptyView={
            <Text as="p" color="color.text.subtle">
              {t('reviews.noItemsMatch')}
            </Text>
          }
        />
        <Section title={t('reviews.reviewRecord')}>
          <Details
            rows={[
              [
                t('reviewsView.created'),
                t('reviewsView.dateByName', {
                  date: formatLocal(d.review.createdAt),
                  name: d.review.createdByName ?? t('people.jiraAdmin'),
                }),
              ],
              [t('campaigns.due'), d.review.dueAt ? formatLocal(d.review.dueAt) : '—'],
              [
                t('settings.keyPermissions'),
                d.review.keyPermissions.map(permissionLabel).join(', '),
              ],
              [t('reviewsView.baseSnapshotHash'), <Hash key="b" value={d.base?.contentHash} />],
              [t('reviewsView.engineVersion'), d.review.engineVersion],
            ]}
          />
        </Section>
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

function ItemDrawer({
  item,
  readOnly,
  onSave,
  onCancel,
}: {
  item: ReviewItem;
  readOnly: boolean;
  onSave: (
    decision: 'keep' | 'revoke' | 'exception' | null,
    note: string,
    expiresAt?: string | null,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<'keep' | 'revoke' | 'exception' | null>(item.decision);
  const [note, setNote] = useState(item.note ?? '');
  const [expiresOn, setExpiresOn] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const needsJustification = value === 'revoke' || value === 'exception';
  const primaryLabel =
    value === 'exception'
      ? t('reviews.grantException')
      : value === 'revoke'
        ? t('projectReview.revoke')
        : t('settings.save');
  // R-9.3: the primary stays disabled until there is a valid change to the decision or note.
  const canSave = isDecisionChangeValid(item, { value, note, expiresOn });
  return (
    <>
      <DrawerBody>
        <SubjectCell subject={item.subject} />
        <Details
          rows={[
            [t('groups.access'), item.permissions.map(permissionLabel).join(', ')],
            [
              t('projectReview.decided'),
              item.decidedAt
                ? t('reviewsView.dateByName', {
                    date: formatLocal(item.decidedAt),
                    name: item.decidedByName ?? t('people.jiraAdmin'),
                  })
                : '—',
            ],
          ]}
        />
        <Section title={t('projects.why')}>
          <PathList paths={item.reasons} />
        </Section>
        {readOnly ? (
          item.note ? (
            <Text as="p">“{item.note}”</Text>
          ) : null
        ) : (
          <Stack space="space.150">
            <RadioField label={t('reviews.decision')}>
              <RadioGroup
                value={value ?? ''}
                onChange={(e) => setValue((e.target.value || null) as typeof value)}
                options={[
                  {
                    name: 'decision',
                    value: 'keep',
                    label: t('reviews.keepThisAccessIsStillNeeded'),
                  },
                  {
                    name: 'decision',
                    value: 'revoke',
                    label: t('reviews.revokeRemoveThisAccessInJira'),
                  },
                  {
                    name: 'decision',
                    value: 'exception',
                    label: t('reviews.exceptionKeepWithJustificationAndExpiry'),
                  },
                  { name: 'decision', value: '', label: t('reviews.undecided') },
                ]}
              />
            </RadioField>
            <FormField
              label={t('reviews.justification')}
              helper={
                needsJustification
                  ? t('reviews.requiredAtLeast10CharactersBecomes')
                  : t('reviews.optionalNotesBecomePartOfThe')
              }
            >
              {(fid, helperId) => (
                <>
                  <Textarea
                    id={fid}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    resize="vertical"
                    isInvalid={
                      (needsJustification && note.trim().length > 0 && note.trim().length < 10) ||
                      note.length > NOTE_MAX_LENGTH
                    }
                    aria-describedby={`${helperId} ${fid}-character-counter`}
                  />
                  <CharacterCounter
                    inputId={fid}
                    maxCharacters={NOTE_MAX_LENGTH}
                    currentValue={note}
                  />
                </>
              )}
            </FormField>
            {value === 'exception' ? (
              <FormField
                label={t('reviews.expiresOn')}
                helper={t('reviewsView.expiresHelper', {
                  dateHelper: dateHelper(),
                  registered: t('exceptions.registeredOnSave'),
                })}
              >
                {(fid, helperId) => (
                  <DateField
                    id={fid}
                    describedBy={helperId}
                    value={expiresOn}
                    onChange={(d) => setExpiresOn(d)}
                  />
                )}
              </FormField>
            ) : null}
            {/* R-9.4: the save error sits under the fields, next to the pinned Save. */}
            {error ? (
              <SectionMessage appearance="error">
                <Text as="p">{error}</Text>
              </SectionMessage>
            ) : null}
          </Stack>
        )}
      </DrawerBody>
      {readOnly ? null : (
        <DrawerFooter onCancel={onCancel}>
          <Button
            appearance="primary"
            isDisabled={!canSave || busy}
            isLoading={busy}
            onClick={async () => {
              setError('');
              if (needsJustification && note.trim().length < 10) {
                setError(t('reviews.addAJustificationAtLeast10'));
                return;
              }
              if (value === 'exception' && !expiresOn) {
                setError(t('reviews.exceptionExpiryDateIsRequired'));
                return;
              }
              setBusy(true);
              try {
                await onSave(value, note.trim(), value === 'exception' ? expiresOn : null);
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {primaryLabel}
          </Button>
        </DrawerFooter>
      )}
    </>
  );
}

const REMEDIATION_LOZENGE: Record<
  RemediationStatus,
  { readonly label: string; tone: 'neutral' | 'info' | 'success' | 'danger' | 'warning' }
> = {
  pending: {
    get label() {
      return t('reviewsView.remediationPending');
    },
    tone: 'info',
  },
  verified: {
    get label() {
      return t('reviews.verified');
    },
    tone: 'success',
  },
  still_present: {
    get label() {
      return t('planGate.sample.stillPresent');
    },
    tone: 'danger',
  },
  inconclusive: {
    get label() {
      return t('reviewsView.remediationInconclusive');
    },
    tone: 'neutral',
  },
  accepted: {
    get label() {
      return t('reviewsView.remediationAccepted');
    },
    tone: 'warning',
  },
  untracked: {
    get label() {
      return t('reviewsView.remediationUntracked');
    },
    tone: 'neutral',
  },
};

/** Made-up rows for the locked Remediation panel (never real review data). */
function RemediationSample() {
  const rows: Array<[string, string, 'success' | 'info' | 'danger', number]> = [
    [t('planGate.sample.subject1'), t('planGate.sample.verified'), 'success', 12],
    [t('planGate.sample.subject2'), t('planGate.sample.pending'), 'info', 12],
    [t('planGate.sample.subject3'), t('planGate.sample.stillPresent'), 'danger', 12],
  ];
  return (
    <Stack space="space.200">
      <ProgressBar value={1 / 3} />
      <Text color="color.text.subtle">
        {t('planGate.sample.closedOf', { closed: 1, total: 3 })}
      </Text>
      <DynamicTable
        head={{
          cells: [
            { key: 'who', content: t('planGate.sample.colSubject') },
            { key: 'status', content: t('planGate.sample.colStatus') },
            { key: 'snap', content: t('planGate.sample.colSnapshot') },
          ],
        }}
        rows={rows.map(([who, label, tone, seq]) => ({
          key: who,
          cells: [
            { key: 'w', content: who },
            { key: 's', content: <Pill tone={tone}>{label}</Pill> },
            { key: 'c', content: `#${seq}` },
          ],
        }))}
      />
    </Stack>
  );
}

function RemediationPanel({ reviewId, items }: { reviewId: string; items: ReviewItem[] }) {
  const rem = useCall<{
    gated: boolean;
    rows: RemediationRow[];
    summary: { verified: number; total: number; open: number };
  }>('listRemediation', { reviewId });
  // Same source as the "Revoke" summary card: the review's own Revoke decisions. Verification
  // rows (Advanced) only add a status to each entry.
  const { entries, closed, total, untracked } = deriveRemediation(items, rem.data?.rows);
  const gated = rem.data?.gated ?? false;
  const description = gated
    ? t('reviewsView.remediationDescriptionGated')
    : t('reviewsView.remediationDescription');

  if (!total) {
    if (gated) {
      return (
        <Section
          title={t('reviews.remediation')}
          description={t('reviews.whetherRevokeDecisionsDisappearedInA')}
        >
          <PlanGate locked benefit={t('planGate.remediation')}>
            <RemediationSample />
          </PlanGate>
        </Section>
      );
    }
    return (
      <Section title={t('reviews.remediation')}>
        <Text as="p" color="color.text.subtle">
          {t('reviews.noRevokeDecisionsInThisReview')}
        </Text>
      </Section>
    );
  }
  if (rem.error && !rem.data) {
    // R-10.13: a failed load is an error with retry, never an empty result.
    return (
      <Section title={t('reviews.remediation')} description={description}>
        <ErrorState
          title={t('reviews.remediationUnavailable')}
          message={rem.error}
          retry={() => void rem.reload()}
        />
      </Section>
    );
  }
  if (!rem.data) {
    return (
      <Section title={t('reviews.remediation')} description={description}>
        <SkeletonRoot>
          <Phantom height={8} radius="full" />
          {/* Gating is only known after the load; Advanced (the default) has the snapshot column. */}
          <SkeletonTable
            columns={[
              t('exceptions.subject'),
              t('reviews.where'),
              t('groups.access'),
              t('campaigns.status'),
              t('reviews.checkedInSnapshot'),
            ]}
            rows={3}
          />
        </SkeletonRoot>
      </Section>
    );
  }
  return (
    <Section title={t('reviews.remediation')} description={description}>
      <Stack space="space.200">
        {!gated && untracked < total ? (
          <>
            <ProgressBar
              value={total ? closed / total : 0}
              ariaLabel={t('reviews.remediationProgress')}
            />
            <Text color="color.text.subtle">
              {t('reviewsView.revocationsClosed', { closed, total })}
            </Text>
          </>
        ) : (
          <Text color="color.text.subtle">
            {t('reviewsView.revocationsToRemove', { count: total })}
          </Text>
        )}
        {!gated && untracked ? (
          <Text as="p" color="color.text.subtle">
            {untracked === total && total > 1
              ? t('reviewsView.untrackedAll')
              : t('reviewsView.untrackedSome', { count: untracked })}
          </Text>
        ) : null}
        <DynamicTable
          head={{
            cells: [
              { key: 'who', content: t('exceptions.subject') },
              { key: 'where', content: t('reviews.where') },
              { key: 'access', content: t('groups.access') },
              { key: 'status', content: t('campaigns.status') },
              ...(gated ? [] : [{ key: 'snap', content: t('reviews.checkedInSnapshot') }]),
            ],
          }}
          rows={entries.map((e) => {
            const { label, tone } = REMEDIATION_LOZENGE[e.status];
            return {
              key: String(e.item.idx),
              cells: [
                { key: 'w', content: <SubjectCell subject={e.item.subject} compact /> },
                {
                  key: 'p',
                  content: e.item.project ? (
                    <Text weight="bold">{e.item.project.key}</Text>
                  ) : (
                    (e.item.groupName ?? t('reviews.site'))
                  ),
                },
                { key: 'a', content: e.item.permissions.map(permissionLabel).join(', ') },
                {
                  key: 's',
                  content: (
                    <Stack as="span" space="space.200">
                      <Pill tone={tone}>
                        {e.status === 'verified' && e.verifiedSeq
                          ? t('reviewsView.verifiedSeq', { seq: e.verifiedSeq })
                          : label}
                      </Pill>
                      {e.detail && e.checkCount >= 3 ? (
                        <Text color="color.text.subtle">{e.detail}</Text>
                      ) : null}
                    </Stack>
                  ),
                },
                ...(gated
                  ? []
                  : [{ key: 'c', content: e.checkedSeq != null ? `#${e.checkedSeq}` : '—' }]),
              ],
            };
          })}
          rowsPerPage={25}
          defaultPage={1}
        />
        {gated ? <PlanNote benefit={t('planGate.remediation')} /> : null}
      </Stack>
    </Section>
  );
}

type VerifyJob = {
  id: string;
  status: 'pending' | 'running' | 'ok' | 'mismatch' | 'purged' | 'error';
  expectedHash: string | null;
  actualHash: string | null;
  error: string | null;
};

type ChainVerifyResult = {
  ok: boolean;
  length: number;
  brokenAt?: number;
  reason?: string;
  links: Array<{ chainSeq: number; id: string; ok: boolean; reason?: string }>;
};

function VerifyChainPanel({ onDone }: { onDone: () => void }) {
  const [result, setResult] = useState<ChainVerifyResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const run = async () => {
    setError('');
    setBusy(true);
    try {
      setResult(await call<ChainVerifyResult>('verifyChain', {}));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void run();
  }, []);
  return (
    <>
      <DrawerBody>
        {error ? (
          <ErrorState
            title={t('reviews.chainCouldNotBeVerified')}
            message={error}
            retry={() => void run()}
          />
        ) : busy || !result ? (
          // Mirrors the loaded result: status lozenge, then the chain table (R-10.1, R-10.8).
          <SkeletonRoot>
            <Phantom width={120} height={20} radius="full" />
            <SkeletonTable
              columns={[t('reviews.chain'), t('campaigns.status'), t('activity.detail')]}
              rows={3}
            />
          </SkeletonRoot>
        ) : (
          <Stack space="space.200">
            <Pill tone={result.ok ? 'success' : 'danger'}>
              {result.ok
                ? t('reviewsView.chainIntact', { count: result.length })
                : t('reviewsView.chainBroken', { seq: result.brokenAt ?? '?' })}
            </Pill>
            {!result.ok && result.reason ? (
              <SectionMessage appearance="error">
                <Text as="p">{result.reason}</Text>
              </SectionMessage>
            ) : null}
            {result.length ? (
              <DynamicTable
                head={{
                  cells: [
                    { key: 'seq', content: t('reviews.chain') },
                    { key: 'ok', content: t('campaigns.status') },
                    { key: 'reason', content: t('activity.detail') },
                  ],
                }}
                rows={result.links.map((l) => ({
                  key: String(l.chainSeq),
                  cells: [
                    { key: l.chainSeq, content: String(l.chainSeq) },
                    {
                      key: l.ok ? 'ok' : 'bad',
                      content: (
                        <Pill tone={l.ok ? 'success' : 'danger'}>
                          {l.ok ? t('reviews.ok') : t('reviews.break')}
                        </Pill>
                      ),
                    },
                    {
                      key: l.reason ?? '',
                      content: l.reason ?? <Text color="color.text.subtle">—</Text>,
                    },
                  ],
                }))}
                rowsPerPage={50}
                defaultPage={1}
              />
            ) : (
              <Text as="p" color="color.text.subtle">
                {t('reviews.noChainedSignaturesYet')}
              </Text>
            )}
          </Stack>
        )}
      </DrawerBody>
      <DrawerFooter>
        <Button appearance="primary" onClick={onDone}>
          {t('adminNav.close')}
        </Button>
      </DrawerFooter>
    </>
  );
}

function VerifyDrawer({
  reviewId,
  snapshotSeq,
  snapshotHash,
  onClose,
}: {
  reviewId: string;
  snapshotSeq: number;
  snapshotHash: string | null;
  onClose: () => void;
}) {
  const [sig, setSig] = useState<{
    ok: boolean;
    signatureVersion: number;
    evidenceHash: string | null;
    recomputed: string;
  } | null>(null);
  const [sigError, setSigError] = useState('');
  const [job, setJob] = useState<VerifyJob | null>(null);
  const [deepError, setDeepError] = useState('');
  const [polling, setPolling] = useState(false);

  const checkSignature = async () => {
    setSigError('');
    try {
      const v = await call<{
        ok: boolean;
        signatureVersion: number;
        evidenceHash: string | null;
        recomputed: string;
      }>('verifyReview', { id: reviewId });
      setSig(v);
    } catch (e) {
      setSigError(errorText(e));
    }
  };

  useEffect(() => {
    void checkSignature();
  }, [reviewId]);

  useEffect(() => {
    if (!polling || !job?.id) return;
    if (
      job.status === 'ok' ||
      job.status === 'mismatch' ||
      job.status === 'purged' ||
      job.status === 'error'
    ) {
      setPolling(false);
      return;
    }
    const t = window.setTimeout(() => {
      void call<VerifyJob>('getVerifyJob', { jobId: job.id })
        .then(setJob)
        .catch((e) => {
          setDeepError(errorText(e));
          setPolling(false);
        });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [polling, job]);

  const startDeep = async () => {
    setDeepError('');
    setPolling(true);
    try {
      const r = await call<{ jobId: string }>('startSnapshotVerify', { reviewId });
      setJob({
        id: r.jobId,
        status: 'pending',
        expectedHash: snapshotHash,
        actualHash: null,
        error: null,
      });
    } catch (e) {
      setDeepError(errorText(e));
      setPolling(false);
    }
  };

  const deepDone =
    job &&
    (job.status === 'ok' ||
      job.status === 'mismatch' ||
      job.status === 'purged' ||
      job.status === 'error');

  return (
    <>
      <DrawerBody>
        <Section title={t('reviews.signature')}>
          {sigError ? (
            <ErrorState
              title={t('reviews.signatureCouldNotBeChecked')}
              message={sigError}
              retry={() => void checkSignature()}
            />
          ) : !sig ? (
            <SkeletonRoot>
              <Phantom width={80} height={16} />
              <DetailsPhantom
                terms={[
                  t('reviewsView.signatureVersion'),
                  t('reviewsView.storedHash'),
                  t('reviewsView.recomputed'),
                ]}
              />
            </SkeletonRoot>
          ) : (
            <Stack space="space.200">
              <Pill tone={sig.ok ? 'success' : 'danger'}>
                {sig.ok ? t('reviews.verified') : t('reviews.mismatch')}
              </Pill>
              <Details
                rows={[
                  [t('reviewsView.signatureVersion'), String(sig.signatureVersion)],
                  [t('reviewsView.storedHash'), <Hash key="sh" value={sig.evidenceHash} />],
                  [t('reviewsView.recomputed'), <Hash key="rh" value={sig.recomputed} />],
                ]}
              />
              {!sig.ok ? (
                <SectionMessage appearance="error">
                  <Text as="p">{t('reviews.storedRecordsNoLongerMatchThe')}</Text>
                </SectionMessage>
              ) : null}
            </Stack>
          )}
        </Section>
        <Section title={t('reviews.snapshotIntegrity')}>
          <Text as="p" color="color.text.subtle">
            {t('reviewsView.recomputesHash', { seq: snapshotSeq })}
          </Text>
          {/* Default appearance: the footer already holds the panel's one primary (Done). */}
          {!job ? (
            <Button onClick={() => void startDeep()}>{t('reviews.checkSnapshotIntegrity')}</Button>
          ) : null}
          {polling && !deepDone ? (
            <Stack space="space.200">
              <ProgressBar isIndeterminate />
              <Text color="color.text.subtle">{t('reviews.checkingSnapshotFacts')}</Text>
            </Stack>
          ) : null}
          {deepError ? (
            <ErrorState
              title={t('reviews.snapshotIntegrityCouldNotBeChecked')}
              message={deepError}
              retry={() => {
                setJob(null);
                void startDeep();
              }}
            />
          ) : null}
          {job?.status === 'purged' ? (
            <SectionMessage appearance="warning">
              <Text as="p">{t('reviews.snapshotDataWasDeletedByRetention')}</Text>
            </SectionMessage>
          ) : null}
          {deepDone && job.status !== 'purged' ? (
            <Stack space="space.200">
              <Pill tone={job.status === 'ok' ? 'success' : 'danger'}>
                {job.status === 'ok' ? t('reviews.verified') : t('reviews.mismatch')}
              </Pill>
              <Details
                rows={[
                  [t('reviewsView.expected'), <Hash key="eh" value={job.expectedHash} />],
                  [t('reviewsView.actual'), <Hash key="ah" value={job.actualHash} />],
                ]}
              />
              {job.status === 'mismatch' ? (
                <SectionMessage appearance="error">
                  <Text as="p">{t('reviews.recomputedSnapshotHashDoesNotMatch')}</Text>
                </SectionMessage>
              ) : null}
            </Stack>
          ) : null}
        </Section>
      </DrawerBody>
      <DrawerFooter>
        <Button appearance="primary" onClick={onClose}>
          {t('getStarted.done')}
        </Button>
      </DrawerFooter>
    </>
  );
}

function SignDrawer({
  detail,
  onSigned,
  onCancel,
}: {
  detail: ReviewDetail;
  onSigned: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const items = detail.items.filter((i) => i.change !== 'removed');
  const sign = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await call<{ evidenceHash: string; signedAt: number }>('signReview', {
        id: detail.review.id,
        attest: true,
        tz: timeZone(),
      });
      toast.success(
        t('reviews.reviewSigned'),
        t('reviewsView.evidenceHashToast', { hash: r.evidenceHash.slice(0, 16) }),
      );
      onSigned();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <DrawerBody>
        <Details
          rows={[
            [t('projectReview.items'), String(items.length)],
            [t('projectReview.keep'), String(items.filter((i) => i.decision === 'keep').length)],
            [
              t('projectReview.revoke'),
              String(items.filter((i) => i.decision === 'revoke').length),
            ],
            [
              t('reviews.exception2'),
              String(items.filter((i) => i.decision === 'exception').length),
            ],
            [t('reviewsView.signedAt'), t('reviewsView.signedAtNow', { tz: timeZone() })],
          ]}
        />
        <Text as="p" color="color.text.subtle">
          {t('reviews.signingLocksTheReviewSignatureV2')}
        </Text>
        <Checkbox
          isChecked={attest}
          onChange={(e) => setAttest(e.target.checked)}
          label={t('reviewsView.attestation')}
        />
        {error ? (
          <SectionMessage appearance="error">
            <Text as="p">{error}</Text>
          </SectionMessage>
        ) : null}
      </DrawerBody>
      <DrawerFooter onCancel={onCancel}>
        <Button
          appearance="primary"
          isDisabled={!attest}
          isLoading={busy}
          onClick={() => void sign()}
        >
          {t('reviews.signOff')}
        </Button>
      </DrawerFooter>
    </>
  );
}
