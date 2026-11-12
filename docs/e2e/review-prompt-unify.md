# AccessRadar unified review prompt, dev E2E (2026-11-12)

Dev version: **4.2.0** (development, marginradar.atlassian.net), PR #76, branch feat/review-prompt-unify.

**9 PASS / 0 FAIL**

| # | Case | Result | Evidence |
|---|---|---|---|
| 1 | Advanced, EN, light: prompt first block of Overview body, exact title/body, 3 actions, no X, no body link | PASS | `review-prompt-dev-en-light.png`, `1-advanced-light-full.png` |
| 2 | Standard, EN, light: prompt shown | PASS | `2-standard-light.png` |
| 3 | Dark theme renders correctly | PASS | `3-dark.png` |
| 4 | pl-PL shows translated title, body and 3 actions, then back to English (US) | PASS | `4-pl-PL.png` |
| 5 | "Write a review" opens the exact URL via router.open (request stubbed, no review posted), prompt hides | PASS | opened `https://marketplace.atlassian.com/apps/3691498947/accessradar-access-review-permission-audit-for-jira?tab=reviews&hosting=cloud` |
| 6 | "Not now" persists after reload and nav away/back; "I already reviewed" hides and persists after reload | PASS | `6a-after-not-now.png` |
| 7 | Absent on Reviews list, review detail, sign-off dialog (own test review, cancelled, then deleted), delete dialog, Revoke dialog, Start-review drawer, Exceptions, Settings | PASS | `7-*.png` |
| 8 | `forge logs -e development --since 30m`: no errors | PASS | 92 log lines, no ERROR or WARN |
| 9 | `forge eligibility -e development`: Runs on Atlassian | PASS | app 4.2.0 eligible |

## Plan
1. Dev-only reset of `review-prompt`. 2. Advanced and Standard, light, English. 3. Dark. 4. pl-PL and back. 5. Write a review opens the exact URL. 6. Not now / I already reviewed persist. 7. Absent on sign, submit, delete, revoke, list, exceptions and settings paths. 8. forge logs. 9. forge eligibility.

## Notes
- Overview placement: the prompt is the first block under the page header; the change-alert and snapshot-failure notices sit below it.
- Test data: the review-prompt kv record was reset only through the existing dev-only hook (Settings, Developer spike, gated by spikeAllowed). The original value could not be read back; the prompt was hidden before the first reset (answered by the earlier C11 run, which left it done). Final state: **done** (answered via "I already reviewed").
- Case 7: the existing ARTEST review had a stale decision (C5 recheck) and cannot be signed, so an own ARTEST review "E2E review-prompt NNNNNN" was created, decided with Keep all, the sign-off dialog was opened and cancelled (nothing signed), then the review was deleted.
- Final environment: edition "Use the license", theme Light, language English (US).
- Jira's own "Cannot use import.meta outside a module" page errors were ignored.
- Scripts: `e2e/_lib/review-prompt.mjs` (parts a, b, c, e).
