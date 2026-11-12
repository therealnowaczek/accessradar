# E2E: phase 3 (Sharing and security, read-only scopes), dev 3.x

Site marginradar.atlassian.net, development install, ARTEST. Run 2026-11-12, light and dark Jira theme (account theme restored to Light).

- 18/18 PASS light, 18/18 PASS dark: theme applied, Sharing and security page as Advanced and Standard (no "Approval needed" after consent, audit section gated on Standard), all 12 navigation pages load without error, Spaces > ARTEST > Why panel, Reviews > open review > Verify (signature Verified), Snapshots > take snapshot.
- `forge logs -e development --since 40m`: no errors.
- Not testable on dev: a site that has not consented (dev is consented). Covered by unit test (401 "scope does not match" -> `needs-consent`, section shows "Approval needed", rest of the app unaffected). The marginradar production install stays on 2.x after the prod deploy until an admin approves, which makes it the first real check.
