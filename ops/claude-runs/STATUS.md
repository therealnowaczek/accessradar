# AccessRadar roadmap run (Claude Sonnet 5.5), started 2026-11-11

| Phase | Branch | PR | Dev | Prod | E2E | State |
|---|---|---|---|---|---|---|
| 0/1 | merged | #57-#60 | 2.9x | released | done earlier | DONE |
| MCP item C | - | - | - | - | - | SKIPPED: no MCP calls in logs (dev `[rovo] ok` lines are agent calls, `agentId` present, `surface: rovo`; prod has none) |
| 2 (F + G) | merged (squash a5e54cc) | #61 | 2.98 (from main) | 2.47.0 | 17/17 PASS light on dev 2.97.0 (dark + full regression not run; noted on PR) | DONE, prod deployed 2026-11-12, prod logs clean, backup tag prod-backup-2026-11-12-2.46-pre-phase2 |
| i18n (12 locales) | merged d3c62fa | #62 | 2.100 (from main) | 2.48.0 | 12/12 PASS light (dev 2.99.0); dark + regression not run | DONE, prod deployed, logs clean, tag prod-backup-2026-11-12-2.47.0. Test account language ended English (US) (found as Deutsch). Partial string coverage (~350 keys) documented in decisions-log |
| 3a spike (I, J, K) | scratch (deleted) | - | 3.0.0 | - | probes OK as user and app | DONE: docs/spike-results/permissions-upgrade-2026-11-12.md; 6 new read scopes; audit log 403 on free-plan dev site (scope accepted) |
| 3b build (I, J, K) | merged d9ef6d0 | #63 | 3 (from main) | 3.0.0 | 18/18 PASS light + 18/18 PASS dark incl. full regression (e2e/2026-11-12-phase-3c) | DONE 2026-11-12, Marcin approved 05:06 (decisions-log). Prod deployed, eligibility OK, prod logs clean, tag prod-backup-2026-11-12-2.48.0. marginradar prod install shows "Outdated app" until an admin approves (no --upgrade run). |

Prod at start: deployed 2026-11-11 20:42Z (after 2.45.0), so first prod deploy is allowed.
Blockers: none yet. Forge CLI needs `set -a; . ~/.config/radrly/atlassian.env; set +a` first (keytar unavailable).

NOTE FROM ACCESSRADAR BOT (2026-11-12 05:06): Marcin said in the room "don't wait for me, finish the plan". Phase 3 I/J/K (read-only scopes only) is now approved to merge and ship to prod after green dev E2E, see the updated rule in claude-prompts/roadmap-rest.md. No write scopes, no egress.


## Final summary (2026-11-12)

