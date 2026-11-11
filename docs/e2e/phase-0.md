# Phase 0 E2E: close this week's verifications

- Dev version: 2.92.0 (environment `development`, env id `b98d505b-afb5-4c8d-a8f9-5306b85e352d`)
- Commit: 3dc9d79 (main, includes phase 0 #57 bd6b159 and phase 1 #58)
- Site: marginradar.atlassian.net (dev install `ef61e0be-f952-4dd6-8611-ef3d1cdce8e8`, app name shows "Dev")
- Dev app URL: `https://marginradar.atlassian.net/jira/settings/apps/026c4f6a-266d-4c42-aec5-7394371ad05d/b98d505b-afb5-4c8d-a8f9-5306b85e352d`
- Evidence folder: `/workspace/radrly/accessradar/e2e/2026-11-11-phase-0/` (one screenshot per step, named `<step>-<edition>-<theme>.png`)

## Scope and status

Phase 0 has no feature code. The planned code change (item C, MCP surface detection in `src/rovo/invocation.ts`) is **blocked**: it must be built from the real `[rovo] ok ... ctx: [...]` log lines of a live MCP call, and no MCP or Rovo call has been logged on dev or prod in the last 3 days. The live MCP call needs Marcin's OAuth consent and the admin toggle "Expose tools via external MCP endpoint", so it is not part of this browser run. This checklist covers what the browser agent can verify now: the date pickers (item A) and the Rovo agent path plus the gates (part of item B), and it collects the Rovo `ctx` key list for item C.

## Shared-site rules (MarginRadar and other Radrly apps use the same site)

- Use only the AccessRadar dev app ("AccessRadar (Dev)") and the test project **ARTEST** ("AccessRadar E2E"). If ARTEST does not exist, create it once (Jira > Projects > Create project > Scrum or Kanban, team-managed is fine, name "AccessRadar E2E", key ARTEST) and add nothing else.
- Never edit other projects, their permission schemes, groups, users, filters or dashboards. Never open or change MarginRadar, ConfigRadar, LimitRadar, CapRadar or LeakRadar settings.
- AccessRadar records (reviews, exceptions, campaigns) are stored in AccessRadar's own Forge SQL; create them only for ARTEST and name them with the prefix `E2E 2026-11-11`.
- Do not use the production AccessRadar app (name without "Dev").

## 0. Setup

1. Sign in to marginradar.atlassian.net as a Jira admin. Open the dev app URL above. Expect the AccessRadar sidebar (Overview, Spaces, Groups, People, Changes, Reviews, Exceptions, Alerts, Campaigns, Snapshots, Settings, Activity) and "Dev" in the app title.
2. Settings > Plan: the "Override" select is visible (development only). Set it to **Advanced**, expect the toast "Edition override saved". Every step below runs first in Advanced, then again with Override = **Standard** where an edition column is given.
3. Snapshots: if the latest snapshot is older than today, click "Take snapshot now" and wait until the run completes. Expect a new snapshot row with today's date and ARTEST among the spaces (Spaces list).
4. Theme: Jira profile menu > Theme > Light. Dark theme steps switch to Dark in the same menu.

## A. Date-picker smoke test (`@atlaskit/datetime-picker` 14 to 19)

All date inputs use the shared `DateField` (`static/app/src/ui.tsx`, ADS `DatePicker`, value stored as ISO). Displayed and typed dates follow the Jira profile language (decision 2026-11-11; fallback en-US). The expectations below are for English (United States); for a day-first language (English (UK), Polski) the numeric order flips: `12/1/2026` is 12 January there. There are three screens:

| Id | Screen | Path | Field |
|---|---|---|---|
| A1 | Start a review drawer | Reviews > Start a review | "Due date (optional)" |
| A2 | Review decision (exception) drawer | Reviews > open the E2E review > a row > decision "Exception: keep with justification and expiry" | "Expires on" |
| A3 | New campaign drawer | Campaigns > New campaign | "Start date (UTC)" |

For each of A1, A2, A3, in Light and then Dark theme:

1. Open the drawer. Expect the field with the helper text "Type a date such as 10/27/2026 or Oct 27, 2026, or pick one from the calendar." and a calendar button.
2. Mouse: click the calendar button, pick a date 7 days from today. Expect the field to show it in the locale format (for example "Nov 18, 2026"). The calendar closes.
3. Keyboard: focus the field, clear it (select all, Backspace), type `12/1/2026`, press Enter. Expect "Dec 1, 2026". Then type `2026-12-28`, Enter, expect "Dec 28, 2026". Open the calendar with the keyboard (Down arrow), move with arrow keys, Enter. Expect the chosen date in the field.
4. Invalid input: type `31 Feb 2026` (or `27/12/2026` in en-US) and press Enter or Tab away. Expect no date accepted (previous value kept), a red field error "Enter a valid date, for example 10/27/2026." directly under the field, and no crash. Picking a valid date clears the error.
5. Clear the field (clear button or select all + Backspace). Expect an empty field and, for A1 only, the drawer still allows "Start review" (the date is optional). A2: the exception needs an expiry, expect the save button disabled or a validation message.
6. Set a valid date again and save with the drawer's primary button (A1 "Start review", A2 the decision save button, A3 "Create campaign"). Name items `E2E 2026-11-11 ...` and pick ARTEST as scope where the drawer asks for spaces or categories.
7. Reload the page (browser reload), reopen the saved item. Expect the same date, shown in the locale format ("Mon D, YYYY" in en-US). A2: the Exceptions screen lists the exception with that expiry. A3: the campaign shows the start date (UTC).
8. DevTools console: no errors or React warnings from the date picker during steps 1 to 7.
9. Dark theme: calendar popup, selected day and field text readable (tokens), no white blocks.

Edition: A1 and A3 are available in both editions; run them with Override = Standard too and expect the same picker behaviour (any Advanced-only parts show the upgrade note, not a broken picker). A2 needs a review row, run it in Advanced.

Cleanup: leave the E2E records (they live only in AccessRadar dev storage) and list their names in the report.

## B. Rovo agent path and gates (no MCP client needed)

1. Advanced, Jira admin: open Rovo chat (top bar), pick the "AccessRadar" agent (dev). Ask: `Who can access ARTEST?` Expect an answer listing real people/groups with permissions on ARTEST from the latest snapshot (no invented names), at most 50 rows.
2. Ask: `What changed in access since the last snapshot?` Expect granted/revoked items or a clear "no changes" answer.
3. Ask: `What is the status of access reviews?` Expect the `E2E 2026-11-11` review from A1 among open reviews.
4. Override = Standard, repeat question 1. Expect "The AccessRadar Rovo agent requires the Advanced edition of AccessRadar. ..." and no data.
5. Non-admin (only if a non-admin test account is available to the browser agent; otherwise SKIP and say so): ask question 1. Expect "AccessRadar is available to Jira administrators only".
6. Logs (bot runs on the Mac right after steps 1 to 4): `npx forge logs -e development --since 30m | grep -E "\[rovo\]|error"`. Expect `[rovo] ok` lines with `surface: 'rovo'`, the action keys (`ar-who-can-access`, `ar-changes-since`, `ar-review-status`) and a `ctx: [...]` key list. Copy the `ctx` key list into the report: it is the Rovo half of the input item C needs. No `[rovo] failed` lines.

## B-MCP. Needs Marcin (not run by the browser agent)

Marcin, in Atlassian Administration > Apps > Sites > marginradar > Connected apps > AccessRadar (Dev) > Tools, turns on "Expose tools via external MCP endpoint", then runs `~/accessradar/accessradar-mcp-e2e-prompt.md` (Claude Code: `claude mcp add --transport http accessradar https://mcp.atlassian.com/forge/026c4f6a-266d-4c42-aec5-7394371ad05d`, `/mcp`, OAuth consent for marginradar). Expected: all 5 tools listed and answering (`ar-who-can-access` projectKey ARTEST, `ar-why` projectKey ARTEST + a group name, `ar-person-access` name of an admin, `ar-changes-since` sinceDate today, `ar-review-status`). The bot then reads `[rovo] ok` lines: MCP calls must log `surface: 'mcp'` and no `[auth] asApp` lines. Those `ctx` key lists unblock item C (Claude prompt phase-0, branch `fix/mcp-surface-detection`).

Also for Marcin: one Rovo or MCP call against the **production** app on marginradar, to see whether the prod install has a Marketplace licence (logs show `[rovo] no license on invocation` if not).

## Regression pass (Advanced, Light; Overview and Reviews also in Dark)

1. Overview: KPI tiles and risk list load, no error state.
2. Spaces: list loads; open ARTEST, open the Why panel for one permission, expect a grant path.
3. Groups: list loads, open one group.
4. People: list loads, open one person.
5. Changes: loads (diff between the last two snapshots or a clear empty state).
6. Reviews: open the `E2E 2026-11-11` review, set a decision on two rows ("Keep: this access is still needed" and "Exception: keep with justification and expiry" with an expiry and a justification of at least 10 characters), sign it (Advanced), then "Verify chain". Expect a valid signature/chain message.
7. Exceptions: the exception from A2 is listed with its expiry.
8. Alerts: loads.
9. Campaigns: the A3 campaign is listed.
10. Snapshots: take a snapshot, expect a new row and the run to finish.
11. Settings: loads; set Override back to **Use the license** at the end (development default = Advanced).
12. Get started: Jira Settings > Apps > "Get started with AccessRadar" (Dev) loads.
13. Project settings page: ARTEST > Project settings > AccessRadar (Dev): page loads with the delegated review view.
14. Rovo: one AccessRadar agent question (B1 counts).
15. Logs: `npx forge logs -e development --since 30m`: zero errors; tick/collector lines show real `sql` counts.

## Result

Report a PASS/FAIL table (step id, edition, theme, result, screenshot path). Phase 0 is NOT done until every step above is PASS with screenshots, and item C stays open until Marcin's MCP run gives the MCP `ctx` key list.
