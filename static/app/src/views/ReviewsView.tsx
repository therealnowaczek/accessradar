import { useEffect, useMemo, useState } from 'react';
import Button from '@atlaskit/button/new';
import Checkbox from '@atlaskit/checkbox';
import DynamicTable from '@atlaskit/dynamic-table';
import ArrowLeftIcon from '@atlaskit/icon/core/arrow-left';
import Lozenge from '@atlaskit/lozenge';
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
  CoverageList,
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
import { formatLocal, formatUtc, permissionLabel, plural, timeZone } from '../format';
import { navItem } from '../routes';
import { exportContext, logExport, NoSnapshot, useApp, useExporter, useSnapshots } from '../shared';
import { useToast } from '../Toast';
import {
  Details,
  Empty,
  ErrorState,
  FilterBar,
  Loading,
  Metric,
  PageFrame,
  PageHeader,
  Pill,
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
  const header = (
    <PageHeader
      title={meta.title}
      description={meta.description}
      actions={
        <Button appearance="primary" isDisabled={!hasSnapshot} onClick={openCreate}>
          Start a review
        </Button>
      }
    />
  );
  const reviews = list.data?.reviews ?? [];
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
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => go('reviews', { reviewId: r.id })}
                    >
                      <strong>{r.name}</strong>
                      <div className="subtle">
                        {r.scope.type === 'site'
                          ? 'Whole site'
                          : plural(
                              r.scope.ids.length,
                              r.scope.type === 'projects' ? 'project' : 'group',
                            )}{' '}
                        · snapshot #{r.baseSeq}
                      </div>
                    </button>
                  ),
                },
                {
                  key: r.status,
                  content: (
                    <Lozenge appearance={STATUS[r.status][1]}>{STATUS[r.status][0]}</Lozenge>
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
          <label className="field">
            <span className="field-label">Name</span>
            <Textfield
              value={name}
              onChange={(e) => setName((e.target as HTMLInputElement).value)}
              maxLength={200}
            />
          </label>
          <fieldset className="choice-group">
            <legend>Scope</legend>
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
          </fieldset>
          {scope !== 'site' ? (
            <label className="field">
              <span className="field-label">{scope === 'projects' ? 'Projects' : 'Groups'}</span>
              <Select<Opt, true>
                isMulti
                options={options}
                value={ids}
                onChange={(v) => setIds([...v])}
                isLoading={projects.loading || groups.loading}
                placeholder="Search…"
              />
            </label>
          ) : null}
          <label className="field">
            <span className="field-label">Base snapshot</span>
            <SnapshotPicker
              snapshots={snaps.data?.snapshots ?? []}
              value={base}
              onChange={(v) => {
                setBase(v);
                setCompare(null);
              }}
              width={360}
            />
          </label>
          <label className="field">
            <span className="field-label">Compare with (optional)</span>
            <Select<{ label: string; value: number }>
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
            <span className="subtle">
              Marks items as new since the older snapshot, and lists access removed since then.
            </span>
          </label>
          <label className="field">
            <span className="field-label">Due date (optional)</span>
            <Textfield
              type="date"
              value={due}
              onChange={(e) => setDue((e.target as HTMLInputElement).value)}
            />
          </label>
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
      <DrawerFooter>
        <Button onClick={onCancel}>Cancel</Button>
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

  const decide = async (idxs: number[], value: 'keep' | 'revoke' | null, note?: string) => {
    if (!idxs.length) return;
    setBusy(true);
    try {
      const res = await call<{ changed: number }>('decideItems', {
        id,
        idxs,
        decision: value,
        ...(note !== undefined ? { note } : {}),
      });
      if (idxs.length > 1) toast.success(`${plural(res.changed, 'item')} updated`);
      r.reload();
    } catch (e) {
      toast.error('Decision not saved', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const openNote = (item: ReviewItem) =>
    setDrawer([
      {
        key: `note-${item.idx}`,
        title: item.subject.name,
        description: item.project
          ? `${item.project.key} · ${item.project.name}`
          : (item.groupName ?? 'Site'),
        content: (
          <ItemDrawer
            item={item}
            readOnly={signed}
            onSave={async (value, note) => {
              await decide([item.idx], value, note);
              setDrawer([]);
            }}
            onCancel={() => setDrawer([])}
          />
        ),
      },
    ]);

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

  const verify = async () => {
    try {
      const v = await call<{ stored: string; computed: string; valid: boolean }>('verifyReview', {
        id,
      });
      if (v.valid) toast.success('Evidence verified', 'The stored records match the signed hash.');
      else
        toast.error(
          'Evidence mismatch',
          `Stored ${v.stored.slice(0, 12)}…, computed ${v.computed.slice(0, 12)}…`,
        );
    } catch (e) {
      toast.error('Verification failed', errorText(e));
    }
  };

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
            <DrawerFooter>
              <Button onClick={() => setDrawer([])}>Cancel</Button>
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
            label={signed ? 'Evidence pack' : 'Export'}
            onCsv={() =>
              void exporter('Review CSV', () => {
                downloadCsv(reviewFileName(d!, 'csv'), reviewCsv(d!, exportContext(siteUrl)));
                logExport('review-csv', id);
              })
            }
            onPdf={() =>
              void exporter('Evidence pack PDF', () => {
                downloadPdf(reviewFileName(d!, 'pdf'), reviewPdf(d!, exportContext(siteUrl)));
                logExport('review-pdf', id);
              })
            }
          />
          {signed ? (
            <Button onClick={() => void verify()}>Verify</Button>
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
                rows={[['Evidence hash (SHA-256)', <Hash key="h" value={d.review.evidenceHash} />]]}
              />
            </div>
          </SectionMessage>
        ) : d.base?.status === 'partial' ? (
          <SectionMessage appearance="warning" title="The base snapshot is partial">
            <CoverageList coverage={d.coverage} />
          </SectionMessage>
        ) : null}
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
                onClick={() => void decide(filteredOpen, 'revoke')}
              >
                Revoke{' '}
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
                        onClick={() => openNote({ ...i, decision: 'revoke' })}
                      >
                        Revoke…
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
  onSave: (decision: 'keep' | 'revoke' | null, note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<'keep' | 'revoke' | null>(item.decision);
  const [note, setNote] = useState(item.note ?? '');
  const [busy, setBusy] = useState(false);
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
            <fieldset className="choice-group">
              <legend>Decision</legend>
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
                  { name: 'decision', value: '', label: 'Undecided' },
                ]}
              />
            </fieldset>
            <label className="field">
              <span className="field-label">
                Note{value === 'revoke' ? ' (recommended: what to remove)' : ''}
              </span>
              <Textarea
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
                resize="vertical"
              />
            </label>
          </div>
        )}
      </DrawerBody>
      {readOnly ? null : (
        <DrawerFooter>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            appearance="primary"
            isLoading={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(value, note.trim());
              setBusy(false);
            }}
          >
            Save
          </Button>
        </DrawerFooter>
      )}
    </>
  );
}

const ATTESTATION =
  'I confirm that I reviewed every access item in this scope and that the decisions recorded here reflect my assessment.';

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
            ['Signed at', `Now, recorded in UTC and ${timeZone()}`],
          ]}
        />
        <p className="subtle">
          Signing locks the review. AccessRadar records your account ID and the time, and computes a
          SHA-256 hash over the review, all decisions and the base snapshot hash. Revocations must
          still be done in Jira.
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
      <DrawerFooter>
        <Button onClick={onCancel}>Cancel</Button>
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
