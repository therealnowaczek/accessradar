# Review prompt E2E part b

3 PASS, 0 FAIL of 3


| Step | What | Result | Note |
|---|---|---|---|
| 5 | Write a review calls router.open with exact URL, hides prompt | PASS | opened https://marketplace.atlassian.com/apps/3691498947/accessradar-access-review-permission-audit-for-jira?tab=reviews&hosting=cloud; no review posted (request stubbed) |
| 6a | Not now persists: reload, away and back | PASS | hidden after answer, reload, nav away/back |
| 6b | I already reviewed hides, persists after reload | PASS | hidden |
