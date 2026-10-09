import { describe, expect, it } from 'vitest';
import { contentHash, factVersionHash, canonicalJson, sha256 } from '../src/engine/facts';
import { diffEffective, diffFacts, effectiveTuples } from '../src/engine/diff';
import { buildState } from '../src/engine/state';
import { siteFacts, withChanges } from './fixtures';

const a = siteFacts();
const b = withChanges(
  a,
  [
    {
      kind: 'group_member',
      fkey: 'g-admins:carol',
      attrs: { groupId: 'g-admins', accountId: 'carol' },
    },
    {
      kind: 'person',
      fkey: 'carol',
      attrs: { displayName: 'Carol', accountType: 'atlassian', active: false },
    },
  ],
  ['group_member:g-users:ivan', 'grant:s1:5', 'person:carol'],
);

describe('diffFacts', () => {
  it('lists added, removed and changed facts', () => {
    const d = diffFacts(a, b);
    expect(d.filter((c) => c.change === 'added').map((c) => `${c.kind}:${c.fkey}`)).toEqual([
      'group_member:g-admins:carol',
    ]);
    expect(
      d
        .filter((c) => c.change === 'removed')
        .map((c) => `${c.kind}:${c.fkey}`)
        .sort(),
    ).toEqual(['grant:s1:5', 'group_member:g-users:ivan']);
    const changed = d.find((c) => c.change === 'changed');
    expect(changed?.kind).toBe('person');
    expect(changed?.before?.active).toBe(true);
    expect(changed?.after?.active).toBe(false);
  });
  it('is empty for identical snapshots', () => {
    expect(diffFacts(a, siteFacts())).toEqual([]);
  });
});

describe('diffEffective', () => {
  it('reports granted and revoked access with reasons', () => {
    const keys = new Set(['BROWSE_PROJECTS', 'EDIT_ISSUES']);
    const d = diffEffective(
      effectiveTuples(buildState(a), keys),
      effectiveTuples(buildState(b), keys),
    );
    const granted = d.granted.map((t) => `${(t.subject as any).accountId}:${t.permission}`);
    expect(granted).toEqual(['carol:EDIT_ISSUES']);
    expect(d.granted[0].reasons[0]).toContain('group “jira-admins”');
    const revoked = d.revoked
      .map((t) =>
        t.subject.type === 'user' ? `${t.subject.accountId}:${t.permission}` : t.subject.type,
      )
      .sort();
    expect(revoked).toEqual(['anonymous', 'ivan:BROWSE_PROJECTS']);
  });
});

describe('hashing', () => {
  it('canonical JSON sorts keys and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: undefined, c: 'x' }] })).toBe(
      '{"a":[2,{"c":"x"}],"b":1}',
    );
  });
  it('sha256 matches the known vector', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('version hash ignores display names (privacy) but not status', () => {
    const base = { displayName: 'Ann', accountType: 'atlassian', active: true };
    expect(factVersionHash('person', base)).toBe(
      factVersionHash('person', { ...base, displayName: 'Closed account 1' }),
    );
    expect(factVersionHash('person', base)).not.toBe(
      factVersionHash('person', { ...base, active: false }),
    );
  });
  it('content hash is order independent and change sensitive', () => {
    expect(contentHash(a)).toBe(contentHash([...a].reverse()));
    expect(contentHash(a)).not.toBe(contentHash(b));
    expect(contentHash(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
