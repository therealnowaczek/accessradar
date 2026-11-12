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

## 2026-11-12: i18n, 12 UI locales (Claude run)

- Locales: en-US, de-DE, ja-JP, fr-FR, es-ES, pt-BR, pl-PL, ko-KR, it-IT, nl-NL, zh-CN, zh-TW. Locale from the Jira user
  profile (`context.locale`); `zh`, `zh-SG`, `zh-MY` and `zh-Hans` map to zh-CN, `zh-HK`, `zh-MO`, `zh-TW` and `zh-Hant` to
  zh-TW; every other locale falls back to en-US. No language switcher.
- Dictionaries live in the app bundle (`static/app/src/i18n/locales/*.json`, loaded lazily in `main.tsx` before the first
  render), not in the manifest `translations`, so there is no manifest, scope or permission change. Per-key fallback to
  English.
- Dates (display and typed input) already follow the user's locale with en-US fallback (phase 1).
- Coverage: UI copy where a JSX text node or a title/label/description/placeholder prop is a plain sentence (about 350
  keys, including navigation). Sentences built from several fragments or interpolated values, exports (CSV/PDF/JSON keep
  English column names and ISO formats for machine use) and the Rovo agent prompts/skills stay English. Remaining strings
  are a follow-up (extract with `/workspace/radrly/accessradar/tools/extract.mjs`, then translate).
- Translations are machine-drafted by Claude and not reviewed by native speakers: Marcin should have de/fr/pl/ja checked
  before the listing advertises localisation.

## 2026-11-12: Phase 3 (read-only I, J, K) (Claude run)

- H (writing work items/comments) dropped earlier; 3b builds only I (public filters/dashboards), K (issue security levels) and J (audit-log diffs, Advanced) as one page, "Sharing and security", read live and not stored.
- Six new `read:` scopes, see `docs/phase-3-scopes-for-marcin.md`. Major version 3.0.0. Branch `feat/phase-3b-sharing-security-audit`: deployed to dev only, PR not merged, no production deploy until Marcin approves.
- J reuses the `changeAlerts` Advanced flag (no new edition flag).
- **Approved by Marcin (2026-11-12 05:06, Jira Apps room): "Jeśli na coś czekacie na mnie, to nie czekajcie, realizujemy plan do spodu!"** Phase 3 (I, J, K; six read-only scopes, major 3.0.0) ships to production after green dev E2E. No write scopes, no egress, no remotes. Deploy never uses `forge install --upgrade`; sites approve the update themselves.

## 2026-11-12: C-items batch (competitor research roadmap, approved by Marcin 15:58 via the CMO) (Claude run)

