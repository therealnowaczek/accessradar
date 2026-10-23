import { audit } from '../db/audit';
import { campaignIdByRun, listCampaigns, type CampaignRow } from '../db/campaigns';
import { listReviews, type ReviewRow } from '../db/reviews';
import { latestCommitted, listSnapshots, previousCommitted } from '../db/snapshots';
import { getSettings } from '../db/settings';
import type { AccessState } from '../engine/state';
import { BadRequest, changes, personInfo, projectDetail, stateFor } from '../api/service';

const MAX_ROWS = 50;

export type RovoResult = {
  action: string;
  snapshotSeq: number | null;
  snapshotAt: number | null;
  note?: string;
  rows: Array<Record<string, string | number | null>>;
  openIn: string;
};

function truncate<T>(rows: T[]): { rows: T[]; note?: string } {
  if (rows.length <= MAX_ROWS) return { rows };
  return {
    rows: rows.slice(0, MAX_ROWS),
    note: `Showing first ${MAX_ROWS} of ${rows.length} rows.`,
  };
}

function findProjectId(state: AccessState, projectKey: string): string | null {
  const want = projectKey.trim().toUpperCase();
  for (const [id, p] of state.projects) {
    if (p.key.toUpperCase() === want || id === projectKey) return id;
  }
  return null;
}

function findAccountId(state: AccessState, accountIdOrName: string): string | null {
  const raw = accountIdOrName.trim();
  if (!raw) return null;
  if (state.persons.has(raw) || state.memberOf.has(raw)) return raw;
  const lower = raw.toLowerCase();
  for (const [id, p] of state.persons) {
    if ((p.displayName ?? '').toLowerCase() === lower) return id;
  }
  return null;
}

async function latestState() {
  const snap = await latestCommitted();
  if (!snap) throw new BadRequest('Take a snapshot in AccessRadar first.');
  return { snap, state: await stateFor(snap.seq) };
}

export async function whoCanAccess(p: {
  projectKey?: string;
  permission?: string;
}): Promise<RovoResult> {
  const { snap, state } = await latestState();
  const key = String(p.projectKey ?? '').trim();
  if (!key) throw new BadRequest('projectKey is required');
  const projectId = findProjectId(state, key);
  if (!projectId) throw new BadRequest(`Space ${key} not in the latest snapshot`);
  const detail = await projectDetail({ projectId, seq: snap.seq });
  const data = detail.data;
  if (!data) throw new BadRequest('Space not in this snapshot');
  const want = p.permission?.trim() || null;
  const rows: RovoResult['rows'] = [];
  for (const r of data.rows) {
    const perms = Object.keys(r.perms).sort();
    const matched = want ? perms.filter((x) => x === want) : perms;
    if (!matched.length) continue;
    rows.push({
      subject: r.subject.name,
      subjectType: r.subject.type,
      permissions: matched.join(', '),
      project: data.project.key,
    });
  }
  const t = truncate(rows);
  return {
    action: 'ar-who-can-access',
    snapshotSeq: snap.seq,
    snapshotAt: snap.finishedAt ?? snap.startedAt,
    note: t.note,
    rows: t.rows,
    openIn: 'AccessRadar → Explore → Spaces',
  };
}

export async function whyAccess(p: {
  projectKey?: string;
  accountId?: string;
  name?: string;
  permission?: string;
}): Promise<RovoResult> {
  const { snap, state } = await latestState();
  const key = String(p.projectKey ?? '').trim();
  if (!key) throw new BadRequest('projectKey is required');
  const projectId = findProjectId(state, key);
  if (!projectId) throw new BadRequest(`Space ${key} not in the latest snapshot`);
  const who = String(p.accountId ?? p.name ?? '').trim();
  if (!who) throw new BadRequest('accountId or name is required');
  const accountId = findAccountId(state, who);
  const detail = await projectDetail({ projectId, seq: snap.seq });
  const data = detail.data;
  if (!data) throw new BadRequest('Space not in this snapshot');
  const want = p.permission?.trim() || null;
  const rows: RovoResult['rows'] = [];
  for (const r of data.rows) {
    const match =
      (accountId && r.subject.id === accountId) ||
      r.subject.name.toLowerCase() === who.toLowerCase() ||
      r.subject.id === who;
    if (!match) continue;
    for (const [perm, reasons] of Object.entries(r.perms)) {
      if (want && perm !== want) continue;
      const path = reasons.map((x) => x.text).filter(Boolean);
      rows.push({
        subject: r.subject.name,
        permission: perm,
        why: path.join(' · ') || 'path unavailable',
        project: data.project.key,
      });
    }
  }
  if (!rows.length) throw new BadRequest('No matching grant path in the latest snapshot');
  const t = truncate(rows);
  return {
    action: 'ar-why',
    snapshotSeq: snap.seq,
    snapshotAt: snap.finishedAt ?? snap.startedAt,
    note: t.note,
    rows: t.rows,
    openIn: 'AccessRadar → Explore → Spaces (Why panel)',
  };
}

