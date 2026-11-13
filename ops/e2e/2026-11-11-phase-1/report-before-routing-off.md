# AccessRadar phase 1 E2E — partial run, 2026-11-11

**NOT a completed checklist.** Counts are table rows (footer checks split from unverified header-scroll checks): **6 PASS, 0 FAIL, 69 SKIPPED**. No product FAIL was established; untested cases are not passes.

## Environment and stop condition
- Used only supplied DEVELOPMENT app URL ending `b98d505b-afb5-4c8d-a8f9-5306b85e352d`; confirmed Jira sidebar DEV badge. Never opened production AccessRadar.
- The user's computer is offline; browsing ran over the box's own network, not through the user's computer.
- Starting theme **Light**; Jira profile language **English (United States)**; timezone **Europe/Warsaw**; edition override **Use the license**, effective **Advanced**.
- Native Computer was used only to inspect browser chrome and try DevTools for required viewport/network setup. Ctrl+Shift+I and F12 had no visible effect. No Offline or Slow 4G setting was activated.
- Evidence is native browser screenshots at **1920x1072**, not a verified 1280x800 CSS viewport/DPR 2 capture. This is a global evidence limitation; geometry and breakpoint tests cannot be certified. Some early screenshots caught transitions; final light drawer evidence was retaken with animations disabled.
- During a scoped Keep-decision loop, a disabled Keep button timed out; subsequent page accessibility reads timed out (5s then 10s). A **single new-tab retry** of the exact dev URL timed out at `page.goto`, 25s waiting for DOMContentLoaded. Stopped all browser work at that point per the network rule. No access-denied/captcha or refused HTTP action was observed; no bot protection attribution.

## Results

