# AccessRadar roadmap phase 2: JSON export and free-tier schedule options

Run from the repo root: `claude -p "$(cat phase-2.md)" --model claude-opus-5-5 --effort medium`

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
Branch: `feat/json-export-and-free-tier`. E2E file: `docs/e2e/phase-2.md`. No manifest change.
Part G (do it): JSON export.
1. Add JSON next to the existing CSV / PDF / Markdown exports (`static/app/src/export/`): access matrix (Explore), a review (with decisions, exceptions, signature fields when present) and the evidence pack. Client-side download like the others, `schemaVersion` field, ISO timestamps, no personal data beyond what CSV already contains.
2. Server-side edition gate identical to the existing exports (evidence pack JSON = Advanced; Standard gets the existing upgrade note and the resolver refuses a direct call).
3. Document the schema in `docs/export-json.md`; golden tests in `static/app/src/export/json.test.ts`.
Part F (ONLY if the bot passes Marcin's decision in this prompt; otherwise skip F and say so): free-tier schedule options. Today `src/collector/gate.ts` forces Standard sites with ≤10 active humans to an internal biweekly schedule. Implement exactly Marcin's decision: DECISION_F = "<to be filled by the bot>". Update Settings copy, `docs/PRD-R1-R2.md` R1-09 status, tests in `test/gate.test.ts`.
Draft (do not publish) the site/docs/listing text changes in `docs/site-drafts/phase-2.md`, including removing the "Free-tier schedule options" roadmap item if it ships.
E2E checklist: JSON export from Explore, from one review and from the evidence pack in Advanced; Standard shows the upgrade note; open each file and validate against the schema; free-tier behaviour (if F shipped): with the dev override to Standard and the free-tier condition simulated, Settings shows the decided options and the next snapshot time is correct; then the regression pass.
