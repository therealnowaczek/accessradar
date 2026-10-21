import EmptyState from '@atlaskit/empty-state';
import { useEffect, useMemo, useState } from 'react';
import { Inline, Stack, Text } from '@atlaskit/primitives';
import Button from '@atlaskit/button/new';
import Checkbox from '@atlaskit/checkbox';
import { DropdownItem } from '@atlaskit/dropdown-menu';
import DynamicTable from '../Table';
import ArrowLeftIcon from '@atlaskit/icon/core/arrow-left';
import ProgressBar from '@atlaskit/progress-bar';
import { RadioGroup } from '@atlaskit/radio';
import SectionMessage from '@atlaskit/section-message';
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
} from '../components';
import { useCall } from '../data';
import { useConfirm } from '../Confirm';
import { DrawerBody, DrawerFooter, LevelDrawer, type DrawerLevel } from '../Drawer';
import { downloadCsv, downloadMarkdown, downloadPdf } from '../export/download';
import { reviewCsv, reviewFileName, reviewMarkdown, reviewPdf } from '../export/evidence';
import {
  evidencePackFileName,
  evidencePackPdf,
  type EvidencePackPayload,
} from '../export/evidencePack';
import { formatLocal, formatUtc, permissionLabel, plural, timeZone } from '../format';
import { t } from '../i18n';
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
  LinesPhantom,
  MetricGridPhantom,
  Phantom,
  SkeletonRoot,
} from '../skeletons';
import { ActionsHeader, SkeletonTable } from '../skeletonTable';

const STATUS: Record<ReviewSummary['status'], [string, 'neutral' | 'info' | 'success']> = {
  draft: ['Draft', 'neutral'],
  in_progress: ['In progress', 'info'],
  signed: ['Signed', 'success'],
};

