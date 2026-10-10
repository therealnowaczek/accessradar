import { useEffect, useMemo, useState } from 'react';
import Button from '@atlaskit/button/new';
import Checkbox from '@atlaskit/checkbox';
import { DatePicker } from '@atlaskit/datetime-picker';
import DynamicTable from '@atlaskit/dynamic-table';
import ArrowLeftIcon from '@atlaskit/icon/core/arrow-left';
import Lozenge from '@atlaskit/lozenge';
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
  SearchField,
  Section,
  SnapshotPicker,
  SubjectCell,
} from '../components';
import { useCall } from '../data';
import { DrawerBody, DrawerFooter, StackDrawer, type DrawerLevel } from '../Drawer';
import { downloadCsv, downloadPdf } from '../export/download';
import { reviewCsv, reviewFileName, reviewPdf } from '../export/evidence';
import {
  evidencePackFileName,
  evidencePackPdf,
  type EvidencePackPayload,
} from '../export/evidencePack';
import { formatLocal, formatUtc, permissionLabel, plural, timeZone } from '../format';
import { navItem } from '../routes';
import { exportContext, logExport, NoSnapshot, useApp, useExporter, useSnapshots } from '../shared';
import { useToast } from '../Toast';
import {
  Details,
  Empty,
  ErrorState,
  FilterBar,
  FormField,
  LinkButton,
  Loading,
  Metric,
  PageFrame,
  PageHeader,
  Pill,
  RadioField,
} from '../ui';

