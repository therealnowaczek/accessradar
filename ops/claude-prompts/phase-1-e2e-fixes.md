# AccessRadar: fix phase 1 E2E failures and apply Marcin's 11.11 decisions

You are running on the bot box, in an already prepared git clone:

- Working directory: `/workspace/radrly/accessradar/work-phase1-fixes`
- Branch already created: `fix/phase-1-e2e` from `origin/main` at `4ad0c0fc9b16c6d1ad64d50e431e9c0b90969008` (or the current HEAD if it moved forward; rebase onto latest origin/main if needed before you start).
- `npm ci` is already done. Do not create another clone or worktree. Do not use `/workspace/accessradar` (stale). Never touch, push, reset, or delete `release/production` or `wip/local-2026-10-12`. No force push. Do not merge.

Read first: `AGENTS.md`, `.cursor/rules/accessradar-ui.mdc`, `docs/layout-conformance.md`, `docs/e2e/phase-1.md`, plus the evidence files listed below (use `--add-dir` paths; they are already allowed).

## Evidence (read these; do not invent symptoms)

- Phase 1 E2E report: `/workspace/radrly/accessradar/e2e/2026-11-11-phase-1/report.md`
- Summary: `/workspace/radrly/accessradar/e2e/2026-11-11-phase-1/summary.json`
- Screenshots in that folder and `resume/`
- Checklist: `/workspace/radrly/accessradar/e2e/phase-1.md`
- Phase 0 report: `/workspace/radrly/accessradar/e2e/2026-11-11-phase-0/report.md`
- Layout standard if present: `/workspace/radrly/layout-standard.md`

## Hard rules

- UI: Atlassian Design System / Atlaskit only. No raw `<button>`, `<input>`, `<select>`, `<table>`, no hard-coded colours. Modal: primary button on the RIGHT (Cancel, then primary). Drawer and fullscreen page: primary on the LEFT, Cancel immediately after it. No language switcher.
- NO manifest, scope, or egress changes. `manifest.yml` diff vs origin/main must stay empty. Stay eligible for Runs on Atlassian.
- Security: accountId from server context only; asApp preceded by a user permission check; payload validation; SQL only via `sql.prepare().bindParams()`; logs without accountIds, names, emails or tokens.
- Keep repo design-system guard rules green (`static/app/src/designSystem.guard.test.ts` and related). Extend tests rather than weakening them.
- Do not edit the Marketplace listing, the website, or Marketplace console.
- Secrets: never print or commit tokens or env files (`/home/box/.config/radrly/atlassian.env`, FORGE_API_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, emails). Forge credentials may already be in the environment; use them, do not echo them.
- Git: every commit message ends with `[skip ci]`. Author is already configured in this clone. Open a PR to `main` with `gh pr create`. Do NOT merge.

## Quality gate (must pass before push and before any deploy)

