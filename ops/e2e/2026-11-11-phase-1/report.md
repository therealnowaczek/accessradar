# AccessRadar phase 1 E2E — resumed partial run, 2026-11-11

**NOT complete / not release approval.** Original 75 result rows retained: **13 PASS, 4 FAIL, 58 SKIPPED**. Partial edition/theme matrices remain SKIPPED. Previous report is preserved in `report-before-routing-off.md`.

## Environment / stop condition
- Used only supplied DEVELOPMENT environment ending `b98d505b-afb5-4c8d-a8f9-5306b85e352d`; DEV badge confirmed in Jira admin and ARTEST space settings. Never opened production.
- The user's Mac is offline / routing through it is off; browsing used the box's own network, not the user's computer. Jira loaded on resume.
- Starting Dark / English (US) / Europe/Warsaw / Use the license (Advanced). Exercised Standard and Polski; restored original language, Light, and license override.
- DevTools-only 1.5 a–l, 1.6.1, 1.6.7, 1.8, 1.10 SKIPPED immediately per request. No throttling/offline/device toolbar attempts. MCP 2.15 and production before shots skipped.
- Native desktop 1280×800; normal browser screenshots 1920×1072. Required CSS viewport / DPR2 not independently certified, limiting exact geometry certification. Native Chrome zoom confirmed 200% for 1.9, restored 100%. Browser screenshots at zoom cropped the page, so Computer native screenshots were used for that technical capture failure; Computer otherwise used only for native Chrome zoom.
- Dynamic-row and offscreen dummy Select locator errors were resolved with stable refs/fresh reads and keyboard selection. Finally a multi-page Standard-light screenshot script hit the tool's **30-second limit at mouse.wheel**; fresh snapshot showed Jira shell without app. Retried exact DEV URL **once in a new tab**, which loaded. Conservatively stopped test execution per “retry once ... then stop”, then performed required cleanup verification only. Failed batch returned no usable Light screenshots.
- No captcha, access-denied wall, HTTP refusal or persistent connection drop observed on resume; no bot-protection attribution.

## Results

