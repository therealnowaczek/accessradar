# AccessRadar DEV — E2E 2026-11-11, phase 0

## Scope and outcome

Executed on marginradar.atlassian.net as the existing Jira administrator session, 11 November 2026. Target: AccessRadar DEV, requested build 2.92.0, environment `b98d505b-afb5-4c8d-a8f9-5306b85e352d`. The DEV badge and exact development environment URL were used throughout; production AccessRadar was not tested. Installed build number was not independently re-verified in this continuation.

**Outcome: requested functional flows passed, with non-blocking presentation/wording findings below.** A3 is intentionally unavailable in Standard. No sign-in, 2FA, or CAPTCHA interruption during the successful run.

The user's computer was offline; this successful run used the agent's own network, not traffic routed through the user's computer. Old network-failure screenshots remain in this folder from earlier attempts; they do not describe this run's result.

Only ARTEST was created/used for test records: team-managed Kanban, name **AccessRadar E2E**. No other project, group, scheme, real access permission, or other app setting was modified. Site-wide Overview/Groups/People/Changes were viewed read-only as requested. Review decisions are AccessRadar records, not Jira permission changes. No real access was revoked and no revoke was submitted.

## PASS/FAIL results

| Step | Result | One-line observation | Screenshot(s) |
|---|---|---|---|
| Network / Jira | PASS | Jira loaded in the new-tab retry and existing signed-in session worked. | `00-artest-created.png` |
| ARTEST setup | PASS | Created missing team-managed AccessRadar E2E with key ARTEST. | `00-artest-created.png` |
| 0 — Advanced / snapshot | PASS | Advanced override tested; current snapshot #34 is Complete on Nov 11 and ARTEST appears in Spaces. | `c-settings-advanced.png`, `c-overview.png`, `c-artest-why.png` |
| A1 — helper / calendar / mouse | PASS | Due date helper and calendar button present; calendar date can be selected by mouse. | `a1-dark-calendar.png`, `a1-standard-calendar.png` |
| A1 — text formats | PASS | `27/12/2026` + Enter → `27 Dec 2026`; `2026-12-28` → `28 Dec 2026`. | `a1-dark-calendar.png` |
| A1 — invalid / clear | PASS | `31 Feb 2026` was not accepted; clearing optional due date left Start review available. | `a1-dark-calendar.png` |
| A1 — dark / persistence | PASS | Dark calendar readable; ARTEST review E2E 2026-11-11 review survived reload with due date 28 Dec 2026. | `a1-dark-calendar.png`, `c-review-verified.png`, `b-rovo-reviews.png` |
| A2 — helper / calendar / mouse | PASS | Exception Expires on has helper and calendar control; mouse selection works. | `a2-dark-calendar.png` |
| A2 — text formats | PASS | Slash input normalized to 27 Dec 2026; ISO input normalized to 28 Dec 2026. | `a2-dark-calendar.png` |
| A2 — invalid / clear | PASS | Impossible February date refused; empty expiry blocked saving the exception. | `a2-dark-calendar.png` |
| A2 — dark / saved exception | PASS | Dark calendar readable; justified ARTEST exception persisted with 28 Dec expiry and appears Active. | `a2-dark-calendar.png`, `c-exceptions.png` |
| A3 — helper / calendar / mouse | PASS | Start date (UTC) has date-format helper and calendar button; mouse selection works. | `a3-dark-calendar.png` |
| A3 — text formats / invalid | PASS | Slash and ISO inputs normalized to 27 / 28 Dec; `31 Feb 2026` reverted to the last valid date, not a rolled-over date. | `a3-dark-calendar.png` |
| A3 — clear / dark | PASS | Clear exercised; dark calendar labels/grid readable. No optional/required expectation was specified for A3 clear. | `a3-dark-calendar.png` |
| A3 — save / reload | PASS | E2E 2026-11-11 phase 1 persisted, quarterly and active, next run Dec 28, 2026, 10:00 AM. | `a3-campaign-persisted.png` |
| A1 — Standard smoke | PASS | Review creation drawer/date picker available; slash input normalized and mouse selection worked; canceled without creating a duplicate. | `a1-standard-calendar.png` |
| A3 — Standard smoke | PASS | Campaign page explicitly requires Advanced; no New campaign/date input exposed. | `a3-standard-gate.png` |
| B1 — Advanced access question | PASS | Returned ARTEST access subjects and snapshot #34, including the administrator and app integrations. | `b-rovo-access.png` |
| B2 — Advanced changes question | PASS | Returned 130 changes from #33 to #34, grants in ARTEST; disclosed truncation to first 50. | `b-rovo-changes.png` |
| B3 — Advanced review-status question | PASS | Reported no open/overdue reviews and E2E review Signed, 26/26, due 2026-12-28; wording caveat below. | `b-rovo-reviews.png` |
| B4 — Standard after Advanced | PASS | Fresh AccessRadar chat refused access lookup with explicit Advanced-edition requirement. | `b-rovo-standard.png` |
| C — Overview | PASS | Snapshot metrics, risk indicators, changes and review summary rendered; current snapshot Complete. | `c-overview.png` |
| C — Spaces / ARTEST / Why | PASS | ARTEST present; Why panel rendered access rationale. | `c-artest-why.png` |
| C — Groups | PASS | Group listing rendered, viewed read-only. | `c-groups.png` |
| C — People | PASS | People listing rendered, viewed read-only. | `c-people.png` |
| C — Changes | PASS | Change listing rendered; 130 grants and zero revokes since #33. | `c-changes.png`, `c-overview.png` |
| C — Reviews decisions / sign-off | PASS | ARTEST review contains Keep and Exception decisions; completed 26/26 and signed, no revokes. | `c-review-verified.png` |
| C — Verify chain | PASS | Verify signature chain reported Intact · 2 signed; both chain entries OK. | `c-chain-intact.png` |
| C — Exceptions | PASS | Saved A2 exception listed Active with justification and expiry; display-ID issue below. | `c-exceptions.png` |
| C — Alerts | PASS | Alerts page rendered; no real-access action or unrelated configuration changed. | `c-alerts.png` |
| C — Campaigns | PASS | Saved A3 campaign listed active after reload. | `a3-campaign-persisted.png` |
| C — Settings | PASS | Settings rendered; edition overrides worked; collection/security defaults not edited. | `c-settings-advanced.png`, `end-license-restored.png` |
| C — Get started | PASS | Correct DEV onboarding page rendered, 2/3 steps complete; schedule-confirmation step left unchanged. | `c-get-started.png` |
| C — ARTEST project settings / DEV | PASS | Access review module rendered No assigned review, expected with no active delegated review scheduled yet. | `c-artest-project-settings.png` |
| C — layout / console inspection | PASS | No blocking app error/layout break observed after viewport adjustment; Jira-host console messages listed below. | `c-overview.png`, `c-artest-project-settings.png` |
| End — edition / theme | PASS | Override restored to Use the license (development effective Advanced); original Light theme restored and checked. | `end-license-restored.png` |