| Step | PASS/FAIL/SKIPPED | One-line observation | Screenshot(s) |
|---|---|---|---|
| 1.1 overview | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. | 1.1-overview-scrolled-light.png; 1.1-overview-scrolled-dark.png |
| 1.1 spaces | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. Current content did not overflow enough for a 300px content scroll. | 1.1-spaces-scrolled-light.png; 1.1-spaces-scrolled-dark.png |
| 1.1 groups | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. Current content did not overflow enough for a 300px content scroll. | 1.1-groups-scrolled-light.png; 1.1-groups-scrolled-dark.png |
| 1.1 people | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. Current content did not overflow enough for a 300px content scroll. | 1.1-people-scrolled-light.png; 1.1-people-scrolled-dark.png |
| 1.1 changes | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. Dark capture remained near top; tab-bar line observed. | 1.1-changes-scrolled-light.png; 1.1-changes-scrolled-dark.png |
| 1.1 reviews | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. Current content did not overflow enough for a 300px content scroll. | 1.1-reviews-scrolled-light.png; 1.1-reviews-scrolled-dark.png |
| 1.1 exceptions | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. Current content did not overflow enough for a 300px content scroll. | 1.1-exceptions-scrolled-light.png; 1.1-exceptions-scrolled-dark.png |
| 1.1 alerts | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. | 1.1-alerts-scrolled-light.png; 1.1-alerts-scrolled-dark.png |
| 1.1 campaigns | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. Current content did not overflow enough for a 300px content scroll. | 1.1-campaigns-scrolled-light.png; 1.1-campaigns-scrolled-dark.png |
| 1.1 snapshots | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. | 1.1-snapshots-scrolled-light.png; 1.1-snapshots-scrolled-dark.png |
| 1.1 settings | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. | 1.1-settings-scrolled-light.png; 1.1-settings-scrolled-dark.png |
| 1.1 activity | SKIPPED | Advanced light/dark captured; Standard not run; exact fade geometry not measured. | 1.1-activity-scrolled-light.png; 1.1-activity-scrolled-dark.png |
| 1.2 a footer | PASS | Snapshot schedule: primary on left followed immediately by Cancel in both themes. | 1.2-a-light.png; 1.2-a-dark.png |
| 1.2 a header scroll | SKIPPED | Header/title stayed readable and divider visible; scrolled-body fade not exercised/verified. | 1.2-a-light.png; 1.2-a-dark.png |
| 1.2 b footer | PASS | Key permissions: primary on left followed immediately by Cancel in both themes. | 1.2-b-light.png; 1.2-b-dark.png |
| 1.2 b header scroll | SKIPPED | Header/title stayed readable and divider visible; scrolled-body fade not exercised/verified. | 1.2-b-light.png; 1.2-b-dark.png |
| 1.2 c footer | PASS | Start review: primary on left followed immediately by Cancel in both themes. | 1.2-c-light.png; 1.2-c-dark.png |
| 1.2 c header scroll | SKIPPED | Header/title stayed readable and divider visible; scrolled-body fade not exercised/verified. | 1.2-c-light.png; 1.2-c-dark.png |
| 1.2 d footer | PASS | Revoke access: primary on left followed immediately by Cancel in both themes. | 1.2-d-light.png; 1.2-d-dark.png |
| 1.2 d header scroll | SKIPPED | Header/title stayed readable and divider visible; scrolled-body fade not exercised/verified. | 1.2-d-light.png; 1.2-d-dark.png |
| 1.2 d2 footer | PASS | Grant exception: primary on left followed immediately by Cancel in both themes. | 1.2-d2-light.png; 1.2-d2-dark.png |
| 1.2 d2 header scroll | SKIPPED | Header/title stayed readable and divider visible; scrolled-body fade not exercised/verified. | 1.2-d2-light.png; 1.2-d2-dark.png |
| 1.2 e | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.2 f | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.2 g | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.2 h | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.2 i | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.3 | SKIPPED | Campaign creation/deletion not reached; E2E phase 1 was never created. | — |
| 1.4.1 | SKIPPED | Active exceptions already exist; empty Active case unavailable; Expired filter not exercised. | — |
| 1.4.2 | SKIPPED | 173 alerts already exist; no-alerts case unavailable. | — |
| 1.4.3 | SKIPPED | 34 snapshots already exist; one-snapshot case unavailable. | — |
| 1.4.4 | SKIPPED | Not a fresh install; completed snapshots already exist. | — |
| 1.4.5 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.5 a | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.5 b | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.5 c | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.5 d | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.5 e | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.5 f | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.5 g | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.5 h | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.5 i | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.5 j | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.5 k | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.5 l | SKIPPED | DevTools Slow 4G could not be enabled: Ctrl+Shift+I then F12 had no visible effect; no throttled skeleton/loaded comparison. | — |
| 1.6.1 | SKIPPED | DevTools Offline unavailable; Revoke drawer opened but Revoke was never submitted. Cancelled safely. | 1.2-d-light.png; 1.2-d-dark.png |
| 1.6.2 | PASS | Clearing all permissions displayed red “Pick at least one permission.” directly under Select; Save remained enabled; Cancel discarded changes. | 1.6-2-light.png |
| 1.6.3 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.6.4 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.6.5 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.6.6 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.6.7 | SKIPPED | Optional offline retry not attempted; DevTools Offline unavailable. | — |
| 1.7 | SKIPPED | Starting language English (United States), timezone Europe/Warsaw recorded; Polish switch and CSV export not reached. | — |
| 1.8 | SKIPPED | Native DevTools shortcuts did not open DevTools; exact 900/901px iframe could not be configured. | — |
| 1.9 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.10 | SKIPPED | Native DevTools shortcuts did not open DevTools; 390x844 device emulation unavailable. | — |
| 1.11 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 1.12.1 | SKIPPED | Standard override not exercised before stop. | — |
| 1.12.2 | SKIPPED | Standard override not exercised before stop. | — |
| 1.12.3 | SKIPPED | Standard override not exercised before stop. | — |
| 2.1 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.2 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.3 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.4 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.5 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.6 | SKIPPED | ARTEST-only “E2E phase 1 review” started (26 items); Keep loop partly executed, then page stalled; Revoke/Exception/sign-off/verify not completed. | — |
| 2.7 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.8 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.9 | SKIPPED | List loaded and existing “E2E 2026-11-11 phase 1” was left untouched; run panel not exercised. | — |
| 2.10 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.11 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.12 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.13 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.14 | SKIPPED | Not reached: browser/page stalled; one fresh-tab navigation retry timed out, then stopped as instructed. | — |
| 2.15 | SKIPPED | Optional MCP explicitly skipped as requested. | — |

