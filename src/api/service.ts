import api, { route } from '@forge/api';
import { diffEffective, diffFacts, effectiveTuples, type AccessTuple } from '../engine/diff';
import { ENGINE_VERSION, resolveAll } from '../engine/resolve';
import { applyExceptions, validateDecisionInput } from '../engine/exceptions';
import { buildReviewItems, evidenceHash, type ReviewScope } from '../engine/review';
import {
  activeExceptionsForKeys,
  expireExceptions,
  insertException,
  listExceptions,
  upsertExceptionsOnSign,
} from '../db/exceptions';
import { computeRisks } from '../engine/risk';
import { buildState, type AccessState } from '../engine/state';
import { audit, listAudit } from '../db/audit';
import {
  countUndismissed,
  dismissNotices,
  insertNotice,
  listNotices,
  type Notice,
} from '../db/notices';
import { capAlerts, evaluateAlerts, sanitizeAlertRules } from '../engine/alerts';
import {
  decide,
  deleteDraftReview,
  evidenceInput,
  getItems,
  getReview,
  insertReview,
  listChainLinks,
  listReviews,
  markSigned,
  nextChainTip,
  type ReviewRow,
} from '../db/reviews';
import { isDuplicateKey, walkChain } from '../engine/chain';
import { refreshGate } from '../collector/gate';
import { LIMITATIONS_VERSION, limitationsPayload } from '../domain/limitations';
import {
  CONTROL_MAPPINGS,
  CONTROLS_DISCLAIMER,
  CONTROLS_VERSION,
  EVIDENCE_DATA_SOURCES,
} from '../domain/controls';
import { contentHash, coverageHash } from '../engine/facts';
import { getVerifyJob, insertVerifyJob, patchVerifyJob, streamContentHashPage } from '../db/verify';
import { push } from '../lib/queue';
import { getSettings, kvGet, saveSettings } from '../db/settings';
import {
  comingSoonFeatures,
  effectiveSchedule,
  featureFlags,
  REQUIRES_ADVANCED,
  STANDARD_RETENTION_DAYS,
  type FeatureFlags,
} from '../domain/edition';
import { itemPresent } from '../engine/remediation';
import {
  getRemediation,
  insertRemediations,
  listRemediation,
  markRemediationAccepted,
  openRemediations,
  remediationSummarySite,
  updateRemediationCheck,
} from '../db/remediation';
import { backgroundEdition, type EditionDecision } from './edition';
import {
  activeSnapshot,
  getSnapshot,
  latestCommitted,
  listSnapshots,
  loadFacts,
  previousCommitted,
  type SnapshotRow,
} from '../db/snapshots';
import { hourUsage, startSnapshot } from '../collector/run';
import {
  describeFactChange,
  groupDetail,
  groupsList,
  peopleList,
  personAccess,
  projectAccess,
  projectsList,
  projectView,
  subjectView,
} from './views';

export class BadRequest extends Error {}

// ---------- input validation (payloads are untrusted) ----------
export const v = {
  optSeq(x: unknown): number | null {
    if (x === undefined || x === null || x === '') return null;
    const n = Number(x);
    if (!Number.isInteger(n) || n <= 0) throw new BadRequest('Invalid snapshot');
    return n;
  },
  id(x: unknown, label = 'id', re = /^[\w:.-]{1,128}$/): string {
    if (typeof x !== 'string' || !re.test(x)) throw new BadRequest(`Invalid ${label}`);
    return x;
  },
  text(x: unknown, max: number, label: string, required = false): string {
    const s = typeof x === 'string' ? x.trim() : '';
    if (required && !s) throw new BadRequest(`${label} is required`);
    if (s.length > max) throw new BadRequest(`${label} is too long (max ${max})`);
    return s;
  },
};

// ---------- snapshot state ----------
export function snapshotSummary(s: SnapshotRow | null) {
  if (!s) return null;
  return {
    seq: s.seq,
    status: s.status,
    trigger: s.trigger,
    collectorMode: s.collectorMode,
    engineVersion: s.engineVersion,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
    updatedAt: s.updatedAt,
    progress: s.progress,
    stats: s.stats,
    points: s.points,
    calls: s.calls,
    contentHash: s.contentHash,
    error: s.error,
    gaps: s.coverage.filter((c) => c.status !== 'info').length,
  };
}

/** Resolves the requested snapshot server-side: must exist and be committed. Default: latest. */
export async function committed(seq: number | null): Promise<SnapshotRow | null> {
  if (seq === null) return latestCommitted();
  const s = await getSnapshot(seq);
  if (!s || (s.status !== 'complete' && s.status !== 'partial'))
    throw new BadRequest('Snapshot not available');
  return s;
}

export async function stateFor(seq: number): Promise<AccessState> {
  return buildState(await loadFacts(seq));
}

async function withState<T>(seqInput: unknown, fn: (state: AccessState, snap: SnapshotRow) => T) {
  const snap = await committed(v.optSeq(seqInput));
  if (!snap) return { snapshot: null, data: null as T | null };
  const state = await stateFor(snap.seq);
  return { snapshot: snapshotSummary(snap), data: fn(state, snap) };
}

// ---------- status & overview ----------
export async function status(spike = false) {
  const [latest, active, settings, list, noticeCount, alertCount] = await Promise.all([
    latestCommitted(),
    activeSnapshot(),
    getSettings(),
    listSnapshots(1),
    countUndismissed({ audience: 'admin' }).catch(() => 0),
    countUndismissed({ audience: 'admin', kindPrefix: 'alert:' }).catch(() => 0),
  ]);
  return {
    engineVersion: ENGINE_VERSION,
    spike,
    settingsSaved: settings.saved,
    frequency: settings.frequency,
    latest: snapshotSummary(latest),
    active: snapshotSummary(active),
    lastAttempt: snapshotSummary(list[0] ?? null),
    noticeCount,
    alertCount,
  };
}

