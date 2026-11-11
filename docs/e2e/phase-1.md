# E2E checklist: phase 1, layout standard conformance

- Dev version: `DEV_VERSION_TBD`
- Commit: `COMMIT_TBD`
- Branch: `ui/layout-standard-conformance`
- Site: marginradar.atlassian.net, **development** install. The app shows a "Dev" label. Do not use the production
  install.
- Rule references: `docs/layout-conformance.md`.

## Ground rules for the browser agent

- MarginRadar shares this site. Every step that writes (exceptions, review decisions, sign-off, campaigns, delegated
  review page) uses the AccessRadar test space **ARTEST** ("AccessRadar E2E"). If ARTEST is missing, create it first:
  Jira → Spaces → Create space → Scrum (team-managed is fine) → name "AccessRadar E2E", key `ARTEST`. Do not change
  any other space, MarginRadar data, MarginRadar settings or MarginRadar spaces.
- Reviews you start for this checklist are scoped to "Spaces: ARTEST" only.
- Viewport 1280x800 unless a step says otherwise. Take every screenshot at DPR 2.
- **Theme**: avatar (top right) → Theme → Light / Dark. Run each UI step in both themes. Screenshot names end in
  `-light` / `-dark`.
- **Edition**: Jira settings (cog) → Apps → AccessRadar → Settings (sidebar) → section "Edition" → "Override" select.
  "Standard" = Standard, "Advanced" = Advanced, "Use the license" = development default (Advanced). A toast "Edition
  override saved" confirms each switch. Run each step marked [S/A] once in Standard and once in Advanced. End the run
  on "Use the license".
- App entry: Jira settings (cog) → Apps → left menu "AccessRadar". In-app navigation is the AccessRadar sidebar.
- PASS needs a screenshot for every step. Where a step says "before/after", the "before" screenshot is the production
  install (released code) or the earlier dev version, taken at the same width and theme.

## 1. Changed rules (fixed on this branch)

### 1.1 Header separator + fade on every long page (R-3.4, R-3.5) [S/A, light/dark]

For each of Overview, Spaces, Groups, People, Changes, Reviews, Exceptions, Alerts, Campaigns, Snapshots, Settings,
Activity:

1. Open the page from the sidebar.
2. Scroll the content down by about 300px.
3. Expected: the page title area stays fixed. Under it are a 1px line and a soft 24px fade, and the content scrolls
   under the fade (no hard cut, no shadow). On Changes (tabs) the line is the tab bar's line and the fade sits under
   the tab bar, with no extra line under the title.
4. Screenshot `1.1-<page>-scrolled-<theme>.png`.

### 1.2 Side panel (drawer) button order and header fade (R-7.4, R-3.7) [A, light/dark]

Open each panel and check that the footer has the primary button on the LEFT and Cancel (or Back) immediately to its
right. Scroll the panel body and check the 1px line + fade under the panel header.

| # | Path | Panel | Expected footer (left to right) |
|---|---|---|---|
| a | Settings → "Snapshot schedule" → Edit | Snapshot schedule | Save, Cancel |
| b | Settings → "Key permissions" → Edit | Key permissions | Save, Cancel |
| c | Reviews → Start a review | Start a review | Start review, Cancel |
| d | Reviews → open an ARTEST review → "Revoke…" on an item row | Revoke access | Revoke, Cancel |
| d2 | Reviews → open an ARTEST review → row menu (…) on an item → "Exception…" | Grant exception | Grant exception, Cancel |
| e | Reviews → open an ARTEST review → header "Sign off" (Advanced) | Sign off review | Sign off, Cancel |
| f | Reviews → open a signed ARTEST review → "Verify signature & chain" | Verify signature & chain | Done (only one primary; "Check snapshot integrity" is a default, not blue, button) |
| g | Reviews → Verify chain (header) | Verify signature chain | Close |
| h | Campaigns → New campaign | New campaign | Preview, Cancel |
| i | Campaigns → New campaign → fill in (scope: Spaces = ARTEST) → Preview | Preview campaign | Create campaign, Back |

Screenshot `1.2-<letter>-<theme>.png` for each. Do **not** click Create campaign in (i) unless step 1.6 says so.

### 1.3 Modal button order (R-7.1) [A, light]

1. After step 1.6.5 (the "E2E phase 1" campaign on ARTEST exists): Campaigns → row menu (…) of "E2E phase 1" →
   "Delete…".
2. Expected: modal with Cancel (subtle) then the red "Delete campaign" button, both on the RIGHT. Press Cancel first
   (the modal closes, nothing is deleted), then open it again and confirm, to clean up.
3. Screenshot `1.3-confirm-modal-<theme>.png` (light and dark).

### 1.4 Empty states (R-8.5, R-8.6, R-3.2) [S/A, light/dark]

