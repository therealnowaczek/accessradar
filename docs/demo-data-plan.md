# AccessRadar demo data plan (marginradar.atlassian.net)

Script: `scripts/demo/seed.py` (+ `data.py`, `jira.py`), modelled on `/workspace/mr-assets/seed.py` and `jira.py`.
**Phase 1 applied on 2026-10-09** (accountIds and ids in `docs/demo-people.json`); phase 2 not run yet. Default mode is a
dry run without network calls; `--apply` needs `JIRA_API_TOKEN` or `JIRA_WRITE_TOKEN` of an account that is site admin
(invites, groups, memberships) and Jira admin (roles, schemes, projects). Re-running is idempotent; invites stop if the
user count would exceed `MAX_USERS` (10); WEB/MOB/RET/INT are guarded (only WEB / Administrators <- Jordan Pike).

## Story on the screens
- **Contractors with broad access:** group `contractors` (Riley Novak, Casey Brandt) has direct grants in OPS
  (Browse, Create, Edit, **Delete issues**) and in phase 2 is added to PAY → Developers.
- **Inactive account with access:** Ellis Ward stays in `developers` (PAY, OPS) and is deactivated by hand.
- **Public (anonymous) grant:** Browse projects to *anyone* on the empty project PUB “Public Roadmap”
  (a dedicated scheme, so no MarginRadar demo issues become public).
- **Extra admins:** Casey Brandt (a contractor) and Taylor Quinn in the site's Jira admin group.
- **Wide project admin:** Jordan Pike administers PAY, HR, PUB, WEB and OPS (via `ops-leads`).
- **Phase 2 (between snapshot #1 and #2):** contractors → PAY Developers (granted), Sam Ortega removed from HR
  Administrators (revoked), Avery Lin joins contractors (group change), Delete issues granted to Developers in
  “AR Demo · Standard” (scheme change).

## What `--apply` would create
- 5 groups: developers, contractors, auditors, hr-team, ops-leads
- 8 invited users (fictional names set when accepting the invite): Avery Lin, Jordan Pike, Ellis Ward, Riley Novak,
  Casey Brandt, Sam Ortega, Morgan Hale, Taylor Quinn; emails `marcin+ar-<slug>@radrly.com` (configurable `DEMO_EMAIL`).
  With Marcin that is 9 users (Free plan limit 10).
- 2 memberships in the existing Jira admin group (Casey Brandt, Taylor Quinn)
- Project roles Administrators, Developers, Auditors (only the missing ones)
- 3 permission schemes: “AR Demo · Standard” (29 grants), “AR Demo · Operations” (30), “AR Demo · Public roadmap” (26)
- 4 company-managed projects: PAY Payments Platform, HR People Ops, OPS Operations, PUB Public Roadmap
- 11 role actors (incl. Jordan Pike as Administrators in the existing MarginRadar project WEB; its scheme is untouched)

## Limits and manual steps
- Jira REST cannot set display names or deactivate accounts: accept the invites and set names; deactivate Ellis Ward
  in admin.atlassian.com.
- The new projects will also be visible to MarginRadar on the shared demo site (no budgets, so they stay empty there).
- Then: snapshot #1 → phase 2 → snapshot #2 → review “Q4 2026 access review” (PAY + HR, Revoke 3) → sign off → shots
  (`brand/marketplace/shots/README.md`).
