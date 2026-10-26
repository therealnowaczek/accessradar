import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  getReview: vi.fn(),
  getItems: vi.fn(),
  markSigned: vi.fn(),
  nextChainTip: vi.fn(),
  listChainLinks: vi.fn(),
  getVerifyJob: vi.fn(),
  insertVerifyJob: vi.fn(),
  patchVerifyJob: vi.fn(),
  push: vi.fn(),
  audit: vi.fn(),
  background: vi.fn(),
}));

vi.mock('@forge/api', () => ({ default: {}, route: () => '', getAppContext: () => ({}) }));
vi.mock('../src/db/sql', () => ({ q: vi.fn(), exec: vi.fn(), limitClause: () => '' }));
vi.mock('../src/db/reviews', async (orig) => ({
  ...(await orig<typeof import('../src/db/reviews')>()),
  getReview: m.getReview,
  getItems: m.getItems,
  markSigned: m.markSigned,
  nextChainTip: m.nextChainTip,
  listChainLinks: m.listChainLinks,
}));
vi.mock('../src/db/verify', () => ({
  getVerifyJob: m.getVerifyJob,
  insertVerifyJob: m.insertVerifyJob,
  patchVerifyJob: m.patchVerifyJob,
  streamContentHashPage: vi.fn(),
}));
vi.mock('../src/lib/queue', () => ({ push: m.push }));
vi.mock('../src/db/audit', () => ({ audit: m.audit, listAudit: vi.fn() }));
vi.mock('../src/api/edition', () => ({ backgroundEdition: m.background }));

import { featureFlags, REQUIRES_ADVANCED } from '../src/domain/edition';
import {
  assertSignatureChain,
  runVerifySnapshotJob,
  signReview,
  startSnapshotVerify,
  verifyChain,
  verifyJobStatus,
  verifyReview,
} from '../src/api/service';

const decision = (edition: 'standard' | 'advanced') =>
  ({
    edition,
    source: 'license',
    features: featureFlags(edition),
    override: null,
    canOverride: false,
  }) as const;
const standard = decision('standard');
const id = '00000000-0000-4000-8000-000000000001';

describe('signature chain edition flag', () => {
  it('is Advanced only', () => {
    expect(featureFlags('advanced').signatureChain).toBe(true);
    expect(featureFlags('standard').signatureChain).toBe(false);
  });

  it('assertSignatureChain refuses Standard with the Advanced message', () => {
    expect(() => assertSignatureChain(standard)).toThrow(REQUIRES_ADVANCED);
    expect(() => assertSignatureChain(decision('advanced'))).not.toThrow();
  });
});

describe('signing, hash chain and Verify resolvers on Standard', () => {
  beforeEach(() => {
    for (const fn of Object.values(m)) fn.mockReset();
  });

  const noDataTouched = () => {
    expect(m.getReview).not.toHaveBeenCalled();
    expect(m.markSigned).not.toHaveBeenCalled();
    expect(m.nextChainTip).not.toHaveBeenCalled();
    expect(m.listChainLinks).not.toHaveBeenCalled();
    expect(m.insertVerifyJob).not.toHaveBeenCalled();
    expect(m.getVerifyJob).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  };

  it('signReview refuses before reading the review or adding a chain link', async () => {
    await expect(signReview({ id, attest: true }, 'acc', standard)).rejects.toThrow(
      REQUIRES_ADVANCED,
    );
    noDataTouched();
  });

  it('verifyReview (quick verify) refuses', async () => {
    await expect(verifyReview({ id }, 'acc', standard)).rejects.toThrow(REQUIRES_ADVANCED);
    noDataTouched();
  });

  it('verifyChain refuses', async () => {
    await expect(verifyChain('acc', standard)).rejects.toThrow(REQUIRES_ADVANCED);
    noDataTouched();
  });

  it('startSnapshotVerify (deep verify) refuses and queues nothing', async () => {
    await expect(startSnapshotVerify({ reviewId: id }, 'acc', standard)).rejects.toThrow(
      REQUIRES_ADVANCED,
    );
    noDataTouched();
  });

  it('getVerifyJob refuses', async () => {
    await expect(verifyJobStatus({ jobId: id }, standard)).rejects.toThrow(REQUIRES_ADVANCED);
    noDataTouched();
  });

  it('Advanced passes the gate and reaches the review lookup', async () => {
    m.getReview.mockResolvedValue(null);
    await expect(verifyReview({ id }, 'acc', decision('advanced'))).rejects.toThrow(
      'Review not found',
    );
    expect(m.getReview).toHaveBeenCalledWith(id);
  });
});

describe('deep verify consumer after a downgrade', () => {
  beforeEach(() => {
    for (const fn of Object.values(m)) fn.mockReset();
  });

  it('closes a queued job on Standard without hashing', async () => {
    m.getVerifyJob.mockResolvedValue({ id, reviewId: id, seq: 3, status: 'pending' });
    m.background.mockResolvedValue(standard);
    await runVerifySnapshotJob(id);
    expect(m.patchVerifyJob).toHaveBeenCalledTimes(1);
    expect(m.patchVerifyJob).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ status: 'error', error: REQUIRES_ADVANCED }),
    );
    expect(m.push).not.toHaveBeenCalled();
  });
});
