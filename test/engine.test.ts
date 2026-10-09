import { describe, expect, it } from 'vitest';
import { resolveProject, type Grant, type ProjectFacts, type DirectoryFacts } from '../src/engine/resolve';

const grants: Grant[] = [
  { schemeId: 's1', grantId: '1', permission: 'BROWSE_PROJECTS', holder: { type: 'projectRole', parameter: '10002' } },
  { schemeId: 's1', grantId: '2', permission: 'BROWSE_PROJECTS', holder: { type: 'applicationRole' } },
  { schemeId: 's1', grantId: '3', permission: 'EDIT_ISSUES', holder: { type: 'reporter' } },
  { schemeId: 's1', grantId: '4', permission: 'BROWSE_PROJECTS', holder: { type: 'anyone' } },
  { schemeId: 's1', grantId: '5', permission: 'ADMINISTER_PROJECTS', holder: { type: 'group', parameter: 'g-secret' } },
  { schemeId: 's2', grantId: '9', permission: 'BROWSE_PROJECTS', holder: { type: 'user', parameter: 'other' } },
];
const project: ProjectFacts = {
  projectId: 'p1',
  schemeId: 's1',
  roleActors: { '10002': { users: ['alice'], groups: ['g-admins'] } },
};
const dir: DirectoryFacts = {
  groupMembers: { 'g-admins': ['bob'], 'g-users': ['carol', 'bob'], 'g-secret': undefined },
  appRoleGroups: { 'jira-software': ['g-users'] },
};

describe('resolveProject', () => {
  const res = resolveProject(grants, project, dir);
  it('expands role actors (users and groups) with a path', () => {
    const bob = res.find((r) => r.subject.type === 'user' && r.subject.accountId === 'bob' && r.path.some((p) => p.kind === 'role'));
    expect(bob?.path.map((p) => p.kind)).toEqual(['scheme', 'role', 'group']);
    expect(res.some((r) => r.subject.type === 'user' && r.subject.accountId === 'alice')).toBe(true);
  });
  it('expands parameterless applicationRole to all app-role groups', () => {
    const viaApp = res.filter((r) => r.path.some((p) => p.kind === 'appRole'));
    expect(viaApp.map((r) => (r.subject as { accountId: string }).accountId).sort()).toEqual(['bob', 'carol']);
  });
  it('marks reporter as conditional and anyone as anonymous', () => {
    expect(res.some((r) => r.subject.type === 'conditional' && r.subject.holderType === 'reporter' && !r.partial)).toBe(true);
    expect(res.some((r) => r.subject.type === 'anonymous')).toBe(true);
  });
  it('flags unreadable groups as partial', () => {
    expect(res.some((r) => r.partial && r.permission === 'ADMINISTER_PROJECTS')).toBe(true);
  });
  it('ignores grants from other schemes', () => {
    expect(res.some((r) => r.subject.type === 'user' && r.subject.accountId === 'other')).toBe(false);
  });
});
