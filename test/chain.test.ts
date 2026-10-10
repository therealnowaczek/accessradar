import { describe, expect, it } from 'vitest';
import { isDuplicateKey, walkChain, type ChainLink } from '../src/engine/chain';
import { evidenceHash } from '../src/engine/review';

const link = (
  seq: number,
  hash: string,
  prev: string | null,
  id = `r${seq}`,
): ChainLink => ({
  id,
  chainSeq: seq,
  evidenceHash: hash,
  prevReviewHash: prev,
});

describe('walkChain', () => {
  it('accepts an empty chain', () => {
    expect(walkChain([])).toEqual({ ok: true, length: 0, links: [] });
  });

  it('accepts a contiguous hash-linked sequence', () => {
    const h1 = 'a'.repeat(64);
    const h2 = 'b'.repeat(64);
    const h3 = 'c'.repeat(64);
    const r = walkChain([
      link(1, h1, null),
      link(2, h2, h1),
      link(3, h3, h2),
    ]);
    expect(r.ok).toBe(true);
    expect(r.length).toBe(3);
    expect(r.links.every((l) => l.ok)).toBe(true);
  });

  it('allows the first link to reference a pre-chain hash', () => {
    const pre = 'p'.repeat(64);
    const h1 = 'a'.repeat(64);
    const r = walkChain([link(1, h1, pre)]);
    expect(r.ok).toBe(true);
  });

  it('reports a sequence gap', () => {
    const h1 = 'a'.repeat(64);
    const h3 = 'c'.repeat(64);
    const r = walkChain([link(1, h1, null), link(3, h3, h1)]);
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(3);
    expect(r.reason).toMatch(/sequence gap/i);
  });

  it('reports a previous-hash break', () => {
    const h1 = 'a'.repeat(64);
    const h2 = 'b'.repeat(64);
    const r = walkChain([link(1, h1, null), link(2, h2, 'x'.repeat(64))]);
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(2);
    expect(r.reason).toMatch(/previous hash/i);
  });

  it('rejects a chain that does not start at 1', () => {
    const r = walkChain([link(2, 'a'.repeat(64), null)]);
    expect(r.ok).toBe(false);
    expect(r.brokenAt).toBe(2);
  });
});

describe('isDuplicateKey', () => {
  it('detects MySQL duplicate-entry errors for retry', () => {
    expect(isDuplicateKey(new Error("Duplicate entry '2' for key 'uq_review_chain'"))).toBe(true);
    expect(isDuplicateKey({ code: 'ER_DUP_ENTRY', message: 'dup' })).toBe(true);
    expect(isDuplicateKey(new Error('connection reset'))).toBe(false);
  });
});

describe('evidenceHash chain linkage', () => {
  const base = {
    reviewId: 'rev-1',
    name: 'Q1',
    scope: { type: 'site' as const, ids: [] as string[] },
    base: { seq: 1, contentHash: 'b'.repeat(64) },
    compare: null,
    engineVersion: '1.0.0',
    signedBy: 'acc-1',
    signedAt: '2026-10-09T15:00:00.000Z',
    signatureVersion: 2 as const,
    coverageHash: 'c'.repeat(64),
    limitationsVersion: 1,
    signerTz: 'UTC',
    items: [
      {
        itemKey: 'a',
        subjectType: 'user' as const,
        subjectId: 'u1',
        projectId: 'p1',
        groupId: null,
        permissions: ['ADMINISTER_PROJECTS'],
        pathCodes: ['x'],
        change: null,
        decision: 'keep' as const,
        note: null,
        decidedBy: 'acc-1',
        decidedAt: '2026-10-09T15:00:00.000Z',
        expiresAt: null,
      },
    ],
  };

  it('changes when prevReviewHash changes (concurrency retry recomputes)', () => {
    const a = evidenceHash({ ...base, prevReviewHash: null });
    const b = evidenceHash({ ...base, prevReviewHash: 'd'.repeat(64) });
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
