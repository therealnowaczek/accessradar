# AccessRadar — verified Forge platform limits

Verified: **2026-10-10** · Sources linked per row · Replaces PRD §2.2 “unverified” numbers.  
Companion spike: [`docs/spike-results/platform-verification-2026-10-10.md`](./spike-results/platform-verification-2026-10-10.md).

Hard ops rules for this repo: deploy / test only on **development** → `marginradar.atlassian.net`; never push `release/production` or run deploy-prod; never log `accountId` or email.

| Limit | Verified value | Source | Design rule (AccessRadar) |
|---|---|---|---|
| Resolver / UI function runtime | **25 s** | [Invocation limits](https://developer.atlassian.com/platform/forge/limits-invocation/) | Resolvers never build >20 000 review items; heavy work → queue |
| Async consumer / scheduled `timeoutSeconds` | **1–900 s** (default **55 s**) | [Invocation limits](https://developer.atlassian.com/platform/forge/limits-invocation/), [Function](https://developer.atlassian.com/platform/forge/manifest-reference/modules/function/) | Long jobs split into steps; `ar-collector` stays 900 |
| `action` / `rovo` / lifecycle `trigger` runtime | **55 s** fixed (action/rovo) or default resolver window — **`timeoutSeconds` not allowed** | [Invocation limits](https://developer.atlassian.com/platform/forge/limits-invocation/); `forge lint` 2026-10-10 | Do not set `timeoutSeconds` on `ar-rovo` or `ar-lifecycle`; only consumer + scheduledTrigger |
| Function memory | Available **1024 MB**; default limit **512 MB** (`runtime.memoryMB`) | [Invocation limits](https://developer.atlassian.com/platform/forge/limits-invocation/) | Keep default; reuse `stateFor` cache |
| Invocation payload | **5 MB** | [Invocation limits](https://developer.atlassian.com/platform/forge/limits-invocation/) | Paginate large responses |
| Front-end `invoke` request / response | **500 KB** / **5 MB** | [Invocation limits](https://developer.atlassian.com/platform/forge/limits-invocation/) | Page review items (500); evidence pack in pages |
| Async events per push | **50** | [Async events limits](https://developer.atlassian.com/platform/forge/limits-async-events/) | Events carry ids only |
| Async combined payload / push | **200 KB** (individual event **100 KB** if function timeout >55 s) | [Async events limits](https://developer.atlassian.com/platform/forge/limits-async-events/) | Ids / cursors only |
| Async `delayInSeconds` | **0–900** | [Async Events API](https://developer.atlassian.com/platform/forge/runtime-reference/async-events-api/) | Campaign wait / re-enqueue ≤900 s |
| Async events / minute / install | **500** | [Async events limits](https://developer.atlassian.com/platform/forge/limits-async-events/) | Materialize paging respects rate |
| Cyclic async push depth | **1000** push requests from one origin | [Async events limits](https://developer.atlassian.com/platform/forge/limits-async-events/) | Cursor chains OK within limit |
| Scheduled trigger intervals | `fiveMinute` \| `hour` \| `day` \| `week` (same for all installs) | [Scheduled trigger](https://developer.atlassian.com/platform/forge/manifest-reference/modules/scheduled-trigger/) | Cheap gate inside tick (R1-01) |
| Scheduled triggers per app | **5** total; **1** × `fiveMinute` | [Scheduled trigger limits](https://developer.atlassian.com/platform/forge/limits-scheduled-trigger/) | Keep hour + day only |
| Forge SQL — no FKs; one statement per query | enforced | [SQL limits](https://developer.atlassian.com/platform/forge/limits-sql/) | Migrations: one DDL per entry, no FKs |
| Forge SQL storage / install | prod **1 GiB**; staging **256 MiB**; development **128 MiB** | [SQL limits](https://developer.atlassian.com/platform/forge/limits-sql/) | Retention + batch writes |
| Forge SQL tables / install | **200** | [SQL limits](https://developer.atlassian.com/platform/forge/limits-sql/) | Headroom OK for R1/R2 tables |
| Forge SQL DML RPS / DDL RPM | **150** / **25** | [SQL limits](https://developer.atlassian.com/platform/forge/limits-sql/) | Batch 100–500 rows; migrate in queue |
| Forge SQL row size | **6 MiB** | [SQL limits](https://developer.atlassian.com/platform/forge/limits-sql/) | Avoid fat JSON blobs |
| Forge SQL query memory | **16 MiB** / query | [SQL limits](https://developer.atlassian.com/platform/forge/limits-sql/) | Stream facts in pages |
| Forge SQL timeouts | SELECT **5 s**; DML **10 s**; DDL **20 s**; aggregate query time **62.5 s/min** | [SQL limits](https://developer.atlassian.com/platform/forge/limits-sql/) | Indexed lookups; no full `fact` scans in resolvers |
| Forge SQL request / response size | **1 MiB** / **4 MiB** | [SQL limits](https://developer.atlassian.com/platform/forge/limits-sql/) | Paginate |
| Forge KVS | needs scope **`storage:app`**; RPS **1000**; value **240 KiB**; key ≤**500** | [Forge scopes](https://developer.atlassian.com/platform/forge/manifest-reference/scopes-forge/), [KVS limits](https://developer.atlassian.com/platform/forge/limits-kvs-ce/) | **Not used** in R1/R2; SQL `kv` table instead |
| Forge pricing free pool (SQL requests) | **100 000** SQL compute requests / app / month | [Forge platform pricing](https://developer.atlassian.com/platform/forge/forge-platform-pricing/) (verified 2026-10-10) | Idle tick must be O(1) SQL (R1-01) |

## Scope ledger (names verified)

| Scope | In current manifest? | `forge lint` 2026-10-10 | Decision |
|---|---|---|---|
| Existing granular `read:*:jira` + `report:personal-data` | yes | clean | unchanged for R1/R2 |
| `jira:projectSettingsPage` / `rovo:agent` / `action` | modules only | clean; **no new scopes**; deploy development **eligible for Runs on Atlassian** | minor expected; ask before merging R2-06 / R2-08 |
| `write:jira-work`, `read:jira-work`, `write:issue:jira`, `write:comment:jira`, `read:issue:jira` | no | names accepted; **MAJOR_VERSION_RULE** (scope modification) | deferred §8a |
| `read:filter:jira`, `read:dashboard:jira` | no | names accepted; major | deferred §8a / R3 |
| `storage:app` | no | names accepted; major | deferred §8a |
| `read:audit-log:jira` | no | names accepted; major | deferred §8a |

## Logging

Structured logs only: area + event + non-PII counters/ids for reviews/snapshots. **Never log `accountId` or email** (stricter than PRD §2.1 “accountIds only”).
