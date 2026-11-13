# AccessRadar roadmap phase 3: permissions upgrade (major) - spike 3a, build 3b after approval

Run from the repo root: `claude -p "$(cat phase-3.md)" --model claude-opus-5-5 --effort medium`

## Context (read first)
You are working in the AccessRadar repo (Atlassian Forge app for Jira Cloud, GitHub therealnowaczek/accessradar), at the repo root on Marcin's Mac (`~/accessradar/accessradar`, Forge CLI logged in). Baseline: origin/main `10a5bb1` = Forge production 2.45.0 (production builds run `scripts/strip-spike.sh` first), development 2.91.0, 327 tests. Read `AGENTS.md`, `.cursor/rules/accessradar-ui.mdc`, `README.md`, `docs/PRD-R1-R2.md`, `docs/data-handling.md`, `docs/mcp-tools.md` before changing anything. Layout reference: `/workspace/radrly/layout-standard.md` on the bot box is mirrored in the rules file; MarginRadar is the layout reference app. Dev site: marginradar.atlassian.net (both dev and prod installs are on it; the dev app shows a "Dev" label).

## Hard rules
- UI: Atlassian Design System only (Atlaskit / `@atlaskit/primitives`, design tokens, dark mode). No raw `<button>`, `<input>`, `<select>`, `<table>`, no hard-coded colours. Modal: primary button on the RIGHT (Cancel, then primary). Drawer and fullscreen page: primary on the LEFT, Cancel right after it. Sticky header: separator line AND fade on scroll, always both. Skeletons mirror the loaded layout. Language and date formats from Jira, no language switcher (i18n itself is on hold).
- No new scopes, no `permissions.external`, no remotes, no Connect, no other `manifest.yml` changes unless this prompt explicitly allows them. The app must stay eligible for Runs on Atlassian (`forge eligibility -e development`).
- Edition gates are enforced on the server for every resolver and Rovo action; missing licence outside development = Standard; Standard answers use clear "requires Advanced" copy that describes the feature exactly as the code does.
- Security: accountId from the server context only; asApp calls preceded by a user permission check; payload validation; SQL only via `sql.prepare().bindParams()`; logs without accountIds, names, emails or tokens. Count SQL via `src/db/sqlCount.ts`.
- Git: create the branch named below from origin/main in a NEW worktree (`git worktree add /tmp/ar-<branch> -b <branch> origin/main`, then `npm ci`); keep the main clone clean. Never touch, push, reset or delete `release/production` or `wip/local-2026-10-12`. No force push. Every commit message ends with `[skip ci]`. Open a PR to main with `gh pr create`; do NOT merge.
- Deploy: development only (`npm run build:ui` then `npx forge deploy --environment development --non-interactive`). Never deploy production. Never run `forge install --upgrade` unless this prompt allows a scope change.
- Secrets: never print or commit tokens or env files (for example `/home/box/.config/radrly/atlassian.env`, FORGE_API_TOKEN, CLAUDE_CODE_OAUTH_TOKEN).
- Do not edit the Marketplace listing, the website or Marketplace console. Draft text changes in `docs/` only.

## Quality gate
`npm run check` (prettier, eslint, typecheck, vitest, build:ui, forge lint) must pass before every commit you push and before the dev deploy. Add unit tests for every behaviour you add or change, including Standard vs Advanced, development vs production, missing licence, non-admin, and Rovo/MCP payload shapes where relevant. Report exact test counts.

## Post-dev-deploy E2E (mandatory, Marcin 11.11 18:45)
After the dev deploy you do NOT run browser tests yourself: AccessRadar's own browser agent runs them on marginradar.atlassian.net. Your job:
1. Write `docs/e2e/<phase>.md` in the PR: dev version, commit SHA, and a numbered checklist per changed feature (exact UI path with labels, steps, expected result in Standard AND in Advanced, using the dev edition override in Settings or `AR_EDITION_OVERRIDE`), Rovo and MCP checks where relevant (exact questions / tool inputs and expected answers), light and dark theme where UI changed.
2. Append the standard regression pass: Overview; Explore (Spaces + Why panel, Groups, People); Changes; Reviews (open a review, set decisions, sign on Advanced, Verify); Exceptions; Alerts; Campaigns; Snapshots (take a snapshot); Settings; Get started; project settings Access review page; one Rovo agent question.
3. Run `npx forge logs -e development --since 30m` after the deploy and paste the relevant lines (errors must be zero; tick/collector lines show real `sql` counts).
4. Say in the final output that the phase is NOT done until the browser agent reports PASS for every checklist step with screenshots.

## Final output
Print: branch, PR URL, commits, `npm run check` result with test counts, `forge lint` and `forge eligibility -e development` output (exact), dev version, manifest diff vs origin/main (must be empty unless allowed), path of `docs/e2e/<phase>.md`, open questions for Marcin.

## Task
This phase is a MAJOR version with new scopes. Run ONLY sub-phase 3a unless the bot states in this prompt that Marcin approved 3b with an exact scope list.
Sub-phase 3a (spike, scratch branch `spike/permissions-upgrade`, never merged):
1. On the scratch branch add candidate scopes for: (H) alerts/reminders as Jira work items or comments (granular write:issue:jira / write:comment:jira or classic write:jira-work), (I) public filters and dashboards rule (read:filter:jira, read:dashboard:jira), (J) Jira audit records (read:audit-log:jira or what Forge lint accepts), (K) issue security levels (read:issue-security-level:jira, read:issue-security-scheme:jira). This is the one exception to the no-scope rule, and only on this branch and the dev environment.
2. `forge lint`, `forge deploy -e development` (expect major; you may approve the major on DEVELOPMENT only), `forge install --upgrade` on the dev install of marginradar.atlassian.net only, `forge eligibility -e development`.
3. Probe the endpoints with tiny dev-only scripts (filters/search with sharePermissions, dashboards/search, auditing/record, issuesecurityschemes + levels, POST issue/comment in a throwaway project) asApp and asUser; record status codes and response shapes (no personal data) in `docs/spike-results/permissions-upgrade-2026-11.md`, with exact scope names, whether RoA stays eligible, and the consent text admins see.
4. Revert dev: redeploy development from origin/main and `forge install --upgrade` back if Forge requires it; confirm dev version and that eligibility is unchanged. Open the spike PR as draft for the record only (do not merge).
Sub-phase 3b (only after explicit approval with the scope list): branch `v3/permissions-upgrade`. Implement the approved items behind runtime consent detection (403 or missing scope = feature disabled with an explanation, no retry storms, no empty snapshots written), H opt-in per alert rule with an admin-chosen target project and off by default, Advanced for H and J, both editions for I and K. Update data-handling, privacy and security drafts (`docs/site-drafts/phase-3.md`), scope justifications for the Marketplace Privacy & Security tab, release notes. Tests for consented and not-consented paths, Standard vs Advanced.
E2E checklist (`docs/e2e/phase-3.md`): upgrade consent screen lists exactly the approved scopes; each feature before consent (disabled explanation) and after consent (works); H creates a work item/comment only in the chosen project and only when the rule is on; I flags a filter shared with "anyone" created on dev; J shows who changed a permission between two snapshots; K shows security levels in Explore; Standard vs Advanced; Rovo and MCP tools still answer; then the regression pass.
