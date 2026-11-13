# AccessRadar: plan to implement everything on the roadmap (2026-11-11)

Asked by Marcin (Jira Apps room, 11.11 18:43): "przeanalizujcie swoje roadmapy i stwórzcie plan na wdrożenie wszystkiego co do tej pory mamy na roadmapach, zlecamy to claude'owi". This is a plan only. Nothing is implemented.

Baseline: repo `therealnowaczek/accessradar` main `10a5bb1` = Forge prod 2.45.0 (plus `scripts/strip-spike.sh` at deploy), dev 2.91.0. 327 tests. Runs on Atlassian eligible.

## 1. Sources checked

- Repo: `docs/PRD-R1-R2.md` (§8 PR list, §8a "AccessRadar 2.0 permissions upgrade", §9 open questions), `docs/LISTING.md`, `docs/limits.md`, `docs/mcp-tools.md`, `src/domain/edition.ts` (`RELEASED_FEATURES`, `comingSoonFeatures`: none today), `SettingsView.tsx` ("Coming soon" pill, nothing uses it now), TODO/FIXME grep (none open).
- Live site roadmap (docs#roadmap and home #roadmap, same 4 "Planned" items).
- Stale box clone `/workspace/accessradar`: `docs/FEATURE-PARITY.md` (§3 matrix, §4 gaps ranked), `docs/competitor-radar.md`.
- `/workspace/radrly/layout-standard.md` v1.1 (MarginRadar reference, §13 checklist), `/workspace/radrly/i18n-plan.md` (ON HOLD by Marcin, 2026-10-20).
- `/workspace/radrly/ai-visibility/status/accessradar.md` (GEO deadlines).
- Known open items from this week (date-picker smoke test, MCP E2E, licence on prod install).

## 2. Verified against code: already shipped (not in the plan)

All R1-01..R1-08 and R2-01..R2-08: tick gate, 11 risk rules (`src/engine/risk.ts`: anonymous, broad-app-role, admins, wide-admin, inactive, large-groups, project-no-admin, direct-user-grants, unused-schemes, empty-groups-in-use, app-accounts-admin), coverage and limitations, exceptions with justification and expiry, signature v2, hash chain and Verify, remediation verification, evidence pack with SOC 2 / ISO mapping (`src/domain/controls.ts`), notices and change alerts, campaigns, delegated reviews (`jira:projectSettingsPage`), Rovo agent, `rovo:mcp` tools (2.45.0), weekly digest, CSV / PDF / Markdown export. R1-09 free-tier schedule shipped as an internal biweekly schedule for Standard sites with ≤10 active humans (`src/collector/gate.ts` `isFreeTier`). FEATURE-PARITY gaps #1 to #5 are closed (except the public filters/dashboards rule).

## 3. Not shipped (the backlog this plan covers)

| # | Item | Source | Scope / manifest change | Edition |
|---|---|---|---|---|
| A | Manual date-picker smoke test after `@atlaskit/datetime-picker` 14 to 19 (promised, not done) | this week | none | both |
| B | MCP end-to-end test with a real client on dev; licence check on the prod CLI install (marginradar) | this week | none | Advanced |
| C | MCP surface detection: replace heuristics with the real context shape seen in B | `src/rovo/invocation.ts` | none | Advanced |
| D | Marketplace console updates for MCP (questionnaire, P&S, Editions, listing) | `rovo-mcp/marketplace-console-checklist.md` | none (console) | n/a |
| E | Layout standard v1.1 conformance (MarginRadar reference) re-verified for AccessRadar after R2 and MCP | layout-standard.md §13 | none | both |
| F | Free-tier schedule options beyond Standard weekly/manual (public roadmap). Today ≤10-user Standard sites are forced to biweekly, not selectable | site roadmap, PRD §9 Q3 | none | Standard (free tier) |
| G | JSON export (snapshot matrix, review, evidence pack) | FEATURE-PARITY §4 #10 | none | both (pack: Advanced) |
| H | Change alerts and reminders as Jira work items or comments | site roadmap, PRD §8a | NEW WRITE scopes (major) | Advanced |
| I | Risk rule: publicly shared filters and dashboards | site roadmap, PRD §8a | new read scopes (major) | both |
| J | Diffs based on the Jira audit log ("who changed what") | site roadmap, PRD §8a | new read scope, admin-level (major) | Advanced |
| K | Issue security levels in effective access | FEATURE-PARITY §4 #10 | new read scopes (major) | both |
| L | Zero-SQL idle tick via KVS | PRD §8a | possibly `storage:app` | n/a. Recommend DROP: tick already costs 1 SQL request |
| M | Confluence spaces | FEATURE-PARITY §4 #7 ("R2+/later") | new product, many scopes, multi-product app | decision |
| N | Last-active users (login activity) | FEATURE-PARITY §4 #6 | needs org admin API on api.atlassian.com = egress, breaks Runs on Atlassian | NOT FEASIBLE as RoA. Recommend drop, keep "deactivated" rule |
| O | i18n en/pl/de/fr | i18n-plan.md | manifest `translations` later | ON HOLD (Marcin). Optional final phase only |
| P | Marketing: GEO drafts + Rich Results Test (13.11), comparisons wave 1 vs Atlassian Guard (20.11) | ai-visibility status | site only | separate track |

## 4. Phases

Global rules for every phase: ADS / Atlaskit only, MarginRadar layout is the reference, modal primary button on the RIGHT, drawer and fullscreen primary on the LEFT, sticky headers need separator line + fade. No scopes, egress, remotes or manifest changes unless the phase says so AND Marcin said yes. Runs on Atlassian must stay eligible (`forge eligibility`). Branch + PR per phase, `npm run check` green, dev deploy only, commits end with `[skip ci]`, never touch `release/production` or `wip/local-2026-10-12`, never print secrets, no prod deploy without Marcin's yes. Check ECOHELP before any prod deploy (a prod deploy during review creates a new ticket).

**Post-dev-deploy E2E (Marcin, room 11.11 18:45, mandatory after EVERY dev deploy):** the bot goes through the changes and runs E2E on marginradar.atlassian.net (dev install, "Dev" label in the app name) before reporting a phase done:
1. Claude Code writes `docs/e2e/phase-N.md` in the PR: a concrete checklist per changed feature (path in the UI, steps, expected result in Standard and in Advanced), plus the dev version and commit.
2. AccessRadar's own browser agent (not Claude) runs it in the browser on marginradar.atlassian.net: UI flows, Rovo chat where relevant, MCP tools where relevant, each flow in Standard AND Advanced via the dev edition override (Settings > edition override, or `AR_EDITION_OVERRIDE`), light and dark theme where UI changed.
3. Regression pass every time over the main screens: Overview, Explore (Spaces + Why panel, Groups, People), Changes, Reviews (open a review, decisions, sign on Advanced, Verify), Exceptions, Alerts, Campaigns, Snapshots (take a snapshot), Settings, Get started, project settings Access review page, Rovo agent one question.
4. Evidence: screenshots per step (saved under `/workspace/radrly/accessradar/e2e/<date>-phase-N/`), `forge logs -e development --since 30m` with no new errors and real `sql` counts, result table PASS/FAIL in the PR comment and in the phase report. Any FAIL goes back to Claude Code with the failing step, then redeploy dev and rerun.

### Phase 0: Close this week's verifications (ops, no feature code)
- Goal: prove 2.45.0 works end to end and clear promised checks.
- Scope: A (date pickers on dev: Exceptions expiry, campaign schedule, any other `@atlaskit/datetime-picker` use; light and dark theme), B (Marcin runs `~/accessradar/accessradar-mcp-e2e-prompt.md`; Rovo or MCP call on prod marginradar to see whether the install has a licence), C (small code change after B gives the real `[rovo] ok ... ctx:` key list), D (browser, separate, checklist exists).
- Acceptance: date pickers open, accept and save a date, display it in Jira's date format, no console errors; MCP E2E "PASS" with 5 tools; `surface: 'mcp'` logged for MCP calls; unit test with the real context shape.
- E2E after dev deploy (item C): call all 5 MCP tools and one Rovo agent question on marginradar dev, confirm `surface: 'mcp'` vs `'rovo'` in logs, Standard override gives the Advanced message, non-admin gets the admin-only message; regression pass.
- Edition: both / Advanced. Risk: low (C touches auth path only via surface flag; asApp stays blocked for MCP either way). Needs Marcin: run the MCP prompt (OAuth + admin toggle), Marketplace console pass.
- Effort: 0.5 day (C: 1 to 2 h).

### Phase 1: Layout standard conformance (UI only)
- Goal: AccessRadar matches layout-standard v1.1 §13 checklist 100%, like MarginRadar.
- Scope: E. Audit every R-x.y MUST/SHOULD against `static/app/src`, fix gaps (PageHeader, sticky separator + fade, drawer/modal/fullscreen button order, skeletons mirroring the layout, empty states, tokens only, no raw HTML controls, dark mode, 200% zoom). Report table in `docs/layout-conformance.md`.
- Acceptance: checklist table all MUST = pass with file:line evidence; `designSystem.guard.test.ts` extended where a rule is testable; `npm run check` green; screenshots or a written manual check list for Marcin.
- E2E after dev deploy: every screen of the regression list in light and dark theme, Standard and Advanced; check sticky header separator + fade while scrolling, drawer primary left, modal primary right, fullscreen primary left, skeleton matches loaded layout (reload with throttling), 200% zoom on Overview and Reviews; screenshots before/after per fixed rule.
- Edition: both. Risk: low (UI only, no manifest). Effort: 1 to 2 days.

### Phase 2: No-scope features (Standard value)
- Goal: ship roadmap items that need no new permissions.
- Scope: F (only after Marcin decides the free-tier options, see decisions), G (JSON export next to CSV / PDF / Markdown: access matrix, review, evidence pack; schema version field; client-side download like the other exports; Advanced gate for the evidence pack JSON).
- Acceptance: JSON files validate against a documented schema (`docs/export-json.md`), golden tests; free-tier option behaves as decided and Settings copy matches code; edition gates server-side; listing/site texts drafted (not published).
- E2E after dev deploy: JSON export from Explore (matrix), a review and the evidence pack (Advanced; Standard shows the upgrade note and the server refuses); open each file and validate against the schema; free-tier option: on Standard with the free-tier condition simulated on dev, Settings shows the decided options and the next snapshot time matches; regression pass.
- Edition: G both (pack Advanced); F Standard free tier. Risk: low. Effort: 1 to 1.5 days.

### Phase 3: AccessRadar 3.0 "permissions upgrade" (one MAJOR version, needs Marcin's yes)
- Goal: deliver the 4 scope-dependent roadmap items in ONE major version so admins re-consent once.
- 3a Spike (scratch branch, never merged, dev only, then reverted): add candidate scopes for H, I, J, K, run `forge lint`, `forge deploy -e development`, `forge eligibility`; verify exact scope names and that the needed REST endpoints work asApp/asUser on dev; record in `docs/spike-results/permissions-upgrade-<date>.md`. Dev is redeployed from main afterwards.
- 3b Build (after Marcin approves the scope list from 3a): I public filters/dashboards rule, K security levels, J audit-log diffs, H alerts/reminders as Jira work items or comments (opt-in per rule, target project chosen by admin, off by default). Every feature detects missing consent at runtime (403 = disabled with an explanation) so sites that have not upgraded keep working.
- Acceptance: RoA still eligible (no egress); tests for consented and not-consented paths; data-handling, privacy, security pages and Marketplace P&S drafts updated (scope justifications); release notes; no prod deploy without Marcin's yes and no open ECOHELP.
- E2E after dev deploy (3a and 3b): consent screen on upgrade lists exactly the approved scopes; for each of H, I, J, K the feature works after consent and shows the disabled explanation before consent (test on a site/environment state without the new consent if possible, otherwise via the 403 path in logs); H creates a work item/comment only in the admin-chosen project and only when the rule is on; Standard vs Advanced gates; Rovo and MCP tools still answer; regression pass.
- Edition: H, J Advanced; I, K both. Risk: HIGH. Write scopes change the "read-only, never modifies Jira" promise on the site, listing and questionnaire; major version = admin approval per site; Marketplace re-review likely. Effort: 3a 0.5 day; 3b 5 to 8 days.

### Phase 4 (optional, decision first): Confluence spaces
- Goal: effective access for Confluence spaces in the same snapshots and reviews.
- Scope: M. Multi-product app (Jira + Confluence), Confluence read scopes, collector, engine, UI, exports. Separate spike first.
- E2E after dev deploy: Confluence space access in snapshots, Why panel, reviews and exports on marginradar's Confluence; Jira flows unchanged; regression pass.
- Risk: HIGH (new product, many scopes, Marketplace compatibility change, pricing question). Effort: 10+ days. Not started without Marcin's explicit go.

### Phase 5 (optional, ON HOLD): i18n en/pl/de/fr
- Only when Marcin lifts the hold. Follows `/workspace/radrly/i18n-plan.md` (locale from Jira, en fallback, Jira date formats, no language switcher, no manifest change until review ends). Effort: 3 to 4 days.
- E2E after dev deploy: switch the Jira profile language (en, pl, de, fr), check every main screen, date formats from Jira settings, en fallback for a missing key; regression pass.

### Dropped (recommendation, Marcin to confirm)
- L zero-SQL tick via KVS: tick already 1 SQL request; scope cost > benefit.
- N last-active users: needs the org admin API outside the Jira product API (egress), breaks Runs on Atlassian.

### Marketing track (separate, not Claude Code)
- 13.11: Rich Results Test for `/` and `/what-is-accessradar/`; drafts in `/workspace/radrly/ai-visibility/drafts/accessradar/` (Marketplace first sentence, LinkedIn page, YouTube H7xGSTA0A4A description), no publishing.
- 20.11: comparisons wave 1 (vs Atlassian Guard, "Atlassian Guard alternatives"); check the existing `/alternatives/` first, verify Guard features on public Atlassian pages.

## 5. Decisions needed from Marcin
1. Phase 3 at all: write scopes (work items/comments) end the "read-only, never modifies Jira" claim. Ship H, or only I, J, K (read scopes, still a major)?
2. Free-tier schedule (F): what "options beyond weekly/manual" means: let ≤10-user sites choose weekly (today forced biweekly), or add daily for free? Or remove the item from the roadmap?
3. Confluence (M): in scope or not?
4. Confirm dropping L and N and removing N/L from any public roadmap wording.
5. i18n stays on hold (Phase 5 not planned until you say so).
6. Order: Phase 1 before Phase 2 (recommended) or in parallel.

## 6. Prompts
One self-contained Claude Code prompt per phase in `/workspace/radrly/accessradar/claude-prompts/phase-N.md` (phase-0 covers only item C; A, B, D are manual). Run from the repo root on Marcin's Mac (Forge CLI logged in there): `claude -p "$(cat phase-N.md)" --model claude-opus-5-5 --effort medium`.

## Aktualizacja 2026-11-11 19:12 (Marcin, Jira Apps): i18n odblokowane
Faza 5 (i18n) nie jest już wstrzymana. Języki: EN, PL, DE, FR, ES, JA (ja), PT-BR, zh-CN i zh-TW (Marcin 19:17: oba; zh, zh-SG, zh-MY -> zh-CN; zh-HK, zh-MO -> zh-TW).
Kolejność: po zakończeniu bieżących zadań Claude CLI (faza 0 i 1). Wg wspólnego planu i18n MarginRadara.
Kroki: 1) wyciągnąć hard-coded teksty z komponentów do katalogu `static/app/src/i18n/` (klucze typowane), 2) język z `context.locale` Jiry, fallback EN, bez przełącznika, 3) format dat z globalnego ustawienia admina Jiry (dziś stałe en-GB), 4) eksporty CSV/PDF i Rovo/MCP: decyzja czy tłumaczyć, 5) E2E na marginradar.atlassian.net dla każdego języka.

