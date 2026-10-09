"""Idempotent AccessRadar demo seed for marginradar.atlassian.net (modelled on /workspace/mr-assets/seed.py).

DEFAULT IS A DRY RUN: prints the plan and makes no network calls.
  python3 scripts/demo/seed.py [--dry-run]     # plan for phase 1 (no network)
  python3 scripts/demo/seed.py --phase 2       # plan for phase 2 (no network)
  JIRA_WRITE_TOKEN=... python3 scripts/demo/seed.py --apply [--phase 1|2]

Needs a token (JIRA_API_TOKEN or JIRA_WRITE_TOKEN) of an account that is BOTH site admin (invite users, create
groups, group membership) and Jira admin (roles, permission schemes, projects). Users are invited with plus-addressed
emails (DEMO_EMAIL, default marcin+ar-{slug}@radrly.com) and count towards the site's user limit (MAX_USERS, 10).
Existing objects are reused (matched by name/key/email); nothing is ever deleted except the phase-2 role
actor removal listed in data.PHASE_2.

Safety (agreed with MarginRadar): projects in PROTECTED are never modified, except the single allowed role actor
(WEB / Administrators <- Jordan Pike). Writes accountIds to docs/demo-people.json."""
import argparse, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from data import USERS, GROUPS, ROLES, SCHEMES, PROJECTS, ACTORS_1, PHASE_2, MANUAL

EMAIL_PATTERN = os.environ.get('DEMO_EMAIL', 'marcin+ar-{slug}@radrly.com')
MAX_USERS = int(os.environ.get('MAX_USERS', '10'))
PROTECTED = {'WEB', 'MOB', 'RET', 'INT'}                       # MarginRadar's listing projects
ALLOWED_PROTECTED_ACTORS = {('WEB', 'Administrators', 'user', 'jordan')}
PEOPLE_JSON = os.path.join(HERE, '..', '..', 'docs', 'demo-people.json')


def check_safety():
    bad = PROTECTED & set(PROJECTS)
    assert not bad, f'refusing: PROJECTS contains protected keys {bad}'
    for k, rs in ACTORS_1.items():
        if k in PROTECTED:
            for r, actors in rs.items():
                for kind, v in actors:
                    assert (k, r, kind, v) in ALLOWED_PROTECTED_ACTORS, f'refusing: actor {k}/{r}/{kind} {v} not allowed'
    for op, *a in PHASE_2:
        if op in ('add_actor', 'remove_actor'): assert a[0] not in PROTECTED, f'refusing: phase 2 touches {a[0]}'


def plan(phase):
    steps = []
    if phase == 1:
        for g in GROUPS: steps.append(('create group (if missing)', g))
        steps.append(('check licensed user count', f'existing + new invites must be <= {MAX_USERS}, otherwise no invites'))
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
        steps.append(('write', 'docs/demo-people.json'))
    else:
        for op, *args in PHASE_2:
            steps.append((op.replace('_', ' '), ' / '.join(str(a if not isinstance(a, tuple) else (a[0] + ' ' + (USERS[a[1]][0] if a[0] == 'user' else a[1]))) for a in args)))
    return steps


