import { describe, expect, it } from 'vitest';
import { projectsList } from '../src/api/views';
import { stored, type Fact } from '../src/engine/facts';
import { buildState } from '../src/engine/state';

const grant = (id: string, permission: string, accountId: string): Fact<any> => ({
  kind: 'grant' as const,
  fkey: `s1:${id}`,
  attrs: { schemeId: 's1', grantId: id, permission, holderType: 'user', holderParam: accountId },
});
const person = (id: string, accountType: string): Fact<any> => ({
  kind: 'person' as const,
  fkey: id,
  attrs: { displayName: id, accountType, active: true },
});

describe('spaces list counts', () => {
  it('counts space admins as people and app-account admins separately', () => {
    const facts: Fact<any>[] = [
      {
        kind: 'project' as const,
        fkey: 'p',
        attrs: { key: 'P', name: 'P', style: 'company', typeKey: 'software', schemeId: 's1' },
      },
      { kind: 'scheme' as const, fkey: 's1', attrs: { name: 'S', teamManaged: false } },
      person('ann', 'atlassian'),
      person('bob', 'atlassian'),
      person('bot1', 'app'),
      person('bot2', 'app'),
      grant('1', 'BROWSE_PROJECTS', 'ann'),
      grant('2', 'BROWSE_PROJECTS', 'bob'),
      grant('3', 'ADMINISTER_PROJECTS', 'ann'),
      grant('4', 'ADMINISTER_PROJECTS', 'bot1'),
      grant('5', 'ADMINISTER_PROJECTS', 'bot2'),
    ];
    const [row] = projectsList(buildState(facts.map(stored)));
    expect(row.people).toBe(2);
    expect(row.appAccounts).toBe(2);
    expect(row.admins).toBe(1);
    expect(row.appAdmins).toBe(2);
  });
});