1. Exceptions → status filter "Active" with no active exceptions. Expected: small empty state "No exceptions yet" (small
   heading). Switch the filter to "Expired" (or any other) with no results. Expected: "No exceptions / Nothing matches
   this filter." inside the table area, **not** "No exceptions yet". Before this branch, every filter said "No
   exceptions yet" (before/after pair).
2. Alerts with no alerts: "No alerts" with a small heading and a one-sentence description.
3. Changes with only one snapshot: "One snapshot so far" with a small heading and a one-sentence description.
4. Snapshots while a snapshot is running and none is finished (fresh install only; skip if not reproducible): header
   "Take snapshot now" is disabled and the empty state shows **no** second button.
5. Space settings for ARTEST → AccessRadar (project settings page) with no assigned review: "No assigned review" with
   one sentence and no em dash.
6. Screenshots `1.4-<n>-<theme>.png`.

### 1.5 Skeleton vs loaded layout (R-10.1, R-10.7, R-10.8) [A, light; repeat Overview and Reviews in dark]

Chrome DevTools → Network → throttling "Slow 4G". Reload the iframe page (Ctrl/Cmd+R on the Jira page). For each, take
a screenshot of the skeleton and of the loaded page **at the same scroll position**, and compare: same section titles,
same number of KPI tiles, same table column headers, no jump of header or sections.

| # | Page / panel | Must match |
|---|---|---|
| a | Overview | 5 tiles; Risk indicators; Changes since the previous snapshot; **Weekly digest with 5 tiles** (new); Access reviews |
| b | Spaces → open space (any) | table columns include the key-permission columns (e.g. "Browse projects", "Administer projects") |
| c | Groups | 3 filter controls, 5 columns |
| d | Groups → open a group | panel sections Access, Spaces, Members appear while loading (new) |
| e | People → open a person | avatar line, Details terms (Account ID, Account type, Status, Jira administrator), sections Global permissions, Groups, Spaces (new) |
| f | Snapshots → open a snapshot | Details terms Status … Content hash while loading (new) |
| g | Reviews → open an ARTEST review | 4 tiles, filters, items table, **Review record** section (new) |
| h | Reviews → open a signed ARTEST review | Remediation: 5 columns on Advanced, including "Checked in snapshot" |
| i | Reviews → Verify chain | lozenge + table "Chain #, Status, Detail" while loading (new) |
| j | Campaigns → open a run | table "Space, Assignee, Status, Due" and the **Close** footer while loading (new) |
| k | Settings | Edition, Snapshot schedule … Reviews, **Change alerts** (Advanced), **Security & data** (new) |
| l | Space settings ARTEST → AccessRadar (assigned review) | 4 tiles **with hint rows** (new) |

Panel headers (title and description) must never be skeletons. Screenshots `1.5-<letter>-skeleton.png` /
`1.5-<letter>-loaded.png`.

### 1.6 Errors, toasts and inline messages (R-8.7, R-9.2, R-9.4, R-10.13) [A, light]

1. Reviews → ARTEST review → "Revoke…" on an item → justification "E2E offline check" → DevTools → Network →
   Offline → Revoke. Expected: inline red error under the fields, directly above the footer (not above the Decision
   radios), and **no** red toast. Before this branch both appeared, and the inline one was above the radios
   (before/after pair). Go back online → Cancel.
2. Settings → Key permissions → Edit → remove every permission. Expected: "Pick at least one permission." directly
   under the Select (red), Save still enabled. Cancel.
3. Settings → Collection → Edit → set "API budget" (or another number field) to a value outside its range. Expected: a
   red error under the field, "Enter a number between … and …". Cancel.
4. People → open a person → Global permissions → Check now. Expected: the list appears. On failure: a red toast "Could
   not check global permissions" (no inline red text).
5. Campaigns → New campaign → name "E2E phase 1", scope Spaces = ARTEST, valid dates → Preview → Create campaign.
   Expected: the button shows a spinner while saving, then toast "Campaign created". Then run step 1.3, which deletes
   this campaign again.
6. Get started (Jira settings → Apps → "Get started with AccessRadar") → if "Take the first snapshot" is shown, click
   it. Expected: toast "Snapshot #N started" (or "already running"). No inline red box.
7. Offline retry (optional): DevTools → Network → Offline → Reviews → Verify chain. Expected: error box "Chain could not
   be verified" with "Try again". Go back online → Try again → result table.

### 1.7 Dates follow the Jira locale (R-6.1, R-6.3) [A, light]