const STATUS: Record<ReviewSummary['status'], [string, 'default' | 'inprogress' | 'success']> = {
  draft: ['Draft', 'default'],
  in_progress: ['In progress', 'inprogress'],
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
          <Button appearance="primary" isDisabled={!hasSnapshot} onClick={openCreate}>
            Start a review
          </Button>
        </>
      }
    />
  );
  return (
    <PageFrame header={header}>
      <div className="page-stack">
        {list.error && !list.data ? (
          <ErrorState title="Reviews unavailable" message={list.error} retry={list.reload} />
        ) : !list.data || (status.loading && !status.data) ? (
          <Loading />
        ) : !hasSnapshot && !reviews.length ? (
          <NoSnapshot what="and review access" />
        ) : !reviews.length ? (
          <Empty
            title="No reviews yet"
            description="A review lists who has key permissions in the chosen scope. Reviewers mark each item keep or revoke, then sign off; the evidence pack is hashed."
            action={
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
                      <div className="subtle">
                        {r.scope.type === 'site'
                          ? 'Whole site'
                          : plural(
                              r.scope.ids.length,
                              r.scope.type === 'projects' ? 'project' : 'group',
                            )}{' '}
                        · snapshot #{r.baseSeq}
                      </div>
                    </>
                  ),
                },
                {
                  key: r.status,
                  content: (
                    <Lozenge appearance={STATUS[r.status][1]}>{STATUS[r.status][0]}</Lozenge>
                  ),
                },
                {
                  key: r.chainSeq ?? 0,
                  content:
                    r.status === 'signed' ? (
                      r.chainSeq != null ? (
                        String(r.chainSeq)
                      ) : (
                        <span className="subtle">pre-chain</span>
                      )
                    ) : (
                      <span className="subtle">—</span>
                    ),
                },
                { key: 'p', content: `${r.decided ?? 0} of ${r.itemCount}` },
                { key: r.flagged ?? 0, content: r.flagged ?? 0 },
                {
                  key: r.dueAt ?? 0,
                  content: r.dueAt ? (
                    <span className="status-row tight">
                      {formatLocal(r.dueAt).split(',')[0]}
                      {r.status !== 'signed' && r.dueAt < now ? (
                        <Pill tone="danger">Overdue</Pill>
                      ) : null}
                    </span>
                  ) : (
                    <span className="subtle">—</span>
                  ),
                },
                {
                  key: r.signedAt ?? 0,
                  content: r.signedAt ? formatLocal(r.signedAt) : <span className="subtle">—</span>,
                },
              ],
            }))}
            rowsPerPage={25}
            defaultPage={1}
          />
        )}
      </div>
      <StackDrawer
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
      return setError(`Pick at least one ${scope === 'projects' ? 'project' : 'group'}.`);
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
        <div className="form-stack">
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
                  label: 'Whole site (all projects, Jira admins and application access)',
                },
                { name: 'scope', value: 'projects', label: 'Selected projects' },
                { name: 'scope', value: 'groups', label: 'Selected groups (membership review)' },
              ]}
            />
          </RadioField>
          {scope !== 'site' ? (
            <FormField label={scope === 'projects' ? 'Projects' : 'Groups'}>
              {(id) => (
                <Select<Opt, true>
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
                width="100%"
              />
            )}
          </FormField>
          <FormField
            label="Compare with (optional)"
            helper="Marks items as new since the older snapshot, and lists access removed since then."
          >
            {(id) => (
              <Select<{ label: string; value: number }>
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
            {(id) => (
              <Textfield
                id={id}
                type="date"
                value={due}
                onChange={(e) => setDue((e.target as HTMLInputElement).value)}
              />
            )}
          </FormField>
          <p className="subtle">
            Reviewers are Jira administrators. Key permissions from Settings define which access is
            listed.
          </p>
          {error ? (
            <SectionMessage appearance="error">
              <p>{error}</p>
            </SectionMessage>
          ) : null}
        </div>
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
  const flagged = decidable.filter((i) => i.decision === 'revoke').length;
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
    setDrawer([
      {
        key: 'delete',
        title: 'Delete review',
        description: d?.review.name,
        content: (
          <>
            <DrawerBody>
              <p>
                This deletes the draft review and its decisions. Snapshots are not affected. Signed
                reviews cannot be deleted.
              </p>
            </DrawerBody>
            <DrawerFooter onCancel={() => setDrawer([])}>
              <Button
                appearance="danger"
                onClick={async () => {
                  try {
                    await call('deleteReview', { id });
                    toast.success('Review deleted');
                    onBack();
                  } catch (e) {
                    toast.error('Review not deleted', errorText(e));
                  }
                }}
              >
                Delete review
              </Button>
            </DrawerFooter>
          </>
        ),
      },
    ]);

  const header = (
    <PageHeader
      title={d?.review.name ?? 'Review'}
      description={
        d
          ? `${d.review.scope.type === 'site' ? 'Whole site' : `${d.review.scope.type}: ${d.review.scopeLabels.slice(0, 6).join(', ')}${d.review.scopeLabels.length > 6 ? '…' : ''}`} · snapshot #${d.review.baseSeq}${d.review.compareSeq ? ` vs #${d.review.compareSeq}` : ''}`
          : undefined
      }
      status={
        d ? (
          <Lozenge appearance={STATUS[d.review.status][1]}>{STATUS[d.review.status][0]}</Lozenge>
        ) : null
      }
      actions={
        <>
          <Button iconBefore={ArrowLeftIcon} onClick={onBack}>
            All reviews
          </Button>
          <ExportMenu
            isDisabled={!d}
            label={signed ? 'Export' : 'Export'}
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
          />
          {signed ? (
            <>
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
              <Button onClick={openVerify}>Verify signature & chain</Button>
            </>
          ) : (
            <>
              <Button appearance="subtle" onClick={openDelete} isDisabled={!d}>
                Delete
              </Button>
              <Button appearance="primary" isDisabled={!d || pending > 0} onClick={openSign}>
                Sign off
              </Button>
            </>
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
        <Loading />
      </PageFrame>
    );
  const filteredOpen = items.filter((i) => i.change !== 'removed').map((i) => i.idx);
  return (
    <PageFrame header={header}>
      <div className="page-stack">
        {signed ? (
          <SectionMessage
            appearance="success"
            title={`Signed by ${d.review.signedByName ?? 'Jira admin'}`}
          >
            <div className="section-stack">
              <p>
                {formatUtc(d.review.signedAt)} ·{' '}
                {formatLocal(d.review.signedAt, d.review.signerTz ?? timeZone())} (
                {d.review.signerTz}). This review is read-only.
              </p>
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
            </div>
          </SectionMessage>
        ) : null}
        {signed ? <RemediationPanel reviewId={id} items={d.items} /> : null}
        <CoverageLimitations coverage={d.coverage} limitations={d.limitations} />
        <div className="metric-grid">
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
        </div>
        <FilterBar>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search people, projects, paths, notes"
          />
          {(
            [
              ['Decision', DECISIONS, decision, setDecision],
              ...(d.review.compareSeq ? [['Change', CHANGES, change, setChange]] : []),
            ] as Array<[string, Opt[], string, (v: string) => void]>
          ).map(([label, opts, value, set]) => (
            <div style={{ width: 210 }} key={label}>
              <Select<Opt>
                aria-label={label}
                options={opts}
                value={opts.find((o) => o.value === value)}
                onChange={(o) => set(o?.value ?? '')}
                spacing="compact"
                isSearchable={false}
              />
            </div>
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
              { key: 'actions', content: '' },
            ],
          }}
          rows={items.map((i) => ({
            key: String(i.idx),
            cells: [
              {
                key: i.subject.name.toLowerCase(),
                content: (
                  <span className="section-stack">
                    <SubjectCell subject={i.subject} compact />
                    {i.change === 'new' ? (
                      <Pill tone="info">New</Pill>
                    ) : i.change === 'removed' ? (
                      <Pill tone="neutral">Removed since comparison</Pill>
                    ) : null}
                  </span>
                ),
              },
              {
                key: i.project?.key ?? i.groupName ?? 'site',
                content: i.project ? <strong>{i.project.key}</strong> : (i.groupName ?? 'Site'),
              },
              { key: 'access', content: i.permissions.map(permissionLabel).join(', ') },
              {
                key: 'why',
                content: (
                  <span className="subtle wrap-anywhere">
                    {i.reasons[0]}
                    {i.reasons.length > 1 ? ` (+${i.reasons.length - 1})` : ''}
                  </span>
                ),
              },
              {
                key: i.decision ?? '',
                content:
                  i.change === 'removed' ? (
                    <span className="subtle">—</span>
                  ) : (
                    <span className="section-stack">
                      {i.decision === 'keep' ? (
                        <Lozenge appearance="success">Keep</Lozenge>
                      ) : i.decision === 'revoke' ? (
                        <Lozenge appearance="removed">Revoke</Lozenge>
                      ) : i.decision === 'exception' ? (
                        <Lozenge appearance="moved">
                          {i.expiresAt
                            ? `Exception until ${formatLocal(i.expiresAt)}`
                            : 'Exception'}
                        </Lozenge>
                      ) : i.reasons.includes('Exception expired') ? (
                        <Lozenge appearance="removed">Exception expired</Lozenge>
                      ) : (
                        <Lozenge>Undecided</Lozenge>
                      )}
                      {i.note ? <span className="subtle">“{i.note}”</span> : null}
                    </span>
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
                    <span className="actions">
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
                      <Button
                        spacing="compact"
                        isDisabled={busy}
                        onClick={() => openNote(i, 'exception')}
                      >
                        Exception…
                      </Button>
                      <Button spacing="compact" appearance="subtle" onClick={() => openNote(i)}>
                        Note
                      </Button>
                    </span>
                  ),
              },
            ],
          }))}
          rowsPerPage={50}
          defaultPage={1}
          emptyView={<p className="subtle">No items match.</p>}
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
      </div>
      <StackDrawer
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
          <ul className="reason-paths">
            {item.reasons.map((x, n) => (
              <li key={n} className="subtle">
                {x}
              </li>
            ))}
          </ul>
        </Section>
        {readOnly ? (
          item.note ? (
            <p>“{item.note}”</p>
          ) : null
        ) : (
          <div className="form-stack">
            {error ? (
              <SectionMessage appearance="error">
                <p>{error}</p>
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
                  <DatePicker
                    id={fid}
                    value={expiresOn}
                    onChange={(d) => setExpiresOn(d)}
                    dateFormat="YYYY-MM-DD"
                    placeholder="YYYY-MM-DD"
                  />
                )}
              </FormField>
            ) : null}
          </div>
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

type RemediationRow = {
  idx: number;
  itemKey: string;
  status: 'pending' | 'verified' | 'still_present' | 'inconclusive' | 'accepted';
  checkedSeq: number | null;
  verifiedSeq: number | null;
  detail: string | null;
  checkCount: number;
};

const REMEDIATION_LOZENGE: Record<
  RemediationRow['status'],
  [string, 'default' | 'inprogress' | 'success' | 'removed' | 'moved']
> = {
  pending: ['Pending', 'inprogress'],
  verified: ['Verified', 'success'],
  still_present: ['Still present', 'removed'],
  inconclusive: ['Inconclusive', 'default'],
  accepted: ['Accepted risk', 'moved'],
};

function RemediationPanel({ reviewId, items }: { reviewId: string; items: ReviewItem[] }) {
  const rem = useCall<{
    gated: boolean;
    rows: RemediationRow[];
    summary: { verified: number; total: number; open: number };
  }>('listRemediation', { reviewId });
  if (rem.error && !rem.data) return null;
  if (!rem.data) return <Loading />;
  if (rem.data.gated) {
    return (
      <SectionMessage appearance="information" title="Remediation verification">
        <p>
          Verify revocations automatically with Advanced — AccessRadar checks the next snapshot.
        </p>
      </SectionMessage>
    );
  }
  if (!rem.data.rows.length) {
    return (
      <Section title="Remediation">
        <Empty title="No revocations in this review" description="" action={null} />
      </Section>
    );
  }
  const byIdx = new Map(items.map((i) => [i.idx, i]));
  const { verified, total } = rem.data.summary;
  return (
    <Section
      title="Remediation"
      description="Whether Revoke decisions disappeared in a later snapshot."
    >
      <div className="section-stack">
        <ProgressBar value={total ? verified / total : 0} />
        <span className="subtle">
          {verified} of {total} closed
        </span>
        <DynamicTable
          head={{
            cells: [
              { key: 'who', content: 'Subject' },
              { key: 'access', content: 'Access' },
              { key: 'status', content: 'Status' },
              { key: 'snap', content: 'Checked in snapshot' },
            ],
          }}
          rows={rem.data.rows.map((r) => {
            const item = byIdx.get(r.idx);
            const [label, appearance] = REMEDIATION_LOZENGE[r.status];
            return {
              key: String(r.idx),
              cells: [
                {
                  key: 'w',
                  content: item ? <SubjectCell subject={item.subject} compact /> : r.itemKey,
                },
                {
                  key: 'a',
                  content: item ? item.permissions.map(permissionLabel).join(', ') : '—',
                },
                {
                  key: 's',
                  content: (
                    <span className="section-stack">
                      <Lozenge appearance={appearance}>
                        {r.status === 'verified' && r.verifiedSeq
                          ? `Verified #${r.verifiedSeq}`
                          : label}
                      </Lozenge>
                      {r.detail && r.checkCount >= 3 ? (
                        <span className="subtle">{r.detail}</span>
                      ) : null}
                    </span>
                  ),
                },
                {
                  key: 'c',
                  content: r.checkedSeq != null ? `#${r.checkedSeq}` : '—',
                },
              ],
            };
          })}
          rowsPerPage={25}
          defaultPage={1}
        />
      </div>
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
            <p>{error}</p>
          </SectionMessage>
        ) : busy || !result ? (
          <Loading />
        ) : (
          <div className="section-stack">
            <Lozenge appearance={result.ok ? 'success' : 'removed'}>
              {result.ok
                ? `Intact · ${result.length} signed`
                : `Broken at #${result.brokenAt ?? '?'}`}
            </Lozenge>
            {!result.ok && result.reason ? (
              <SectionMessage appearance="error">
                <p>{result.reason}</p>
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
                        <Lozenge appearance={l.ok ? 'success' : 'removed'}>
                          {l.ok ? 'OK' : 'Break'}
                        </Lozenge>
                      ),
                    },
                    {
                      key: l.reason ?? '',
                      content: l.reason ?? <span className="subtle">—</span>,
                    },
                  ],
                }))}
                rowsPerPage={50}
                defaultPage={1}
              />
            ) : (
              <p className="subtle">No chained signatures yet.</p>
            )}
          </div>
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
              <p>{sigError}</p>
            </SectionMessage>
          ) : !sig ? (
            <Loading />
          ) : (
            <div className="section-stack">
              <Lozenge appearance={sig.ok ? 'success' : 'removed'}>
                {sig.ok ? 'Verified' : 'Mismatch'}
              </Lozenge>
              <Details
                rows={[
                  ['Signature version', String(sig.signatureVersion)],
                  ['Stored hash', <Hash key="sh" value={sig.evidenceHash} />],
                  ['Recomputed', <Hash key="rh" value={sig.recomputed} />],
                ]}
              />
              {!sig.ok ? (
                <SectionMessage appearance="error">
                  <p>Stored records no longer match the signed evidence hash.</p>
                </SectionMessage>
              ) : null}
            </div>
          )}
        </Section>
        <Section title="Snapshot integrity">
          <p className="subtle">
            Recomputes the content hash of snapshot #{snapshotSeq} from stored facts and compares it
            to the hash recorded when the review was signed.
          </p>
          {!job ? (
            <Button appearance="primary" onClick={() => void startDeep()}>
              Check snapshot integrity
            </Button>
          ) : null}
          {polling && !deepDone ? (
            <div className="section-stack">
              <ProgressBar isIndeterminate />
              <span className="subtle">Checking snapshot facts…</span>
            </div>
          ) : null}
          {deepError ? (
            <SectionMessage appearance="error">
              <p>{deepError}</p>
            </SectionMessage>
          ) : null}
          {job?.status === 'purged' ? (
            <SectionMessage appearance="warning">
              <p>Snapshot data was deleted by retention; only the signature can be checked.</p>
            </SectionMessage>
          ) : null}
          {deepDone && job.status !== 'purged' ? (
            <div className="section-stack">
              <Lozenge appearance={job.status === 'ok' ? 'success' : 'removed'}>
                {job.status === 'ok' ? 'Verified' : 'Mismatch'}
              </Lozenge>
              <Details
                rows={[
                  ['Expected', <Hash key="eh" value={job.expectedHash} />],
                  ['Actual', <Hash key="ah" value={job.actualHash} />],
                ]}
              />
              {job.status === 'mismatch' ? (
                <SectionMessage appearance="error">
                  <p>Recomputed snapshot hash does not match the signed value.</p>
                </SectionMessage>
              ) : null}
            </div>
          ) : null}
        </Section>
      </DrawerBody>
      <DrawerFooter onCancel={onClose}>
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
        <p className="subtle">
          Signing locks the review (signature v2). AccessRadar records your account ID and the time,
          and computes a SHA-256 hash over the review, decisions, coverage hash, and base snapshot
          hash. Revocations must still be done in Jira.
        </p>
        <Checkbox
          isChecked={attest}
          onChange={(e) => setAttest(e.target.checked)}
          label={ATTESTATION}
        />
        {error ? (
          <SectionMessage appearance="error">
            <p>{error}</p>
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