export async function overview(payload: any) {
  const settings = await getSettings();
  const [active, reviews, usage] = await Promise.all([
    activeSnapshot(),
    listReviews(),
    hourUsage(),
  ]);
  const snap = await committed(v.optSeq(payload.seq));
  const reviewSummary = {
    open: reviews.filter((r) => r.status !== 'signed').length,
    signed: reviews.filter((r) => r.status === 'signed').length,
    lastSigned: reviews.find((r) => r.status === 'signed')
      ? {
          id: reviews.find((r) => r.status === 'signed')!.id,
          name: reviews.find((r) => r.status === 'signed')!.name,
          signedAt: reviews.find((r) => r.status === 'signed')!.signedAt,
        }
      : null,
    overdue: reviews
      .filter((r) => r.status !== 'signed' && r.dueAt && r.dueAt < Date.now())
      .map((r) => ({ id: r.id, name: r.name, dueAt: r.dueAt })),
  };
  const remediation = await remediationSummarySite().catch(() => ({
    open: 0,
    stillPresent: 0,
    verified: 0,
  }));
  if (!snap)
    return {
      snapshot: null,
      active: snapshotSummary(active),
      reviews: reviewSummary,
      remediation,
      usage,
      budget: settings.hourlyPointBudget,
    };
  const state = await stateFor(snap.seq);
  const entries = resolveAll(state);
  const persons = [...state.persons.values()];
  const humans = persons.filter((p) => p.accountType === 'atlassian');
  const risks = computeRisks(state, {
    largeGroupThreshold: settings.largeGroupThreshold,
    wideAdminProjects: settings.wideAdminProjects,
    includeAppAccounts: settings.showAppAccounts,
    keyPermissions: settings.keyPermissions,
  }).map((r) => ({ ...r, items: r.items.slice(0, 50) }));
  let changes: { granted: number; revoked: number; fromSeq: number } | null = null;
  const prev = await previousCommitted(snap.seq);
  if (prev) {
    const keys = new Set(settings.keyPermissions);
    const d = diffEffective(
      effectiveTuples(await stateFor(prev.seq), keys),
      effectiveTuples(state, keys),
    );
    changes = { granted: d.granted.length, revoked: d.revoked.length, fromSeq: prev.seq };
  }
  return {
    snapshot: snapshotSummary(snap),
    coverage: snap.coverage,
    active: snapshotSummary(active),
    metrics: {
      projects: state.projects.size,
      teamManaged: [...state.projects.values()].filter((p) => p.style === 'team').length,
      schemes: state.schemes.size,
      grants: state.grants.length,
      groups: state.groups.size,
      groupsRead: [...state.groups.values()].filter((g) => g.members === 'collected').length,
      people: humans.length,
      inactivePeople: humans.filter((p) => !p.active).length,
      appAccounts: persons.length - humans.length,
      accessEntries: entries.length,
    },
    risks,
    changes,
    reviews: reviewSummary,
    remediation,
    usage,
    budget: settings.hourlyPointBudget,
  };
}

// ---------- snapshots ----------
export async function snapshots() {
  const [rows, active] = await Promise.all([listSnapshots(), activeSnapshot()]);
  return { snapshots: rows.map(snapshotSummary), active: snapshotSummary(active) };
}

export async function snapshotDetail(payload: any) {
  const seq = v.optSeq(payload.seq);
  if (seq === null) throw new BadRequest('Snapshot is required');
  const s = await getSnapshot(seq);
  if (!s) throw new BadRequest('Snapshot not found');
  const limitations = limitationsPayload(s.status, s.coverage);
  return {
    ...snapshotSummary(s),
    coverage: s.coverage,
    limitations,
    completeness: limitations.completeness,
  };
}

export async function takeSnapshot(accountId: string, trigger: 'manual' | 'onboarding') {
  const r = await startSnapshot(trigger);
  if (r.created) await audit(accountId, 'snapshot.started', `#${r.seq}`, { trigger });
  return r;
}

// ---------- explore ----------
export const exploreProjects = (p: any) => withState(p.seq, (s) => projectsList(s));
export const exploreGroups = (p: any) => withState(p.seq, (s) => groupsList(s));
export const explorePeople = (p: any) => withState(p.seq, (s) => peopleList(s));

export async function projectDetail(p: any) {
  const projectId = v.id(p.projectId, 'project');
  const r = await withState(p.seq, (s) =>
    s.projects.has(projectId) ? projectAccess(s, projectId) : null,
  );
  if (r.snapshot && !r.data) throw new BadRequest('Project not in this snapshot');
  return r;
}

export async function groupInfo(p: any) {
  const groupId = v.id(p.groupId, 'group', /^[\w:.\- ]{1,128}$/);
  const r = await withState(p.seq, (s) => groupDetail(s, groupId));
  if (r.snapshot && !r.data) throw new BadRequest('Group not in this snapshot');
  return r;
}

export async function personInfo(p: any) {
  const accountId = v.id(p.accountId, 'account');
  const settings = await getSettings();
  const snap = await committed(v.optSeq(p.seq));
  if (!snap) return { snapshot: null, data: null };
  const state = await stateFor(snap.seq);
  if (!state.persons.has(accountId) && !state.memberOf.has(accountId))
    throw new BadRequest('Person not in this snapshot');
  const data = personAccess(state, accountId);
  // Joiner/mover/leaver: what changed for this person since the previous snapshot.
  const prev = await previousCommitted(snap.seq);
  let changes = null;
  if (prev) {
    const prevState = await stateFor(prev.seq);
    const mine = (m: ReturnType<typeof effectiveTuples>) =>
      new Map(
        [...m].filter(([, t]) => t.subject.type === 'user' && t.subject.accountId === accountId),
      );
    const all = null;
    const d = diffEffective(
      mine(effectiveTuples(prevState, all)),
      mine(effectiveTuples(state, all)),
    );
    changes = {
      fromSeq: prev.seq,
      granted: d.granted.map((t) => ({
        project: projectView(state, t.projectId),
        permission: t.permission,
        reasons: t.reasons,
      })),
      revoked: d.revoked.map((t) => ({
        project: projectView(prevState, t.projectId),
        permission: t.permission,
        reasons: t.reasons,
      })),
    };
  }
  return {
    snapshot: snapshotSummary(snap),
    data: { ...data, changes, keyPermissions: settings.keyPermissions },
  };
}

const GLOBAL_PERMISSIONS = [
  'ADMINISTER',
  'SYSTEM_ADMIN',
  'USER_PICKER',
  'CREATE_PROJECT',
  'CREATE_SHARED_OBJECTS',
  'MANAGE_GROUP_FILTER_SUBSCRIPTIONS',
  'BULK_CHANGE',
];

/** Live global-permission check for one person (Jira has no API listing global permission holders). */
export async function globalPermissions(p: any) {
  const accountId = v.id(p.accountId, 'account');
  const snap = await latestCommitted();
  if (!snap) throw new BadRequest('Take a snapshot first');
  const state = await stateFor(snap.seq);
  if (!state.persons.has(accountId)) throw new BadRequest('Person not in the latest snapshot');
  const res = await api.asApp().requestJira(route`/rest/api/3/permissions/check`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, globalPermissions: GLOBAL_PERMISSIONS }),
  });
  if (!res.ok) throw new Error(`Global permission check failed (${res.status})`);
  const body = (await res.json()) as { globalPermissions?: string[] };
  return { checked: GLOBAL_PERMISSIONS, granted: body.globalPermissions ?? [], at: Date.now() };
}

// ---------- changes ----------
export async function changes(p: any) {
  const settings = await getSettings();
  let b = await committed(v.optSeq(p.b));
  if (!b)
    return {
      a: null,
      b: null,
      granted: [],
      revoked: [],
      facts: [],
      keyPermissions: settings.keyPermissions,
    };
  let a = v.optSeq(p.a) === null ? await previousCommitted(b.seq) : await committed(v.optSeq(p.a));
  if (!a)
    return {
      a: null,
      b: snapshotSummary(b),
      granted: [],
      revoked: [],
      facts: [],
      keyPermissions: settings.keyPermissions,
    };
  if (a.seq > b.seq) [a, b] = [b, a];
  const [factsA, factsB] = await Promise.all([loadFacts(a.seq), loadFacts(b.seq)]);
  const sa = buildState(factsA);
  const sb = buildState(factsB);
  const perms = p.allPermissions === true ? null : new Set(settings.keyPermissions);
  const eff = diffEffective(effectiveTuples(sa, perms), effectiveTuples(sb, perms));
  const tuple = (s: AccessState) => (t: AccessTuple) => ({
    subject: subjectView(s, t.subject),
    project: projectView(s, t.projectId),
    permission: t.permission,
    reasons: t.reasons,
    codes: t.pathCodes,
  });
  return {
    a: snapshotSummary(a),
    b: snapshotSummary(b),
    keyPermissions: settings.keyPermissions,
    granted: eff.granted.map(tuple(sb)),
    revoked: eff.revoked.map(tuple(sa)),
    facts: diffFacts(factsA, factsB).map((c) => describeFactChange(sb, sa, c)),
  };
}

