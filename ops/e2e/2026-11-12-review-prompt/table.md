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