export async function changesSince(p: {
  sinceSeq?: string | number;
  sinceDate?: string;
}): Promise<RovoResult> {
  const latest = await latestCommitted();
  if (!latest) throw new BadRequest('Take a snapshot in AccessRadar first.');
  let aSeq: number | null;
  if (p.sinceSeq != null && String(p.sinceSeq).trim() !== '') {
    aSeq = Number(p.sinceSeq);
    if (!Number.isFinite(aSeq)) throw new BadRequest('sinceSeq must be a number');
  } else if (p.sinceDate) {
    const t = Date.parse(String(p.sinceDate));
    if (!Number.isFinite(t)) throw new BadRequest('sinceDate must be an ISO date');
    const list = await listSnapshots(50);
    const hit = list.find(
      (s) =>
        (s.status === 'complete' || s.status === 'partial') && (s.finishedAt ?? s.startedAt) <= t,
    );
    aSeq = hit?.seq ?? null;
  } else {
    const prev = await previousCommitted(latest.seq);
    aSeq = prev?.seq ?? null;
  }
  const diff = await changes({ a: aSeq, b: latest.seq });
  const rows: RovoResult['rows'] = [
    ...diff.granted.map((g) => ({
      change: 'granted',
      subject: g.subject.name,
      project: g.project?.key ?? '',
      permission: g.permission,
    })),
    ...diff.revoked.map((g) => ({
      change: 'revoked',
      subject: g.subject.name,
      project: g.project?.key ?? '',
      permission: g.permission,
    })),
  ];
  const t = truncate(rows);
  return {
    action: 'ar-changes-since',
    snapshotSeq: latest.seq,
    snapshotAt: latest.finishedAt ?? latest.startedAt,
    note: [
      diff.a
        ? `Compared snapshot #${diff.a.seq} → #${diff.b?.seq}`
        : 'No earlier snapshot to compare',
      t.note,
    ]
      .filter(Boolean)
      .join(' · '),
    rows: t.rows,
    openIn: 'AccessRadar → Changes',
  };
}

/**
 * Campaigns matching the optional `campaign` input: exact name (case-insensitive) wins,
 * otherwise every campaign whose name contains the text. Deleted campaigns are never listed.
 */
function matchCampaigns(campaigns: CampaignRow[], filter: string): CampaignRow[] {
  const want = filter.trim().toLowerCase();
  if (!want) return campaigns;
  const exact = campaigns.filter((c) => c.name.trim().toLowerCase() === want);
  if (exact.length) return exact;
  return campaigns.filter((c) => c.name.toLowerCase().includes(want));
}

/** Reviews created by runs of the matched campaigns, plus the campaign name for each review. */
function reviewsForCampaigns<R extends Pick<ReviewRow, 'campaignRunId'>>(
  reviews: R[],
  campaigns: CampaignRow[],
  runToCampaign: Map<string, string>,
): Array<{ review: R; campaign: string }> {
  const names = new Map(campaigns.map((c) => [c.id, c.name]));
  const out: Array<{ review: R; campaign: string }> = [];
  for (const review of reviews) {
    const campaignId = review.campaignRunId ? runToCampaign.get(review.campaignRunId) : undefined;
    const name = campaignId ? names.get(campaignId) : undefined;
    if (name !== undefined) out.push({ review, campaign: name });
  }
  return out;
}

function reviewRow(r: ReviewRow & { decided?: number }, now: number, campaign: string | null) {
  return {
    name: r.name,
    campaign,
    status: r.status,
    due: r.dueAt ? new Date(r.dueAt).toISOString() : null,
    overdue: r.status !== 'signed' && r.dueAt != null && r.dueAt < now ? 'yes' : 'no',
    decided: `${r.decided ?? 0}/${r.itemCount}`,
    chain: r.chainSeq != null ? String(r.chainSeq) : r.status === 'signed' ? 'pre-chain' : null,
  };
}

