You are building the approved AccessRadar competitor-research roadmap items, one at a time, on development only. AccessRadar is a Radrly Atlassian Forge app for Jira (read-only access review, Runs on Atlassian, zero egress, Rovo agent). Repo: github.com/therealnowaczek/accessradar. Working clone: the current directory (/workspace/radrly/accessradar/work-roadmap).

Marcin approved this build on 12.11.2026 at 15:58 (Europe/Warsaw), via the CMO, in this strict order. Do not start any item that is not in this list. Do not build C9 (rejected, egress), C10 (CMO-owned listing work), or C12 (not doing; app stays read-only).

Read first, and keep referring back:
- /workspace/radrly/accessradar/roadmap-plan-2026-11-11.md section "Competitor research proposals 2026-11-12"
- /workspace/radrly/marketplace-seo/competitors-2026-11/accessradar.md (proposal details)
- /workspace/radrly/marketplace-seo/competitors-2026-11/CMO-decisions-2026-11-12.md
- /workspace/radrly/layout-standard.md, /workspace/radrly/i18n-plan.md
- repo AGENTS.md, .cursor/rules/accessradar-ui.mdc, docs/layout-conformance.md, docs/decisions-log.md, docs/e2e/phase-3.md
- Existing code you will extend, not replace: src/domain/controls.ts (SOC 2 / ISO mapping already exists at control level; C1 adds NIS2 and a docs page), src/engine/risk.ts, src/engine/review.ts, src/domain/campaignSchedule.ts, src/lib/projectAuth.ts, docs/demo-data-plan.md
- Playwright helpers from earlier runs: /workspace/radrly/accessradar/e2e/_lib/lib.mjs (site, app id, storageState, openApp, setEdition, nav). Reuse them.