def apply(phase):
    from jira import j, req, connect
    connect()
    failed = []

    def ok(r, what, already=()):
        if r.status_code < 300: return True
        txt = r.text[:300]
        if any(a in txt.lower() for a in already): return True
        failed.append(f'{what}: {r.status_code} {txt}'); print('FAILED', what, r.status_code, txt); return False

    me = j('GET', '/rest/api/3/myself')['accountId']
    groups = {}
    start = 0
    while True:
        r = j('GET', f'/rest/api/3/group/bulk?startAt={start}&maxResults=50')
        for g in r['values']: groups[g['name']] = g['groupId']
        if r.get('isLast', True): break
        start += 50
    admins = j('GET', '/rest/api/3/group/bulk?accessType=admin&maxResults=50')['values']
    admin_group = next(g for g in admins if g['name'].startswith('jira-admins'))   # never org-admins / site-admins
    groups['@admins'] = admin_group['groupId']
    users = {}
    try: known = {k: v.get('accountId') for k, v in json.load(open(PEOPLE_JSON))['people'].items()}
    except (OSError, ValueError, KeyError): known = {}

    def same(u, slug, email):
        # Atlassian hides emails ('' or absent) unless the user made them public: then match the display name
        # (invite default = email local part, or the fictional name once Marcin renamed the account)
        if u.get('accountType') != 'atlassian': return False
        if u.get('emailAddress'): return u['emailAddress'].lower() == email.lower()
        return u.get('displayName') in (email.split('@')[0], USERS[slug][0])

    for slug in USERS:
        email = EMAIL_PATTERN.format(slug=slug)
        found = [u for u in j('GET', '/rest/api/3/user/search', params={'query': email}) if same(u, slug, email)]
        if not found and known.get(slug):
            r = req('GET', '/rest/api/3/user', params={'accountId': known[slug]})
            if r.ok: found = [r.json()]
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
            if g not in groups:
                r = req('POST', '/rest/api/3/group', json={'name': g})
                if ok(r, f'create group {g}'): groups[g] = r.json()['groupId']; print('group created', g)
            else: print('group exists', g)
        # licensed user cap
        humans = [u for u in j('GET', '/rest/api/3/users/search?maxResults=1000')
                  if u['accountType'] == 'atlassian' and u.get('active')]
        sw = j('GET', '/rest/api/3/applicationrole/jira-software')
        missing = [s for s in USERS if not users[s]]
        current = max(len(humans), sw.get('userCount', 0))
        print(f'licensed users now: {current} (active humans {len(humans)}, jira-software userCount {sw.get("userCount")}); to invite: {len(missing)}')
        can_invite = current + len(missing) <= MAX_USERS
        if not can_invite:
            failed.append(f'invites skipped: {current} + {len(missing)} > {MAX_USERS}'); print('STOP invites:', failed[-1])
        for slug, (name, gs) in USERS.items():
            if not users[slug]:
                if not can_invite: continue
                r = req('POST', '/rest/api/3/user', json={'emailAddress': EMAIL_PATTERN.format(slug=slug), 'products': ['jira-software']})
                if not ok(r, f'invite {slug}'): continue
                users[slug] = r.json()['accountId']; print('invited', slug, users[slug])
            else: print('user exists', slug, users[slug])
            for g in gs:
                if g not in groups: failed.append(f'group {g} missing for {slug}'); continue
                ok(req('POST', f'/rest/api/3/group/user?groupId={groups[g]}', json={'accountId': users[slug]}),
                   f'add {slug} to {g}', already=('already a member',))
        for r in ROLES:
            if r not in roles:
                resp = req('POST', '/rest/api/3/role', json={'name': r, 'description': 'AccessRadar demo'})
                if ok(resp, f'create role {r}'): roles[r] = resp.json()['id']; print('role created', r)
        existing = {s['name']: s['id'] for s in j('GET', '/rest/api/3/permissionscheme')['permissionSchemes']}
        for s, grants in SCHEMES.items():
            if s not in existing:
                try: perms = [{'permission': p, 'holder': holder(h)} for p, h in grants]
                except KeyError as e: failed.append(f'scheme {s}: missing {e}'); continue
                resp = req('POST', '/rest/api/3/permissionscheme', json={'name': s, 'description': 'AccessRadar demo', 'permissions': perms})
                if ok(resp, f'create scheme {s}'): existing[s] = resp.json()['id']; print('scheme created', s, existing[s])
            else: print('scheme exists', s, existing[s])
        projects = {}
        for k, (n, s) in PROJECTS.items():
            assert k not in PROTECTED
            if s not in existing: failed.append(f'project {k}: scheme {s} missing, not created'); continue
            r = req('GET', f'/rest/api/3/project/{k}')
            if r.status_code == 404:
                resp = req('POST', '/rest/api/3/project', json={'key': k, 'name': n, 'projectTypeKey': 'software',
                  'projectTemplateKey': 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic', 'leadAccountId': me,
                  'assigneeType': 'UNASSIGNED', 'permissionScheme': existing[s]})
                if ok(resp, f'create project {k}'): projects[k] = str(resp.json()['id']); print('project created', k)
            elif r.ok:
                projects[k] = str(r.json()['id'])
                if r.json().get('name') != n:
                    failed.append(f'project {k} exists with another name ({r.json().get("name")}); left untouched'); continue
                ok(req('PUT', f'/rest/api/3/project/{k}/permissionscheme', json={'id': existing[s]}), f'set scheme {k}')
                print('project exists', k)
            else: ok(r, f'get project {k}')
        actors = []
        for k, rs in ACTORS_1.items():
            for r, acts in rs.items():
                for kind, v in acts:
                    if k in PROTECTED: assert (k, r, kind, v) in ALLOWED_PROTECTED_ACTORS
                    what = f'{k} / {r} <- {kind} {USERS[v][0] if kind == "user" else v}'
                    if r not in roles or (kind == 'user' and not users[v]) or (kind == 'group' and v not in groups):
                        failed.append(f'actor skipped (missing role/user/group): {what}'); continue
                    if k not in PROTECTED and k not in projects:
                        failed.append(f'actor skipped (project missing): {what}'); continue
                    if ok(req('POST', f'/rest/api/3/project/{k}/role/{roles[r]}', json=actor_body(kind, v)), what,
                          already=('already',)):
                        actors.append(what); print('actor', what)
        people = {'site': 'https://marginradar.atlassian.net', 'admin_group': admin_group['name'], 'people': {
            slug: {'name': USERS[slug][0], 'email': EMAIL_PATTERN.format(slug=slug), 'accountId': users[slug],
                   'groups': [admin_group['name'] if g == '@admins' else g for g in USERS[slug][1]]} for slug in USERS},
            'groups': {g: groups.get(g) for g in GROUPS}, 'roles': {r: roles.get(r) for r in ROLES},
            'schemes': {s: existing.get(s) for s in SCHEMES}, 'projects': projects, 'role_actors_phase1': actors}
        with open(PEOPLE_JSON, 'w') as f: json.dump(people, f, indent=2, ensure_ascii=False); f.write('\n')
        print('wrote', os.path.normpath(PEOPLE_JSON))
    else:
        for op, *a in PHASE_2:
            if op == 'add_actor': ok(req('POST', f'/rest/api/3/project/{a[0]}/role/{roles[a[1]]}', json=actor_body(*a[2])), str(a), ('already',))
            elif op == 'remove_actor':
                q = {'user': users[a[2][1]]} if a[2][0] == 'user' else {'groupId': groups[a[2][1]]}
                ok(req('DELETE', f'/rest/api/3/project/{a[0]}/role/{roles[a[1]]}', params=q), str(a), ('not',))
            elif op == 'add_group_member': ok(req('POST', f'/rest/api/3/group/user?groupId={groups[a[0]]}', json={'accountId': users[a[1]]}), str(a), ('already a member',))
            elif op == 'add_grant':
                sid = {s['name']: s['id'] for s in j('GET', '/rest/api/3/permissionscheme')['permissionSchemes']}[a[0]]
                cur = j('GET', f'/rest/api/3/permissionscheme/{sid}/permission')['permissions']
                h = holder(a[2])
                if not any(g['permission'] == a[1] and g['holder'].get('type') == h['type'] and str(g['holder'].get('value', g['holder'].get('parameter'))) == h.get('value') for g in cur):
                    ok(req('POST', f'/rest/api/3/permissionscheme/{sid}/permission', json={'permission': a[1], 'holder': h}), str(a))
            print('done', op, a)
    print('\nFAILED:' if failed else '\nNo failures.'); [print(' -', f) for f in failed]
    return failed


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--phase', type=int, choices=(1, 2), default=1)
    ap.add_argument('--apply', action='store_true', help='actually write to Jira (needs JIRA_API_TOKEN/JIRA_WRITE_TOKEN)')
    ap.add_argument('--dry-run', action='store_true', help='default; print the plan without network calls')
    a = ap.parse_args()
    check_safety()
    if a.apply and not a.dry_run:
        apply(a.phase)
    else:
        print(f'DRY RUN, phase {a.phase}, site {os.environ.get("JIRA_BASE", "https://marginradar.atlassian.net")} (no network calls)')
        for i, (what, detail) in enumerate(plan(a.phase), 1): print(f'{i:3}. {what}: {detail}')
        print('\nManual steps:'); [print(' -', m) for m in MANUAL]