Dev only, one branch and one PR per item, nothing merged, no production deploy (Marketplace P&S review ECOHELP-184698 is open and prod needs Marcin's own "tak"). Order: C11, C5, C1, C3, C7, C4, C2, C8, C6. Not built: C9 (egress), C10 (CMO), C12 (read-only).

### C11: review request after first value
- First value = the first signed review; a site that never started a review gets the request once a second complete snapshot exists (the first that can show what changed). Shown only on Overview, only to Jira admins (every resolver is admin-gated), as a dismissible Atlaskit SectionMessage.
- Plain link (`router.open`) to the Marketplace reviews tab of app 3691498947. No tracking, no Marketplace API, no incentive, no egress, no new scope. "Write a review" and "I already did" count as done, "Not now" as dismissed; either answer is stored once per site in the `kv` table (key `review-prompt`) and the request never returns. It never blocks a review, remediation or sign-off path.
- A dev-only reset (Settings, Developer spike panel, spike flag and development environment only) exists so E2E can show the request again.

### C5: Recheck state
- A keep, revoke or exception decision is stale when the access it was made on changed in a later snapshot. "The access it was made on" is the review's own snapshot, or, after a re-decision, the access recorded at that moment (`review_item.ack_fp`, new nullable column, migration v040). This is slightly stricter than "changed after the decision": it also catches a change that happened between the review snapshot and the decision, which the reviewer never saw.
- Fingerprint = permissions plus path codes (direct, group, role), hashed (`src/engine/recheck.ts`). Display names, counts and wording are not part of it, so renames never raise a recheck. The comparison uses the latest complete snapshot only: a partial snapshot can drop paths and would raise false rechecks. Access that disappeared is not stale (nothing left to recheck; revoke stays verified by remediation). Signed reviews are frozen evidence and never show a recheck.
- Enforcement is server side: `signReview` and `projectSubmitAssignment` refuse while any decision is stale. In the UI a stale item counts as still to do, shows a Recheck pill with the previous decision and the access now, and bulk Keep skips it so a recheck is never confirmed by accident. Re-deciding (Keep, Revoke, Exception) records the current fingerprint and writes a `review.rechecked` audit event.
- The signed evidence document is unchanged (signature v2); no new scope.

### C1: control mapping (SOC 2, ISO 27001:2022, NIS2)
- Kept the existing control-level mapping and tightened two rows (CC6.3 and A.5.18 now name Recheck). Added NIS2 Art. 21(2)(i) (access control policies) and Art. 21(2)(f) (assessing effectiveness of measures); the other Art. 21(2) points are not about Jira access and are not mapped. `CONTROLS_VERSION` 1 to 2, printed in the PDF. The disclaimer now says it supports evidence collection, is not a statement of compliance and not legal advice. Em dash removed from a control title.
- The docs page is in-repo: `docs/control-mapping.md` (not the marketing site). No scope, no egress, no UI change (the mapping is part of the Advanced evidence pack PDF).

### C3: group reach and tracked groups
- Reach per group already existed in the group panel; C3 adds tracking: up to 50 groups per site (setting `trackedGroups`, server side limit), a Tracked pill and filter on Groups, and a weekly diff (spaces added or removed, permission changes, members joined or left) built from the two snapshots the weekly digest already compares. It appears on Groups, Overview digest and the digest export path. Available on Standard and Advanced like Groups. No scope, no egress. Audit events group.tracked and group.untracked.

### C7: sample review campaign
- The sample is a fixed set of 8 invented items (fictional people, groups, spaces) stored in one key-value entry (`sample-campaign`). It never reads or writes Jira users, groups or spaces, and creates no snapshot, review, campaign, audit entry, export row or evidence chain link. So it cannot be mistaken for, or leak into, real evidence. Every row carries a Sample label and a banner says so.
- One click on Campaigns ("Try a sample campaign", also offered from the Overview empty state) creates it; Keep, Revoke or Exception per item; Finish needs all items decided and only shows a summary ("nothing was changed in Jira, nothing was signed"); Delete removes it. Available on Standard and Advanced (Standard sees it beside the plan note, with a line that real campaigns are Advanced). Jira admins only, like every resolver. No scope, no egress. The demo seed from docs/demo-data-plan.md was not run.

### C4: risk rules from 11 to 20
- Nine new rules, no new scope, no snapshot schema change. From snapshot data: anonymous-write (Anyone with anything other than view permissions), inactive-admin (deactivated account in an admin group; the deactivated flag only, no activity claim), destructive-large-group (delete or administer granted to a group at or above the large-group threshold), admin-group-large (10 or more active human members), empty-admin-groups, project-single-admin (low; exactly one active human, skipped when any holder is partial). From the live filters and dashboards read added in 3.0.0 (not part of a snapshot): filters-public, dashboards-public (high), shared-loggedin (low; often intended).
- False-positive guards: groups whose members were not collected are never flagged; schemes not assigned to a space are ignored; app accounts are not counted as people; team-managed spaces are skipped. When filters and dashboards cannot be read (no consent, Jira error), the three sharing rules show "partial", never "none found".
- Overview now reads filters and dashboards once per load for these rules (the same read as Sharing and security). The sharing rules always reflect the live state, also when an older snapshot is selected.
- Two existing learn-more texts lost an em dash.

### C2: seat view (no activity claim)
- New page Seats (Explore) from data already collected: application roles, the groups that grant them, memberships, effective space access (scopes `read:application-role`, `read:group` already held). No new scope, no snapshot change.
- Seat holder = distinct active Atlassian account in a group that grants a product; customers and app accounts are not counted. Review candidates: seat holders with no effective space access, and holders of several products. The page says plainly that these are candidates, not a statement about use, and that Jira gives apps no last-login or last-active data. Deactivated accounts are shown as the account flag only; no claim about how Atlassian bills them. No `read:jira-work` or other scope was added to proxy activity.
- Unread groups make the product count "may be too low" and unresolved access flags the no-space-access count as possibly incomplete.