export async function reviewStatus(p: { campaign?: unknown } = {}): Promise<RovoResult> {
  const filter = typeof p.campaign === 'string' ? p.campaign.trim() : '';
  const reviews = await listReviews();
  const now = Date.now();
  let rows: RovoResult['rows'];
  let note: string | undefined;
  if (filter) {
    const campaigns = await listCampaigns();
    const matched = matchCampaigns(campaigns, filter);
    if (!matched.length) {
      const known = campaigns.map((c) => c.name).slice(0, 10);
      throw new BadRequest(
        known.length
          ? `No campaign matches "${filter}". Campaigns: ${known.join(', ')}.`
          : `No campaign matches "${filter}". No review campaigns are configured.`,
      );
    }
    const found = reviewsForCampaigns(reviews, matched, await campaignIdByRun());
    rows = found.map(({ review, campaign }) => reviewRow(review, now, campaign));
    note = `Campaign: ${matched.map((c) => c.name).join(', ')} (${found.length} review(s)).`;
  } else {
    let runToCampaign = new Map<string, string>();
    let names = new Map<string, string>();
    try {
      const campaigns = await listCampaigns();
      names = new Map(campaigns.map((c) => [c.id, c.name]));
      const active = campaigns.filter((c) => c.status === 'active' || c.status === 'paused');
      if (active.length) note = `${active.length} campaign(s) configured (see Campaigns).`;
      if (reviews.some((r) => r.campaignRunId)) runToCampaign = await campaignIdByRun();
    } catch {
      /* campaigns unavailable */
    }
    rows = reviews.map((r) => {
      const campaignId = r.campaignRunId ? runToCampaign.get(r.campaignRunId) : undefined;
      return reviewRow(r, now, (campaignId && names.get(campaignId)) || null);
    });
  }
  const t = truncate(rows);
  const snap = await latestCommitted();
  return {
    action: 'ar-review-status',
    snapshotSeq: snap?.seq ?? null,
    snapshotAt: snap ? (snap.finishedAt ?? snap.startedAt) : null,
    note: [note, t.note].filter(Boolean).join(' · ') || undefined,
    rows: t.rows,
    openIn: 'AccessRadar → Reviews / Campaigns',
  };
}

export async function personAccessAction(p: {
  accountId?: string;
  name?: string;
}): Promise<RovoResult> {
  const { snap, state } = await latestState();
  const who = String(p.accountId ?? p.name ?? '').trim();
  if (!who) throw new BadRequest('accountId or name is required');
  const accountId = findAccountId(state, who);
  if (!accountId) throw new BadRequest('Person not in the latest snapshot');
  const info = await personInfo({ accountId, seq: snap.seq });
  const data = info.data;
  if (!data) throw new BadRequest('Person not in this snapshot');
  const settings = await getSettings();
  const keys = new Set(settings.keyPermissions);
  const rows: RovoResult['rows'] = [];
  for (const row of data.projects) {
    const perms = Object.keys(row.perms).sort();
    const matched = perms.filter((x) => keys.has(x));
    const shown = matched.length ? matched : perms.slice(0, 8);
    if (!shown.length) continue;
    rows.push({
      project: row.project.key,
      permissions: shown.join(', '),
      person: data.person.name,
    });
  }
  const t = truncate(rows);
  return {
    action: 'ar-person-access',
    snapshotSeq: snap.seq,
    snapshotAt: snap.finishedAt ?? snap.startedAt,
    note: t.note,
    rows: t.rows,
    openIn: 'AccessRadar → Explore → People',
  };
}

export async function runRovoAction(
  actionKey: string,
  payload: Record<string, unknown>,
  accountId: string,
): Promise<RovoResult> {
  let result: RovoResult;
  switch (actionKey) {
    case 'ar-who-can-access':
      result = await whoCanAccess(payload);
      break;
    case 'ar-why':
      result = await whyAccess(payload);
      break;
    case 'ar-changes-since':
      result = await changesSince(payload);
      break;
    case 'ar-review-status':
      result = await reviewStatus(payload);
      break;
    case 'ar-person-access':
      result = await personAccessAction(payload);
      break;
    default:
      throw new BadRequest(`Unknown AccessRadar action: ${actionKey}`);
  }
  await audit(accountId, 'rovo.action', null, { action: result.action, rows: result.rows.length });
  return result;
}

/** Pure helpers exported for unit tests. */
export const _test = {
  truncate,
  findProjectId,
  findAccountId,
  matchCampaigns,
  reviewsForCampaigns,
  MAX_ROWS,
};
