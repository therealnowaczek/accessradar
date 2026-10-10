import { describe, expect, it } from 'vitest';
import { itemPresent } from '../src/engine/remediation';
import { buildState } from '../src/engine/state';
import { DEFAULT_KEY_PERMISSIONS } from '../src/engine/resolve';
import { siteFacts } from './fixtures';

const state = buildState(siteFacts());
const scope = { type: 'projects' as const, ids: ['p1'] };

describe('itemPresent', () => {
  it('finds a project item that still exists', () => {
    expect(itemPresent(state, 'p|p1|user:alice', DEFAULT_KEY_PERMISSIONS, scope)).toBe('present');
  });

  it('reports absent for a synthetic item key that never existed', () => {
    expect(itemPresent(state, 'p|p1|user:does-not-exist', DEFAULT_KEY_PERMISSIONS, scope)).toBe(
      'absent',
    );
  });

  it('checks group membership for group-scoped items', () => {
    const gScope = { type: 'groups' as const, ids: ['g-admins'] };
    expect(itemPresent(state, 'g|g-admins|user:bob', [], gScope)).toBe('present');
    expect(itemPresent(state, 'g|g-admins|user:nobody', [], gScope)).toBe('absent');
  });

  it('is inconclusive when group members were not collected', () => {
    const facts = siteFacts().map((f) =>
      f.kind === 'group' && f.fkey === 'g-secret'
        ? { ...f, attrs: { ...f.attrs, members: 'unreadable' as const } }
        : f,
    );
    // Ensure group_member facts for g-secret are removed so members map is empty
    const filtered = facts.filter(
      (f) => !(f.kind === 'group_member' && f.fkey.startsWith('g-secret:')),
    );
    const s = buildState(filtered);
    // Force members status
    const g = s.groups.get('g-secret');
    if (g) g.members = 'unreadable';
    expect(itemPresent(s, 'g|g-secret|user:x', [], { type: 'groups', ids: ['g-secret'] })).toBe(
      'inconclusive',
    );
  });

  it('is inconclusive for unknown project', () => {
    expect(itemPresent(state, 'p|missing|user:alice', DEFAULT_KEY_PERMISSIONS, scope)).toBe(
      'inconclusive',
    );
  });
});