// ---------- export: access matrix ----------
export async function matrix(p: any) {
  return withState(p.seq, (state) => {
    const rows: Array<Record<string, string>> = [];
    const tuples = effectiveTuples(
      state,
      p.allPermissions === true ? null : new Set((p.keyPermissions as string[]) ?? []),
    );
    for (const t of tuples.values()) {
      const s = subjectView(state, t.subject);
      const proj = projectView(state, t.projectId);
      rows.push({
        project_key: proj.key,
        project_name: proj.name,
        project_style: proj.style,
        subject_type: s.type,
        subject_id: s.id,
        display_name: s.name,
        account_type: s.accountType ?? '',
        active: s.active === undefined ? '' : s.active ? 'yes' : 'no',
        permission: t.permission,
        path: t.reasons.join(' | '),
        path_codes: t.pathCodes.join(' | '),
        completeness_flag:
          s.type === 'group'
            ? 'members-unreadable'
            : s.type === 'conditional'
              ? 'issue-dependent'
              : 'complete',
      });
    }
    return rows.sort(
      (x, y) =>
        x.project_key.localeCompare(y.project_key) ||
        x.display_name.localeCompare(y.display_name) ||
        x.permission.localeCompare(y.permission),
    );
  });
}

// ---------- reviews ----------
export async function reviews() {
  return { reviews: await listReviews() };
}

export async function createReview(p: any, accountId: string) {
  const settings = await getSettings();
  const name = v.text(p.name, 200, 'Name', true);
  const type = p.scope?.type;
  if (!['site', 'projects', 'groups'].includes(type)) throw new BadRequest('Invalid scope');
  const ids: string[] = Array.isArray(p.scope?.ids)
    ? p.scope.ids.slice(0, 500).map((x: unknown) => v.id(x, 'scope id', /^[\w:.\- ]{1,128}$/))
    : [];
  if (type !== 'site' && !ids.length) throw new BadRequest('Pick at least one project or group');
  const base = await committed(v.optSeq(p.baseSeq));
  if (!base) throw new BadRequest('Take a snapshot before starting a review');
  const compare = v.optSeq(p.compareSeq) === null ? null : await committed(v.optSeq(p.compareSeq));
  if (compare && compare.seq >= base.seq)
    throw new BadRequest('The comparison snapshot must be older than the base snapshot');
  const dueAt = p.dueAt ? Number(p.dueAt) : null;
  if (dueAt !== null && (!Number.isFinite(dueAt) || dueAt < Date.now() - 86400_000))
    throw new BadRequest('Invalid due date');
  const state = await stateFor(base.seq);
  // Scope ids are re-resolved against the pinned snapshot; unknown ids are rejected.
  const known = type === 'projects' ? state.projects : state.groups;
  if (type !== 'site' && ids.some((id) => !known.has(id)))
    throw new BadRequest('Scope contains unknown projects or groups');
  const scope: ReviewScope = { type, ids };
  const drafts = buildReviewItems(
    state,
    scope,
    settings.keyPermissions,
    compare ? await stateFor(compare.seq) : undefined,
  );
  if (drafts.length > 20000)
    throw new BadRequest(`Scope too large (${drafts.length} items); narrow it down`);
  const now = Date.now();
  await expireExceptions(now);
  const active = await activeExceptionsForKeys(drafts.map((i) => i.itemKey));
  const items = applyExceptions(drafts, active, now);
  const id = await insertReview(
    {
      name,
      scope,
      keyPermissions: settings.keyPermissions,
      baseSeq: base.seq,
      compareSeq: compare?.seq ?? null,
      createdBy: accountId,
      createdAt: now,
      dueAt,
      engineVersion: ENGINE_VERSION,
      campaignRunId: null,
    },
    items,
  );
  await audit(accountId, 'review.created', id, { items: items.length, scope: type });
  return { id, items: items.length };
}

async function loadReview(idInput: unknown): Promise<ReviewRow> {
  const id = v.id(idInput, 'review', /^[0-9a-f-]{36}$/);
  const r = await getReview(id);
  if (!r) throw new BadRequest('Review not found');
  return r;
}

export async function reviewDetail(p: any) {
  const review = await loadReview(p.id);
  const items = await getItems(review.id);
  const state = await stateFor(review.baseSeq);
  const latest = await latestCommitted();
  const names = latest && latest.seq !== review.baseSeq ? await stateFor(latest.seq) : state;
  const personName = (id: string | null) =>
    id
      ? (names.persons.get(id)?.displayName ?? state.persons.get(id)?.displayName ?? 'Unknown user')
      : null;
  const base = await getSnapshot(review.baseSeq, false);
  const compare = review.compareSeq ? await getSnapshot(review.compareSeq, false) : null;
  const baseFull = await getSnapshot(review.baseSeq);
  const coverage = baseFull?.coverage ?? [];
  const limitations = limitationsPayload(base?.status, coverage);
  return {
    review: {
      ...review,
      createdByName: personName(review.createdBy),
      signedByName: personName(review.signedBy),
      scopeLabels: review.scope.ids.map((id) =>
        review.scope.type === 'projects'
          ? (state.projects.get(id)?.key ?? id)
          : (state.groups.get(id)?.name ?? id),
      ),
    },
    base: snapshotSummary(base),
    compare: snapshotSummary(compare),
    coverage,
    limitations,
    completeness: limitations.completeness,
    items: items.map((i) => {
      const subject =
        i.subjectType === 'user'
          ? subjectView(state, { type: 'user', accountId: i.subjectId })
          : i.subjectType === 'group'
            ? subjectView(state, { type: 'group', groupId: i.subjectId })
            : i.subjectType === 'conditional'
              ? subjectView(state, { type: 'conditional', holderType: i.subjectId })
              : subjectView(state, { type: 'anonymous' });
      if (i.subjectType === 'user') subject.name = personName(i.subjectId) ?? subject.name;
      return {
        ...i,
        subject,
        project: i.projectId ? projectView(state, i.projectId) : null,
        groupName: i.groupId ? (state.groups.get(i.groupId)?.name ?? i.groupId) : null,
        decidedByName: personName(i.decidedBy),
      };
    }),
  };
}

