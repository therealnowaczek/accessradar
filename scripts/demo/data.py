"""AccessRadar demo data for marginradar.atlassian.net (fictional people, no real names).
The story the screens should tell (docs/LISTING.md §6.2):
  * a contractors group with broad access (direct grants in OPS incl. Delete issues, later added to PAY Developers)
  * an inactive account that still has access (Ellis Ward, deactivated by hand after the invite)
  * a public (anonymous) grant: Browse projects to "anyone" on the empty PUB project
  * extra admins: a contractor and an engineering manager in the Jira admins group
  * one person administering many projects (Jordan Pike: PAY, HR, OPS via ops-leads, PUB, WEB)
  * phase 2 changes between snapshots, for the Changes view and the "Q4 2026 access review"."""

# slug -> (display name to set when accepting the invite, groups)
USERS = {
    'avery':  ('Avery Lin',     ['developers']),
    'jordan': ('Jordan Pike',   ['developers', 'ops-leads']),
    'ellis':  ('Ellis Ward',    ['developers']),                 # deactivate by hand -> "Inactive" with access
    'riley':  ('Riley Novak',   ['contractors']),
    'casey':  ('Casey Brandt',  ['contractors', '@admins']),     # contractor with admin access (risk)
    'sam':    ('Sam Ortega',    ['hr-team']),
    'morgan': ('Morgan Hale',   ['auditors']),
    'taylor': ('Taylor Quinn',  ['ops-leads', '@admins']),       # extra admin
}
# '@admins' = the site's existing Jira admin group (found via group/bulk?accessType=admin, e.g. jira-admins-<site>)
GROUPS = ['developers', 'contractors', 'auditors', 'hr-team', 'ops-leads']
ROLES = ['Administrators', 'Developers', 'Auditors']            # created if missing

WORK = ['BROWSE_PROJECTS', 'CREATE_ISSUES', 'EDIT_ISSUES', 'ASSIGN_ISSUES', 'ASSIGNABLE_USER', 'TRANSITION_ISSUES',
        'RESOLVE_ISSUES', 'CLOSE_ISSUES', 'LINK_ISSUES', 'ADD_COMMENTS', 'EDIT_OWN_COMMENTS', 'CREATE_ATTACHMENTS',
        'WORK_ON_ISSUES', 'EDIT_OWN_WORKLOGS', 'SCHEDULE_ISSUES', 'MANAGE_SPRINTS_PERMISSION']
ADMIN = ['ADMINISTER_PROJECTS', 'DELETE_ISSUES', 'MOVE_ISSUES', 'MODIFY_REPORTER', 'DELETE_ALL_COMMENTS',
         'EDIT_ALL_COMMENTS', 'DELETE_ALL_ATTACHMENTS', 'MANAGE_WATCHERS', 'BROWSE_PROJECTS']
VIEW = ['BROWSE_PROJECTS', 'VIEW_VOTERS_AND_WATCHERS', 'VIEW_DEV_TOOLS', 'VIEW_READONLY_WORKFLOW']

# scheme name -> list of (permission, holder) ; holder = ('role', name) | ('group', name) | ('anyone',)
SCHEMES = {
    'AR Demo · Standard': [(p, ('role', 'Developers')) for p in WORK]
                          + [(p, ('role', 'Administrators')) for p in ADMIN]
                          + [(p, ('role', 'Auditors')) for p in VIEW],
    'AR Demo · Operations': [(p, ('role', 'Developers')) for p in WORK]
                            + [(p, ('role', 'Administrators')) for p in ADMIN]
                            + [(p, ('group', 'contractors')) for p in ('BROWSE_PROJECTS', 'CREATE_ISSUES', 'EDIT_ISSUES', 'DELETE_ISSUES', 'TRANSITION_ISSUES')],
    'AR Demo · Public roadmap': [('BROWSE_PROJECTS', ('anyone',))]
                                + [(p, ('role', 'Administrators')) for p in ADMIN + WORK],
}

# key -> (name, scheme) ; company-managed (classic) Kanban, lead = the token owner
PROJECTS = {
    'PAY': ('Payments Platform', 'AR Demo · Standard'),
    'HR':  ('People Ops', 'AR Demo · Standard'),
    'OPS': ('Operations', 'AR Demo · Operations'),
    'PUB': ('Public Roadmap', 'AR Demo · Public roadmap'),     # empty project; only exists for the public grant
}

# phase 1 role actors: project -> role -> [('user', slug) | ('group', name)]
ACTORS_1 = {
    'PAY': {'Administrators': [('user', 'jordan')], 'Developers': [('group', 'developers')], 'Auditors': [('group', 'auditors')]},
    'HR':  {'Administrators': [('user', 'sam'), ('user', 'jordan')], 'Developers': [('group', 'hr-team')], 'Auditors': [('group', 'auditors')]},
    'OPS': {'Administrators': [('group', 'ops-leads')], 'Developers': [('group', 'developers')]},
    'PUB': {'Administrators': [('user', 'jordan')]},
    'WEB': {'Administrators': [('user', 'jordan')]},          # existing MarginRadar project: role actor only, scheme untouched
}

# phase 2: run after the first snapshot so the Changes view and the review comparison have a story
PHASE_2 = [
    ('add_actor', 'PAY', 'Developers', ('group', 'contractors')),   # Riley + Casey gain Browse/Create/Edit in PAY
    ('remove_actor', 'HR', 'Administrators', ('user', 'sam')),      # Sam loses Administer projects in HR
    ('add_group_member', 'contractors', 'avery'),                   # a developer joins contractors (group change)
    ('add_grant', 'AR Demo · Standard', 'DELETE_ISSUES', ('role', 'Developers')),  # scheme change
]

MANUAL = [
    'Accept each invite (mail to the plus-addressed inbox) and set the display name from USERS; Jira REST cannot set names.',
    'Deactivate Ellis Ward in admin.atlassian.com (Directory > Users > Deactivate); Jira REST cannot deactivate accounts.',
    'In AccessRadar: take snapshot #1 after phase 1; run phase 2; take snapshot #2.',
    'In AccessRadar: Reviews > Start an access review "Q4 2026 access review", scope PAY + HR, base = latest, compare with #1; Keep all, Revoke 3 (Riley Novak and Casey Brandt in PAY via contractors, Ellis Ward inactive in PAY); sign off.',
]
