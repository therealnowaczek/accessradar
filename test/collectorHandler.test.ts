import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  runCollectStep: vi.fn(),
  runAlertsCheck: vi.fn(),
  ensureMigrated: vi.fn(),
}));

vi.mock('@forge/api', () => ({
  default: { asApp: () => ({}), asUser: () => ({}) },
  route: () => '',
  getAppContext: () => ({}),
  __getRuntime: () => ({ appContext: {} }),
}));
vi.mock('@forge/resolver', () => ({
  default: class {
    define() {}
    getDefinitions() {
      return {};
    }
  },
}));
vi.mock('@forge/events', () => ({
  InvocationError: class InvocationError {
    constructor(readonly opts: unknown) {}
  },
  InvocationErrorCode: { FUNCTION_RETRY_REQUEST: 'FUNCTION_RETRY_REQUEST' },
  Queue: class {},
}));
vi.mock('../src/db/migrations', () => ({
  ensureMigrated: m.ensureMigrated,
  runMigrations: vi.fn(),
}));
vi.mock('../src/collector/run', () => ({
  runCollectStep: m.runCollectStep,
  scheduledTick: vi.fn(),
}));
vi.mock('../src/api/service', () => ({
  runAlertsCheck: m.runAlertsCheck,
  BadRequest: class BadRequest extends Error {},
}));
vi.mock('../src/spike', () => ({
  runSpikeResolver: vi.fn(),
  spikeAllowed: () => false,
  spikeEnabled: () => false,
  spikeOnInstall: vi.fn(),
  spikeOnTick: vi.fn(),
  spikeProbe: vi.fn(),
  spikeSelfTest: vi.fn(),
}));
vi.mock('../src/lib/queue', () => ({ push: vi.fn() }));

import { InvocationError } from '@forge/events';
import { collectorHandler } from '../src/handlers';

const event = (body: Record<string, unknown>, retryCount = 0) =>
  ({ body, retryContext: { retryCount } }) as any;

describe('collectorHandler error handling', () => {
  beforeEach(() => {
    m.runCollectStep.mockReset();
    m.runAlertsCheck.mockReset();
    m.ensureMigrated.mockReset().mockResolvedValue(undefined);
  });

  it('logs a failing step with its context instead of throwing', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.runAlertsCheck.mockRejectedValue(new Error("Duplicate entry 'acc-1'"));
    await expect(collectorHandler(event({ step: 'ALERTS', seq: 12 }))).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith(
      '[collector] step failed',
      expect.objectContaining({
        step: 'ALERTS',
        seq: 12,
        attempt: 0,
        message: "Duplicate entry '?'",
      }),
    );
    err.mockRestore();
  });

  it('retries a snapshot step that failed before its own handling, at most twice', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    m.runCollectStep.mockRejectedValue(new Error('SQL timeout'));
    const first = await collectorHandler(event({ step: 'FINALIZE', snapshotSeq: 7 }, 0));
    expect(first).toBeInstanceOf(InvocationError);
    const last = await collectorHandler(event({ step: 'FINALIZE', snapshotSeq: 7 }, 2));
    expect(last).toBeUndefined();
    expect(err).toHaveBeenCalledWith(
      '[collector] step failed',
      expect.objectContaining({ step: 'FINALIZE', snapshotSeq: 7, attempt: 2 }),
    );
    err.mockRestore();
  });

  it('passes through results of steps that succeed', async () => {
    m.runCollectStep.mockResolvedValue(undefined);
    await expect(
      collectorHandler(event({ step: 'PROJECTS', snapshotSeq: 3, batch: 1 })),
    ).resolves.toBeUndefined();
    expect(m.runCollectStep).toHaveBeenCalledTimes(1);
  });
});
