# Phase 3a spike: permissions upgrade (I, J, K), 2026-11-12

Scratch branch (deleted, never merged), dev only. H (writing work items/comments) is dropped: AccessRadar stays read-only.

## Scope names (from Atlassian's Jira Cloud REST OpenAPI, granular "Beta" scope sets)

| Item | Endpoints (all GET) | Scopes needed | New for AccessRadar |
|---|---|---|---|
| I public filters/dashboards | `filter/search?expand=sharePermissions`, `filter/{id}/permission`, `dashboard/search?expand=sharePermissions` | `read:filter:jira`, `read:jql:jira`, `read:dashboard:jira` (plus group, project, project-role, user, application-role, avatar, issue-type, issue-type-hierarchy, project-category, project-version, project.component) | `read:filter:jira`, `read:jql:jira`, `read:dashboard:jira` |
| J audit log | `auditing/record` | `read:audit-log:jira`, `read:user:jira` | `read:audit-log:jira` |
| K issue security | `issuesecurityschemes`, `issuesecurityschemes/level`, `issuesecurityschemes/level/member`, `project/{key}/issuesecuritylevelscheme` | `read:issue-security-level:jira`, `read:issue-security-scheme:jira` | both |

Six new scopes in total, all `read:`, all with `allowImpersonation` like the existing ones. The classic equivalents
(`manage:jira-configuration`, `manage:jira-project`) are write-capable and are NOT used.

## Results on dev (marginradar, 3.0.0 after `forge deploy --approve MAJOR_VERSION_RULE` and `forge install --upgrade`)

- `forge lint`: one approval, `MAJOR_VERSION_RULE` ("Change due to scope modification"). Deploy needs `--approve MAJOR_VERSION_RULE`.
- `forge eligibility -e development`: still Runs on Atlassian eligible.
- Probes as the interactive admin and as the app (asApp), same results:
  - `filter/search` 200 (11 filters, 10 with shares, share types `project`, `project-unknown`), `filter/{id}/permission` 200, `dashboard/search` 200 (share type `loggedin`).
  - `issuesecurityschemes` 200 (1 scheme), `level` and `level/member` 200 (0 levels on this site), `project/ARTEST/issuesecuritylevelscheme` 404 "Security level for project ARTEST does not exist" (normal: no scheme on that space).
  - `auditing/record` 403 on BOTH identities with the message "Audit logs aren't available for this site as all of its Jira Cloud products are on Free plans." The scope is accepted; the dev site is on a free plan, so the audit payload could not be verified here. The feature treats this 403 as "not available on this site" (shown to the admin), never as an error.
- Negative control `search/jql`: 401 "scope does not match" asApp, as expected (scope not granted).
- Before consent (site not yet on 3.0): the same calls return 401 "Unauthorized; scope does not match". The app maps that to "needs consent" (covered by unit tests in `src/lib/exposure.test.ts`).
