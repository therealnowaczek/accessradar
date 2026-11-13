# AccessRadar: unify the in-app Marketplace review prompt (UI only), dev + E2E

Repo clone: /workspace/radrly/accessradar/ship-c3c8, branch feat/review-prompt-unify (from main 572754d, prod 4.0.0). Spec (read first, follow exactly): /workspace/radrly/marketplace-seo/review-prompt-audit-2026-11-12.md, sections "Proposed shared standard" 1 to 8. Existing code: static/app/src/views/ReviewPrompt.tsx, OverviewView.tsx, SpikePanel.tsx, api.ts, i18n en.ts + locales/*.json, server side review-prompt kv (SQL kv key `review-prompt`, record {state, at}).

Scope (UI only):
- KEEP the existing C11 trigger logic and the server storage (per site, `{state:'dismissed'|'done', at}`, no account ids, first answer wins). Do not change manifest.yml or scopes.
- One Atlaskit SectionMessage, appearance="discovery", headingLevel="h2", no isDismissible X, no link in the body, three SectionMessageActions: "Write a review" (stores done, opens URL via router.open with preventDefault), "I already reviewed" (done), "Not now" (dismissed). Hide immediately after any answer, permanently.
- Copy EN: title "Enjoying {appName}?", body "A short review on the Atlassian Marketplace helps other teams find it. It takes about a minute, and nothing in {appName} depends on it." appName = AccessRadar. Keep existing key names if convenient (reviewPrompt.*), but update the wording and the "I already did" label to "I already reviewed". Translate title/body/buttons in all 11 locale JSON files (de-DE, es-ES, fr-FR, it-IT, ja-JP, ko-KR, nl-NL, pl-PL, pt-BR, zh-CN, zh-TW) natively and naturally, same meaning. Keep {appName} placeholder parity (i18n tests).
- URL exactly: https://marketplace.atlassian.com/apps/3691498947/accessradar-access-review-permission-audit-for-jira?tab=reviews&hosting=cloud (no UTM).
- Placement: top of the Overview page body, directly below the page header, above metrics/tables/notices (only a blocking error or licence banner may be above it; move the snapshot-progress notice below it if needed). The trigger's first-value moments are a signed review (sign-off path, excluded) or a second snapshot; do not mount on Reviews detail, sign/submit/sign-off, approval, exception or delete paths. Mount on Overview only unless a non-excluded first-value screen exists; record the placement decision in docs/decisions-log.md.
- Both editions, no tracking, no analytics call.
- Remove any leftover usage of old copy; update unit tests (add/adjust tests for URL, copy, three actions, no X).

Rules (hard):
- Auth: before any `forge` command run `set -a; . /home/box/.config/radrly/atlassian.env; set +a`. Never print that file, tokens, or $CLAUDE_CODE_OAUTH_TOKEN. Never extract or copy cookies or the session file.
- Allowed forge: `forge deploy -e development --non-interactive`, `forge lint`, `forge eligibility -e development`, `forge logs -e development`. Forbidden: anything with `-e production`, any `forge install`, pushing to main, tags, merges. If forge reports a major version rule, STOP and write RESULT: RED.
- `npm run check` must be green before dev deploy.
- Commits with [skip ci] (git user is configured), push only `origin feat/review-prompt-unify` (never force). Open a PR to main titled "feat: unified in-app review prompt (Radrly standard) [skip ci]" with gh, do not merge.
- E2E only on https://marginradar.atlassian.net development install ("Dev" label), AccessRadar admin pages, ARTEST project only for any test data, own data only. Playwright helpers /workspace/radrly/accessradar/e2e/_lib/lib.mjs and theme.mjs; storageState /home/box/.config/radrly/lr-e2e-state.json (read only). Editions via Settings > Edition > Override, end on "Use the license". Restore English (US) and Light at the end.
- To make the prompt visible you may reset ONLY the app's own `review-prompt` kv record on the dev install (e.g. via an existing dev-only hook gated by spikeAllowed, or a new dev-only resolver gated the same way; never in production). Record the original value and leave it dismissed or done at the end as found, or deleted if it was absent and then answered by the test.

E2E cases (PASS/FAIL each): 
1. Advanced, EN, light: prompt at top of Overview with exact title/body/3 buttons, no X, no body link. Save a screenshot to /workspace/radrly/accessradar/review-prompt-dev-en-light.png (crop or full page, prompt clearly visible).
2. Standard, EN, light: prompt shown too.
3. Dark theme renders correctly (screenshot in the e2e folder).
4. One non-English locale (pl-PL) shows translated text (screenshot), then back to English.
5. "Write a review" calls router.open with the exact URL (verify the opened tab/new page URL or intercepted navigation; do not post a review) and hides the prompt.
6. Dismiss persists: reset, press "Not now", reload Overview and navigate away and back: prompt stays hidden; also "I already reviewed" hides it after reload.
7. Absent on sign/submit/sign-off paths: open an ARTEST review detail and its sign-off/submit dialog (do not actually sign a real review unless it is your own test review, then delete it): no prompt there. Also not on Reviews list, Exceptions, Settings.
8. `forge logs -e development --since 30m`: no new errors. 9. `forge eligibility -e development`: Runs on Atlassian.
Note: Jira itself emits "Cannot use import.meta outside a module" page errors on every page; ignore that one.

Output: screenshots + report.md in /workspace/radrly/accessradar/e2e/2026-11-12-review-prompt/, docs/e2e/review-prompt-unify.md with plan, results table, "N PASS / M FAIL", dev version. Commit and push. Post the table as a PR comment. Finally write /workspace/radrly/accessradar/e2e/2026-11-12-review-prompt/DONE with the table, PR number, dev version, and final line `RESULT: GREEN` or `RESULT: RED <reason>`. Fix FAILs, redeploy dev, rerun. Do not ask questions.