1. Avatar → Profile → Language: English (United States). Reload AccessRadar → Snapshots and Reviews.
2. Expected: dates in US style ("Nov 11, 2026, 06:30 PM"); the Reviews "Due" column shows the date only ("Nov 11,
   2026") with no stray comma fragments. Before this branch it showed "11 Nov 2026".
3. Language: Polski. Expected: Polish month abbreviations ("11 lis 2026, 18:30"). The rest of the UI stays English
   (i18n is on hold).
4. Set the language back to its original value.
5. Times stay in the Jira profile time zone (Settings → Snapshot schedule shows "(from HH:MM <zone>)").
6. Exports are unchanged: Snapshots → open snapshot → Download coverage CSV, and timestamps stay
   `YYYY-MM-DD HH:MM:SS (Zone)` / `… UTC`.
7. Screenshots `1.7-en-US.png`, `1.7-pl.png`.

### 1.8 Header actions breakpoint 900px (R-1.16) [A, light]

1. Resize the browser so the iframe is exactly 900px wide (DevTools device toolbar → responsive 900 + sidebar), then
   901px.
2. Expected: at ≤900px the header actions move under the title and only the primary stays visible (others in "More
   actions"). At ≥901px they are on the title row. Before this branch the switch happened at 899px.

### 1.9 200% zoom: Overview and Reviews (R-1.18, R-11.6) [A, light/dark]

1. Browser zoom 200% at 1280x800.
2. Overview and Reviews (list and an ARTEST review detail).
3. Expected: single page scroll, header not pinned (line stays, no fade), the sidebar replaced by the menu button +
   brand bar, nothing cut off, tables scroll sideways inside their own area, buttons wrap, no sideways scroll of the
   page.
4. Screenshots `1.9-overview-200-<theme>.png`, `1.9-reviews-200-<theme>.png`.

### 1.10 Mobile width 390px [A, light]

DevTools device toolbar 390x844: Overview, Reviews, Settings → Edit (panel). Expected as in 1.9; the side panel
covers the width.

### 1.11 Get started step markers (R-8.10) [S/A, light/dark]

Get started page: unfinished steps show a bold number (no grey Badge pill); finished steps a green check. Before/after
pair.

### 1.12 Standard edition copy [S]

With the override on Standard:

1. Reviews → open a review. The PlanNote says signing needs Advanced. The header has no "Verify chain".
2. Campaigns: PlanNote "requires Advanced" and no "New campaign" button.
3. Space settings ARTEST → AccessRadar: PlanNote for delegated reviews.
4. Expected: every Advanced marker is the purple "Advanced" lozenge, at most one per section.

## 2. Standard regression pass [S/A unless noted, light]

1. **Overview**: tiles, risk indicators, changes, weekly digest (Refresh digest shows a spinner on the button and a
   toast), access reviews. Click one risk indicator → panel opens on the right → Close.
2. **Explore → Spaces**: search; open ARTEST → table; row "Why" → Why panel shows the path; export menu (CSV) downloads.
3. **Explore → Groups**: filter; open a group → Access / Spaces / Members.
4. **Explore → People**: search a person → panel → Check now (global permissions).
5. **Changes**: pick two snapshots; tabs switch; each tab scrolls under the tab bar fade.
6. **Reviews** (ARTEST only): Start a review (scope Spaces = ARTEST) → open it → set decisions Keep / Revoke (with
   justification) / Exception (expiry date) → [A] Sign off → Verify → both checks "Verified". [S] Sign off shows
   "requires Advanced".
7. **Exceptions**: the exception from step 6 is listed under "Active"; "Open review" navigates.
8. **Alerts**: list and filter; [S] PlanNote for real-time alerts plus the weekly digest.
9. **Campaigns** [A]: list; open a run if one exists (Close footer); do not create campaigns outside ARTEST.
10. **Snapshots**: Take snapshot now → toast → progress banner → completes → open the snapshot panel → Details,
    Contents, Coverage, Export.
11. **Settings**: every section's Edit panel opens and Cancel closes it without saving; Edition override switch works
    (toast).
12. **Get started**: progress, steps, Refresh button.
13. **Space settings → AccessRadar** (ARTEST): the delegated review page loads; with an assigned campaign review,
    decisions save (Advanced).
14. **Rovo**: open Rovo chat → agent "AccessRadar" → ask "Who can administer space ARTEST?". Expected: a list of
    people/groups with the scheme/role path, based on the latest snapshot, read-only. On Standard: the answer says it
    requires Advanced.
15. **MCP** (optional, Advanced): tool `ar-review-status` with input `{}`. Expected: JSON with open/overdue review
    counts, the same as the Reviews page.

## 3. Logs (bot, after deploy)

`npx forge logs -e development --since 30m`: paste the lines here. Errors must be 0. Tick/collector lines show real
`sql` counts.

```
LOGS_TBD
```

## Result

The phase is **not done** until the browser agent reports PASS for every step above, with screenshots.
