import { describe, expect, it } from 'vitest';
import {
  buildReviewItems,
  evidenceDocument,
  evidenceHash,
  type EvidenceInput,
} from '../src/engine/review';
import { computeRisks } from '../src/engine/risk';
import { buildState } from '../src/engine/state';
import { DEFAULT_KEY_PERMISSIONS } from '../src/engine/resolve';
import { siteFacts, withChanges } from './fixtures';

const state = buildState(siteFacts());

describe('buildReviewItems', () => {
  it('creates one item per subject and project, riskiest first', () => {
    const items = buildReviewItems(
      state,
      { type: 'projects', ids: ['p1'] },
      DEFAULT_KEY_PERMISSIONS,
    );
    expect(items[0].subjectType).toBe('anonymous');
    expect(items[1].subjectType).toBe('group');
    const bob = items.find((i) => i.subjectId === 'bob')!;
    expect(bob.permissions).toEqual(['BROWSE_PROJECTS', 'EDIT_ISSUES']);
    expect(bob.reasons.length).toBe(2);
    expect(items.find((i) => i.subjectId === 'ivan')!.risk).toBe(70);
    // Only key permissions: CREATE_ISSUES-only lead is included, conditional reporter on DELETE too.
    expect(items.some((i) => i.subjectType === 'conditional')).toBe(true);
  });
  it('marks new and removed items against a comparison snapshot', () => {
    const newer = buildState(
      withChanges(
        siteFacts(),
        [
          {
            kind: 'group_member',
            fkey: 'g-users:zed',
            attrs: { groupId: 'g-users', accountId: 'zed' },
          },
        ],
        ['group_member:g-users:ivan'],
      ),
    );
    const items = buildReviewItems(
      newer,
      { type: 'site', ids: [] },
      DEFAULT_KEY_PERMISSIONS,
      state,
    );
    expect(items.find((i) => i.subjectId === 'zed')?.change).toBe('new');
    expect(items.find((i) => i.subjectId === 'ivan')?.change).toBe('removed');
    expect(items.find((i) => i.subjectId === 'alice' && i.projectId === 'p1')?.change).toBe(
      'unchanged',
    );
  });
  it('reviews group membership for group scope', () => {
    const items = buildReviewItems(
      state,
      { type: 'groups', ids: ['g-admins', 'g-secret'] },
      DEFAULT_KEY_PERMISSIONS,
    );
    expect(items.map((i) => i.itemKey).sort()).toEqual([
      'g|g-admins|user:bob',
      'g|g-secret|group:g-secret',
    ]);
    expect(items.find((i) => i.subjectId === 'bob')?.permissions).toEqual(['GLOBAL_ADMIN']);
  });
});

describe('evidence hash', () => {
  const input: EvidenceInput = {
    reviewId: 'r1',
    name: 'Q4',
    scope: { type: 'projects', ids: ['p2', 'p1'] },
    base: { seq: 3, contentHash: 'a'.repeat(64) },
    compare: null,
    engineVersion: '1.0.0',
    signedBy: 'acc-1',
    signedAt: '2026-10-09T16:00:00.000Z',
    items: [
      {
        itemKey: 'b',
        subjectType: 'user',
        subjectId: 'u2',
        projectId: 'p1',
        groupId: null,
        permissions: ['EDIT_ISSUES'],
        pathCodes: ['x'],
        change: null,
        decision: 'revoke',
        note: 'left',
        decidedBy: 'acc-1',
        decidedAt: '2026-10-09T15:00:00.000Z',
      },
      {
        itemKey: 'a',
        subjectType: 'user',
        subjectId: 'u1',
        projectId: 'p1',
        groupId: null,
        permissions: ['BROWSE_PROJECTS'],
        pathCodes: ['y'],
        change: null,
        decision: 'keep',
        note: null,
        decidedBy: 'acc-1',
        decidedAt: '2026-10-09T15:00:00.000Z',
      },
    ],
  };
  it('is deterministic regardless of item and scope order', () => {
    const shuffled = {
      ...input,
      items: [...input.items].reverse(),
      scope: { type: 'projects' as const, ids: ['p1', 'p2'] },
    };
    expect(evidenceHash(input)).toBe(evidenceHash(shuffled));
    expect(evidenceHash(input)).toMatch(/^[0-9a-f]{64}$/);
    expect(evidenceDocument(input).indexOf('"itemKey":"a"')).toBeLessThan(
      evidenceDocument(input).indexOf('"itemKey":"b"'),
    );
  });
  it('changes when any decision, note or signer changes', () => {
    const h = evidenceHash(input);
    expect(
      evidenceHash({ ...input, items: [{ ...input.items[0], decision: 'keep' }, input.items[1]] }),
    ).not.toBe(h);
    expect(
      evidenceHash({ ...input, items: [{ ...input.items[0], note: 'other' }, input.items[1]] }),
    ).not.toBe(h);
    expect(evidenceHash({ ...input, signedBy: 'acc-2' })).not.toBe(h);
    expect(evidenceHash({ ...input, base: { seq: 3, contentHash: 'b'.repeat(64) } })).not.toBe(h);
  });
});

describe('computeRisks', () => {
  const risks = Object.fromEntries(
    computeRisks(state, {
      largeGroupThreshold: 3,
      wideAdminProjects: 2,
      includeAppAccounts: false,
    }).map((r) => [r.id, r]),
  );
  it('finds anonymous grants, inactive users and admins', () => {
    expect(risks.anonymous.items.map((i) => i.label)).toEqual(['ALPHA: BROWSE_PROJECTS']);
    expect(risks.inactive.items.map((i) => i.label)).toEqual(['Ivan']);
    expect(risks.admins.items.map((i) => i.label)).toEqual(['Bob']);
  });
  it('finds broad application grants, wide admins and large groups', () => {
    expect(risks['broad-app-role'].count).toBe(1);
    expect(risks['wide-admin'].count).toBe(0);
    expect(risks['large-groups'].items.map((i) => i.label)).toEqual(['jira-users']);
  });
});
