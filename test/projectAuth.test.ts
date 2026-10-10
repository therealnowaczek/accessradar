import { describe, expect, it } from 'vitest';
import { assignmentAccess, hasProjectAdminister } from '../src/lib/projectAuth';

describe('hasProjectAdminister', () => {
  it('accepts ADMINISTER_PROJECTS on the target project id', () => {
    const body = {
      projectPermissions: [{ permission: 'ADMINISTER_PROJECTS', projects: [10001, 10002] }],
    };
    expect(hasProjectAdminister(body, '10001')).toBe(true);
    expect(hasProjectAdminister(body, '10003')).toBe(false);
  });

  it('rejects empty or unrelated responses (user without project admin)', () => {
    expect(hasProjectAdminister({}, '10001')).toBe(false);
    expect(
      hasProjectAdminister(
        { projectPermissions: [{ permission: 'BROWSE_PROJECTS', projects: [10001] }] },
        '10001',
      ),
    ).toBe(false);
  });
});

describe('assignmentAccess', () => {
  it('lets the assigned project admin act', () => {
    expect(
      assignmentAccess({ accountId: 'acc-owner', assignee: 'acc-owner', isSiteAdmin: false }),
    ).toBe('assignee');
  });

  it('marks a project admin who is not the assignee as not-assigned', () => {
    // Non-admin project lead without ADMINISTER_PROJECTS never reaches this helper
    // (assertProjectAdminister throws first). A project admin who is not the assignee
    // gets the empty "not assigned" state.
    expect(
      assignmentAccess({ accountId: 'acc-other', assignee: 'acc-owner', isSiteAdmin: false }),
    ).toBe('not-assigned');
  });

  it('lets a site admin support the assignment', () => {
    expect(
      assignmentAccess({ accountId: 'acc-admin', assignee: 'acc-owner', isSiteAdmin: true }),
    ).toBe('site-admin');
  });
});