## Rovo quotes

- **Who can access ARTEST?** “The list includes 26 subjects in total” and “Marcin Nowak is the primary individual user identified.”
- **What changed in access since the last snapshot?** “Comparing snapshot #33 to #34 … there were 130 changes in total.” The answer explicitly says the first 50 are summarized and all are grants within ARTEST.
- **What is the status of access reviews?** “there are currently no overdue or open reviews.” The E2E row was Signed, 26/26, due 2026-12-28.
- **Standard:** “I'm unable to retrieve the access information for the ARTEST project because the AccessRadar Rovo agent requires the Advanced edition of AccessRadar.”

## Findings and console messages

1. **Exceptions presentation:** Subject and Granted by display raw account identifiers, and Space/Group displays numeric project ID rather than ARTEST/name. Functionally the correct exception is present, but this reduces readability (`c-exceptions.png`).
2. **Rovo terminology:** The status response says “All configured campaigns have been signed off” and labels reviews “Campaign Name”. It is returning signed review sessions; the recurring E2E campaign remains active with a future run. Prefer “reviews” to avoid conflating the two (`b-rovo-reviews.png`, `a3-campaign-persisted.png`). Its subject table also labels app integrations generically as `user` despite identifying them as apps in prose.
3. **Invalid-date feedback:** Impossible dates are refused by restoring/retaining the last valid date; there was no prominent dedicated validation error. This satisfies refusal, but explicit feedback would be clearer. Committed dates are rendered as selected combobox text; the underlying inputValue may be empty, so visible normalized text was used for assertions.
4. **Viewport:** A calendar click initially timed out as outside the viewport. Chrome was maximized/zoomed out using native browser controls, after which calendar interaction worked. This is a small-viewport usability observation, not a confirmed application logic failure. Computer tools were used only for those native window/zoom adjustments.
5. **Console, main DEV admin page:** four host errors: two 404s for Jira `mypreferences` custom-nav-bar dismissed flags, plus two “Permissions policy violation: unload is not allowed in this document” from Jira's shared frontend bundle. No AccessRadar-specific runtime exception was observed in that console.
6. **Console, ARTEST DEV project page:** the same four host messages, plus a 404 for `jira.its.changeboarding.preferences`. No visible app failure. These preference 404s are not sign-in/bot refusals.
7. An auxiliary Atlassian admin app-details navigation was slow/timed out; it was not needed for the requested project module, which was subsequently opened directly and passed.

## Persisted test artifacts and limitations

- Project: ARTEST / AccessRadar E2E, team-managed.
- Review: E2E 2026-11-11 review, ARTEST only, Signed, chain #2, 26/26 decisions, due 28 Dec 2026.
- Exception justification: “E2E 2026-11-11 temporary exception for ARTEST date validation” (≥10 characters); active through 28 Dec 2026.
- Campaign: E2E 2026-11-11 phase 1, ARTEST only, quarterly, active, future next run 28 Dec 2026. Not manually run, paused, or deleted; retained as requested evidence.
- Standard A3 date-entry/save is **not applicable / skipped** because the feature is Advanced-gated, not a broken date picker.
- Actual permission revocation, future campaign execution, unrelated onboarding/settings changes, and edits to other projects/apps were deliberately not performed.
- Screenshots are evidence of representative states; not every typed intermediate value has its own screenshot. Installed build 2.92.0 was supplied in the task and was not independently re-confirmed here.
- Final edition: **Use the license**, displaying **Development site (no license): Advanced**. Final theme: **Light**, the original theme.