| Step | PASS/FAIL/SKIPPED | observation | screenshots |
|---|---|---|---|
| 1.1 overview | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Fixed title and subtle divider/fade observed. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-overview-standard-dark.png |
| 1.1 spaces | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Content too short to certify 300px scroll/fade. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-spaces-standard-dark.png |
| 1.1 groups | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Content too short to certify 300px scroll/fade. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-groups-standard-dark.png |
| 1.1 people | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Content too short to certify 300px scroll/fade. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-people-standard-dark.png |
| 1.1 changes | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Content too short to certify 300px scroll/fade. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-changes-standard-dark.png |
| 1.1 reviews | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Content too short to certify 300px scroll/fade. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-reviews-standard-dark.png |
| 1.1 exceptions | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Content too short to certify 300px scroll/fade. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-exceptions-standard-dark.png |
| 1.1 alerts | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Fixed title and subtle divider/fade observed. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-alerts-standard-dark.png |
| 1.1 campaigns | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Content too short to certify 300px scroll/fade. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-campaigns-standard-dark.png |
| 1.1 snapshots | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Fixed title and subtle divider/fade observed. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-snapshots-standard-dark.png |
| 1.1 settings | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Fixed title and subtle divider/fade observed. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-settings-standard-dark.png |
| 1.1 activity | SKIPPED | Standard dark retested; loading finished and 300px wheel attempted. Fixed title and subtle divider/fade observed. Earlier Advanced light/dark evidence retained. Standard-light batch timed out: full matrix not passed. | resume/1.1-activity-standard-dark.png |
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
| 1.2 e | SKIPPED | Light Sign off then Cancel footer verified; 26 items / 23 Keep / 1 Revoke / 2 Exceptions. Dark and header-scroll not certified before review was signed. | resume/1.2-e-light.png |
| 1.2 f | SKIPPED | Both themes: Done is only primary; Check snapshot integrity default, not blue. Body too short to exercise header-scroll/fade. | resume/2.6-integrity-mismatch-light.png; resume/1.2-f-dark.png |
| 1.2 g | SKIPPED | Both themes: primary Close footer; chain Intact, 3 signed, all rows OK. Body too short to exercise header-scroll/fade. | resume/1.2-g-light.png; resume/1.2-g-dark.png |
| 1.2 h | SKIPPED | Both themes: Preview then Cancel on left. Header-scroll/fade not exercised. | resume/1.2-h-light.png; resume/1.2-h-dark.png |
| 1.2 i | SKIPPED | Both themes: Create campaign then Back on left; preview ARTEST only, 26 estimated items. Header-scroll/fade not exercised. Back reset form; refilled ARTEST before Create. | resume/1.2-i-light.png; resume/1.2-i-dark.png |
| 1.3 | PASS | Cancel then red Delete campaign on RIGHT, both themes. Cancel preserved E2E phase 1; reopened and confirmed deletion, toast Campaign deleted. Existing E2E 2026-11-11 phase 1 untouched. | resume/1.3-confirm-modal-light.png; resume/1.3-confirm-modal-dark.png; resume/1.3-deleted-toast-dark.png |
| 1.4.1 | SKIPPED | Active empty precondition unavailable (two exceptions). Advanced Expired light/dark correctly shows No exceptions / Nothing matches this filter in table. Standard empty-state matrix incomplete. | resume/1.4-1-expired-light.png; resume/1.4-1-expired-dark.png |
| 1.4.2 | SKIPPED | 173 alerts already exist; no-alerts case unavailable. | — |
| 1.4.3 | SKIPPED | 34 snapshots already exist; one-snapshot case unavailable. | — |
| 1.4.4 | SKIPPED | Not a fresh install; completed snapshots already exist. | — |
| 1.4.5 | FAIL | ARTEST DEV No assigned review description has TWO sentences and an em dash; expected one sentence without em dash. Both themes. Exact copy in findings. | resume/1.4-5-light.png; resume/1.4-5-dark.png |
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
| 1.6.3 | PASS | API budget = 1 gives red Enter a number between 500 and 65,000 directly under field. Cancelled; 20,000 default preserved. | resume/1.6-3-light.png |
| 1.6.4 | SKIPPED | Standard Check now succeeded with 7 global-permission results and Checked timestamp. Required Advanced repeat not completed. | resume/2.4-person-standard-light.png |
| 1.6.5 | PASS | Created E2E phase 1, Selected spaces = ARTEST, valid Nov 18 start / 14-day window. Saving spinner and Campaign created toast captured; deleted in 1.3. | resume/1.6-5-saving-light.png; resume/1.6-5-created-light.png |
| 1.6.6 | SKIPPED | Get started DEV entry not reached before stop; completed snapshots already exist. | — |
| 1.6.7 | SKIPPED | Optional offline retry not attempted; DevTools Offline unavailable. | — |
| 1.7 | SKIPPED | US Nov 11, 2026, 07:32 PM; Polish 11 lis 2026, 19:32, Due 28 gru 2026 date only; app stayed English. Coverage CSV kept numeric UTC / Europe/Warsaw timestamps. Polish exercised while Standard, not required Advanced: full step not passed. Restored/verified English (US). | resume/1.7-pl-snapshots.png; resume/1.7-pl-reviews.png; resume/2.10-detail-light.png; resume/1.7-language-restored.png |
| 1.8 | SKIPPED | Native DevTools shortcuts did not open DevTools; exact 900/901px iframe could not be configured. | — |
| 1.9 | FAIL | Native Chrome 200% confirmed; compact menu/brand works, Reviews list fits. Overview and ARTEST detail keep title pinned AND fade visible while body scrolls, in both themes. Detail title y=149 before/after bringing Review record into view; Overview y=125 unchanged. Exact CSS 1280x800 not certified. Zoom restored 100%. | resume/1.9-overview-200-light.webp; resume/1.9-overview-200-dark.webp; resume/1.9-reviews-200-light.webp; resume/1.9-reviews-200-dark.webp; resume/1.9-detail-200-light.webp; resume/1.9-detail-200-dark.webp |
| 1.10 | SKIPPED | Native DevTools shortcuts did not open DevTools; 390x844 device emulation unavailable. | — |
| 1.11 | SKIPPED | Get started edition/theme marker matrix not reached before stop. Production before shots omitted. | — |
| 1.12.1 | PASS | Standard Reviews list: purple Advanced note says signing/hash chain needs Advanced; no Verify chain. Signed ARTEST detail also hides Verify and shows one purple Advanced verification note. | resume/1.1-reviews-standard-dark.png; resume/1.12-1-standard-light.png |
| 1.12.2 | PASS | Standard Campaigns has one purple Advanced PlanNote and no New campaign. | resume/1.12-2-standard-light.png; resume/1.1-campaigns-standard-dark.png |
| 1.12.3 | PASS | ARTEST DEV Standard space settings shows delegated-review PlanNote with one purple Advanced lozenge. | resume/1.12-3-standard-light.png |
| 2.1 | SKIPPED | Advanced: five top KPIs, risk panel opens/Close, changes, five digest tiles, access reviews; Refresh now spinner then Digest refresh queued toast. Complete Standard repeat not run. | resume/2.1-digest-spinner-light.png; resume/2.1-digest-toast-light.png; resume/2.1-risk-light.png |
| 2.2 | FAIL | Standard: ARTEST search/detail/Why path works. Export CSV twice: no download event after 5s / 20s and no matrix CSV file appeared; Coverage CSV later downloaded normally. App-versus-browser cause unconfirmed. Advanced repeat not run. | resume/2.2-why-standard-light.png |
| 2.3 | SKIPPED | Standard group search and Access / Spaces / Members (13) loaded. Advanced repeat incomplete. | resume/2.3-group-standard-light.png |
| 2.4 | SKIPPED | Standard person search/detail and Check now yielded seven global-permission checks. Advanced repeat incomplete. | resume/2.4-person-standard-light.png |
| 2.5 | SKIPPED | Standard comparison #34 to #35 loaded, zero differences. Different pair / every-tab scrolling regression not completed. | resume/1.1-changes-standard-dark.png |
| 2.6 | FAIL | Finished/signed E2E phase 1 review, ARTEST only, 26/26 = 23 Keep / 1 Revoke record / 2 Exceptions (one inherited). Signature Verified; chain Intact (3 OK); snapshot #34 integrity Mismatch. No Jira revocation. Standard new-review/sign-off flow not repeated. | resume/1.2-e-light.png; resume/2.6-integrity-mismatch-light.png; resume/1.2-g-light.png |
| 2.7 | SKIPPED | Advanced new ARTEST exception Active; Open review navigated to E2E phase 1 review. Standard list displayed it, navigation repeat not completed. | resume/2.7-active-light.png; resume/1.1-exceptions-standard-dark.png |
| 2.8 | SKIPPED | 173-alert list rendered/scrolled in Standard dark; filters, Advanced repeat and Standard PlanNote check incomplete. | resume/1.1-alerts-standard-dark.png |
| 2.9 | PASS | Advanced list loaded; no existing run link exposed (only Run now/menu), so no run panel available. Temporary E2E phase 1 created/deleted; existing E2E 2026-11-11 phase 1 never run, edited or deleted. | resume/1.6-5-created-light.png; resume/1.3-deleted-toast-dark.png |
| 2.10 | SKIPPED | Advanced started #35: spinner, started toast, live progress; later Overview #35 Complete, 79 calls / 1,142 points. #34 Details/Contents/Coverage/Export loaded; coverage CSV downloaded. Standard repeat / all exports incomplete. | resume/2.10-progress-light.png; resume/2.10-detail-light.png; resume/2.1-risk-light.png |
| 2.11 | SKIPPED | Advanced all seven Edit drawers opened/cancelled; Standard Reviews opened/cancelled, Change alerts Edit absent. Not every Standard drawer repeated. Edition switches worked; final Use the license verified. | resume/2.11-schedule-light.png; resume/2.11-key-permissions-light.png; resume/2.11-retention-light.png; resume/2.11-risk-light.png; resume/2.11-reviews-standard-dark.png; resume/edition-standard-light.png; resume/final-cleanup-light.png |
| 2.12 | SKIPPED | Get started regression not reached before stop. | — |
| 2.13 | SKIPPED | ARTEST DEV page loads: Advanced No assigned review, Standard Advanced PlanNote. No assigned campaign review exists, so delegated decision save not tested. Existing campaign left untouched. | resume/1.4-5-light.png; resume/1.12-3-standard-light.png |
| 2.14 | SKIPPED | Rovo not reached before stop; no chat submitted. | — |
| 2.15 | SKIPPED | Optional MCP explicitly skipped as requested. | — |

