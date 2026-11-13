# Review prompt E2E part e

5 PASS, 0 FAIL of 5


| Step | What | Result | Note |
|---|---|---|---|
| 7e.0 | Reset so the prompt is due | PASS | visible on Overview |
| 7e.create | Start-review drawer has no prompt; create own ARTEST test review | PASS | created E2E review-prompt 118497 |
| 7e.signoff | Absent on own review detail, Keep all, sign-off dialog (cancelled, not signed) | PASS | absent in detail and sign-off dialog; cancelled |
| 7e.delete | Delete own test review (confirm dialog has no prompt) | PASS | deleted E2E review-prompt 118497 |
| 7e.end | Final state: answer the prompt (I already reviewed), edition Use the license | PASS | review-prompt left done |
