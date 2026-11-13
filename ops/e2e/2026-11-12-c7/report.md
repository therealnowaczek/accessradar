# C7 sample campaign E2E, dev

8 PASS, 0 FAIL of 8


| Step | What | Result | Note |
|---|---|---|---|
| 1 | Advanced: Campaigns shows Try a sample campaign; one click creates the sample with 8 undecided items and the Sample label | PASS | rows 9 |
| 2 | Finish is disabled until all 8 are decided; decisions persist | PASS | ok |
| 3 | Finish sample: summary says nothing changed in Jira and nothing signed; decisions locked | PASS | 3 kept, 4 marked to revoke, 1 exceptions. |
| 4 | Sample is isolated: not listed in Reviews, Snapshots count unchanged, no Sample in real campaigns | PASS | ok |
| 5 | Delete sample (confirm dialog) removes it and the Try button returns | PASS | ok |
| 6 | Standard: Plan note plus sample with edition note; start and delete work | PASS | ok |
| 7 | Dark: sample on Campaigns | PASS | ok |
| 8 | Regression: main pages load | PASS | ok |