export function ReviewsView() {
  const { params, go } = useApp();
  if (params.reviewId)
    return <ReviewDetailView id={params.reviewId} onBack={() => go('reviews')} />;
  return <ReviewList autoCreate={params.create === '1'} />;
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
        title: 'Start an access review',
        description:
          'Items are pinned to the base snapshot; later changes do not alter this review.',
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
  const openVerifyChain = () =>
    setDrawer([
      {
        key: 'verify-chain',
        title: 'Verify signature chain',
        description: 'Checks that signed reviews form a contiguous hash-linked sequence.',
        content: <VerifyChainPanel onDone={() => setDrawer([])} />,
      },
    ]);
  const header = (
    <PageHeader
      title={meta.title}
      description={meta.description}
      actions={
        <>
          {hasChained ? (
            <Button appearance="subtle" onClick={openVerifyChain}>
              Verify chain
            </Button>
          ) : null}
          {/* No duplicate CTA: an empty list carries "Start a review" in its empty state. */}
          {list.data && !reviews.length ? null : (
            <Button appearance="primary" isDisabled={!hasSnapshot} onClick={openCreate}>
              Start a review
            </Button>
          )}
        </>
      }
    />
  );
  return (
    <PageFrame notice={staleNotice(list)} header={header}>
      <Stack space="space.300">
        {list.error && !list.data ? (
          <ErrorState title="Reviews unavailable" message={list.error} retry={list.reload} />
        ) : !list.data || (status.loading && !status.data) ? (
          <SkeletonRoot>
            <SkeletonTable
              columns={['Review', 'Status', 'Chain #', 'Decided', 'Revoke', 'Due', 'Signed']}
            />
          </SkeletonRoot>
        ) : !hasSnapshot && !reviews.length ? (
          <NoSnapshot what="and review access" />
        ) : !reviews.length ? (
          <EmptyState
            header="No reviews yet"
            description="A review lists who has key permissions in the chosen scope. Reviewers mark each item keep or revoke, then sign off; the evidence pack is hashed."
            primaryAction={
              <Button appearance="primary" onClick={openCreate}>
                Start a review
              </Button>
            }
          />
        ) : (
          <DynamicTable
            head={{
              cells: [
                { key: 'name', content: 'Review', isSortable: true },
                { key: 'status', content: 'Status', isSortable: true },
                { key: 'chain', content: 'Chain #', isSortable: true },
                { key: 'progress', content: 'Decided' },
                { key: 'flagged', content: 'Revoke', isSortable: true },
                { key: 'due', content: 'Due', isSortable: true },
                { key: 'signed', content: 'Signed', isSortable: true },
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
                        {r.scope.type === 'site'
                          ? 'Whole site'
                          : plural(
                              r.scope.ids.length,
                              r.scope.type === 'projects' ? 'space' : 'group',
                            )}{' '}
                        · snapshot #{r.baseSeq}
                      </Text>
                    </>
                  ),
                },
                {
                  key: r.status,
                  content: <Pill tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Pill>,
                },
                {
                  key: r.chainSeq ?? 0,
                  content:
                    r.status === 'signed' ? (
                      r.chainSeq != null ? (
                        String(r.chainSeq)
                      ) : (
                        <Text color="color.text.subtle">pre-chain</Text>
                      )
                    ) : (
                      <Text color="color.text.subtle">—</Text>
                    ),
                },
                { key: 'p', content: `${r.decided ?? 0} of ${r.itemCount}` },
                { key: r.flagged ?? 0, content: r.flagged ?? 0 },
                {
                  key: r.dueAt ?? 0,
                  content: r.dueAt ? (
                    <Inline as="span" space="space.075" alignBlock="center" shouldWrap>
                      {formatLocal(r.dueAt).split(',')[0]}
                      {r.status !== 'signed' && r.dueAt < now ? (
                        <Pill tone="danger">Overdue</Pill>
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
  const [name, setName] = useState(`Access review ${new Date().toISOString().slice(0, 7)}`);
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
  const submit = async () => {
    setError('');
    if (!name.trim()) return setError('Give the review a name.');
    if (scope !== 'site' && !ids.length)
      return setError(`Pick at least one ${scope === 'projects' ? 'space' : 'group'}.`);
    setBusy(true);
    try {
      const r = await call<{ id: string; items: number }>('createReview', {
        name: name.trim(),
        scope: { type: scope, ids: ids.map((o) => o.value) },
        baseSeq: base,
        compareSeq: compare,
        dueAt: due ? new Date(`${due}T23:59:59`).getTime() : null,
      });
      toast.success('Review started', `${plural(r.items, 'item')} to review.`);
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
          <FormField label="Name">
            {(id) => (
              <Textfield
                id={id}
                value={name}
                onChange={(e) => setName((e.target as HTMLInputElement).value)}
                maxLength={200}
              />
            )}
          </FormField>
          <RadioField label="Scope">
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
                  label: 'Whole site (all spaces, Jira admins and application access)',
                },
                { name: 'scope', value: 'projects', label: 'Selected spaces' },
                { name: 'scope', value: 'groups', label: 'Selected groups (membership review)' },
              ]}
            />
          </RadioField>
          {scope !== 'site' ? (
            <FormField label={scope === 'projects' ? 'Spaces' : 'Groups'}>
              {(id) => (
                <Select<Opt, true>
                  menuPosition="fixed"
                  inputId={id}
                  isMulti
                  options={options}
                  value={ids}
                  onChange={(v) => setIds([...v])}
                  isLoading={projects.loading || groups.loading}
                  placeholder="Search…"
                />
              )}
            </FormField>
          ) : null}
          <FormField label="Base snapshot">
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
            label="Compare with (optional)"
            helper="Marks items as new since the older snapshot, and lists access removed since then."
          >
            {(id) => (
              <Select<{ label: string; value: number }>
                menuPosition="fixed"
                inputId={id}
                options={[
                  { label: 'No comparison', value: 0 },
                  ...older.map((s) => ({
                    label: `#${s.seq} · ${formatLocal(s.startedAt)}`,
                    value: s.seq,
                  })),
                ]}
                value={
                  compare
                    ? { label: `#${compare}`, value: compare }
                    : { label: 'No comparison', value: 0 }
                }
                onChange={(o) => setCompare(o && o.value ? o.value : null)}
                isSearchable={false}
              />
            )}
          </FormField>
          <FormField label="Due date (optional)">
            {(id) => <DateField id={id} value={due} onChange={(v) => setDue(v)} />}
          </FormField>
          <Text as="p" color="color.text.subtle">
            Reviewers are Jira administrators. Key permissions from Settings define which access is
            listed.
          </Text>
          {error ? (
            <SectionMessage appearance="error">
              <Text as="p">{error}</Text>
            </SectionMessage>
          ) : null}
        </Stack>
      </DrawerBody>
      <DrawerFooter onCancel={onCancel}>
        <Button appearance="primary" isLoading={busy} onClick={() => void submit()}>
          Start review
        </Button>
      </DrawerFooter>
    </>
  );
}

const DECISIONS: Opt[] = [
  { label: 'All decisions', value: '' },
  { label: 'Undecided', value: 'none' },
  { label: 'Keep', value: 'keep' },
  { label: 'Revoke', value: 'revoke' },
  { label: 'Exception', value: 'exception' },
];
const CHANGES: Opt[] = [
  { label: 'All items', value: '' },
  { label: 'New since comparison', value: 'new' },
  { label: 'Unchanged', value: 'unchanged' },
  { label: 'Removed since comparison', value: 'removed' },
];

function ReviewDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { siteUrl } = useApp();
  const toast = useToast();
  const r = useCall<ReviewDetail>('getReview', { id });
  const [drawer, setDrawer] = useState<DrawerLevel[]>([]);
  const [confirmDialog, confirm] = useConfirm();
  const [query, setQuery] = useState('');
  const [decision, setDecision] = useState('');
  const [change, setChange] = useState('');
  const [busy, setBusy] = useState(false);
  const exporter = useExporter();
  const d = r.data;
  const signed = d?.review.status === 'signed';

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (d?.items ?? []).filter(
      (i) =>
        (!decision ||
          (decision === 'none'
            ? !i.decision && i.change !== 'removed'
            : i.decision === decision)) &&
        (!change || i.change === change) &&
        (!q ||
          `${i.subject.name} ${i.project?.key ?? ''} ${i.groupName ?? ''} ${i.reasons.join(' ')} ${i.note ?? ''}`
            .toLowerCase()
            .includes(q)),
    );
  }, [d, query, decision, change]);

  const decidable = (d?.items ?? []).filter((i) => i.change !== 'removed');
  const decided = decidable.filter((i) => i.decision).length;
  const flagged = revokeDecisions(d?.items ?? []).length;
  const pending = decidable.length - decided;

  const decide = async (
    idxs: number[],
    value: 'keep' | 'revoke' | 'exception' | null,
    note?: string,
    expiresAt?: string | null,
  ) => {
    if (!idxs.length) return;
    setBusy(true);
    try {
      const res = await call<{ changed: number }>('decideItems', {
        id,
        idxs,
        decision: value,
        tz: timeZone(),
        ...(note !== undefined ? { note } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      });
      if (idxs.length > 1) toast.success(`${plural(res.changed, 'decision')} updated`);
      r.reload();
    } catch (e) {
      toast.error('Decision not saved', errorText(e));
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
              ? `Grant exception (${idxs.length})`
              : 'Grant exception'
            : preset === 'revoke'
              ? multi
                ? `Revoke access (${idxs.length})`
                : 'Revoke access'
              : sample.subject.name,
        description: multi
          ? 'One justification applies to every selected item.'
          : sample.project
            ? `${sample.project.key} · ${sample.project.name}`
            : (sample.groupName ?? 'Site'),
        content: (
          <ItemDrawer
            item={{ ...sample, decision: preset ?? sample.decision }}
            readOnly={signed}
            onSave={async (value, note, expiresAt) => {
              await decide(idxs, value, note, expiresAt);
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
        title: 'Sign off review',
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
        title: 'Verify signature & chain',
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
      title: `Delete review "${d?.review.name ?? ''}"?`,
      confirmLabel: 'Delete review',
      onConfirm: async () => {
        try {
          await call('deleteReview', { id });
          toast.success('Review deleted');
          onBack();
        } catch (e) {
          toast.error('Review not deleted', errorText(e));
        }
      },
      body: (
        <Text as="p">
          This deletes the draft review and its decisions. Snapshots are not affected. Signed
          reviews cannot be deleted.
        </Text>
      ),
    });

  const header = (
    <PageHeader
      title={d?.review.name ?? 'Review'}
      description={
        d
          ? `${d.review.scope.type === 'site' ? 'Whole site' : `${d.review.scope.type}: ${d.review.scopeLabels.slice(0, 6).join(', ')}${d.review.scopeLabels.length > 6 ? '…' : ''}`} · snapshot #${d.review.baseSeq}${d.review.compareSeq ? ` vs #${d.review.compareSeq}` : ''}`
          : undefined
      }
      status={
        d ? <Pill tone={STATUS[d.review.status][1]}>{STATUS[d.review.status][0]}</Pill> : null
      }
      actions={
        <>
          {/* Controls → secondaries → primary last (family header CTA order). */}
          <Button iconBefore={ArrowLeftIcon} onClick={onBack}>
            All reviews
          </Button>
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
          />
          {signed ? <Button onClick={openVerify}>Verify signature & chain</Button> : null}
          {!signed ? (
            <Button appearance="subtle" onClick={openDelete} isDisabled={!d}>
              Delete
            </Button>
          ) : null}
          {signed ? (
            <Button
              appearance="primary"
              onClick={() =>
                void exporter('Evidence pack', async () => {
                  const allItems: EvidencePackPayload['items'] = [];
                  let page = 1;
                  let first: EvidencePackPayload | null = null;
                  for (;;) {
                    const pack = await call<EvidencePackPayload>('getEvidencePack', {
                      id,
                      page,
                      pageSize: 500,
                    });
                    if (!first) first = pack;
                    allItems.push(...pack.items);
                    if (!pack.nextPage) break;
                    page = pack.nextPage;
                  }
                  if (!first) throw new Error('Empty evidence pack');
                  downloadPdf(
                    evidencePackFileName(d!.review.name, id),
                    await evidencePackPdf(first, allItems, exportContext(siteUrl)),
                  );
                  logExport('evidence-pack', id, d!.limitations?.version);
                })
              }
            >
              Download evidence pack
            </Button>
          ) : (
            <Button appearance="primary" isDisabled={!d || pending > 0} onClick={openSign}>
              Sign off
            </Button>
          )}
        </>
      }
    />
  );

  if (r.error && !d)
    return (
      <PageFrame header={header}>
        <ErrorState title="Review unavailable" message={r.error} retry={r.reload} />
      </PageFrame>
    );
  if (!d)
    return (
      <PageFrame header={header}>
        <SkeletonRoot>
          <MetricGridPhantom count={4} />
          <FilterBarPhantom controls={3} />
          <SkeletonTable
            columns={['Who', 'Where', 'Access', 'Why', 'Decision', <ActionsHeader key="a" />]}
          />
        </SkeletonRoot>
      </PageFrame>
    );
  const filteredOpen = items.filter((i) => i.change !== 'removed').map((i) => i.idx);
  return (
    <PageFrame notice={staleNotice(r)} header={header}>
      <Stack space="space.300">
        {signed ? (
          <SectionMessage
            appearance="success"
            title={`Signed by ${d.review.signedByName ?? 'Jira admin'}`}
          >
            <Stack space="space.200">
              <Text as="p">
                {formatUtc(d.review.signedAt)} ·{' '}
                {formatLocal(d.review.signedAt, d.review.signerTz ?? timeZone())} (
                {d.review.signerTz}). This review is read-only.
              </Text>
              <Details
                rows={[
                  ['Evidence hash (SHA-256)', <Hash key="h" value={d.review.evidenceHash} />],
                  [
                    `Snapshot #${d.review.baseSeq} hash`,
                    <Hash key="s" value={d.base?.contentHash} />,
                  ],
                  ['Chain #', d.review.chainSeq != null ? String(d.review.chainSeq) : 'pre-chain'],
                  [
                    'Previous hash',
                    d.review.prevReviewHash ? (
                      <Hash key="p" value={d.review.prevReviewHash} />
                    ) : (
                      '—'
                    ),
                  ],
                  ['Signature', `v${d.review.signatureVersion ?? 1}`],
                ]}
              />
            </Stack>
          </SectionMessage>
        ) : null}
        {signed ? <RemediationPanel reviewId={id} items={d.items} /> : null}
        <CoverageLimitations coverage={d.coverage} limitations={d.limitations} />
        <MetricGrid>
          <Metric
            label="Items"
            value={decidable.length}
            hint={
              d.review.compareSeq
                ? `${decidable.filter((i) => i.change === 'new').length} new`
                : undefined
            }
          />
          <Metric
            label="Decided"
            value={decided}
            hint={pending ? `${pending} to go` : 'All decided'}
          />
          <Metric label="Keep" value={decidable.filter((i) => i.decision === 'keep').length} />
          <Metric label="Revoke" value={flagged} hint="Remove manually in Jira" />
        </MetricGrid>
        <FilterBar>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search people, spaces, paths, notes"
          />
          {(
            [
              ['Decision', DECISIONS, decision, setDecision],
              ...(d.review.compareSeq ? [['Change', CHANGES, change, setChange]] : []),
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
              <Button
                isDisabled={busy || !filteredOpen.length}
                onClick={() => void decide(filteredOpen, 'keep')}
              >
                Keep{' '}
                {filteredOpen.length === decidable.length ? 'all' : `${filteredOpen.length} shown`}
              </Button>
              <Button
                isDisabled={busy || !filteredOpen.length}
                onClick={() => openDecide(filteredOpen, 'revoke')}
              >
                Revoke{' '}
                {filteredOpen.length === decidable.length ? 'all' : `${filteredOpen.length} shown`}
              </Button>
              <Button
                isDisabled={busy || !filteredOpen.length}
                onClick={() => openDecide(filteredOpen, 'exception')}
              >
                Exception{' '}
                {filteredOpen.length === decidable.length ? 'all' : `${filteredOpen.length} shown`}
              </Button>
            </>
          ) : null}
        </FilterBar>
        <DynamicTable
          head={{
            cells: [
              { key: 'who', content: 'Who', isSortable: true },
              {
                key: 'where',
                content: d.review.scope.type === 'groups' ? 'Group' : 'Where',
                isSortable: true,
              },
              { key: 'access', content: 'Access' },
              { key: 'why', content: 'Why' },
              { key: 'decision', content: 'Decision', isSortable: true },
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
                      <Pill tone="info">New</Pill>
                    ) : i.change === 'removed' ? (
                      <Pill tone="neutral">Removed since comparison</Pill>
                    ) : null}
                  </Stack>
                ),
              },
              {
                key: i.project?.key ?? i.groupName ?? 'site',
                content: i.project ? (
                  <Text weight="bold">{i.project.key}</Text>
                ) : (
                  (i.groupName ?? 'Site')
                ),
              },
              { key: 'access', content: i.permissions.map(permissionLabel).join(', ') },
              {
                key: 'why',
                content: (
                  <WrapAnywhere>
                    <Text color="color.text.subtle">
                      {i.reasons[0]}
                      {i.reasons.length > 1 ? ` (+${i.reasons.length - 1})` : ''}
                    </Text>
                  </WrapAnywhere>
                ),
              },
              {
                key: i.decision ?? '',
                content:
                  i.change === 'removed' ? (
                    <Text color="color.text.subtle">—</Text>
                  ) : (
                    <Stack as="span" space="space.200">
                      {i.decision === 'keep' ? (
                        <Pill tone="success">Keep</Pill>
                      ) : i.decision === 'revoke' ? (
                        <Pill tone="danger">Revoke</Pill>
                      ) : i.decision === 'exception' ? (
                        <Pill tone="warning">
                          {i.expiresAt
                            ? `Exception until ${formatLocal(i.expiresAt)}`
                            : 'Exception'}
                        </Pill>
                      ) : i.reasons.includes('Exception expired') ? (
                        <Pill tone="danger">Exception expired</Pill>
                      ) : (
                        <Pill>Undecided</Pill>
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
                      Details
                    </Button>
                  ) : (
                    <Inline as="span" space="space.100" alignBlock="center" shouldWrap>
                      <Button
                        spacing="compact"
                        isDisabled={busy}
                        isSelected={i.decision === 'keep'}
                        onClick={() => void decide([i.idx], 'keep')}
                      >
                        Keep
                      </Button>
                      <Button
                        spacing="compact"
                        isDisabled={busy}
                        onClick={() => openNote(i, 'revoke')}
                      >
                        Revoke…
                      </Button>
                      <RowMenu label={`More actions for ${i.subject.name}`}>
                        <DropdownItem isDisabled={busy} onClick={() => openNote(i, 'exception')}>
                          Exception…
                        </DropdownItem>
                        <DropdownItem onClick={() => openNote(i)}>Note</DropdownItem>
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
              No items match.
            </Text>
          }
        />
        <Section title="Review record">
          <Details
            rows={[
              [
                'Created',
                `${formatLocal(d.review.createdAt)} by ${d.review.createdByName ?? 'Jira admin'}`,
              ],
              ['Due', d.review.dueAt ? formatLocal(d.review.dueAt) : '—'],
              ['Key permissions', d.review.keyPermissions.map(permissionLabel).join(', ')],
              ['Base snapshot hash', <Hash key="b" value={d.base?.contentHash} />],
              ['Engine version', d.review.engineVersion],
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
    value === 'exception' ? 'Grant exception' : value === 'revoke' ? 'Revoke' : 'Save';
  return (
    <>
      <DrawerBody>
        <SubjectCell subject={item.subject} />
        <Details
          rows={[
            ['Access', item.permissions.map(permissionLabel).join(', ')],
            [
              'Decided',
              item.decidedAt
                ? `${formatLocal(item.decidedAt)} by ${item.decidedByName ?? 'Jira admin'}`
                : '—',
            ],
          ]}
        />
        <Section title="Why">
          <PathList paths={item.reasons} />
        </Section>
        {readOnly ? (
          item.note ? (
            <Text as="p">“{item.note}”</Text>
          ) : null
        ) : (
          <Stack space="space.150">
            {error ? (
              <SectionMessage appearance="error">
                <Text as="p">{error}</Text>
              </SectionMessage>
            ) : null}
            <RadioField label="Decision">
              <RadioGroup
                value={value ?? ''}
                onChange={(e) => setValue((e.target.value || null) as typeof value)}
                options={[
                  { name: 'decision', value: 'keep', label: 'Keep: this access is still needed' },
                  {
                    name: 'decision',
                    value: 'revoke',
                    label: 'Revoke: remove this access in Jira',
                  },
                  {
                    name: 'decision',
                    value: 'exception',
                    label: 'Exception: keep with justification and expiry',
                  },
                  { name: 'decision', value: '', label: 'Undecided' },
                ]}
              />
            </RadioField>
            <FormField
              label="Justification"
              helper={
                needsJustification
                  ? 'Required · at least 10 characters. Becomes part of the evidence.'
                  : 'Optional. Notes become part of the evidence.'
              }
            >
              {(fid) => (
                <Textarea
                  id={fid}
                  value={note}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                  resize="vertical"
                  isInvalid={
                    needsJustification && note.trim().length > 0 && note.trim().length < 10
                  }
                />
              )}
            </FormField>
            {value === 'exception' ? (
              <FormField
                label="Expires on"
                helper="Date-only · stored as end of that day in your timezone."
              >
                {(fid) => (
                  <DateField id={fid} value={expiresOn} onChange={(d) => setExpiresOn(d)} />
                )}
              </FormField>
            ) : null}
          </Stack>
        )}
      </DrawerBody>
      {readOnly ? null : (
        <DrawerFooter onCancel={onCancel}>
          <Button
            appearance="primary"
            isLoading={busy}
            onClick={async () => {
              setError('');
              if (needsJustification && note.trim().length < 10) {
                setError('Add a justification (at least 10 characters)');
                return;
              }
              if (value === 'exception' && !expiresOn) {
                setError('Exception expiry date is required');
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

const ATTESTATION =
  'I confirm that I reviewed every access item in this scope and that the decisions recorded here reflect my assessment.';

const REMEDIATION_LOZENGE: Record<
  RemediationStatus,
  [string, 'neutral' | 'info' | 'success' | 'danger' | 'warning']
> = {
  pending: ['Pending', 'info'],
  verified: ['Verified', 'success'],
  still_present: ['Still present', 'danger'],
  inconclusive: ['Inconclusive', 'neutral'],
  accepted: ['Accepted risk', 'warning'],
  untracked: ['Remove in Jira', 'neutral'],
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
    ? 'Revoke decisions to carry out manually in Jira.'
    : 'Revoke decisions to carry out manually in Jira, and whether each access disappeared in a later snapshot.';

  if (!total) {
    if (gated) {
      return (
        <Section
          title="Remediation"
          description="Whether Revoke decisions disappeared in a later snapshot."
        >
          <PlanGate locked benefit={t('planGate.remediation')}>
            <RemediationSample />
          </PlanGate>
        </Section>
      );
    }
    return (
      <Section title="Remediation">
        <Text as="p" color="color.text.subtle">
          No Revoke decisions in this review, so nothing needs to be removed in Jira.
        </Text>
      </Section>
    );
  }
  if (!rem.data && !rem.error) {
    return (
      <Section title="Remediation" description={description}>
        <SkeletonRoot>
          <Phantom height={8} radius="full" />
          <SkeletonTable columns={['Subject', 'Where', 'Access', 'Status']} rows={3} />
        </SkeletonRoot>
      </Section>
    );
  }
  return (
    <Section title="Remediation" description={description}>
      <Stack space="space.200">
        {!gated && untracked < total ? (
          <>
            <ProgressBar value={total ? closed / total : 0} ariaLabel="Remediation progress" />
            <Text color="color.text.subtle">
              {closed} of {plural(total, 'revocation')} closed
            </Text>
          </>
        ) : (
          <Text color="color.text.subtle">
            {plural(total, 'revocation')} to remove manually in Jira
          </Text>
        )}
        {!gated && untracked ? (
          <Text as="p" color="color.text.subtle">
            {untracked === total
              ? 'These revocations are'
              : untracked === 1
                ? '1 revocation is'
                : `${untracked} revocations are`}{' '}
            not tracked for verification: remediation verification was off when the review was
            signed. Remove the access in Jira; after the next snapshot, Changes shows it as revoked.
          </Text>
        ) : null}
        <DynamicTable
          head={{
            cells: [
              { key: 'who', content: 'Subject' },
              { key: 'where', content: 'Where' },
              { key: 'access', content: 'Access' },
              { key: 'status', content: 'Status' },
              ...(gated ? [] : [{ key: 'snap', content: 'Checked in snapshot' }]),
            ],
          }}
          rows={entries.map((e) => {
            const [label, tone] = REMEDIATION_LOZENGE[e.status];
            return {
              key: String(e.item.idx),
              cells: [
                { key: 'w', content: <SubjectCell subject={e.item.subject} compact /> },
                {
                  key: 'p',
                  content: e.item.project ? (
                    <Text weight="bold">{e.item.project.key}</Text>
                  ) : (
                    (e.item.groupName ?? 'Site')
                  ),
                },
                { key: 'a', content: e.item.permissions.map(permissionLabel).join(', ') },
                {
                  key: 's',
                  content: (
                    <Stack as="span" space="space.200">
                      <Pill tone={tone}>
                        {e.status === 'verified' && e.verifiedSeq
                          ? `Verified #${e.verifiedSeq}`
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
  useEffect(() => {
    void (async () => {
      try {
        setResult(await call<ChainVerifyResult>('verifyChain', {}));
      } catch (e) {
        setError(errorText(e));
      } finally {
        setBusy(false);
      }
    })();
  }, []);
  return (
    <>
      <DrawerBody>
        {error ? (
          <SectionMessage appearance="error">
            <Text as="p">{error}</Text>
          </SectionMessage>
        ) : busy || !result ? (
          <SkeletonRoot>
            <Phantom width={120} height={16} />
            <LinesPhantom lines={3} />
          </SkeletonRoot>
        ) : (
          <Stack space="space.200">
            <Pill tone={result.ok ? 'success' : 'danger'}>
              {result.ok
                ? `Intact · ${result.length} signed`
                : `Broken at #${result.brokenAt ?? '?'}`}
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
                    { key: 'seq', content: 'Chain #' },
                    { key: 'ok', content: 'Status' },
                    { key: 'reason', content: 'Detail' },
                  ],
                }}
                rows={result.links.map((l) => ({
                  key: String(l.chainSeq),
                  cells: [
                    { key: l.chainSeq, content: String(l.chainSeq) },
                    {
                      key: l.ok ? 'ok' : 'bad',
                      content: (
                        <Pill tone={l.ok ? 'success' : 'danger'}>{l.ok ? 'OK' : 'Break'}</Pill>
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
                No chained signatures yet.
              </Text>
            )}
          </Stack>
        )}
      </DrawerBody>
      <DrawerFooter>
        <Button appearance="primary" onClick={onDone}>
          Close
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

  useEffect(() => {
    void (async () => {
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
    })();
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
        <Section title="Signature">
          {sigError ? (
            <SectionMessage appearance="error">
              <Text as="p">{sigError}</Text>
            </SectionMessage>
          ) : !sig ? (
            <SkeletonRoot>
              <Phantom width={80} height={16} />
              <DetailsPhantom terms={['Signature version', 'Stored hash', 'Recomputed']} />
            </SkeletonRoot>
          ) : (
            <Stack space="space.200">
              <Pill tone={sig.ok ? 'success' : 'danger'}>{sig.ok ? 'Verified' : 'Mismatch'}</Pill>
              <Details
                rows={[
                  ['Signature version', String(sig.signatureVersion)],
                  ['Stored hash', <Hash key="sh" value={sig.evidenceHash} />],
                  ['Recomputed', <Hash key="rh" value={sig.recomputed} />],
                ]}
              />
              {!sig.ok ? (
                <SectionMessage appearance="error">
                  <Text as="p">Stored records no longer match the signed evidence hash.</Text>
                </SectionMessage>
              ) : null}
            </Stack>
          )}
        </Section>
        <Section title="Snapshot integrity">
          <Text as="p" color="color.text.subtle">
            Recomputes the content hash of snapshot #{snapshotSeq} from stored facts and compares it
            to the hash recorded when the review was signed.
          </Text>
          {!job ? (
            <Button appearance="primary" onClick={() => void startDeep()}>
              Check snapshot integrity
            </Button>
          ) : null}
          {polling && !deepDone ? (
            <Stack space="space.200">
              <ProgressBar isIndeterminate />
              <Text color="color.text.subtle">Checking snapshot facts…</Text>
            </Stack>
          ) : null}
          {deepError ? (
            <SectionMessage appearance="error">
              <Text as="p">{deepError}</Text>
            </SectionMessage>
          ) : null}
          {job?.status === 'purged' ? (
            <SectionMessage appearance="warning">
              <Text as="p">
                Snapshot data was deleted by retention; only the signature can be checked.
              </Text>
            </SectionMessage>
          ) : null}
          {deepDone && job.status !== 'purged' ? (
            <Stack space="space.200">
              <Pill tone={job.status === 'ok' ? 'success' : 'danger'}>
                {job.status === 'ok' ? 'Verified' : 'Mismatch'}
              </Pill>
              <Details
                rows={[
                  ['Expected', <Hash key="eh" value={job.expectedHash} />],
                  ['Actual', <Hash key="ah" value={job.actualHash} />],
                ]}
              />
              {job.status === 'mismatch' ? (
                <SectionMessage appearance="error">
                  <Text as="p">Recomputed snapshot hash does not match the signed value.</Text>
                </SectionMessage>
              ) : null}
            </Stack>
          ) : null}
        </Section>
      </DrawerBody>
      <DrawerFooter>
        <Button appearance="primary" onClick={onClose}>
          Done
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
      toast.success('Review signed', `Evidence hash ${r.evidenceHash.slice(0, 16)}…`);
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
            ['Items', String(items.length)],
            ['Keep', String(items.filter((i) => i.decision === 'keep').length)],
            ['Revoke', String(items.filter((i) => i.decision === 'revoke').length)],
            ['Exception', String(items.filter((i) => i.decision === 'exception').length)],
            ['Signed at', `Now, recorded in UTC and ${timeZone()}`],
          ]}
        />
        <Text as="p" color="color.text.subtle">
          Signing locks the review (signature v2). AccessRadar records your account ID and the time,
          and computes a SHA-256 hash over the review, decisions, coverage hash, and base snapshot
          hash. Revocations must still be done in Jira.
        </Text>
        <Checkbox
          isChecked={attest}
          onChange={(e) => setAttest(e.target.checked)}
          label={ATTESTATION}
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
          Sign off
        </Button>
      </DrawerFooter>
    </>
  );
}
