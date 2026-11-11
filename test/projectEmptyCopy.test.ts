/**
 * E2E 1.4.5 (phase 1): the project settings page "No assigned review" description comes from the
 * server (`limitation`), which overrides the UI fallback. It must be one sentence without an em
 * or en dash (R-8.5), like every other EmptyState description.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { featureFlags } from '../src/domain/edition';

const m = vi.hoisted(() => ({
  listNotices: vi.fn(),
  findOpenAssignmentForProject: vi.fn(),
}));

vi.mock('@forge/api', () => ({ default: {}, route: () => '', getAppContext: () => ({}) }));
vi.mock('../src/db/sql', () => ({ q: vi.fn(), exec: vi.fn(), limitClause: () => '' }));
vi.mock('../src/db/notices', async (orig) => ({
  ...(await orig<typeof import('../src/db/notices')>()),
  listNotices: m.listNotices,
}));
vi.mock('../src/db/campaigns', async (orig) => ({
  ...(await orig<typeof import('../src/db/campaigns')>()),
  findOpenAssignmentForProject: m.findOpenAssignmentForProject,
}));

import { PROJECT_EMPTY_COPY, projectMyAssignment } from '../src/api/service';

const advanced = {
  edition: 'advanced',
  source: 'license',
  features: featureFlags('advanced'),
  override: null,
  canOverride: false,
} as const;

/** One sentence: a single terminal full stop, no sentence break inside, no dashes. */
function expectOneSentence(text: string) {
  expect(text).not.toMatch(/[–—]/);
  expect(text.trim()).toMatch(/[.!?]$/);
  expect(text.trim().slice(0, -1)).not.toMatch(/[.!?]\s+[A-Z]/);
}

describe('project page empty-state copy', () => {
  beforeEach(() => {
    m.listNotices.mockResolvedValue({ items: [], total: 0 });
    m.findOpenAssignmentForProject.mockReset();
  });

  it.each(Object.entries(PROJECT_EMPTY_COPY))('%s is one sentence without dashes', (_k, text) =>
    expectOneSentence(text),
  );

  it('keeps the meaning: campaigns assign the space admin, reminders in app, no email', () => {
    expect(PROJECT_EMPTY_COPY.noAssignment).toMatch(/Jira admin runs a campaign/);
    expect(PROJECT_EMPTY_COPY.noAssignment).toMatch(/assigned space admin reviews access here/);
    expect(PROJECT_EMPTY_COPY.noAssignment).toMatch(/reminders in the app only/);
    expect(PROJECT_EMPTY_COPY.noAssignment).toMatch(/sends no email/);
  });

  it('No assigned review (no open assignment) returns the one-sentence description', async () => {
    m.findOpenAssignmentForProject.mockResolvedValue(null);
    const r = await projectMyAssignment('10001', 'acc', 'site-admin', advanced);
    expect(r.limitation).toBe(PROJECT_EMPTY_COPY.noAssignment);
    expectOneSentence(r.limitation!);
  });

  it('a project admin without an assignment gets the one-sentence description', async () => {
    const r = await projectMyAssignment('10001', 'acc', 'not-assigned', advanced);
    expect(r.limitation).toBe(PROJECT_EMPTY_COPY.notAssigned);
    expect(m.findOpenAssignmentForProject).not.toHaveBeenCalled();
  });
});