## Every FAIL / findings
1. **1.4.5: delegated empty-state copy.** Two sentences and em dash instead of one sentence without em dash. Advanced Light/Dark exact description: “When a Jira admin runs a campaign, the assigned space admin reviews access here. Reminders stay in the app — AccessRadar does not send email.”
2. **1.9: pinned header/fade at native Chrome 200%.** Compact menu/brand bar appears, review list fits. Overview and signed ARTEST detail retain pinned title and fade while content scrolls independently, both themes. Exact CSS viewport not certified: this reports behavior at native Chrome 200%, not an exact breakpoint measurement.
3. **2.2: matrix CSV did not download.** Standard ARTEST detail Export → CSV clicked twice; download-event waits failed after 5s and 20s, no matrix file appeared, no app error/toast. Later coverage CSV downloaded successfully. App versus browser cause unconfirmed; focused manual retest recommended before classifying as confirmed product export bug.
4. **2.6: deep snapshot-integrity mismatch.** Signature Verified and chain Intact (3 signed, rows 1–3 OK), but snapshot #34 integrity Mismatch:
   - Expected `c5a5180d4c6f92580d1e95459803a93a4dc062599b14b22fe4601406187250e3`
   - Actual `c80cce7940641defd6fb4cbb460eb29760a1f2a6052983b8c6e28064c057327e`
   - “Recomputed snapshot hash does not match the signed value.”
   - Signature `70975971707bdd455966993f2ed6ec1c2cda0316ee47e4db1a9c1a86924a23bd`, chain #3, signed Nov 11, 2026, 08:13 PM Europe/Warsaw. Mismatch occurred BEFORE new snapshot #35 started.

