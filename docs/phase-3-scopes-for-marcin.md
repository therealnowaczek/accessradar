# AccessRadar 3.0: scope list for Marcin's decision (I, J, K)

Status: APPROVED by Marcin 2026-11-12 05:06, merged (#63) and deployed to production as 3.0.0 on 2026-11-12. Marketplace listing and privacy/security text still to be updated by a human from `docs/LISTING.md` and `docs/data-handling.md` (nothing published by the run).

## What ships

- **I** Publicly shared filters and dashboards (both editions): lists filters and dashboards shared with anyone or all signed-in users.
- **K** Issue security levels (both editions): per scheme and level, who is granted it and which spaces use the scheme.
- **J** Permission changes from the Jira audit log (Advanced): permission, group and role changes of the last 7 days with before/after.
- All three live on one new page, "Sharing and security" (Explore). Everything is a GET. Nothing is written to Jira. H (writing work items/comments) is dropped.
- Missing consent is handled at runtime: a site that has not approved the update sees an "Approval needed" notice in that section only; the rest of AccessRadar works as before.

## Exact scopes to add (6, all read, all with allowImpersonation)

| Scope | Why |
|---|---|
| `read:filter:jira` | Read filters and who they are shared with (I) |
| `read:jql:jira` | Required by the filter search response (JQL of the filter) (I) |
| `read:dashboard:jira` | Read dashboards and who they are shared with (I) |
| `read:audit-log:jira` | Read audit records for permission, group and role changes (J) |
| `read:issue-security-level:jira` | Read security levels and who is granted them (K) |
| `read:issue-security-scheme:jira` | Read issue security schemes and which space uses which (K) |

Already granted and reused: `read:project`, `read:project-role`, `read:group`, `read:user`, `read:avatar`, `read:application-role`, `read:project-category`, `read:issue-type`, `read:issue-type-hierarchy`, `read:project-version`, `read:project.component`. No egress, no remote, no Connect, no new module type: Runs on Atlassian eligibility unchanged (`forge eligibility -e development` OK).

## Consent impact

- Forge treats the scope change as a MAJOR version: 2.48.0 -> 3.0.0. Every site admin must approve the update ("Update app" consent screen listing the six new read scopes) before the new permissions apply. Sites that do not approve stay on 2.x behaviour and keep working.
- Marketplace: a new version with new scopes is reviewed again (expect a re-review; privacy and security answers need the text below).
- Deploy command needs `forge deploy -e production --approve MAJOR_VERSION_RULE`.

## Text changes needed before release (I did not publish anything)

- **Listing / site**: add "Finds filters and dashboards shared publicly, shows issue security levels and (Advanced) permission changes from the Jira audit log. Still read-only."
- **Privacy / data handling (`docs/data-handling.md`)**: AccessRadar now also reads filter and dashboard names, owners and share targets, issue security scheme/level names and holders, and audit-log summaries (actor, object, changed values). Read live, shown to the admin, not stored by the app, never leaves Atlassian (zero egress).
- **Security / questionnaire**: scope justification per scope as in the table; "read-only, never modifies Jira" stays true.
- **Audit log caveat for the listing**: Jira only exposes the audit log on paid plans; on free plans the section shows "not available on this site".

## Caveats found in testing

- Audit log payload could not be verified on dev (free plan, 403). The mapping follows the documented record shape; first paid-site run should be watched.
- Security levels: dev site has 1 scheme with 0 levels, so the table is exercised only by unit tests plus the empty state.