export async function decideItems(p: any, accountId: string) {
  const review = await loadReview(p.id);
  if (review.status === 'signed') throw new BadRequest('Signed reviews are read-only');
  const decision =
    p.decision === 'keep' || p.decision === 'revoke' || p.decision === 'exception'
      ? p.decision
      : p.decision === null
        ? null
        : undefined;
  if (decision === undefined) throw new BadRequest('Invalid decision');
  if (!Array.isArray(p.idxs) || !p.idxs.length || p.idxs.length > 5000)
    throw new BadRequest('Pick items to decide');
  const idxs = p.idxs.map((x: unknown) => {
    const n = Number(x);
    if (!Number.isInteger(n) || n < 0 || n >= review.itemCount)
      throw new BadRequest('Invalid item');
    return n;
  });
  const settings = await getSettings();
  const rawNote = p.note === undefined ? undefined : v.text(p.note, 2000, 'Note');
  let note: string | null | undefined = rawNote === undefined ? undefined : rawNote || null;
  let expiresAt: number | null = null;
  if (decision !== null) {
    try {
      const checked = validateDecisionInput({
        decision,
        note: note ?? '',
        expiresAt: p.expiresAt ?? null,
        requireKeepNote: settings.requireKeepNote,
        tz: typeof p.tz === 'string' ? p.tz : 'UTC',
      });
      note = checked.note;
      expiresAt = checked.expiresAt;
    } catch (e) {
      throw new BadRequest(String((e as Error).message ?? e));
    }
  }
  const changed = await decide(review.id, idxs, decision, note, accountId, expiresAt);
  await audit(accountId, 'review.decided', review.id, {
    count: changed,
    decision,
    withNote: Boolean(note),
  });
  return { changed };
}

const TZ = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$|^UTC$/;

export async function signReview(p: any, accountId: string, edition: EditionDecision) {
  const review = await loadReview(p.id);
  if (review.status === 'signed') throw new BadRequest('This review is already signed');
  if (p.attest !== true) throw new BadRequest('Confirm the attestation to sign');
  const tz = typeof p.tz === 'string' && TZ.test(p.tz) ? p.tz : 'UTC';
  const items = await getItems(review.id);
  const pending = items.filter((i) => i.change !== 'removed' && !i.decision).length;
  if (pending) throw new BadRequest(`${pending} items still need a decision`);
  const base = await getSnapshot(review.baseSeq, false);
  const compare = review.compareSeq ? await getSnapshot(review.compareSeq, false) : null;
  const baseFull = await getSnapshot(review.baseSeq);
  const covHash = coverageHash(baseFull?.coverage ?? []);
  const signedAt = Date.now();
  const attestation =
    'I confirm that I reviewed every access item in this scope and that the decisions recorded here reflect my assessment.';
  const trySign = async () => {
    const tip = await nextChainTip();
    const hash = evidenceHash(
      evidenceInput(
        review,
        items,
        { seq: review.baseSeq, contentHash: base?.contentHash ?? null },
        compare ? { seq: compare.seq, contentHash: compare.contentHash } : null,
        accountId,
        signedAt,
        {
          signatureVersion: 2,
          coverageHash: covHash,
          limitationsVersion: LIMITATIONS_VERSION,
          prevReviewHash: tip.prevHash,
          signerTz: tz,
        },
      ),
    );
    if (
      !(await markSigned(review.id, accountId, signedAt, tz, attestation, hash, {
        signatureVersion: 2,
        coverageHash: covHash,
        chainSeq: tip.nextSeq,
        prevReviewHash: tip.prevHash,
      }))
    )
      throw new BadRequest('This review is already signed');
    return { hash, chainSeq: tip.nextSeq };
  };
  let signed: { hash: string; chainSeq: number };
  try {
    signed = await trySign();
  } catch (e) {
    if (!isDuplicateKey(e)) throw e;
    signed = await trySign();
  }
  const { hash, chainSeq } = signed;
  const exc = await upsertExceptionsOnSign(review.id, items, accountId, signedAt);
  if (exc.granted) await audit(accountId, 'exception.granted', review.id, { count: exc.granted });
  if (exc.superseded)
    await audit(accountId, 'exception.superseded', review.id, { count: exc.superseded });
  if (edition.features.remediationVerification) {
    const n = await insertRemediations(
      review.id,
      items
        .filter((it) => it.decision === 'revoke')
        .map((it) => ({ idx: it.idx, itemKey: it.itemKey })),
      signedAt,
    );
    if (n) await audit(accountId, 'remediation.created', review.id, { count: n });
  }
  await audit(accountId, 'review.signed', review.id, {
    signatureVersion: 2,
    evidenceHash: hash,
    chainSeq,
  });
  console.log('[review] signed', { items: items.length, hash: hash.slice(0, 12), chainSeq });
  return { evidenceHash: hash, signedAt, signatureVersion: 2 as const, chainSeq };
}

export async function exceptionsList(p: any) {
  const status =
    typeof p.status === 'string' &&
    ['active', 'expired', 'superseded', 'revoked', 'all'].includes(p.status)
      ? p.status
      : undefined;
  const page = Number.isInteger(Number(p.page)) ? Number(p.page) : 1;
  return listExceptions({ status, page });
}

/** Called from the daily privacy consumer; returns how many rows flipped to expired. */
export async function runExpireExceptions(now = Date.now()): Promise<number> {
  const count = await expireExceptions(now);
  if (count) {
    await audit('system', 'exception.expired', null, { count });
    console.log('[exceptions] expired', { count });
  }
  return count;
}

export async function remediationList(p: any, edition: EditionDecision) {
  const review = await loadReview(p.reviewId ?? p.id);
  if (!edition.features.remediationVerification) {
    return { gated: true as const, rows: [], summary: { verified: 0, total: 0, open: 0 } };
  }
  const rows = await listRemediation(review.id);
  const verified = rows.filter((r) => r.status === 'verified' || r.status === 'accepted').length;
  const open = rows.filter((r) =>
    ['pending', 'still_present', 'inconclusive'].includes(r.status),
  ).length;
  return {
    gated: false as const,
    rows,
    summary: { verified, total: rows.length, open },
  };
}

export async function acceptRemediationRisk(p: any, accountId: string, edition: EditionDecision) {
  if (!edition.features.remediationVerification) throw new BadRequest(REQUIRES_ADVANCED);
  const review = await loadReview(p.reviewId ?? p.id);
  const idx = Number(p.idx);
  if (!Number.isInteger(idx) || idx < 0) throw new BadRequest('Invalid item');
  const row = await getRemediation(review.id, idx);
  if (!row) throw new BadRequest('Remediation not found');
  if (row.status === 'verified' || row.status === 'accepted')
    throw new BadRequest('This remediation is already closed');
  const items = await getItems(review.id);
  const item = items.find((i) => i.idx === idx);
  if (!item) throw new BadRequest('Review item not found');
  let note: string;
  let expiresAt: number;
  try {
    const checked = validateDecisionInput({
      decision: 'exception',
      note: p.note,
      expiresAt: p.expiresAt,
      tz: typeof p.tz === 'string' ? p.tz : 'UTC',
    });
    note = checked.note!;
    expiresAt = checked.expiresAt!;
  } catch (e) {
    throw new BadRequest(String((e as Error).message ?? e));
  }
  await insertException({
    itemKey: item.itemKey,
    subjectType: item.subjectType,
    subjectId: item.subjectId,
    projectId: item.projectId,
    groupId: item.groupId,
    permissions: item.permissions,
    justification: note,
    expiresAt,
    reviewId: review.id,
    grantedBy: accountId,
    grantedAt: Date.now(),
  });
  await markRemediationAccepted(review.id, idx, `Accepted risk: ${note}`);
  await audit(accountId, 'remediation.accepted', review.id, { idx });
  return { ok: true };
}

