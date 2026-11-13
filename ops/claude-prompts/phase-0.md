# AccessRadar roadmap phase 0: MCP surface detection after the live MCP test (+ date-picker E2E checklist)

Run from the repo root: `claude -p "$(cat phase-0.md)" --model claude-opus-5-5 --effort medium`

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
Branch: `fix/mcp-surface-detection`. E2E file: `docs/e2e/phase-0.md`.
Prerequisite: Marcin ran the live MCP test (`~/accessradar/accessradar-mcp-e2e-prompt.md`) and the bot gives you the real `[rovo] ok` log lines with `surface` and `ctx: [...]` key names from MCP and from Rovo calls. If you do not have them, STOP and ask for them; do not guess.
1. In `src/rovo/invocation.ts`, detect MCP from the real field(s) Forge sends (keep the heuristic only as a fallback). Keep the rule: MCP calls never call asApp (`assertJiraAdmin(..., { prefer: 'user', allowApp: false })`), Rovo calls user-first with asApp fallback.
2. Add tests in `test/rovoMcp.test.ts` with the exact real payload/context shapes for MCP and for Rovo agent calls (values anonymised).
3. Update `docs/mcp-tools.md` (surface detection paragraph).
4. E2E checklist: call all 5 MCP tools and one Rovo agent question on marginradar dev; logs show `surface: 'mcp'` / `'rovo'` correctly and no `[auth] asApp` lines for MCP; Standard via the dev override gives "requires the Advanced edition"; a non-admin account gets "AccessRadar is available to Jira administrators only".
Manual items not for you (listed for context only): date-picker smoke test after `@atlaskit/datetime-picker` 14 to 19, licence check on the prod install, Marketplace console updates.
Also add to `docs/e2e/phase-0.md` the date-picker smoke checklist for the browser agent: every screen that uses `@atlaskit/datetime-picker` (find them with grep: Exceptions expiry, campaign schedule, any review due date), open the picker, pick a date with mouse and keyboard, clear it, save, reload, check the value and the Jira date format, light and dark theme, no console errors.
