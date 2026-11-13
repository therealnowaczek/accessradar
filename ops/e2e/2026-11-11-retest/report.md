# AccessRadar development retest — 2026-11-11

## Environment and safety
- Site: https://marginradar.atlassian.net. Development install only; Jira sidebar shows **DEV**. Connected Apps → development app details confirms **Environment: Development**, **Version: 2.93.0**, **Up to date** (`00-development-version.png`). Production app was not opened or used.
- Existing tabs initially contained stale app UI. Both app surfaces were reloaded before the final results below; initial stale observations are excluded.
- Light theme. Browser zoom tested at 200% and 100%, finally restored to **100%**. Requested 1280×800 viewport was set using Chrome's existing “Gallery 1280×800” viewport control. Native browser shortcuts were used only for zoom and viewport controls; all page interaction used browser tools.
- Screenshot limitation: at 200% the browser screenshot tool returned reduced/cropped 640×400 or 960×536 images despite the viewport control showing 1280×800. Those original captures are retained unmodified, with `02-zoom-200-viewport-controls.webp` as native zoom/viewport evidence. 100% primary test screenshots are 1280×800. Version confirmation screenshot is 1920×1072.
- No reviews, exceptions, campaigns, Jira permissions, or app settings were saved or changed. Date-test dialogs were canceled. No other spaces or MarginRadar settings/data were modified. Rovo received the requested read-only question and one ARTEST-only supplemental question for app labeling.
- Edition remains **Use the license** (Advanced from development license behavior); see `08-final-settings.png`.
- No ERR_TIMED_OUT page was encountered during this run.
- The user's computer is offline; browsing was over the box's own network rather than routed through the user's computer.

## Results
All paths in the screenshot column are relative to `/workspace/radrly/accessradar/e2e/2026-11-11-retest/`.

| Step | Result | Actual text / observation | Screenshots |
|---|---|---|---|
| 1. Integrity (2.6) | PASS | “Snapshot integrity” → “Verified”; Expected and Actual are identical: `c5a5180d4c6f92580d1e95459803a93a4dc062599b14b22fe4601406187250e3`. UI says “Verified”, not literal “OK”. | `01-integrity.png` |
| 2. Zoom (1.9) | FAIL | At 100% on both Overview and signed ARTEST review, scrolling content leaves the page title fixed at the top; a fade is visible at the content's upper edge. This fails the title-scroll-away/no-fade requirement. At 200% in the narrow responsive layout the title scrolls away, but the entire title/subtitle header disappears rather than retaining its line. No fade visible in those scrolled captures. Left at 100%. | `02-overview-100.png`, `02-review-100.png`, `02-overview-200.png`, `02-review-200.png`, `02-zoom-200-viewport-controls.webp` |
| 3. Delegated copy (1.4.5) | PASS | Exactly one sentence: “When a Jira admin runs a campaign, the assigned space admin reviews access here, with reminders in the app only (AccessRadar sends no email).” | `03-delegated-copy.png` |
| 4. CSV (2.2) | PASS | `accessradar_access_matrix_snapshot-35_ARTEST.csv`; toast: “Space access CSV downloaded”. Parsed access-matrix section: 1,179 rows, only project key `ARTEST`, only project name `AccessRadar E2E`. A separate Risks summary section follows the matrix; it has aggregate risk rows, not additional space access rows. | `04-csv-downloaded.png` |
| 5. Exceptions | PASS | Both rows show human-readable subject, “ARTEST · AccessRadar E2E”, and “Marcin Nowak” as grantor; Jira Service Management Widget has “App”. Full rows below. | `05-exceptions.png` |
| 6. Rovo | PASS | Development agent confirmed by Skills labeled “(Development)”. Answer reports signed access reviews, not campaign statuses. It additionally notes one recurring campaign. Supplemental “Who can access ARTEST?” labels integrations as “App” and says “1 user and 25 apps/integrations.” Full answer below. | `06-rovo-status.png`, `06-rovo-apps.png` |
| 7. Date validation | PASS | Start review dialog, scope Selected spaces → ARTEST; typed `99/99/2026` into Due date and pressed Enter. Inline error: “Enter a valid date, for example 10/27/2026.” Canceled without starting/saving a review. | `07-date-validation.png` |

## Integrity result text

> Snapshot integrity
>
> Recomputes the content hash of snapshot #34 from stored facts and compares it to the hash recorded when the review was signed.
>
> Verified
>
> Expected
> c5a5180d4c6f92580d1e95459803a93a4dc062599b14b22fe4601406187250e3
>
> Actual
> c5a5180d4c6f92580d1e95459803a93a4dc062599b14b22fe4601406187250e3

## CSV download
- Filename: `accessradar_access_matrix_snapshot-35_ARTEST.csv`
- Absolute Downloads path: `/home/box/Downloads/accessradar_access_matrix_snapshot-35_ARTEST.csv`
- Validation receipt: `csv-validation.json`.
- Export was repeated only to capture the toast at the requested viewport; original download path above is retained.

## Exceptions: two quoted rows
Column order: Subject | Space/Group | Permissions | Justification | Expires | Granted by.

> Jira Service Management Widget · App | ARTEST · AccessRadar E2E | Administer projects, Browse projects, Create issues, Delete issues, Edit issues | E2E phase 1 temporary ARTEST exception; test record only. | active; Dec 28, 2026, 11:59 PM | Marcin Nowak

> Marcin Nowak | ARTEST · AccessRadar E2E | Administer projects, Browse projects, Create issues, Delete issues, Edit issues | E2E 2026-11-11 temporary exception for ARTEST date validation | active; Dec 28, 2026, 11:59 PM | Marcin Nowak

## Rovo: requested question and exact answer text
Question: “What is the status of access reviews?”

> Based on the latest AccessRadar snapshot (Sequence 35, captured at 2026-11-11 19:25:22 UTC), all current access reviews have been signed. There are no open or overdue reviews at this time.

### Signed Reviews

| Review | Status | Decided | Due Date |
|---|---|---|---|
| E2E phase 1 review | Signed | 26/26 | blank |
| E2E 2026-11-11 review | Signed | 26/26 | 2026-12-28 |
| Q4 2026 access review | Signed | 244/244 | blank |
| Q4 2026 access review | Signed | 170/170 | blank |

> Notes:
>
> There is 1 recurring campaign scheduled.
>
> For more details or to manage these reviews, please visit the AccessRadar → Reviews or Campaigns admin pages.

Supplemental app-label check: “Who can access ARTEST?”

> Based on the latest AccessRadar snapshot (Sequence 35, captured at 2026-11-11 19:25:22 UTC), the following subjects have access to the ARTEST space.

The response's “Access Summary for ARTEST” table shows Marcin Nowak as **User** and AccessRadar, Automation for Jira, Slack, Timesheets by Tempo, Microsoft Teams for Jira Cloud, and BigPicture PPM as **App**.

> Note: The list includes 1 user and 25 apps/integrations. Many apps have broad administrative and project-level permissions.
>
> For a complete list of all 26 subjects and their specific permissions, you can view the AccessRadar → Explore → Spaces page.