## Aktualizacja 2026-11-11 19:21 (Marcin): 12 języków
en-US, de-DE, ja-JP, fr-FR, es-ES, pt-BR, pl-PL, ko-KR, it-IT, nl-NL, zh-CN, zh-TW (locale Jiry z podkreślnikiem, np. pt_BR). Zastępuje listę 9 języków wyżej. Mapowanie chińskiego bez zmian, reszta -> en-US.

## Decisions 2026-11-11 21:02 (after CMO consultation, per Marcin 21:01)
1. Stay read-only. No write scopes. Remediation = guidance + deep link to the exact Jira screen (group, project role, permission scheme). Revisit only on paying-customer demand.
2. Snapshot cadence: Standard weekly, Advanced daily. Send exact cadences to CMO before shipping (site/listing alignment).
3. Confluence later, bundled into the next major that needs consent anyway.
4. Drop KVS. Drop "recently active" ONLY if the inactive-users flag does not depend on it; otherwise keep it or tell CMO first (site/carousel promise "inactive users with access, flagged on every snapshot").

## Competitor research proposals 2026-11-12 (status: proposed, awaiting CMO review)

Source: /workspace/radrly/marketplace-seo/competitors-2026-11/accessradar.md and summary.md (CMO). Per Marcin's rule relayed by CMO (12.11): roadmap only, no work started (no code, branches, Claude CLI or listing changes). Only CMO-approved items go to the public roadmap.

