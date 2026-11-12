# Decisions log

Newest first. Decisions made without Marcin in the loop are marked "(Claude run)". Each entry says why and what it
changes in the repo.

## 2026-11-11 (Marcin and CMO, recorded by the Claude roadmap run)

### D1. AccessRadar stays read-only

Roadmap item H (write Jira work items or comments for alerts and reminders) is dropped. No write scopes. Remediation
is guidance plus a deep link to the exact Jira admin screen (group, project role, permission scheme). Revisit only on
paying-customer demand. Why: keeps the "read-only, never modifies Jira" promise on the site, listing and
questionnaire and avoids a write-scope major version.

### D2. Snapshot cadences (exact)

| Edition | Scheduled snapshot | Notes |
|---|---|---|
| Standard | **weekly** (one chosen weekday and UTC hour; or Off) | A saved daily schedule runs weekly. Free tier (up to 10 active human users) is the same: weekly. The internal biweekly schedule (R1-09) is removed. |
| Advanced | **daily** or weekly (admin chooses, or Off) | Daily is Advanced only. |
| Both | manual snapshot any time | |

Retention is unchanged (Standard 90 days, Advanced up to the configured value). The hourly tick still costs one SQL
request when nothing is due. The same text is in `/workspace/radrly/accessradar/cmo-cadences.md` for the CMO bot.
Site and listing texts are not published from this repo.

### D3. Confluence (item M) is not built

Later, bundled into the next major version that needs new consent anyway.

### D4. KVS (L) and last-active users (N) are dropped

Checked before removing anything about "recently active": the inactive-users risk rule (`src/engine/risk.ts`,
`inactive`) and the `inactive-with-access` alert use the Jira account `active` flag, so "inactive" means a
deactivated account, not last-login age (`src/domain/limitations.ts`). It does not depend on last-active data, so
dropping N changes nothing in that rule. The rule and the site promise "inactive users with access, flagged on every
snapshot" stay.

### D5. i18n

12 UI locales: en-US, de-DE, ja-JP, fr-FR, es-ES, pt-BR, pl-PL, ko-KR, it-IT, nl-NL, zh-CN, zh-TW. Locale comes from
the user's Jira settings with English fallback. zh, zh-SG, zh-MY map to zh-CN; zh-HK, zh-MO map to zh-TW. No language
switcher. Dates (display and typed input) follow the user's locale with en-US fallback. Follows MarginRadar's shared
i18n plan.

## 2026-11-11 (Claude run, phase 2)

### D6. JSON export is schema-versioned and client-side

JSON sits next to CSV, PDF and Markdown in the existing export menus (access matrix, space access, changes, review)
plus "Evidence pack JSON" for signed reviews. It reuses the client-side download, adds no scopes and no resolver. The
evidence pack JSON is Advanced (the existing server gate in `getEvidencePack`). Documented in `docs/export-json.md`,
validated in tests against `docs/schemas/accessradar-export-v1.schema.json`. Timestamps are ISO 8601 UTC (unlike CSV,
which prints "YYYY-MM-DD HH:mm:ss UTC") because JSON is meant for machines.

### D7. MCP item C (surface detection) skipped

No MCP call has reached the logs. All `[rovo] ok` lines are Rovo agent calls (`agentId` in `ctx`, `surface: rovo`).
Changing the heuristic without a real MCP context shape would be a guess. Revisit when an MCP call appears in
`forge logs`.
