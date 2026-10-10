# Platform verification (V-00) — 2026-10-10

Branch: `chore/verify-platform-assumptions` · Environment: **development only** · Site: `marginradar.atlassian.net`  
Never: `release/production`, deploy-prod workflow, production Forge env.

## 1. Limits (§2.2)

All PRD §2.2 “unverified” numbers were checked against developer.atlassian.com and recorded in [`docs/limits.md`](../limits.md). Material corrections vs PRD memory:

| Topic | PRD assumed | Verified |
|---|---|---|
| Memory | 256 MB default | Available **1024 MB**, default limit **512 MB** |
| Action / Rovo timeout | `timeoutSeconds: 25` on `ar-rovo` | **Invalid** — action functions are fixed **55 s**; lint errors if `timeoutSeconds` set |
| Free SQL pool | 100k / month | Confirmed **100 000** SQL compute requests / app / month |

## 2. Modules without scopes (`jira:projectSettingsPage` + `rovo:agent` + `action`)

Scratch (not left on main; development restored to clean app after):

- `forge lint --environment development` → **No issues found** (after removing `timeoutSeconds` from `ar-rovo`).
- `forge deploy --environment development` → **Deployed** as version **2.18.0**.
- Deploy output: *“eligible for the Runs on Atlassian program.”*
- No new `permissions.scopes` were added; no MAJOR_VERSION_RULE for modules-only change.
- Development then redeployed clean baseline as **2.19.0** (stubs removed).

Implication for R2-06 / R2-08: module adds are expected **minor** (no re-consent). Still ask before merge (Marketplace re-review risk for listing).

## 3. §8a candidate scopes (scratch only — not deployed)

Added to a local scratch manifest: `write:jira-work`, `read:jira-work`, `write:issue:jira`, `write:comment:jira`, `read:issue:jira`, `read:filter:jira`, `read:dashboard:jira`, `storage:app`, `read:audit-log:jira`.

- `forge lint --environment development` → **MAJOR_VERSION_RULE** approval (“Change due to scope modification”).
- No “unknown scope” errors — names are valid.
- Manifest restored; **not deployed**.

## 4. `POST /rest/api/3/permissions/check`

- Scope `read:permission:jira` already in manifest; used by `src/lib/auth.ts` (`assertJiraAdmin`).
- Week-1 spike (`docs/spike-results/forge-probes-2026-10-09.json`) confirms related permission endpoints under current scopes.
- Non-admin **project** `ADMINISTER_PROJECTS` check for R2-06: not re-exercised in this docs PR; must be covered by R2-06 authorization tests on `marginradar.atlassian.net`.

## 5. SQL requests per tick (before R1-01)

Not measured from Developer Console in this step. Baseline code path still does `ensureMigrated` + `failStale` + settings/edition/kv reads (~4–6 SQL / idle tick). Measure before/after on R1-01 using Dev Console usage + unit SQL call counter.

## 6. Pricing CSV

`docs/accessradar-pricing-import.csv` is **referenced** in LISTING / name-pricing-legal / PRD but **absent from the repo** at this commit. No file to scrub for injected “system notice” text. P-01 (post Marketplace) should add a clean CSV; skip until then per PRD.

## 7. Open-question defaults applied (PRD §9)

| # | Default used |
|---|---|
| Q1 | In-app reminders only; Jira-issue reminders deferred to §8a |
| Q2 | Public filters/dashboards rule deferred to R3 / §8a |
| Q3 | Free-tier ≤10 users → biweekly scheduled snapshot (R1-09) |
| Q4 | Delegation surface = project admins; lead without ADMINISTER_PROJECTS → Unassigned |
| Q5 | `delegateCanSign` default **false** (admin signs) |
| Q6 | Block delete of signed reviews (R2-07) |
| Q7 | Advanced CSV columns: verify in partner console at P-01 |
| Q8 | SOC/ISO mapping text as in PRD; disclaimer included |
| Q9 | Rovo kept in R2 plan — **RoA eligibility confirmed** with modules on development |
| Q10 | Exception max 366 days; justification ≥10 chars |

## Artifacts (local, not committed)

- `/tmp/forge-lint-baseline.txt`, `/tmp/forge-lint-modules.txt`, `/tmp/forge-lint-scopes.txt`
- `/tmp/forge-deploy-modules.txt`, `/tmp/forge-deploy-baseline-restore.txt`
