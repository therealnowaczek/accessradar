import api, { route } from '@forge/api';
import { diffEffective, diffFacts, effectiveTuples, type AccessTuple } from '../engine/diff';
import { ENGINE_VERSION, resolveAll } from '../engine/resolve';
import { applyExceptions, validateDecisionInput } from '../engine/exceptions';
import { buildReviewItems, evidenceHash, type ReviewScope } from '../engine/review';
import {
  activeExceptionsForKeys,
  expireExceptions,
  listExceptions,
  upsertExceptionsOnSign,
} from '../db/exceptions';
import { computeRisks } from '../engine/risk';
import { buildState, type AccessState } from '../engine/state';
import { audit, listAudit } from '../db/audit';
import {
  decide,
  deleteDraftReview,
  evidenceInput,
  getItems,
  getReview,
  insertReview,
  listReviews,
  markSigned,
  type ReviewRow,
} from '../db/reviews';
import { refreshGate } from '../collector/gate';
import { LIMITATIONS_VERSION, limitationsPayload } from '../domain/limitations';
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
import type { EditionDecision } from './edition';
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
  const [latest, active, settings, list] = await Promise.all([
    latestCommitted(),
    activeSnapshot(),
    getSettings(),
    listSnapshots(1),
  ]);
  return {
    engineVersion: ENGINE_VERSION,
    spike,
    settingsSaved: settings.saved,
    frequency: settings.frequency,
    latest: snapshotSummary(latest),
    active: snapshotSummary(active),
    lastAttempt: snapshotSummary(list[0] ?? null),
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
  if (!snap)
    return {
      snapshot: null,
      active: snapshotSummary(active),
      reviews: reviewSummary,
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

export async function signReview(p: any, accountId: string) {
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
        prevReviewHash: null,
        signerTz: tz,
      },
    ),
  );
  const attestation =
    'I confirm that I reviewed every access item in this scope and that the decisions recorded here reflect my assessment.';
  if (
    !(await markSigned(review.id, accountId, signedAt, tz, attestation, hash, {
      signatureVersion: 2,
      coverageHash: covHash,
    }))
  )
    throw new BadRequest('This review is already signed');
  const exc = await upsertExceptionsOnSign(review.id, items, accountId, signedAt);
  if (exc.granted) await audit(accountId, 'exception.granted', review.id, { count: exc.granted });
  if (exc.superseded)
    await audit(accountId, 'exception.superseded', review.id, { count: exc.superseded });
  await audit(accountId, 'review.signed', review.id, {
    signatureVersion: 2,
    evidenceHash: hash,
  });
  console.log('[review] signed', { items: items.length, hash: hash.slice(0, 12) });
  return { evidenceHash: hash, signedAt, signatureVersion: 2 as const };
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
            prevReviewHash: null,
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
