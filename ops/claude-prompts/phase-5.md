# AccessRadar roadmap phase 5: i18n, 12 locales en-US/de-DE/ja-JP/fr-FR/es-ES/pt-BR/pl-PL/ko-KR/it-IT/nl-NL/zh-CN/zh-TW (Marcin 2026-11-11, start after phases 0 and 1)

Run from the repo root: `claude -p "$(cat phase-5.md)" --model claude-opus-5-5 --effort medium`

## Context (read first)
You are working in the AccessRadar repo (Atlassian Forge app for Jira Cloud, GitHub therealnowaczek/accessradar), at the repo root on Marcin's Mac (`~/accessradar/accessradar`, Forge CLI logged in). Baseline: origin/main `10a5bb1` = Forge production 2.45.0 (production builds run `scripts/strip-spike.sh` first), development 2.91.0, 327 tests. Read `AGENTS.md`, `.cursor/rules/accessradar-ui.mdc`, `README.md`, `docs/PRD-R1-R2.md`, `docs/data-handling.md`, `docs/mcp-tools.md` before changing anything. Layout reference: `/workspace/radrly/layout-standard.md` on the bot box is mirrored in the rules file; MarginRadar is the layout reference app. Dev site: marginradar.atlassian.net (both dev and prod installs are on it; the dev app shows a "Dev" label).

## Hard rules
- UI: Atlassian Design System only (Atlaskit / `@atlaskit/primitives`, design tokens, dark mode). No raw `<button>`, `<input>`, `<select>`, `<table>`, no hard-coded colours. Modal: primary button on the RIGHT (Cancel, then primary). Drawer and fullscreen page: primary on the LEFT, Cancel right after it. Sticky header: separator line AND fade on scroll, always both. Skeletons mirror the loaded layout. Language and date formats from Jira, no language switcher (i18n: this phase).
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
ON HOLD by Marcin (2026-10-20). Do NOT run this prompt until the bot states here that Marcin lifted the hold.
Branch `feat/i18n-8-locales`. Implement `/workspace/radrly/i18n-plan.md` for AccessRadar (ask the bot for the file text if it is not on the Mac): UI language from the Jira user locale, English fallback for the language and missing keys, date and time format from Jira's global settings, user time zone, `Intl` for numbers, no language switcher, dictionaries bundled (zero egress), no manifest `translations` change until Marcin allows it. Rovo prompts and site are out of scope. Extract every UI string, add de, ja, fr, es, pt-BR, pl, ko, it, nl, zh-CN and zh-TW dictionaries (Jira locales use underscores, e.g. pt_BR) (map zh, zh-SG, zh-MY to zh-CN and zh-HK, zh-MO to zh-TW) (translations reviewed offline), tests for key coverage and fallback.
E2E checklist (`docs/e2e/phase-5.md`): switch the Jira profile language to en, pl, de, fr and check every main screen; dates follow Jira's date format; a missing key falls back to English; layout does not break with longer German text; then the regression pass.