### Other observations
- Footer order correct in both themes for Verify, Verify chain, New campaign and Preview campaign; combined rows remain SKIPPED because header-scroll not exercised. Sign-off Light only before record locked.
- Preview campaign Back reset name/scope form; refilled and rechecked ARTEST-only. No entire-site campaign created.
- Expired filter correctly shows No exceptions / Nothing matches this filter in table, Advanced light/dark. Active-empty / no-alerts / one-snapshot / fresh-install preconditions unavailable; no existing data removed.
- Locale observations worked: US date formatting, Polish month abbreviations, date-only Due, app UI remains English. Coverage export `resume/accessradar_coverage_snapshot-34.csv` retains `2026-11-11 19:23:47 UTC / 2026-11-11 20:23:47 (Europe/Warsaw)`.
- Standard basic group/person search and live permission checks worked. Partial S/A regressions not counted as full passes.
- Digest refreshed (spinner, queued toast), then showed #26→#35. Overview showed snapshot #35 Complete.
- No Rovo quotes or chat sent. No MCP calls.

## Final state / cleanup
- **Theme Light**, selected checked in final Theme menu; `resume/final-cleanup-light.png`.
- **Language English (US)** restored from Polski, saved setting verified in Atlassian Account preferences; Jira back in English. Europe/Warsaw unchanged.
- **Edition Use the license**, effective Advanced, verified final read/screenshot. All other Edit panels Cancelled without Save; default 20,000 budget and key permissions preserved.
- **E2E phase 1 review finished and SIGNED**, ARTEST only, snapshot #34, **26/26 decided: 23 Keep / 1 Revoke record / 2 Exceptions**. One exception inherited and untouched. New ARTEST exception for Jira Service Management Widget expires Dec 28, 2026, 11:59 PM Europe/Warsaw; justification “E2E phase 1 temporary ARTEST exception; test record only.”
- Revoke is a **record only** for Tempo Core, justification “E2E phase 1 test record only; no real Jira access removal.” Remediation remains open / still present in later snapshot. **No real Jira access, group, scheme or permission was revoked/edited.**
- Temporary **E2E phase 1** campaign created ARTEST-only, then **deleted** after Cancel/reopen check. Never run. Existing **E2E 2026-11-11 phase 1** untouched throughout.
- One manual DEVELOPMENT snapshot **#35 completed**: 11 spaces, 39 groups, 92 people, 79 calls / 1,142 rate points. Read-only site collection required by checklist; no other space/app/settings edited.
- Zoom restored 100%. Final DEV admin tab on Settings; original failed tabs, language tab, ARTEST delegated tab and earlier DEV tab remain open. No unsaved form work remains.

## Logs / evidence caveats
- Earlier console observations are historical (see preserved report). No clean all-session or Forge server-error count established. Section 3 Forge logs not collected: supplied workspace path is website/checklist files, not an available Forge CLI app checkout. Do not infer zero server errors.
- Original screenshots preserved at report root; new screenshots/export under `resume/`, indexed by `resume/evidence-index.json`. No production before screenshots.
