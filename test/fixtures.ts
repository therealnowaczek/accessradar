import { stored, type Fact, type StoredFact } from '../src/engine/facts';

/** Small synthetic site covering every holder type. No real data. */
export function siteFacts(): StoredFact<any>[] {
  const f: Fact<any>[] = [
    {
      kind: 'project',
      fkey: 'p1',
      attrs: {
        key: 'ALPHA',
        name: 'Alpha',
        style: 'company',
        typeKey: 'software',
        schemeId: 's1',
        leadAccountId: 'lead',
      },
    },
    {
      kind: 'project',
      fkey: 'p2',
      attrs: { key: 'KAN', name: 'Kanban', style: 'team', typeKey: 'software', schemeId: 's2' },
    },
    { kind: 'scheme', fkey: 's1', attrs: { name: 'Default scheme', teamManaged: false } },
    { kind: 'scheme', fkey: 's2', attrs: { name: 'KAN: Simplified', teamManaged: true } },
    {
      kind: 'grant',
      fkey: 's1:1',
      attrs: {
        schemeId: 's1',
        grantId: '1',
        permission: 'BROWSE_PROJECTS',
        holderType: 'applicationRole',
      },
    },
    {
      kind: 'grant',
      fkey: 's1:2',
      attrs: {
        schemeId: 's1',
        grantId: '2',
        permission: 'EDIT_ISSUES',
        holderType: 'projectRole',
        holderParam: '10002',
      },
    },
    {
      kind: 'grant',
      fkey: 's1:3',
      attrs: {
        schemeId: 's1',
        grantId: '3',
        permission: 'ADMINISTER_PROJECTS',
        holderType: 'group',
        holderParam: 'g-secret',
      },
    },
    {
      kind: 'grant',
      fkey: 's1:4',
      attrs: { schemeId: 's1', grantId: '4', permission: 'DELETE_ISSUES', holderType: 'reporter' },
    },
    {
      kind: 'grant',
      fkey: 's1:5',
      attrs: { schemeId: 's1', grantId: '5', permission: 'BROWSE_PROJECTS', holderType: 'anyone' },
    },
    {
      kind: 'grant',
      fkey: 's1:6',
      attrs: {
        schemeId: 's1',
        grantId: '6',
        permission: 'ADMINISTER_PROJECTS',
        holderType: 'user',
        holderParam: 'dave',
      },
    },
    {
      kind: 'grant',
      fkey: 's1:7',
      attrs: {
        schemeId: 's1',
        grantId: '7',
        permission: 'CREATE_ISSUES',
        holderType: 'projectLead',
      },
    },
    {
      kind: 'grant',
      fkey: 's1:8',
      attrs: {
        schemeId: 's1',
        grantId: '8',
        permission: 'CREATE_ISSUES',
        holderType: 'group',
        holderName: 'devs',
      },
    },
    {
      kind: 'grant',
      fkey: 's2:1',
      attrs: {
        schemeId: 's2',
        grantId: '1',
        permission: 'ADMINISTER_PROJECTS',
        holderType: 'projectRole',
        holderParam: '10007',
      },
    },
    { kind: 'role', fkey: '10002', attrs: { name: 'Developers' } },
    { kind: 'role', fkey: '10007', attrs: { name: 'Administrator', projectId: 'p2' } },
    {
      kind: 'role_actor',
      fkey: 'p1:10002:user:alice',
      attrs: { projectId: 'p1', roleId: '10002', actorType: 'user', actorId: 'alice' },
    },
    {
      kind: 'role_actor',
      fkey: 'p1:10002:group:g-admins',
      attrs: { projectId: 'p1', roleId: '10002', actorType: 'group', actorId: 'g-admins' },
    },
    {
      kind: 'role_actor',
      fkey: 'p2:10007:user:bob',
      attrs: { projectId: 'p2', roleId: '10007', actorType: 'user', actorId: 'bob' },
    },
    { kind: 'group', fkey: 'g-admins', attrs: { name: 'jira-admins', members: 'collected' } },
    { kind: 'group', fkey: 'g-users', attrs: { name: 'jira-users', members: 'collected' } },
    { kind: 'group', fkey: 'g-secret', attrs: { name: 'secret', members: 'unreadable' } },
    { kind: 'group', fkey: 'g-devs', attrs: { name: 'devs', members: 'collected' } },
    { kind: 'group', fkey: 'g-empty', attrs: { name: 'empty', members: 'collected' } },
    {
      kind: 'group_access',
      fkey: 'admin::g-admins',
      attrs: { groupId: 'g-admins', accessType: 'admin' },
    },
    {
      kind: 'group_member',
      fkey: 'g-admins:bob',
      attrs: { groupId: 'g-admins', accountId: 'bob' },
    },
    { kind: 'group_member', fkey: 'g-users:bob', attrs: { groupId: 'g-users', accountId: 'bob' } },
    {
      kind: 'group_member',
      fkey: 'g-users:carol',
      attrs: { groupId: 'g-users', accountId: 'carol' },
    },
    {
      kind: 'group_member',
      fkey: 'g-users:ivan',
      attrs: { groupId: 'g-users', accountId: 'ivan' },
    },
    {
      kind: 'group_member',
      fkey: 'g-devs:alice',
      attrs: { groupId: 'g-devs', accountId: 'alice' },
    },
    { kind: 'app_role', fkey: 'jira-software', attrs: { name: 'Jira Software' } },
    {
      kind: 'app_role_group',
      fkey: 'jira-software:g-users',
      attrs: { appKey: 'jira-software', groupId: 'g-users' },
    },
    {
      kind: 'person',
      fkey: 'alice',
      attrs: { displayName: 'Alice', accountType: 'atlassian', active: true },
    },
    {
      kind: 'person',
      fkey: 'bob',
      attrs: { displayName: 'Bob', accountType: 'atlassian', active: true },
    },
    {
      kind: 'person',
      fkey: 'carol',
      attrs: { displayName: 'Carol', accountType: 'atlassian', active: true },
    },
    {
      kind: 'person',
      fkey: 'dave',
      attrs: { displayName: 'Dave', accountType: 'atlassian', active: true },
    },
    {
      kind: 'person',
      fkey: 'ivan',
      attrs: { displayName: 'Ivan', accountType: 'atlassian', active: false },
    },
    {
      kind: 'person',
      fkey: 'lead',
      attrs: { displayName: 'Lea', accountType: 'atlassian', active: true },
    },
  ];
  return f.map(stored);
}

export function withChanges(
  base: StoredFact<any>[],
  add: Fact<any>[],
  removeKeys: string[],
): StoredFact<any>[] {
  return [...base.filter((f) => !removeKeys.includes(`${f.kind}:${f.fkey}`)), ...add.map(stored)];
}