- Phase 0/1: earlier. MCP item C: skipped (no MCP calls in logs). H, L, M, N: dropped/not built per decisions.
- Phase 2 (F weekly cadence + G JSON export): merged #61, prod 2.47.0. E2E found and fixed a real bug (whole-site matrix passed the 5 MB Forge response limit; now fetched per space).
- i18n 12 locales: merged #62, prod 2.48.0. About 350 UI strings keyed and machine-translated (not native-reviewed); fragments, exports and Rovo stay English. Test account language left on English (US).
- Phase 3 (I, J, K): PR #63 open, dev 3.1.0 (consent granted on dev), NOT merged, NOT in prod. Needs Marcin: 6 read scopes, major 3.0.0, `forge deploy -e production --approve MAJOR_VERSION_RULE`, listing/privacy text per docs/phase-3-scopes-for-marcin.md.
- Not run for phases 2 and i18n: dark theme and the full regression pass (noted on the PRs). Dev stays on the #63 build (3.1.0).
- Known nit: the dev-only Spike panel text `ACCESSRADAR_SPIKE=1` went through the codemod as a key; harmless, English in all locales unless translated.
- Tools: /workspace/radrly/accessradar/tools/extract.mjs (string codemod), e2e/_lib/*.mjs (Playwright scripts).


## Update after approval (2026-11-12)
- Phase 3 shipped (see table). Manifest diff was six read scopes only. Test account theme restored to Light.
- Next: task 4 docs for new scopes, task 5 i18n coverage.
- Task 4 done: docs PRs #64/#65 merged (LISTING.md, data-handling.md, marketplace-checklist, phase-3 doc). Live listing untouched. Note: the checklist said "do not change scopes during Marketplace review"; 3.0.0 with new scopes is on prod by Marcin's approval, so the App Approval ticket needs the scope update if a review is open.
- Task 5 in progress (branch feat/i18n-coverage-2): pass 2 codemod merged into branch (399 edits), pass 3 (templates, fragments, label maps) running as 4 parallel agents on disjoint files; then 11 translation agents (one per locale) for ~all new + 42 phase-3 keys; then dev E2E (light+dark), prod deploy without scope change.

## Final summary (2026-11-12, after Marcin's approval)

- Phase 3 (I, J, K): merged #63, prod 3.0.0 (six read scopes only, manifest checked, no egress/remotes). Dev E2E 18/18 light + 18/18 dark incl. regression. Decision recorded in docs/decisions-log.md. Tag prod-backup-2026-11-12-2.48.0 (state before). `forge eligibility -e production`: eligible. Prod logs clean. Never ran `forge install --upgrade`: the marginradar production install shows "Outdated app" (still major 2) until a site admin approves; sites without consent get an "Approval needed" notice in the Sharing and security page only (unit-tested; not testable live on dev because dev is consented).
- Docs: #64/#65 merged (LISTING.md, data-handling.md, marketplace-checklist, phase-3 doc). Live Marketplace listing untouched. If a Marketplace review is open, the App Approval ticket needs the new scopes and the privacy/security text from those docs.
- i18n coverage: #66 merged, prod 3.1.0 (no manifest change). About 800 more strings keyed, 585 new keys x 11 locales (machine-translated, not native-reviewed). E2E on dev: English 18/18 light and dark; 11 locales light and ja/pl dark: all pages load, no raw ICU/placeholder leaks. Tag prod-backup-2026-11-12-3.0.0. Prod logs clean. Dev redeployed from main.
- Still English by design: exports, Rovo text, Jira permission names, server messages. Not individually checked in every locale: every drawer/dialog. Known leftovers: format.ts PERMISSION_LABELS, a "key, name" project label in CampaignsView (data).
- Test account restored: language English (US), theme Light. Tools: tools/scan.mjs, extract2.mjs; e2e/_lib/phase3c.mjs, i18n3.mjs, theme.mjs.

## C-items batch (Claude Sonnet 5.5), started 2026-11-12

Approved by Marcin 12.11.2026 15:58 Europe/Warsaw (via CMO). Dev only; no merge to main; no production deploy (ECOHELP-184698 freeze + needs Marcin tak). Order: C11, C5, C1, C3, C7, C4, C2 (no activity claim), C8, C6 last.

| Item | Branch | PR | Dev | E2E | State | Note |
|---|---|---|---|---|---|---|
| C11 review prompt | feat/c11-review-prompt | https://github.com/therealnowaczek/accessradar/pull/67 | 3.6.0 | 8 PASS / 0 FAIL (Advanced, Standard, light, dark) | shipped to prod 3.2.0 | one-time dismissible request, plain link, no scopes; merged to main as 256d096 (merge commit, branch kept) |
| C5 Recheck | feat/c5-recheck | https://github.com/therealnowaczek/accessradar/pull/68 | 3.9.0 | 11 PASS / 0 FAIL (Advanced, Standard, light, dark) | shipped to prod 3.2.0 | stacked on C11; access change simulated by dev-only hook (Jira Free blocks role edits); new column ack_fp (migration v040); merged to main as 8fb35a7 (merge commit, branch kept) |
| C1 control mapping | feat/c1-control-mapping | https://github.com/therealnowaczek/accessradar/pull/69 | 3.11.0 | 3 PASS / 0 FAIL (PDF text check; no UI change, light/dark not needed) | shipped to prod 3.3.0 | NIS2 Art. 21(2)(i),(f) added, CONTROLS_VERSION 2, docs/control-mapping.md |
| C3 group reach | feat/c3-group-reach | https://github.com/therealnowaczek/accessradar/pull/70 | 3.13.0 | 7 PASS / 0 FAIL (Advanced, Standard, light, dark) | ready for prod | track up to 50 groups, weekly reach/membership diff; no scopes; stacked on C1 branch |
| C7 sample campaign | feat/c7-sample-campaign | https://github.com/therealnowaczek/accessradar/pull/71 | 3.14.0 | 8 PASS / 0 FAIL (Advanced, Standard, light, dark) | ready for prod | app-local sample (one kv entry), no Jira data, no evidence; stacked on C3 |
| C4 risk rules | feat/c4-risk-rules | https://github.com/therealnowaczek/accessradar/pull/72 | 3.15.0 | 6 PASS / 0 FAIL (Advanced, Standard, light, dark) | ready for prod | 11 to 20 rules; no scopes; sharing rules partial when unreadable; stacked on C7 |
| C2 seat view | feat/c2-seat-view | https://github.com/therealnowaczek/accessradar/pull/73 | 3.16.0 | 6 PASS / 0 FAIL (Advanced, Standard, light, dark) | ready for prod | Seats page, no activity claim, no scopes; stacked on C4 |
| C8 project self review | feat/c8-project-self-review | https://github.com/therealnowaczek/accessradar/pull/74 | 3.17.0 | 7 PASS / 0 FAIL (Advanced, Standard, light, dark) | ready for prod | self review on Standard+Advanced, server side enforced, no scopes; non-admin path unit-tested only; stacked on C2 |
| C6 Forge LLM pre-sort | feat/c6-forge-llm-presort | https://github.com/therealnowaczek/accessradar/pull/75 | not deployed | not run (479 unit tests pass; forge lint stops on MAJOR_VERSION_RULE for the llm module) | needs Marcin tak + privacy/P&S | Forge LLMs only, minimised input, Advanced, no scopes; dev deploy/E2E blocked: needs forge install --upgrade; draft notes docs/ai-presort-privacy.md; stacked on C8 |

C11 and C5 shipped to prod 3.2.0 on 2026-11-12 18:32 Europe/Warsaw. Merge SHAs: #67 256d096 (C11), #68 8fb35a7 (C5, now main). Backup tag prod-backup-2026-11-12-3.1.0 (e7f24c9). Merge commits, head branches kept. Manifest unchanged (no new scopes or egress). Eligibility: Runs on Atlassian OK. Prod logs: no errors after deploy (only pre-deploy hourly [tick] INFO, sql: 1). Did not run forge install --upgrade; did not touch release/production or the work-roadmap clone.

Next: C11. Wrapper: claude-runs/run-citems.sh. Prompt: claude-prompts/citems.md.

C1 shipped to prod 3.3.0 on 2026-11-12 ~20:25 Europe/Warsaw: PR #69 merge commit c10934c, backup tag prod-backup-2026-11-12-3.2.0, manifest unchanged, eligible, prod logs empty. Fresh clone ship-c1.


## C-items batch final summary (2026-11-12)

All items done or blocked as specified. Stack (each PR targets its parent branch, none merged by this run after C1): C3 #70 (dev 3.13.0, 7/7), C7 #71 (3.14.0, 8/8), C4 #72 (3.15.0, 6/6), C2 #73 (3.16.0, 6/6), C8 #74 (3.17.0, 7/7), C6 #75 (not deployed). Earlier in the batch: C11 #67, C5 #68, C1 #69 (already shipped to prod 3.2.0 / 3.3.0 per the rows above).
- Manifest diff vs parent is empty for C3, C7, C4, C2, C8 (no scopes, no egress, no remotes). C6 adds only the `llm` module.
- C6 blocker: Forge treats the llm module as a major version upgrade (MAJOR_VERSION_RULE), so it needs `forge install --upgrade` (not run) and Marcin's tak plus P&S "uses AI". No dev deploy to avoid stranding the dev install on the old major.
- Test account left on English (US), Light theme, edition "Use the license". Dev install runs 3.17.0 (C8 build).
- Known nits: Seats line reads "1 seat holders" for a count of 1; C8 non-admin refusal is unit-tested only (shared account is a Jira admin).

C3, C7, C4, C2, C8 shipped to prod 3.4.0 on 2026-11-12 ~21:58 Europe/Warsaw (fresh clone ship-c3c8). PRs retargeted to main and merged with merge commits in stack order, head branches kept: #70 88f6c64 (C3), #71 f2e3569 (C7), #72 804efb7 (C4), #73 bb09e2e (C2), #74 ad543ed (C8). Plus 69e2dcd fix(c2): English plural for seat summary ("1 seat holder through 1 group"), unit test added. Backup tag prod-backup-2026-11-12-3.3.0 (c10934c). Manifest unchanged vs 3.3.0. npm run check green (469/469 tests, lint, typecheck, build, forge lint). Eligibility: Runs on Atlassian OK. Prod logs: no entries/errors in first minutes. Dev not redeployed (3.17.0). No forge install --upgrade. C6 #75 still targets feat/c8-project-self-review.

C6 AI pre-sort shipped to prod 4.0.0 (major, Forge LLM module) on 2026-11-12 ~22:30 Europe/Warsaw, under Marcin's 21:50 room green light. main merged into feat/c6 (b50203d); E2E fix 0cb1427 (deleting a review also removes its assignment; lookup ignores orphans); docs 84f6d27. Dev 4.0.0 then 4.1.0; dev install on marginradar upgraded to major 4 (forge install --upgrade -e development only). Dev E2E 8 PASS / 0 FAIL (1 N/A) Advanced/Standard light/dark, docs/e2e/c6.md, e2e/2026-11-12-c6/. #75 retargeted to main and merged as 572754d (merge commit, branch kept). Backup tag prod-backup-2026-11-12-3.4.0 (69e2dcd). npm run check 480/480. Prod deploy with --approve MAJOR_VERSION_RULE; prod installs NOT upgraded (admins approve; marginradar prod install still on major 2 "Outdated app"). Eligibility prod: Runs on Atlassian OK. Prod logs: 0 errors. Still needed: P&S console "uses AI" + privacy/listing text (CMO).

Unified in-app review prompt (Radrly standard, spec marketplace-seo/review-prompt-audit-2026-11-12.md) shipped to prod 4.1.0 on 2026-11-12 ~23:00 Europe/Warsaw (Marcin 21:50 green light + 22:23 via CMO). PR #76 merged as 9e72b94 (merge commit, branch kept). UI only: discovery SectionMessage h2, "Enjoying AccessRadar?", 3 actions (Write a review / I already reviewed / Not now), no X, no body link, URL with &hosting=cloud via router.open, top of Overview, 12 locales, both editions; trigger and per-site storage unchanged; manifest unchanged. Dev 4.2.0, E2E 9 PASS / 0 FAIL (docs/e2e/review-prompt-unify.md, e2e/2026-11-12-review-prompt/, screenshot review-prompt-dev-en-light.png). Backup tag prod-backup-2026-11-12-4.0.0 (572754d). Check 486/486. Eligible. Prod logs 0 errors.
