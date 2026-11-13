# C5 Recheck E2E, dev

11 PASS, 0 FAIL of 11


| Step | What | Result | Note |
|---|---|---|---|
| 2 | Create two ARTEST reviews on snapshot A | PASS |  |
| 3 | No recheck while access is unchanged; Keep all decides every item | PASS | ok |
| 4 | Simulate an access change (dev-only hook in Settings, Developer spike; Jira free plan blocks role edits) | PASS | hook run |
| 6 | Review shows Recheck: banner, pill, Sign off disabled | PASS | banner+pill, sign disabled |
| 7 | Filter "Recheck" and row detail text | PASS | ok |
| 8 | Bulk Keep all does not confirm stale items | PASS | bulk label shown |
| 9 | Standard: Recheck shown too | PASS | ok |
| 10 | Dark: Recheck banner and pill | PASS | ok |
| 11 | Re-decide the stale item (Keep): recheck cleared | PASS | cleared |
| 12 | Sign off now possible (server and UI) | PASS | signed |
| 14 | Regression: Overview, Reviews, Campaigns load | PASS | ok |