/** After a committed snapshot: raise in-app change alerts (Advanced). */
export async function runAlertsCheck(seq: number): Promise<void> {
  const edition = await backgroundEdition();
  if (!edition.features.changeAlerts) return;
  const snap = await getSnapshot(seq, false);
  if (!snap || (snap.status !== 'complete' && snap.status !== 'partial')) return;
  const prev = await previousCommitted(seq);
  if (!prev) return; // first committed snapshot: no baseline
  const settings = await getSettings();
  const rules = sanitizeAlertRules(settings.alerts);
  const [prevState, nextState] = await Promise.all([stateFor(prev.seq), stateFor(seq)]);
  const alerts = capAlerts(evaluateAlerts(prevState, nextState, rules));
  if (!alerts.length) return;
  const counts: Record<string, number> = {};
  for (const a of alerts) {
    counts[a.rule] = (counts[a.rule] ?? 0) + 1;
    await insertNotice({
      kind: `alert:${a.rule}`,
      audience: 'admin',
      severity: a.severity,
      title: a.title,
      body: a.body,
      refId: String(seq),
    });
  }
  await audit('system', 'alert.raised', `#${seq}`, { seq, counts, total: alerts.length });
  console.log('[alerts] raised', { seq, total: alerts.length });
}

function alertFromNotice(n: Notice) {
  return {
    id: n.id,
    rule: n.kind.startsWith('alert:') ? n.kind.slice(6) : n.kind,
    severity: n.severity,
    title: n.title,
    body: n.body,
    seq: n.refId ? Number(n.refId) || null : null,
    createdAt: n.createdAt,
    dismissedAt: n.dismissedAt,
    dismissedBy: n.dismissedBy,
  };
}

export async function alertsList(payload: any, edition: EditionDecision) {
  if (!edition.features.changeAlerts) throw new BadRequest(REQUIRES_ADVANCED);
  const raw = typeof payload?.status === 'string' ? payload.status : 'undismissed';
  const status =
    raw === 'dismissed' || raw === 'all' || raw === 'undismissed' ? raw : 'undismissed';
  const page = Math.max(1, Math.floor(Number(payload?.page) || 1));
  const out = await listNotices({
    audience: 'admin',
    kindPrefix: 'alert:',
    status,
    page,
  });
  return { items: out.items.map(alertFromNotice), total: out.total };
}

export async function dismissAlerts(payload: any, accountId: string, edition: EditionDecision) {
  if (!edition.features.changeAlerts) throw new BadRequest(REQUIRES_ADVANCED);
  const ids = Array.isArray(payload?.ids)
    ? payload.ids.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
    : [];
  if (!ids.length) throw new BadRequest('ids required');
  const changed = await dismissNotices(ids, accountId);
  if (changed) await audit(accountId, 'alert.dismissed', null, { count: changed });
  return { changed };
}

/** After a committed snapshot: re-check open remediations against the new access picture. */
export async function runRemediationCheck(seq: number): Promise<void> {
  const edition = await backgroundEdition();
  if (!edition.features.remediationVerification) return;
  const snap = await getSnapshot(seq, false);
  if (!snap || (snap.status !== 'complete' && snap.status !== 'partial')) return;
  const open = await openRemediations(seq);
  if (!open.length) return;
  const state = await stateFor(seq);
  const now = Date.now();
  let verified = 0;
  let stillPresent = 0;
  let inconclusive = 0;
  // Cache review metadata per id.
  const reviews = new Map<string, ReviewRow>();
  for (const row of open) {
    let review = reviews.get(row.reviewId);
    if (!review) {
      const r = await getReview(row.reviewId);
      if (!r) continue;
      review = r;
      reviews.set(row.reviewId, r);
    }
    const presence = itemPresent(state, row.itemKey, review.keyPermissions, review.scope);
    if (presence === 'absent') {
      await updateRemediationCheck(row.reviewId, row.idx, {
        status: 'verified',
        checkedSeq: seq,
        checkedAt: now,
        verifiedSeq: seq,
        detail: `Absent in snapshot #${seq}`,
      });
      verified += 1;
    } else if (presence === 'inconclusive') {
      await updateRemediationCheck(row.reviewId, row.idx, {
        status: 'inconclusive',
        checkedSeq: seq,
        checkedAt: now,
        detail: 'Partial data; could not confirm removal',
      });
      inconclusive += 1;
    } else {
      const checks = row.checkCount + 1;
      await updateRemediationCheck(row.reviewId, row.idx, {
        status: 'still_present',
        checkedSeq: seq,
        checkedAt: now,
        detail:
          checks >= 3
            ? `Still present after ${checks} snapshots (highlighted)`
            : `Still present in snapshot #${seq}`,
      });
      stillPresent += 1;
    }
  }
  await audit('system', 'remediation.checked', `#${seq}`, {
    seq,
    verified,
    stillPresent,
    inconclusive,
  });
  console.log('[remediation] checked', { seq, verified, stillPresent, inconclusive });
}

/** Recomputes the evidence hash from stored records; any edit after sign-off shows up as a mismatch. */
export async function verifyReview(p: any, accountId: string) {
  const review = await loadReview(p.id);
  if (review.status !== 'signed' || !review.signedBy || !review.signedAt)
    throw new BadRequest('Only signed reviews can be verified');
  const items = await getItems(review.id);
  const base = await getSnapshot(review.baseSeq, false);
  const compare = review.compareSeq ? await getSnapshot(review.compareSeq, false) : null;
  const version = review.signatureVersion >= 2 ? (2 as const) : (1 as const);
  const hash = evidenceHash(
    evidenceInput(
      review,
      items,
      { seq: review.baseSeq, contentHash: base?.contentHash ?? null },
      compare ? { seq: compare.seq, contentHash: compare.contentHash } : null,
      review.signedBy,
      review.signedAt,
      version === 2
        ? {
            signatureVersion: 2,
            coverageHash: review.coverageHash,
            limitationsVersion: LIMITATIONS_VERSION,
            prevReviewHash: review.prevReviewHash,
            signerTz: review.signerTz,
          }
        : { signatureVersion: 1 },
    ),
  );
  const ok = hash === review.evidenceHash;
  await audit(accountId, 'review.verified', review.id, {
    mode: 'quick',
    result: ok ? 'ok' : 'mismatch',
  });
  return {
    ok,
    valid: ok,
    stored: review.evidenceHash,
    computed: hash,
    evidenceHash: review.evidenceHash,
    recomputed: hash,
    signatureVersion: version,
  };
}

