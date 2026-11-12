/**
 * Sample review campaign (C7). Fixed, invented data that lives only in the app's own key-value store:
 * it never reads or writes Jira users, groups or spaces, never creates a snapshot, review, campaign or
 * audit entry, and is never part of exports or the evidence chain. One click creates it, one click deletes it.
 */
export const SAMPLE_KV = 'sample-campaign';

export type SampleDecision = 'keep' | 'revoke' | 'exception';
export type SampleFlag = 'contractor' | 'deactivated' | 'public' | 'admin';
export type SampleVia = { kind: 'group' | 'role'; name: string } | { kind: 'direct' };

export interface SampleItem {
  id: string;
  space: string;
  person: string;
  via: SampleVia;
  permissions: string[];
  flags: SampleFlag[];
}

export const SAMPLE_ITEMS: readonly SampleItem[] = [
  {
    id: 's1',
    space: 'Payments (SMP-PAY)',
    person: 'Riley Sample',
    via: { kind: 'group', name: 'sample-contractors' },
    permissions: ['Browse projects', 'Edit issues', 'Delete issues'],
    flags: ['contractor'],
  },
  {
    id: 's2',
    space: 'Payments (SMP-PAY)',
    person: 'Avery Sample',
    via: { kind: 'role', name: 'Developers' },
    permissions: ['Browse projects', 'Create issues', 'Edit issues'],
    flags: [],
  },
  {
    id: 's3',
    space: 'Payments (SMP-PAY)',
    person: 'Ellis Sample',
    via: { kind: 'group', name: 'sample-developers' },
    permissions: ['Browse projects', 'Edit issues'],
    flags: ['deactivated'],
  },
  {
    id: 's4',
    space: 'People Ops (SMP-HR)',
    person: 'Sam Sample',
    via: { kind: 'role', name: 'Administrators' },
    permissions: ['Administer projects', 'Browse projects'],
    flags: ['admin'],
  },
  {
    id: 's5',
    space: 'People Ops (SMP-HR)',
    person: 'Morgan Sample',
    via: { kind: 'group', name: 'sample-hr-team' },
    permissions: ['Browse projects', 'Edit issues'],
    flags: [],
  },
  {
    id: 's6',
    space: 'Operations (SMP-OPS)',
    person: 'Casey Sample',
    via: { kind: 'group', name: 'sample-contractors' },
    permissions: ['Browse projects', 'Create issues', 'Delete issues'],
    flags: ['contractor'],
  },
  {
    id: 's7',
    space: 'Operations (SMP-OPS)',
    person: 'Jordan Sample',
    via: { kind: 'role', name: 'Administrators' },
    permissions: ['Administer projects', 'Browse projects'],
    flags: ['admin'],
  },
  {
    id: 's8',
    space: 'Public Roadmap (SMP-PUB)',
    person: 'Anyone on the internet',
    via: { kind: 'direct' },
    permissions: ['Browse projects'],
    flags: ['public'],
  },
];

export interface SampleStored {
  v: 1;
  createdAt: number;
  decisions: Record<string, SampleDecision>;
  finishedAt?: number;
}

export interface SampleView {
  createdAt: number;
  finishedAt: number | null;
  total: number;
  decided: number;
  counts: Record<SampleDecision, number>;
  items: Array<SampleItem & { decision: SampleDecision | null }>;
}

export function newSample(now: number): SampleStored {
  return { v: 1, createdAt: now, decisions: {} };
}

export function parseSampleDecision(raw: unknown): SampleDecision | null {
  return raw === 'keep' || raw === 'revoke' || raw === 'exception' ? raw : null;
}

export function isSampleItem(id: unknown): id is string {
  return typeof id === 'string' && SAMPLE_ITEMS.some((i) => i.id === id);
}

/** Records (or, with null, clears) one decision. A finished sample is read only. */
export function decideSample(
  s: SampleStored,
  id: string,
  decision: SampleDecision | null,
): SampleStored {
  if (s.finishedAt) throw new Error('The sample is finished. Delete it to start again.');
  if (!isSampleItem(id)) throw new Error('Unknown sample item');
  const decisions = { ...s.decisions };
  if (decision) decisions[id] = decision;
  else delete decisions[id];
  return { ...s, decisions };
}

export function finishSample(s: SampleStored, now: number): SampleStored {
  if (s.finishedAt) return s;
  if (SAMPLE_ITEMS.some((i) => !s.decisions[i.id]))
    throw new Error('Decide every item before finishing the sample.');
  return { ...s, finishedAt: now };
}

export function sampleView(s: SampleStored): SampleView {
  const counts: Record<SampleDecision, number> = { keep: 0, revoke: 0, exception: 0 };
  const items = SAMPLE_ITEMS.map((i) => {
    const decision = s.decisions[i.id] ?? null;
    if (decision) counts[decision] += 1;
    return { ...i, decision };
  });
  return {
    createdAt: s.createdAt,
    finishedAt: s.finishedAt ?? null,
    total: items.length,
    decided: items.filter((i) => i.decision).length,
    counts,
    items,
  };
}