Run the full gate: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:ui && npx forge lint`.
If `npx forge lint` fails only because of keytar / login, retry with the existing env vars (do not print them). If it still cannot run, say so clearly and do not pretend it passed.
Add or update unit tests for every behaviour you change, including Standard vs Advanced and locale cases where relevant. Report exact test counts (files and tests, baseline was 339 tests / 47 files after the layout-conformance work; current main may differ, report the number you actually get).

## Deploy (development only, after the PR is open and the gate is green)

Forge CLI is available on this box when FORGE_EMAIL / FORGE_API_TOKEN are in the environment (already provided; do not print them). After tests, lint, and the PR exist:

1. `npm run build:ui` immediately before deploy (Custom UI is shipped as `static/*/dist` on disk).
2. `npx forge deploy --environment development --non-interactive`
3. `npx forge eligibility -e development` (must still be Runs on Atlassian)
4. Record the dev version (`npx forge version` / deploy output / `forge install list` as applicable) and the commit SHA.

NEVER deploy to production. NEVER run `forge install --upgrade`. NEVER touch `release/production`.

If deploy fails, do not retry against production and do not invent a version; report the exact error (redacted).

## Task — fix these items. Find the real root cause for each; do not hide symptoms.

### 1. E2E 2.6 — Snapshot integrity shows "Mismatch" on a signed review

Finished/signed "E2E phase 1 review" (ARTEST only, snapshot #34, 26/26 = 23 Keep / 1 Revoke record / 2 Exceptions). Signature is Verified and the chain is Intact (3 signed, rows OK), but snapshot #34 integrity is Mismatch:

- Expected `c5a5180d4c6f92580d1e95459803a93a4dc062599b14b22fe4601406187250e3`
- Actual `c80cce7940641defd6fb4cbb460eb29760a1f2a6052983b8c6e28064c057327e`
- Message: "Recomputed snapshot hash does not match the signed value."
- Signature `70975971707bdd455966993f2ed6ec1c2cda0316ee47e4db1a9c1a86924a23bd`, chain #3, signed Nov 11, 2026, 08:13 PM Europe/Warsaw.
- The report says the mismatch was already present BEFORE snapshot #35 was started. Still investigate all plausible causes (hash computed over different content or key order than at sign time; verify using a newer snapshot than the one bound to the review; canonicalization / serialization drift; stored snapshot mutated; etc.).

Fix the real bug. Do not just hide the Mismatch badge, skip the check, or loosen the comparison. Existing already-signed reviews should either verify correctly once the hash is computed the same way as at sign time, or you must explain if historical records cannot be repaired automatically and what the UI should show. Add tests that would have caught this (same payload, sign then verify; order-sensitive fixtures; review bound to snapshot N while a later snapshot exists).

### 2. E2E 1.9 — at 200% zoom, header and fade stay pinned

Native Chrome 200% zoom: compact menu/brand works and the Reviews list fits, but Overview and the signed ARTEST review detail keep the title pinned AND the fade visible while the body scrolls, in both themes. They should become single-page scroll: header not pinned, separator line stays, no fade.

Fix the zoom / compact-header behaviour so it matches `docs/layout-conformance.md` and the layout standard. Add or extend a test if the rule can be expressed statically or in a unit/component test (breakpoint, media, class, or zoom CSS).

### 3. E2E 1.4.5 — delegated review empty state copy

On the ARTEST project settings Access review page ("No assigned review"), the description is two sentences with an em dash:

> When a Jira admin runs a campaign, the assigned space admin reviews access here. Reminders stay in the app — AccessRadar does not send email.

It must be one sentence, with no em dash (and no "—" / "–" character). Keep the meaning. Update any i18n/copy tests.

### 4. E2E 2.2 — Spaces matrix CSV export did not download

On Spaces, ARTEST detail, Export → CSV was clicked twice. No download event after 5s / 20s, no matrix CSV file appeared, no app error/toast. Later, snapshot Coverage CSV downloaded normally, so generic downloads are not completely broken. Determine whether this is an app bug (classic: download triggered inside a Forge iframe / Custom UI without a user-gesture-safe download, wrong blob URL, sandbox, wrong resolver payload, button no-op, etc.) and fix it if so. If it is only a test-harness / browser limitation, say so clearly and do not change working export code just to guess. Add a test for the export path you touch.

### 5. Phase 0 findings (fix these too)

From `/workspace/radrly/accessradar/e2e/2026-11-11-phase-0/report.md`:

1. Exceptions page shows raw account IDs in Subject / Granted by, and a numeric project ID instead of the space name / ARTEST in Space/Group. Resolve and display names (and the project key/name). Handle missing/unknown names safely without leaking raw IDs in the primary columns if a display name can be resolved; if a name cannot be resolved, use a clear fallback that is still acceptable in the UI, and test that path. Do not log accountIds.
2. Rovo answers say "campaigns" where they mean reviews, and label app integrations as `user` in the subject table even when the prose identifies them as apps. Prefer "reviews" for review sessions; do not conflate campaigns (recurring scheduled runs) with signed reviews. Label apps as apps, not `user`. Update Rovo prompt/copy and tests (including payload shapes).
3. Invalid typed dates are refused by reverting to the last valid date, but there is no visible validation message. Show a clear, visible validation message when the typed date is invalid. Use ADS field error under the field, not a custom control.

### 6. Marcin's decisions (11.11 19:57) — apply these; they close the open questions from the layout-conformance work

1. Every panel uses the right-side sidebar panel (the current right-edge panel pattern). Keep that pattern and make it consistent everywhere. Do not switch panels to a left-anchored ADS drawer. Update `docs/layout-conformance.md` / rules if they still treat the right-edge panel as an open question or a violation.
2. The skeleton loader covers the whole page (the current full-page skeleton before Forge context loads is the intended behaviour). Keep it consistent; do not replace it with a compact issue-panel loader. Document this as accepted if the conformance doc still flags it.
3. Date fallback is **en-US**, not en-GB. When the Jira locale is missing or invalid, fall back to en-US. Update tests that still expect en-GB as the fallback.
4. Dates that are **displayed** and dates that are **typed into inputs** must always follow the user's Jira locale (not day-first only, not a hard-coded English day-first parser). If the locale is month-first (en-US), typed `12/1/2026` is 1 December? No: it is December 1. If the locale is day-first, typed `12/1/2026` is 12 January. ISO `YYYY-MM-DD` should still be accepted. Calendar mouse selection stays. Invalid dates still get a visible validation message (item 5.3). Add tests for at least en-US and a day-first locale, plus ISO, plus invalid input.

### 7. RELEASE_FLAGS

There is (or was) an empty `RELEASE_FLAGS` file, raised as an open question for parity with MarginRadar. Investigate what this file is for (in this repo and, if needed, in the layout standard / MarginRadar). In your final report, explain its purpose and recommend whether to keep, add, or remove it. Do **not** make a risky change: do not delete a file that could be part of a documented standard or a future release-flag workflow unless it is clearly unused, empty, and safe. If you leave it as-is, say why.

## Docs and PR

- Update `docs/layout-conformance.md` so the accepted decisions and the fixes are reflected (status / evidence / fix). Do not rewrite the whole document.
- You may add a short `docs/e2e/` note about the fixes if useful; do not invent a new living checklist unless you are updating existing expected copy/steps that would otherwise be wrong.
- PR title: clear, e.g. `fix: phase 1 E2E failures and locale/panel decisions`.
- PR body must list each fix and its root cause (not just the symptom). Mention no manifest/scope/egress changes, that it is development-only so far, and `[skip ci]`. Do not merge.

## Final output (print all of this)

1. PR URL, branch, commit SHAs and subjects.
2. Per-item fix + root cause for items 1–7 (including the RELEASE_FLAGS recommendation and whether you changed the file).
3. Test counts (files / tests) and the result of format, lint, typecheck, build:ui, `forge lint`.
4. `forge eligibility -e development` exact relevant output.
5. Whether development was deployed, and the dev version if so. If not deployed, the exact reason.
6. Manifest diff vs origin/main (must be empty).
7. Anything unresolved or any follow-up for Marcin.
