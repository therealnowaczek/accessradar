# C6 AI pre-sort E2E, dev

8 PASS, 0 FAIL of 8

Note: Jira itself emits "Cannot use import.meta outside a module" page errors on every page, also with no app loaded (verified on /jira/your-work); excluded from step 7.

| Step | What | Result | Note |
|---|---|---|---|
| 0 | Setup: Advanced edition, start self review of ARTEST (own test data) | PASS | ok |
| 1 | Advanced light: Suggest review order (AI): pills + reasons, nothing decided | PASS | pills 24; state {"status":"Draft","decided":"Decided\n2"} |
| 2 | Reasons: no names, emails, account ids, activity claims | PASS | 24 reasons checked |
| 3 | Advanced dark: view renders, pills readable | PASS | ok |
| 4 | Standard light: no Suggest button; resolver refused | PASS | no button; server refusal via test/presort.test.ts (Advanced-only gate) |
| 5 | Standard dark: renders without button | PASS | ok |
| c | Cleanup: delete test self reviews | PASS | deleted 1 |
| 7 | Regression: Reviews, Seats, Overview, Settings load without page errors | PASS | ok |
| 6 | LLM failure path | N/A | not observed; unit tests (test/presort.test.ts) |
| 8 | forge logs -e development --since 30m | PASS | 92 lines, 0 errors, no group names/reasons/prompt text |
| 9 | forge eligibility -e development | PASS | 4.1.0 eligible for Runs on Atlassian |

Final: 8 PASS / 0 FAIL (1 N/A) over the plan cases. First run had 1 FAIL (orphaned assignment after review delete), fixed in 4.1.0 and rerun.