/** Walk the site-wide signature chain; reports the first structural or hash break. */
export async function verifyChain(accountId: string) {
  const links = await listChainLinks();
  const structural = walkChain(links);
  if (!structural.ok) {
    await audit(accountId, 'review.chain_verified', null, {
      ok: false,
      length: structural.length,
      brokenAt: structural.brokenAt,
      reason: structural.reason,
    });
    return structural;
  }
  const results = [...structural.links];
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const review = await getReview(link.id);
    if (!review || !review.signedBy || !review.signedAt || !review.evidenceHash) {
      const reason = 'signed review missing';
      results[i] = { chainSeq: link.chainSeq, id: link.id, ok: false, reason };
      const out = {
        ok: false,
        length: links.length,
        brokenAt: link.chainSeq,
        reason,
        links: results,
      };
      await audit(accountId, 'review.chain_verified', null, {
        ok: false,
        length: out.length,
        brokenAt: out.brokenAt,
        reason,
      });
      return out;
    }
    const items = await getItems(review.id);
    const base = await getSnapshot(review.baseSeq, false);
    const compare = review.compareSeq ? await getSnapshot(review.compareSeq, false) : null;
    const version = review.signatureVersion >= 2 ? (2 as const) : (1 as const);
    const computed = evidenceHash(
      evidenceInput(
        review,
        items,
        { seq: review.baseSeq, contentHash: base?.contentHash ?? null },
        compare ? { seq: compare.seq, contentHash: compare.contentHash } : null,
        review.signedBy,
        review.signedAt,
        version === 2
          ? {
              signatureVersion: 2,
              coverageHash: review.coverageHash,
              limitationsVersion: LIMITATIONS_VERSION,
              prevReviewHash: review.prevReviewHash,
              signerTz: review.signerTz,
            }
          : { signatureVersion: 1 },
      ),
    );
    if (computed !== review.evidenceHash) {
      const reason = 'evidence hash mismatch';
      results[i] = { chainSeq: link.chainSeq, id: link.id, ok: false, reason };
      const out = {
        ok: false,
        length: links.length,
        brokenAt: link.chainSeq,
        reason,
        links: results,
      };
      await audit(accountId, 'review.chain_verified', null, {
        ok: false,
        length: out.length,
        brokenAt: out.brokenAt,
        reason,
      });
      return out;
    }
  }
  const out = { ok: true, length: links.length, links: results };
  await audit(accountId, 'review.chain_verified', null, {
    ok: true,
    length: out.length,
  });
  return out;
}

export async function startSnapshotVerify(p: any, accountId: string) {
  const review = await loadReview(p.reviewId ?? p.id);
  if (review.status !== 'signed') throw new BadRequest('Only signed reviews can be verified');
  const base = await getSnapshot(review.baseSeq, false);
  // Expected = content hash stored on the snapshot at sign time (also embedded in evidence).
  const expected = base?.contentHash ?? null;
  const jobId = await insertVerifyJob(review.id, review.baseSeq, expected);
  await push({ step: 'VERIFY_SNAPSHOT', jobId });
  await audit(accountId, 'review.verify_started', review.id, { jobId, seq: review.baseSeq });
  return { jobId, expectedHash: expected, seq: review.baseSeq };
}

export async function verifyJobStatus(p: any) {
  const id = v.id(p.jobId, 'job', /^[0-9a-f-]{36}$/);
  const job = await getVerifyJob(id);
  if (!job) throw new BadRequest('Verify job not found');
  return job;
}

/** Queue consumer: recompute snapshot content hash and compare to the signed value. */
export async function runVerifySnapshotJob(jobId: string): Promise<void> {
  const job = await getVerifyJob(jobId);
  if (!job) return;
  if (job.status === 'ok' || job.status === 'mismatch' || job.status === 'purged') return;
  await patchVerifyJob(jobId, { status: 'running', error: null });

  const snap = await getSnapshot(job.seq, false);
  const facts = await loadFacts(job.seq);
  if (!facts.length && !snap?.contentHash) {
    await patchVerifyJob(jobId, {
      status: 'purged',
      finishedAt: Date.now(),
      error: 'Snapshot data was deleted by retention; only the signature can be checked.',
    });
    await audit('system', 'review.verified', job.reviewId, { mode: 'deep', result: 'purged' });
    return;
  }

  // Stream in pages (same ORDER BY kind,fkey as contentHash sort) with an 800s budget.
  const deadline = Date.now() + 800_000;
  let page = await streamContentHashPage(job.seq, null, null);
  while (!page.done) {
    if (Date.now() > deadline) {
      await patchVerifyJob(jobId, {
        status: 'pending',
        cursorKind: page.cursorKind,
        cursorFkey: page.cursorFkey,
        error: 'Budget exceeded; queued for continuation',
      });
      await push({ step: 'VERIFY_SNAPSHOT', jobId }, 0);
      return;
    }
    page = await streamContentHashPage(
      job.seq,
      page.cursorKind,
      page.cursorFkey,
      page.hash,
      page.started,
    );
  }
  const actualHash = page.started ? page.hash.digest('hex') : contentHash([]);
  const expected = job.expectedHash ?? snap?.contentHash ?? null;
  const result: 'ok' | 'mismatch' = expected != null && actualHash === expected ? 'ok' : 'mismatch';
  await patchVerifyJob(jobId, {
    status: result,
    actualHash,
    finishedAt: Date.now(),
    cursorKind: null,
    cursorFkey: null,
    error: null,
  });
  await audit('system', 'review.verified', job.reviewId, { mode: 'deep', result });
  console.log('[verify] snapshot', { seq: job.seq, result, hash: actualHash.slice(0, 12) });
}

export async function removeReview(p: any, accountId: string) {
  const review = await loadReview(p.id);
  if (review.status === 'signed') throw new BadRequest('Signed reviews cannot be deleted');
  await deleteDraftReview(review.id);
  await audit(accountId, 'review.deleted', review.id);
  return { deleted: true };
}

// ---------- settings ----------
export async function settingsView(accountId: string, edition: EditionDecision) {
  const s = effectiveSchedule(await getSettings(), edition.features);
  return {
    settings: { ...s, fallbackAccountId: undefined },
    edition: editionView(edition),
    fallbackIsMe: s.fallbackAccountId === accountId,
    fallbackEnabled: Boolean(s.fallbackAccountId),
    privacy: await kvGet('privacy:lastRun'),
    usage: await hourUsage(),
  };
}

/** Server-side edition gate for settings; the UI only hides controls. */
export function assertSettingsAllowed(input: Record<string, unknown>, features: FeatureFlags) {
  if (!features.customSchedules && input.frequency === 'daily')
    throw new BadRequest(REQUIRES_ADVANCED);
  if (
    !features.unlimitedHistory &&
    input.retentionDays !== undefined &&
    Number(input.retentionDays) > STANDARD_RETENTION_DAYS
  )
    throw new BadRequest(REQUIRES_ADVANCED);
}

export function editionView(e: EditionDecision) {
  return {
    edition: e.edition,
    source: e.source,
    override: e.override,
    features: e.features,
    envOverride: e.source === 'env',
    comingSoon: comingSoonFeatures(featureFlags('advanced')),
  };
}

export async function updateSettings(p: any, accountId: string, edition: EditionDecision) {
  const input = { ...(p.settings ?? {}) } as Record<string, unknown>;
  assertSettingsAllowed(input, edition.features);
  delete input.fallbackAccountId; // never taken from the client
  if (p.fallback === 'me') input.fallbackAccountId = accountId;
  if (p.fallback === 'off') input.fallbackAccountId = null;
  const saved = await saveSettings(input);
  await refreshGate().catch(() => undefined);
  await audit(accountId, 'settings.saved', null, {
    frequency: saved.frequency,
    retentionDays: saved.retentionDays,
  });
  return settingsView(accountId, edition);
}

export async function activity() {
  const events = await listAudit(200);
  const latest = await latestCommitted();
  const state = latest ? await stateFor(latest.seq) : null;
  return {
    events: events.map((e) => ({
      ...e,
      actorName:
        e.actor === 'system'
          ? 'AccessRadar'
          : (state?.persons.get(e.actor)?.displayName ?? 'Jira admin'),
    })),
  };
}

