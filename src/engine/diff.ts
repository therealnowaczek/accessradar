import type { FactKind, StoredFact } from './facts';
import { aggregate, describePath, pathCode, resolveAll, subjectKey, type Subject } from './resolve';
import type { AccessState } from './state';

export type ChangeType = 'added' | 'removed' | 'changed';

export interface FactChange {
  kind: FactKind;
  fkey: string;
  change: ChangeType;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** Fact-level diff between snapshot A (older) and B (newer). */
export function diffFacts(a: StoredFact<any>[], b: StoredFact<any>[]): FactChange[] {
  const key = (f: StoredFact) => `${f.kind}\u0000${f.fkey}`;
  const before = new Map(a.map((f) => [key(f), f]));
  const after = new Map(b.map((f) => [key(f), f]));
  const out: FactChange[] = [];
  for (const [k, fb] of after) {
    const fa = before.get(k);
    if (!fa) out.push({ kind: fb.kind, fkey: fb.fkey, change: 'added', after: fb.attrs });
    else if (fa.vhash !== fb.vhash)
      out.push({
        kind: fb.kind,
        fkey: fb.fkey,
        change: 'changed',
        before: fa.attrs,
        after: fb.attrs,
      });
  }
  for (const [k, fa] of before)
    if (!after.has(k))
      out.push({ kind: fa.kind, fkey: fa.fkey, change: 'removed', before: fa.attrs });
  return out.sort((x, y) =>
    x.kind === y.kind ? x.fkey.localeCompare(y.fkey) : x.kind.localeCompare(y.kind),
  );
}

export interface AccessTuple {
  subject: Subject;
  projectId: string;
  permission: string;
  reasons: string[];
  pathCodes: string[];
}

/** (subject, project, permission) tuples for the given permissions, with reasons. */
export function effectiveTuples(
  state: AccessState,
  permissions: ReadonlySet<string> | null,
): Map<string, AccessTuple> {
  const out = new Map<string, AccessTuple>();
  for (const row of aggregate(resolveAll(state))) {
    for (const [permission, paths] of row.perms) {
      if (permissions && !permissions.has(permission)) continue;
      out.set(`${subjectKey(row.subject)}|${row.projectId}|${permission}`, {
        subject: row.subject,
        projectId: row.projectId,
        permission,
        reasons: paths.map((p) => describePath(state, p)),
        pathCodes: paths.map(pathCode),
      });
    }
  }
  return out;
}

export interface EffectiveDiff {
  granted: AccessTuple[];
  revoked: AccessTuple[];
}

/** Access granted (in B, not in A) and revoked (in A, not in B). */
export function diffEffective(
  a: Map<string, AccessTuple>,
  b: Map<string, AccessTuple>,
): EffectiveDiff {
  const granted = [...b].filter(([k]) => !a.has(k)).map(([, v]) => v);
  const revoked = [...a].filter(([k]) => !b.has(k)).map(([, v]) => v);
  return { granted, revoked };
}
