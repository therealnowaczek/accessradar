import { invoke } from '@forge/bridge';

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; forbidden?: boolean };

/** Resolvers answer { ok, data } | { ok: false, error } (MarginRadar convention); unwrap or throw. */
export async function call<T>(key: string, payload: Record<string, unknown> = {}): Promise<T> {
  const r = (await invoke(key, payload)) as Result<T> | undefined;
  if (!r || typeof r !== 'object' || !('ok' in r))
    throw new Error('Unexpected response from AccessRadar.');
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : 'Something went wrong.';

// ---------- shared types (mirror src/api) ----------
export type SnapshotStatus = 'queued' | 'running' | 'complete' | 'partial' | 'failed';

export type Snapshot = {
  seq: number;
  status: SnapshotStatus;
  trigger: string;
  collectorMode: string;
  engineVersion: string;
  startedAt: number;
  finishedAt: number | null;
  updatedAt: number;
  progress: {
    step: string;
    batch: number;
    batches?: number;
    message?: string;
    counts?: Record<string, number>;
  } | null;
  stats: Record<string, number> | null;
  points: number;
  calls: number;
  contentHash: string | null;
  error: string | null;
  gaps: number;
};

export type Coverage = { area: string; target: string; status: string; reason: string };

export type Status = {
  engineVersion: string;
  spike: boolean;
  settingsSaved: boolean;
  frequency: string;
  latest: Snapshot | null;
  active: Snapshot | null;
  lastAttempt: Snapshot | null;
};

export type ProjectRef = {
  id: string;
  key: string;
  name: string;
  style: 'company' | 'team';
  schemeId: string | null;
  schemeName: string | null;
};

export type SubjectView = {
  key: string;
  type: 'user' | 'group' | 'conditional' | 'anonymous';
  id: string;
  name: string;
  accountType?: string;
  active?: boolean;
};

export type Reason = { text: string; code: string; via: { kind: string; label: string } };

export type Risk = {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  count: number;
  items: Array<{ id: string; label: string; detail?: string }>;
};

export type Overview = {
  snapshot: Snapshot | null;
  coverage?: Coverage[];
  active: Snapshot | null;
  metrics?: {
    projects: number;
    teamManaged: number;
    schemes: number;
    grants: number;
    groups: number;
    groupsRead: number;
    people: number;
    inactivePeople: number;
    appAccounts: number;
    accessEntries: number;
  };
  risks?: Risk[];
  changes?: { granted: number; revoked: number; fromSeq: number } | null;
  reviews: {
    open: number;
    signed: number;
    lastSigned: { id: string; name: string; signedAt: number } | null;
    overdue: Array<{ id: string; name: string; dueAt: number }>;
  };
  usage: { points: number; calls: number };
  budget: number;
};

export type WithSnapshot<T> = { snapshot: Snapshot | null; data: T | null };

export type ProjectRow = ProjectRef & {
  lead: string | null;
  people: number;
  appAccounts: number;
  browse: number;
  admins: number;
  anonymous: boolean;
  unexpanded: number;
  conditional: number;
};

export type ProjectAccess = {
  project: ProjectRef;
  rows: Array<{ subject: SubjectView; perms: Record<string, Reason[]>; partial: boolean }>;
  permissions: string[];
};

export type GroupRow = {
  id: string;
  name: string;
  membersStatus: string;
  members: number | null;
  inactiveMembers: number | null;
  access: string[];
  applications: string[];
  projects: number;
  grants: number;
};

export type GroupDetail = {
  id: string;
  name: string;
  membersStatus: string;
  members: SubjectView[];
  access: string[];
  applications: string[];
  schemeGrants: Array<{ scheme: string; permission: string }>;
  roles: Array<{ projectId: string; roleId: string; roleName: string; project: ProjectRef }>;
  usage: Array<{
    project: ProjectRef;
    permissions: Array<{ permission: string; reasons: string[] }>;
  }>;
};

export type PersonRow = {
  accountId: string;
  name: string;
  accountType: string;
  active: boolean;
  projects: number;
  adminProjects: number;
  groups: number;
  jiraAdmin: boolean;
};

export type PersonAccess = {
  person: SubjectView;
  groups: Array<{ id: string; name: string; access: string[] }>;
  adminVia: string[];
  projects: Array<{ project: ProjectRef; perms: Record<string, Reason[]> }>;
  changes: {
    fromSeq: number;
    granted: Array<{ project: ProjectRef; permission: string; reasons: string[] }>;
    revoked: Array<{ project: ProjectRef; permission: string; reasons: string[] }>;
  } | null;
  keyPermissions: string[];
};

export type AccessChange = {
  subject: SubjectView;
  project: ProjectRef;
  permission: string;
  reasons: string[];
  codes: string[];
};

export type FactChange = {
  category: 'projects' | 'groups' | 'schemes' | 'people';
  change: 'added' | 'removed' | 'changed';
  kind: string;
  label: string;
  detail: string;
  projectIds: string[];
  groupId: string | null;
  permission: string | null;
};

export type Changes = {
  a: Snapshot | null;
  b: Snapshot | null;
  keyPermissions: string[];
  granted: AccessChange[];
  revoked: AccessChange[];
  facts: FactChange[];
};

export type ReviewScope = { type: 'site' | 'projects' | 'groups'; ids: string[] };

export type ReviewSummary = {
  id: string;
  name: string;
  scope: ReviewScope;
  keyPermissions: string[];
  baseSeq: number;
  compareSeq: number | null;
  status: 'draft' | 'in_progress' | 'signed';
  createdBy: string;
  createdAt: number;
  dueAt: number | null;
  itemCount: number;
  signedBy: string | null;
  signedAt: number | null;
  signerTz: string | null;
  attestation: string | null;
  evidenceHash: string | null;
  engineVersion: string;
  decided?: number;
  flagged?: number;
};

export type ReviewItem = {
  idx: number;
  itemKey: string;
  subjectType: SubjectView['type'];
  subjectId: string;
  projectId: string | null;
  groupId: string | null;
  permissions: string[];
  reasons: string[];
  pathCodes: string[];
  change: 'new' | 'unchanged' | 'removed' | null;
  risk: number;
  decision: 'keep' | 'revoke' | null;
  note: string | null;
  decidedBy: string | null;
  decidedAt: number | null;
  subject: SubjectView;
  project: ProjectRef | null;
  groupName: string | null;
  decidedByName: string | null;
};

export type ReviewDetail = {
  review: ReviewSummary & {
    createdByName: string | null;
    signedByName: string | null;
    scopeLabels: string[];
  };
  base: Snapshot | null;
  compare: Snapshot | null;
  coverage: Coverage[];
  items: ReviewItem[];
};

export type Settings = {
  frequency: 'off' | 'daily' | 'weekly';
  hourUtc: number;
  weekday: number;
  retentionDays: number;
  keyPermissions: string[];
  groupMembers: 'referenced' | 'all';
  largeGroupThreshold: number;
  wideAdminProjects: number;
  hourlyPointBudget: number;
  showAppAccounts: boolean;
  saved?: boolean;
};

export type SettingsView = {
  settings: Settings;
  fallbackIsMe: boolean;
  fallbackEnabled: boolean;
  privacy: { at: number; reported: number; closed: number; updated: number } | null;
  usage: { points: number; calls: number };
};

export type ActivityEvent = {
  id: number;
  at: number;
  actor: string;
  actorName: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
};

export type Probe = { name: string; status: number; count?: number; error?: string };
export type SpikeResult = { asUser: Probe[]; asApp: Probe[]; impersonationQueued: boolean };

// Legacy live project list (asUser), used before the first snapshot.
export type LiveProject = {
  id: string;
  key: string;
  name: string;
  typeKey: string;
  managed: 'company' | 'team';
  category?: string;
};
export type ProjectList = { projects: LiveProject[]; complete: boolean };