export async function logExport(p: any, accountId: string) {
  const kind = v.id(p.kind, 'export kind', /^[a-z-]{1,32}$/);
  const target = p.target === undefined ? null : v.text(String(p.target), 128, 'target');
  const limitationsVersion =
    typeof p.limitationsVersion === 'number' && Number.isFinite(p.limitationsVersion)
      ? Math.floor(p.limitationsVersion)
      : undefined;
  await audit(accountId, 'export', target, {
    kind,
    ...(limitationsVersion !== undefined ? { limitationsVersion } : {}),
  });
  return { logged: true };
}

/** Paginated evidence-pack payload for Advanced PDF export (built in the browser). */
export async function getEvidencePack(p: any, edition: EditionDecision) {
  if (!edition.features.evidencePack) throw new BadRequest(REQUIRES_ADVANCED);
  const review = await loadReview(p.id);
  if (review.status !== 'signed') throw new BadRequest('Sign the review first');
  const page = Math.max(1, Math.floor(Number(p.page) || 1));
  const pageSize = Math.min(1000, Math.max(1, Math.floor(Number(p.pageSize) || 500)));
  const items = await getItems(review.id);
  const decidable = items.filter((i) => i.change !== 'removed');
  const start = (page - 1) * pageSize;
  const slice = decidable.slice(start, start + pageSize);
  const nextPage = start + pageSize < decidable.length ? page + 1 : null;
  const base = await getSnapshot(review.baseSeq, false);
  const baseFull = await getSnapshot(review.baseSeq);
  const compare = review.compareSeq ? await getSnapshot(review.compareSeq, false) : null;
  const limitations = limitationsPayload(base?.status, baseFull?.coverage ?? []);
  const rem = await listRemediation(review.id);
  const exceptions = await listExceptions({ status: 'all', page: 1, pageSize: 200 });
  const scopeKeys = new Set(decidable.map((i) => i.itemKey));
  const excRelevant = exceptions.items.filter((e) => scopeKeys.has(e.itemKey));
  const auditEvents = (await listAudit(200)).filter((e) => e.target === review.id).slice(0, 50);
  const header = {
    reviewId: review.id,
    name: review.name,
    scope: review.scope,
    status: review.status,
    base: snapshotSummary(base),
    compare: snapshotSummary(compare),
    signedBy: review.signedBy,
    signedAt: review.signedAt,
    signerTz: review.signerTz,
    evidenceHash: review.evidenceHash,
    signatureVersion: review.signatureVersion,
    coverageHash: review.coverageHash,
    chainSeq: review.chainSeq,
    prevReviewHash: review.prevReviewHash,
    engineVersion: review.engineVersion,
    attestation: review.attestation,
    itemCount: decidable.length,
  };
  if (page > 1) {
    return { header, items: slice, nextPage, page, pageSize };
  }
  const summary = {
    keep: decidable.filter((i) => i.decision === 'keep').length,
    revoke: decidable.filter((i) => i.decision === 'revoke').length,
    exception: decidable.filter((i) => i.decision === 'exception').length,
    undecided: decidable.filter((i) => !i.decision).length,
    new: decidable.filter((i) => i.change === 'new').length,
    removed: items.filter((i) => i.change === 'removed').length,
  };
  return {
    header,
    sections: {
      methodology: {
        engineVersion: ENGINE_VERSION,
        dataSources: [...EVIDENCE_DATA_SOURCES],
        note: 'Effective access is resolved by expanding permission-scheme grants, project roles, and group membership into why-paths (read-only).',
      },
      limitations,
      coverage: baseFull?.coverage ?? [],
      summary,
      controls: {
        version: CONTROLS_VERSION,
        mappings: CONTROL_MAPPINGS,
        disclaimer: CONTROLS_DISCLAIMER,
      },
      exceptions: excRelevant,
      remediation: rem,
      audit: auditEvents.map((e) => ({
        at: e.at,
        actor: e.actor,
        action: e.action,
        detail: e.detail,
      })),
    },
    items: slice,
    nextPage,
    page,
    pageSize,
  };
}

// ---------- campaigns (Advanced) ----------
import {
  deleteCampaign as dbDeleteCampaign,
  findOpenAssignmentForProject,
  getAssignment,
  getCampaign,
  getCampaignRun,
  insertCampaign,
  insertCampaignRun,
  listAssignmentsForRun,
  listCampaigns as dbListCampaigns,
  pauseCampaign as dbPauseCampaign,
  sanitizeCampaignInput,
  submitAssignment as dbSubmitAssignment,
  updateCampaign,
  type CampaignInput,
} from '../db/campaigns';
import { exec as sqlExec } from '../db/sql';
import { resolveAssignee, resolveCampaignProjectIds } from '../collector/campaignRun';
import { push as queuePush } from '../lib/queue';
import { ForbiddenError } from '../lib/auth';
import { nextRunAt } from '../domain/campaignSchedule';

function assertCampaigns(edition: EditionDecision) {
  if (!edition.features.reviewCampaigns) throw new BadRequest(REQUIRES_ADVANCED);
}

export async function campaignsList(_p: any, edition: EditionDecision) {
  assertCampaigns(edition);
  return { items: await dbListCampaigns() };
}

export async function campaignSave(p: any, accountId: string, edition: EditionDecision) {
  assertCampaigns(edition);
  try {
    const input = sanitizeCampaignInput(p as CampaignInput);
    if (typeof p.id === 'string' && p.id) {
      await updateCampaign(p.id, input);
      await audit(accountId, 'campaign.updated', p.id, { name: input.name });
      await refreshGate().catch(() => undefined);
      return { id: p.id };
    }
    const id = await insertCampaign(input, accountId);
    await audit(accountId, 'campaign.created', id, { name: input.name });
    await refreshGate().catch(() => undefined);
    return { id };
  } catch (e) {
    throw new BadRequest(e instanceof Error ? e.message : 'Invalid campaign');
  }
}

