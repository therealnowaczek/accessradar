# C11 review prompt E2E, dev

8 PASS, 0 FAIL of 8


| Step | What | Result | Note |
|---|---|---|---|
| reset | Dev-only reset of stored answer (Settings, Developer spike) | PASS | reset |
| light.Advanced | Prompt visible on Overview (Advanced, light) | PASS | shown |
| light.Standard | Prompt visible on Overview (Standard, light) | PASS | shown |
| block | Prompt never blocks: Reviews page loads and usable | PASS | ok |
| dark | Prompt visible in dark | PASS | shown |
| link | Write a review opens only the Marketplace reviews page; prompt then gone | PASS | https://marketplace.atlassian.com/apps/3691498947/accessradar-user-access-review-permission-audit-for-jira?tab=reviews |
| persist | Reload: prompt stays gone (stored per site) | PASS | gone |
| restore | Theme back to Light | PASS | light |