## Rovo quotes
None: Rovo regression was not reached. Earlier Activity entries showing Rovo calls predate this run and were not treated as evidence.

## Console errors
No console error could be attributed specifically to AccessRadar during completed interactions. The all-session browser console contained Jira shell preference/user-property 404s, Jira frontend `Permissions policy violation: unload is not allowed in this document`, and later `net::ERR_TIMED_OUT` for Atlassian analytics (`xp.atlassian.com`). These are not proof of an AccessRadar defect. All-session logs include earlier browsing and cannot be used for a clean error count for this run. No server/Forge logs were collected (section 3 is outside requested 1–2 run).

## Findings
- Verified the requested left-to-right drawer footer order in five drawers in both themes, and the empty-permission inline validation + enabled Save. Cancel discarded permission edits; no settings were saved.
- Most list pages fit within the current large viewport, limiting the scroll/fade check. Long Overview, Changes, Alerts, Snapshots, Settings and Activity screenshots show a fixed page title and subtle separating/fading region, but the requested all-edition geometry matrix remains unverified.
- Empty-state scenarios are not currently reproducible for Active Exceptions, Alerts, one-snapshot Changes, or fresh-install Snapshots without destructive changes; existing data was not removed.
- Before screenshots requiring production were omitted; production was never opened.
- No real Jira permissions/access, groups, schemes, other spaces, other apps, or their settings were modified. No Revoke submission occurred (online or offline).

## Final state / cleanup needed
- Edition override: **Use the license**, effective **Advanced** (unchanged throughout).
- Language: **English (United States)** (unchanged throughout); timezone Europe/Warsaw.
- Theme: **last successfully selected Dark**, starting Light. **Restoration to Light could not be completed because the page/new-tab retry timed out and the run stopped.** Restore Light when Jira becomes reachable.
- New AccessRadar review **“E2E phase 1 review”**, scoped strictly to **ARTEST**, created successfully on snapshot #34 with **26 items**. It inherited one existing exception and had 25 undecided items at creation. A loop attempted Keep records and reached its tenth indexed iteration before timeout; the exact count saved is **not verified** after the stall (dynamic filtered-row indexing means some undecided rows may have been skipped). Review remains unsigned/draft as last observed. Inspect this review on resume; do not assume all decisions saved. No newly granted exception or Revoke decision was submitted.
- Existing exception associated with “E2E 2026-11-11 review” was not targeted; no Keep action targeted its non-Undecided row.
- Campaign **“E2E phase 1”** was **never created**, so there was nothing from step 1.6.5 to delete. Existing campaign **“E2E 2026-11-11 phase 1”** left untouched; Run now was not clicked.
- No snapshots were started; no other test data created. Permission-clear validation was cancelled and never saved.
- A personal-settings read tab and one failed fresh retry tab may remain open; no additional navigation/cleanup was attempted after the required stop.


## Retry requested at 20:06 Europe/Warsaw
- Reloaded the exact development URL in the existing dev tab: `page.goto` failed with `net::ERR_TIMED_OUT`.
- Retried once in a new tab, as required by the original network rule: same `net::ERR_TIMED_OUT`, ending at `chrome-error://chromewebdata/`. Stopped further site attempts.
- A screenshot of the failure was attempted but also timed out (`screenshot_timeout`, 10s, page did not paint). No new screenshot evidence was produced.
- No further review decisions, campaigns, settings, language, theme, or edition changes could be made. The draft review and cleanup state remain as documented above; Light restoration remains outstanding.
- Per retry instructions, DevTools-only steps remain SKIPPED without further attempts: 1.5 a–l (throttling), 1.6.1 and 1.6.7 (offline), 1.8 and 1.10 (device toolbar/exact width). Browser-zoom step 1.9 was not reachable because Jira would not load.
- **Final counts remain 6 PASS, 0 FAIL, 69 SKIPPED** (75 table rows; no additional product failure established). This is an incomplete E2E run, not approval of phase 1.