export async function campaignPreview(p: any, edition: EditionDecision) {
  assertCampaigns(edition);
  const input = sanitizeCampaignInput(p as CampaignInput);
  const snap = await latestCommitted();
  if (!snap) throw new BadRequest('Take a snapshot before previewing a campaign');
  const state = await stateFor(snap.seq);
  const settings = await getSettings();
  const keyPerms = input.keyPermissions?.length ? input.keyPermissions : settings.keyPermissions;
  const fake = {
    id: 'preview',
    name: input.name,
    scope: input.scope,
    frequency: input.frequency,
    startAt: input.startAt,
    windowDays: input.windowDays ?? 14,
    delegateRule: input.delegateRule ?? ('projectLead' as const),
    delegateMap: input.delegateMap ?? null,
    reminderDays: Array.isArray(input.reminderDays) ? input.reminderDays : [7, 3, 1],
    keyPermissions: keyPerms,
    status: 'active' as const,
    nextRunAt: null,
    createdBy: 'preview',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const { ids, warnings } = resolveCampaignProjectIds(
    fake,
    [...state.projects.entries()].map(([id, p]) => ({ id, categoryId: p.categoryId ?? null })),
  );
  const projects = ids.slice(0, 100).map((id) => {
    const pjt = state.projects.get(id)!;
    return {
      id,
      key: pjt.key,
      assignee: resolveAssignee(fake, id, pjt.leadAccountId),
      items: buildReviewItems(state, { type: 'projects', ids: [id] }, keyPerms).length,
    };
  });
  return { projects, warnings, totalProjects: ids.length };
}

export async function campaignStartRun(p: any, accountId: string, edition: EditionDecision) {
  assertCampaigns(edition);
  const id = v.id(p.campaignId, 'campaign', /^[0-9a-f-]{36}$/);
  const campaign = await getCampaign(id);
  if (!campaign || campaign.status === 'deleted') throw new BadRequest('Campaign not found');
  const now = Date.now();
  const runId = await insertCampaignRun({
    campaignId: id,
    status: 'starting',
    startedAt: now,
    dueAt: now + campaign.windowDays * 86400_000,
  });
  const next = nextRunAt({ frequency: campaign.frequency, startAt: campaign.startAt }, now, now);
  await sqlExec(`UPDATE campaign SET next_run_at = ?, updated_at = ? WHERE id = ?`, next, now, id);
  await queuePush({ step: 'CAMPAIGN_RUN', runId });
  await audit(accountId, 'campaign.run_started', runId, { campaignId: id, manual: true });
  await refreshGate().catch(() => undefined);
  return { runId };
}

export async function campaignRunGet(p: any, edition: EditionDecision) {
  assertCampaigns(edition);
  const id = v.id(p.runId, 'run', /^[0-9a-f-]{36}$/);
  const run = await getCampaignRun(id);
  if (!run) throw new BadRequest('Run not found');
  const assignments = await listAssignmentsForRun(id);
  return { run, assignments };
}

export async function campaignPause(p: any, accountId: string, edition: EditionDecision) {
  assertCampaigns(edition);
  const id = v.id(p.id, 'campaign', /^[0-9a-f-]{36}$/);
  await dbPauseCampaign(id, 'paused');
  await audit(accountId, 'campaign.paused', id, {});
  await refreshGate().catch(() => undefined);
  return { ok: true };
}

export async function campaignDelete(p: any, accountId: string, edition: EditionDecision) {
  assertCampaigns(edition);
  const id = v.id(p.id, 'campaign', /^[0-9a-f-]{36}$/);
  await dbDeleteCampaign(id);
  await audit(accountId, 'campaign.deleted', id, {});
  await refreshGate().catch(() => undefined);
  return { ok: true };
}

export async function campaignReassign(p: any, accountId: string, edition: EditionDecision) {
  assertCampaigns(edition);
  const reviewId = v.id(p.reviewId, 'review', /^[0-9a-f-]{36}$/);
  const assignee =
    p.accountId === null || p.accountId === undefined
      ? null
      : v.id(p.accountId, 'accountId', /^[\w:-]{1,128}$/);
  await sqlExec(
    `UPDATE review_assignment SET assignee = ? WHERE review_id = ?`,
    assignee,
    reviewId,
  );
  await audit(accountId, 'assignment.reassigned', reviewId, {});
  return { ok: true };
}

// ---------- project settings page (delegated reviews) ----------
function assertDelegated(edition: EditionDecision) {
  if (!edition.features.delegatedReviews) throw new BadRequest(REQUIRES_ADVANCED);
}

/**
 * Project page payload. `projectId` must come from Forge extension context (never payload).
 * Caller is already verified as project admin (or site admin) by the project resolver.
 */
export async function projectMyAssignment(
  projectId: string,
  accountId: string,
  access: 'assignee' | 'site-admin' | 'not-assigned',
  edition: EditionDecision,
) {
  assertDelegated(edition);
  const notices = await listNotices({
    audience: 'project',
    projectId,
    status: 'undismissed',
    page: 1,
    pageSize: 20,
  });
  if (access === 'not-assigned') {
    return {
      access,
      assignment: null,
      review: null,
      items: [],
      notices: notices.items,
      limitation:
        'No access review is assigned to you for this project. Admins assign owners when they run a campaign.',
    };
  }
  const assignment = await findOpenAssignmentForProject(projectId);
  if (!assignment) {
    return {
      access,
      assignment: null,
      review: null,
      items: [],
      notices: notices.items,
      limitation: 'No access review is assigned to this project.',
    };
  }
  if (access === 'assignee' && assignment.assignee !== accountId) {
    return {
      access: 'not-assigned' as const,
      assignment: null,
      review: null,
      items: [],
      notices: notices.items,
      limitation: 'Only the assigned project admin can review access here.',
    };
  }
  const detail = await reviewDetail({ id: assignment.reviewId });
  return {
    access,
    assignment,
    review: detail.review,
    items: detail.items,
    notices: notices.items,
    limitation: null,
  };
}

export async function projectDecideItems(
  projectId: string,
  accountId: string,
  access: 'assignee' | 'site-admin' | 'not-assigned',
  p: any,
  edition: EditionDecision,
) {
  assertDelegated(edition);
  if (access === 'not-assigned')
    throw new ForbiddenError('Only the assigned project admin can review access here');
  const reviewId = v.id(p.reviewId ?? p.id, 'review', /^[0-9a-f-]{36}$/);
  const assignment = await getAssignment(reviewId);
  if (!assignment || assignment.projectId !== projectId || assignment.status !== 'open')
    throw new BadRequest('Assignment not found for this project');
  if (access === 'assignee' && assignment.assignee !== accountId)
    throw new ForbiddenError('Only the assigned project admin can review access here');
  return decideItems({ ...p, id: reviewId }, accountId);
}

export async function projectSubmitAssignment(
  projectId: string,
  accountId: string,
  access: 'assignee' | 'site-admin' | 'not-assigned',
  p: any,
  edition: EditionDecision,
) {
  assertDelegated(edition);
  if (access === 'not-assigned')
    throw new ForbiddenError('Only the assigned project admin can submit this review');
  const reviewId = v.id(p.reviewId ?? p.id, 'review', /^[0-9a-f-]{36}$/);
  const assignment = await getAssignment(reviewId);
  if (!assignment || assignment.projectId !== projectId || assignment.status !== 'open')
    throw new BadRequest('Assignment not found for this project');
  if (access === 'assignee' && assignment.assignee !== accountId)
    throw new ForbiddenError('Only the assigned project admin can submit this review');
  const review = await loadReview(reviewId);
  const items = await getItems(reviewId);
  const pending = items.filter((i) => i.change !== 'removed' && !i.decision).length;
  if (pending) throw new BadRequest(`${pending} items still need a decision`);
  if (!(await dbSubmitAssignment(reviewId, accountId)))
    throw new BadRequest('Assignment already submitted');
  await audit(accountId, 'assignment.submitted', reviewId, { projectId });
  return { submitted: true, reviewId, name: review.name };
}

export async function projectDismissNotice(
  projectId: string,
  accountId: string,
  p: any,
  edition: EditionDecision,
) {
  assertDelegated(edition);
  const id = Number(p.id);
  if (!Number.isInteger(id) || id < 1) throw new BadRequest('Invalid notice');
  const list = await listNotices({
    audience: 'project',
    projectId,
    status: 'undismissed',
    page: 1,
    pageSize: 200,
  });
  if (!list.items.some((n) => n.id === id)) throw new BadRequest('Notice not found');
  await dismissNotices([id], accountId);
  await audit(accountId, 'notice.dismissed', String(id), { projectId });
  return { ok: true };
}
