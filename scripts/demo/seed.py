"""Idempotent AccessRadar demo seed for marginradar.atlassian.net (modelled on /workspace/mr-assets/seed.py).

DEFAULT IS A DRY RUN: prints the plan and makes no network calls.
  python3 scripts/demo/seed.py                 # plan for phase 1 (no network)
  python3 scripts/demo/seed.py --phase 2       # plan for phase 2 (no network)
  JIRA_API_TOKEN=... python3 scripts/demo/seed.py --apply [--phase 1|2]

Needs a token of an account that is BOTH site admin (invite users, create groups, group membership)
and Jira admin (roles, permission schemes, projects). Users are invited with plus-addressed emails
(DEMO_EMAIL, default marcin+ar-{slug}@radrly.com) and count towards the site's user limit (Free plan: 10).
Existing objects are reused (matched by name/key/email); nothing is ever deleted except the phase-2 role
actor removal listed in data.PHASE_2."""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data import USERS, GROUPS, ROLES, SCHEMES, PROJECTS, ACTORS_1, PHASE_2, MANUAL

EMAIL_PATTERN = os.environ.get('DEMO_EMAIL', 'marcin+ar-{slug}@radrly.com')


def plan(phase):
    steps = []
    if phase == 1:
        for g in GROUPS: steps.append(('create group (if missing)', g))
        for slug, (name, groups) in USERS.items():
            steps.append(('invite user (if missing) with Jira access', f'{EMAIL_PATTERN.format(slug=slug)}  -> rename to "{name}"'))
            for g in groups:
                steps.append(('add to group', f'{name} -> {"<site Jira admin group>" if g == "@admins" else g}'))
        for r in ROLES: steps.append(('create project role (if missing)', r))
        for s, grants in SCHEMES.items(): steps.append(('create permission scheme (if missing)', f'{s}: {len(grants)} grants'))
        for k, (n, s) in PROJECTS.items(): steps.append(('create company-managed project (if missing)', f'{k} "{n}" with scheme "{s}"'))
        for k, roles in ACTORS_1.items():
            for r, actors in roles.items():
                for kind, v in actors:
                    steps.append(('add role actor', f'{k} / {r} <- {kind} {USERS[v][0] if kind == "user" else v}'))
    else:
        for op, *args in PHASE_2:
            steps.append((op.replace('_', ' '), ' / '.join(str(a if not isinstance(a, tuple) else (a[0] + ' ' + (USERS[a[1]][0] if a[0] == 'user' else a[1]))) for a in args)))
    return steps


def apply(phase):
    from jira import j, req, connect
    connect()
    me = j('GET', '/rest/api/3/myself')['accountId']
    groups = {}
    start = 0
    while True:
        r = j('GET', f'/rest/api/3/group/bulk?startAt={start}&maxResults=50')
        for g in r['values']: groups[g['name']] = g['groupId']
        if r.get('isLast', True): break
        start += 50
    admins = j('GET', '/rest/api/3/group/bulk?accessType=admin&maxResults=50')['values']
    admin_group = next((g for g in admins if g['name'].startswith('jira-admins')), admins[0])
    groups['@admins'] = admin_group['groupId']
    users = {}
    for slug in USERS:
        email = EMAIL_PATTERN.format(slug=slug)
        found = j('GET', '/rest/api/3/user/search', params={'query': email})
        users[slug] = found[0]['accountId'] if found else None
    roles = {r['name']: r['id'] for r in j('GET', '/rest/api/3/role')}

    def holder(h):
        if h[0] == 'role': return {'type': 'projectRole', 'value': str(roles[h[1]])}
        if h[0] == 'group': return {'type': 'group', 'value': groups[h[1]]}
        return {'type': 'anyone'}

    def actor_body(kind, v):
        return {'user': [users[v]]} if kind == 'user' else {'groupId': [groups[v]]}

    if phase == 1:
        for g in GROUPS:
            if g not in groups: groups[g] = j('POST', '/rest/api/3/group', json={'name': g})['groupId']; print('group', g)
        for slug, (name, gs) in USERS.items():
            if not users[slug]:
                users[slug] = j('POST', '/rest/api/3/user', json={'emailAddress': EMAIL_PATTERN.format(slug=slug), 'products': ['jira-software']})['accountId']
                print('invited', slug)
            for g in gs:
                r = req('POST', f'/rest/api/3/group/user?groupId={groups[g]}', json={'accountId': users[slug]})
                if r.status_code not in (200, 201, 400): raise Exception(r.text[:300])   # 400 = already a member
        for r in ROLES:
            if r not in roles: roles[r] = j('POST', '/rest/api/3/role', json={'name': r, 'description': 'AccessRadar demo'})['id']; print('role', r)
        existing = {s['name']: s['id'] for s in j('GET', '/rest/api/3/permissionscheme')['permissionSchemes']}
        for s, grants in SCHEMES.items():
            if s not in existing:
                existing[s] = j('POST', '/rest/api/3/permissionscheme', json={'name': s, 'description': 'AccessRadar demo', 'permissions': [{'permission': p, 'holder': holder(h)} for p, h in grants]})['id']
                print('scheme', s)
        for k, (n, s) in PROJECTS.items():
            if req('GET', f'/rest/api/3/project/{k}').status_code == 404:
                j('POST', '/rest/api/3/project', json={'key': k, 'name': n, 'projectTypeKey': 'software',
                  'projectTemplateKey': 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic', 'leadAccountId': me,
                  'assigneeType': 'UNASSIGNED', 'permissionScheme': existing[s]})
                print('project', k)
            else:
                j('PUT', f'/rest/api/3/project/{k}/permissionscheme', json={'id': existing[s]})
        for k, rs in ACTORS_1.items():
            for r, actors in rs.items():
                for kind, v in actors:
                    req('POST', f'/rest/api/3/project/{k}/role/{roles[r]}', json=actor_body(kind, v))
    else:
        for op, *a in PHASE_2:
            if op == 'add_actor': req('POST', f'/rest/api/3/project/{a[0]}/role/{roles[a[1]]}', json=actor_body(*a[2]))
            elif op == 'remove_actor':
                q = {'user': users[a[2][1]]} if a[2][0] == 'user' else {'groupId': groups[a[2][1]]}
                req('DELETE', f'/rest/api/3/project/{a[0]}/role/{roles[a[1]]}', params=q)
            elif op == 'add_group_member': req('POST', f'/rest/api/3/group/user?groupId={groups[a[0]]}', json={'accountId': users[a[1]]})
            elif op == 'add_grant':
                sid = {s['name']: s['id'] for s in j('GET', '/rest/api/3/permissionscheme')['permissionSchemes']}[a[0]]
                req('POST', f'/rest/api/3/permissionscheme/{sid}/permission', json={'permission': a[1], 'holder': holder(a[2])})
            print('done', op, a)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--phase', type=int, choices=(1, 2), default=1)
    ap.add_argument('--apply', action='store_true', help='actually write to Jira (needs JIRA_API_TOKEN)')
    a = ap.parse_args()
    if a.apply:
        apply(a.phase)
    else:
        print(f'DRY RUN, phase {a.phase}, site {os.environ.get("JIRA_BASE", "https://marginradar.atlassian.net")} (no network calls)')
        for i, (what, detail) in enumerate(plan(a.phase), 1): print(f'{i:3}. {what}: {detail}')
        print('\nManual steps:'); [print(' -', m) for m in MANUAL]
