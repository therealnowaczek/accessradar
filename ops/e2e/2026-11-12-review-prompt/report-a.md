# Review prompt E2E part a

6 PASS, 0 FAIL of 6


| Step | What | Result | Note |
|---|---|---|---|
| 0.reset | Dev-only reset of review-prompt kv (Settings > Developer spike) | PASS | reset; prompt hidden before reset = answered earlier (C11 left it done) |
| 1 | Advanced, EN, light: prompt top of Overview, exact copy | PASS | copy, 3 actions, no X, no body link, first section after header |
| 2 | Standard, EN, light: prompt shown | PASS | copy, 3 actions, no X, no body link, first section after header |
| 3 | Dark theme renders correctly | PASS | dark ok |
| 3b | Theme back to Light | PASS | light |
| 4 | pl-PL shows translated text, then back to English | PASS | pl-PL ok, English restored |