| # | Proposal | Status | Effort | Feasibility notes |
|---|---|---|---|---|
| C1 | Control mapping in evidence pack: SOC 2 CC6.1-CC6.3, ISO 27001:2022 A.5.15/5.18/8.2, NIS2 Art. 21, plus docs page | Planned (CMO 12.11, public roadmap; no work until Marcin starts it) | S | Evidence pack already has SOC 2 / ISO mapping; this makes it control-level and adds NIS2. No scopes, no egress. Wording stays "supports evidence", never "compliant". |
| C2 | Seat view: groups granting product access, members, potential licence savings | Planned without activity claim (CMO 12.11; no work until Marcin starts it) | M | Groups and application roles are already read (read:application-role, read:group), so the product-access part needs no new scope. "No recent activity" is the risky part: last login is not exposed to apps; Jira-activity proxies would need read:jira-work (new scope, major, consent) and contradict "inactive = deactivated flag". Recommend shipping without activity first. |
| C3 | Group-centric reach view with weekly tracked-group diff | Planned (CMO 12.11, public roadmap; no work until Marcin starts it) | S | Group view and snapshot diffs exist; this is a filter/presentation on top. No scopes. |
| C4 | More risk rules (11 toward ~20-25), incl. filters/dashboards shared broadly, spaces open to anyone | Planned (CMO 12.11, public roadmap; no work until Marcin starts it) | M | Data for public filters/dashboards already read since 3.0.0, so new rules need no scope. Rules need care to avoid false positives; snapshot schema change. |
| C5 | "Recheck" state: decision goes stale if access changed after it, round cannot close until re-decided | Planned (CMO 12.11, public roadmap; no work until Marcin starts it) | S | Fits existing snapshot-bound reviews and hash. No scopes. Good audit value per effort. |
| C6 | AI pre-sort for reviewers via Forge LLMs on minimised attributes | Planned (Marcin approved via CMO 12.11; packaging and privacy/P&S decided at start; no work yet) | M | Keeps RoA only with Forge LLMs; needs manifest change (likely major + admin approval), flips "Does your app use AI?" to Yes, and privacy/P&S updates. Advanced only. Lower priority. |
| C7 | One-click sample review campaign on fresh install | Planned (CMO 12.11, public roadmap; no work until Marcin starts it) | S | In-app demo data only, clearly labelled, deletable. No scopes. |
| C8 | Free project-level self review (project admins review own project) | Planned (Marcin approved via CMO 12.11; packaging and privacy/P&S decided at start; no work yet) | S-M | Delegation exists on Advanced; moving a scoped version to Standard is a packaging/pricing decision (CMO + Marcin). New project-admin UI permission check needed. |
| C9 | IdP provisioning (Okta, Entra) like Multiplier | rejected (breaks zero egress and Runs on Atlassian) | - | Keep "revoke verified on next snapshot". |
| C10 | Listing keywords: SOC 2, ISO 27001, who has access | proposed, CMO-owned (after 7.12) | S | Listing is CMO's; no product work. |
| C11 | In-app review request after first value (cross-app) | Approved, internal priority (CMO 12.11; not on public roadmap; no work yet) | S | No scopes; must follow Marketplace rules (no incentives). |
| C12 | Findings as Jira work items / labels / Automation triggers (cross-app) | Not doing (CMO 12.11) | M | Needs write scopes; AccessRadar is read-only by decision (item H dropped). Deep links stay the remediation path. |