State now: main is at the 3.1.0 i18n coverage commit, in sync with origin, production is 3.1.0. Prod deploys are FROZEN (Marketplace P&S review ECOHELP-184698 is open, and prod still needs Marcin's own "tak"). You will not merge to main and you will not deploy production.

============================================================
HARD RULES (never break these)
============================================================

- Model is already selected by the wrapper (`claude -p ... --model claude-sonnet-5-5`). Do not switch models.
- Auth: before any `forge` command, run `set -a; . /home/box/.config/radrly/atlassian.env; set +a`. Never print that file, never print tokens, never print `$CLAUDE_CODE_OAUTH_TOKEN`, never extract cookies, never copy the Playwright session file elsewhere.
- DEV ONLY. Allowed: `forge deploy -e development`, `forge lint`, `forge eligibility -e development`, `forge logs -e development`. Forbidden: `forge deploy -e production`, any production tag (including prod-backup-*), `forge install --upgrade` on any site (including the dev install), any merge to main (main can trigger prod work later). Each item ends at: green dev E2E + open PR (not merged) + a STATUS.md row marked "ready for prod".
- E2E only on https://marginradar.atlassian.net, development install (look for the "Dev" label), project ARTEST ("AccessRadar E2E") only. Own test data only. Do not change other apps' data, other spaces, MarginRadar settings, or the shared account's language/theme except for the temporary E2E switches below. Playwright storageState: /home/box/.config/radrly/lr-e2e-state.json. Write the plan and results into docs/e2e/<item>.md. Screenshots under /workspace/radrly/accessradar/e2e/<date>-<item>/ plus a report.md there. Test Standard and Advanced via Settings > Edition > Override and end on "Use the license". Where UI changed, cover light and dark. Restore the test account to language English (US) and Light theme when you finish an item. Check `forge logs -e development --since 30m` for new errors. Fix FAILs, redeploy dev, rerun. Post the PASS/FAIL table as a PR comment.
- If an item needs a NEW scope, a manifest egress/remote/external-permission change, or would break Runs on Atlassian / zero egress: do not add the scope or egress. Stop that item with a short design note in STATUS.md and in the (unmerged, or unopened) branch, then skip to the next item.
- C6 is last and special: it must stay inside Forge LLMs / Runs on Atlassian, zero egress, minimised attributes only. No external LLM. If it needs new scopes or a "uses AI" declaration, you may still build and deploy on development and open the PR, but mark the STATUS row "needs Marcin tak + privacy/P&S" (not a plain "ready for prod"). Do not run `forge install --upgrade` even on dev; if deploy requires it, stop short of that command, leave the code in the PR, and record the blocker. C6 waits for Marcin's "tak" before any release.
- i18n: any new UI string must be added in all 12 locales: en-US, de-DE, ja-JP, fr-FR, es-ES, pt-BR, pl-PL, ko-KR, it-IT, nl-NL, zh-CN, zh-TW. Locale comes from the user's Jira settings, EN fallback; zh/zh-SG/zh-MY to zh-CN; zh-HK/zh-MO to zh-TW. No language switcher. Dates (display and typed input) follow the user's locale, en-US fallback. Machine translation is OK; keys and placeholders must match; no native review required. Rovo/agent prompts stay English unless a no-permission translations approach already exists.
- UI: Atlaskit / ADS only, MarginRadar layout is the reference, every panel in the right-side sidebar panel, full-page skeleton, modal primary button on the right, drawer/fullscreen primary on the left, sticky header needs separator + fade. No em dashes (U+2014) in UI copy, commits, or PR text. Never call Radrly small.
- Git: one branch and one PR per item. Commit messages end with `[skip ci]`. Push often so a box restart loses nothing. Never force-push, never rewrite pushed history. Never touch branches `release/production` or `wip/local-2026-10-12`. PR titles also include `[skip ci]`.
- Quality: `npm run check` (format, lint, typecheck, tests, build) and `forge lint` green before you push the PR. Add or extend unit tests for the behaviour you add. `forge eligibility -e development` must stay Runs on Atlassian eligible. Show in the PR that the manifest permissions/egress/remotes diff vs the parent branch is empty, except C6 if a Forge LLM module is genuinely required (then call it out clearly).
- Do not change the live product site, Marketplace listing, pricing, Editions, or Privacy & Security console. In-repo docs (docs/*) are allowed. For C1, the "docs page" is in-repo documentation, not accessradar.radrly.com.
- Do not kill, pkill, or otherwise stop other bots' `claude` processes. Other products are running chains on this box.
- Do not stop to ask questions. Decide in Radrly's best interest, write the decision into docs/decisions-log.md, and keep going. If Forge, git, or Playwright fails in a way you cannot fix, record it in STATUS.md and move on to the next item you can do.

============================================================
BRANCHING AND PRS
============================================================

Items may stack if needed, but PRs stay separate.
- Start each item on a new branch named `feat/c11-review-prompt`, `feat/c5-recheck`, `feat/c1-control-mapping`, `feat/c3-group-reach`, `feat/c7-sample-campaign`, `feat/c4-risk-rules`, `feat/c2-seat-view`, `feat/c8-project-self-review`, `feat/c6-forge-llm-presort`.
- Because PRs are not merged, branch item N+1 from the branch of the last successfully completed item (green E2E + open PR), so the work composes. If an item was skipped, do not stack on it; use the last successful branch, or origin/main if nothing has shipped yet.
- Open each PR against its parent branch (so the PR diff is just that item). Do not open a PR against main that would require merging, and do not squash-merge anything into main.
- After a resume, do not `git checkout main` and do not `git reset --hard`. Read STATUS.md, `git status`, and open PRs, then continue the current item or start the next unfinished one.

============================================================
ORDER (strict, one item at a time)
============================================================

Finish item N (check green, dev deploy, eligibility, E2E, open PR, STATUS.md row, PR comment) before starting item N+1.

1) C11. In-app review request after first value (internal priority, not on the public roadmap).
   - After first value (for example the first completed review campaign, or the first useful signed snapshot if no campaign exists), show a site admin once a dismissible Atlaskit SectionMessage or flag asking for a Marketplace review.
   - Plain link only, to the AccessRadar Marketplace review page for app 3691498947 (https://marketplace.atlassian.com/apps/3691498947/accessradar-access-review-permission-audit-for-jira, reviews tab). No tracking, no Marketplace API, no egress, no incentives (Marketplace rules).
   - Remember dismissal or "done" per site in storage. Never block a review, remediation, or sign-off path.
   - No new scopes. No manifest permission change.

2) C5. "Recheck" state.
   - A keep/revoke/exception decision goes stale if that user's access changed after the decision (use the existing snapshot-bound reviews and hash).
   - The round cannot close until stale decisions are re-decided.
   - No new scopes. Fits existing review flow. Good audit value; keep the copy precise.

3) C1. Control mapping in the evidence pack, plus an in-repo docs page.
   - Evidence pack already maps SOC 2 CC6.1-CC6.3 and ISO 27001:2022 A.5.15 / A.5.18 / A.8.2 in src/domain/controls.ts. Keep and tighten that control-level mapping if needed, and add NIS2 Art. 21.
   - Add a docs page in the repo (not the marketing site).
   - Wording stays "supports evidence", never "compliant" / "makes you compliant". No scopes, no egress. Bump CONTROLS_VERSION if the copy changes.

4) C3. Group-centric reach view with weekly tracked-group diff.
   - Group view and snapshot diffs already exist; this is a filter/presentation on top: which projects/spaces a group can reach, plus a weekly diff for tracked groups.
   - No new scopes.

5) C7. One-click sample review campaign on a fresh install (and available to try on a site that wants a demo).
   - In-app demo data only, clearly labelled as a sample, and deletable. No scopes. Do not seed or mutate real Jira users/groups/spaces for the sample; keep it inside the app.
   - Look at docs/demo-data-plan.md for story cues, but do not run the write seed against the shared site unless you are only touching ARTEST test data you created.

6) C4. More risk rules (from 11 toward about 20-25), including filters/dashboards shared broadly and spaces open to anyone.
   - Public filters/dashboards have been readable since 3.0.0, so new rules need no new scope. Design rules carefully to avoid false positives. Snapshot schema changes are allowed if backward compatible or migrated.
   - No new scopes.

7) C2. Seat view (NO activity claim).
   - Show which groups grant product access, their members, and potential licence savings.
   - Groups and application roles are already read (`read:application-role`, `read:group`). Do not claim "no recent activity", last login, or last-active. Last login is not exposed to apps; do not add `read:jira-work` or any new scope to proxy activity. Inactive stays the existing deactivated-flag meaning.

8) C8. Project-level self review (project admins review their own project).
   - Marcin approved building this. Packaging decision, to record in docs/decisions-log.md: make a scoped project-admin self review available on Standard (the approved "free entry" intent), reusing Advanced delegation patterns where they exist. Do not change listing, pricing pages, or Editions console copy.
   - Add/extend the project-admin UI permission check (see src/lib/projectAuth.ts). Server-side enforcement, not just UI. No new scopes.

9) C6. AI pre-sort for reviewers via Forge LLMs, LAST.
   - Advanced edition only. Minimised / pseudonymised attributes only: roles, group names, existing risk flags, and the existing deactivated/inactive flag. Do not send display names, accountIds, emails, or raw issue data. Do not invent last-login or "days since last active" if the app does not already have that field (it must not grow an activity claim).
   - Forge LLMs only, zero egress, stay Runs on Atlassian eligible. If this needs new scopes or a "uses AI" declaration: build and deploy on dev if possible without `forge install --upgrade`, open the PR, and mark STATUS "needs Marcin tak + privacy/P&S". Also draft in-repo privacy/P&S notes (docs only, do not edit the live listing). Lower priority, last on purpose.

============================================================
STATUS AND COMPLETION
============================================================

Keep /workspace/radrly/accessradar/claude-runs/STATUS.md up to date after every item (and after any skip or blocker). Append to the "C-items batch" section; do not delete earlier roadmap history in that file.

After each item, add or update a table row with: item, branch, PR URL, dev version, E2E result (PASS/FAIL counts, light/dark if run), state (`ready for prod`, `skipped: design note`, or `needs Marcin tak + privacy/P&S` for C6 when that applies), and a one-line note.

When the whole chain is finished (every listed item is either ready for prod, skipped with a design note, or C6 marked as above), write a short final summary into STATUS.md and write the file /workspace/radrly/accessradar/claude-runs/C-ITEMS-DONE with a brief report (items, branches, PR URLs, dev versions, E2E, skipped/blocked reasons). The wrapper looks for that file to stop retrying.

If this is a resume after a usage limit or interrupt: read STATUS.md and the working tree, then continue. Do not redo finished items. Do not reset the clone.
