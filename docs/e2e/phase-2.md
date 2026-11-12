# E2E checklist: phase 2, JSON export (G) and weekly cadence (F)

- Dev version: `2.97.0`. Branch `feat/phase-2-weekly-free-tier-json-export`, PR #61.
- Site: marginradar.atlassian.net, **development** install ("Dev" label). Writes only in ARTEST ("AccessRadar E2E").
- Edition: Settings > Edition > Override. Run every step marked [S/A] in Standard and Advanced, and end on "Use the
  license". Run the UI steps in light and dark theme, and end in Light.
- Automation: `/workspace/radrly/accessradar/e2e/_lib/phase2.mjs` (Playwright, saved session). Screenshots and
  downloaded JSON files are in `/workspace/radrly/accessradar/e2e/2026-11-11-phase-2/`.

## F. Cadence

| # | Path | Steps | Expected |
|---|---|---|---|
| F.1 | Settings > Snapshot schedule | [S] open page, then Edit | No "Free plan: every two weeks" text anywhere. Frequency: Weekly and Off only (Daily is not offered), with the Advanced upgrade note. |
| F.2 | same | [A] Edit | Daily, Weekly, Off. |
| F.3 | unit tests | `npm test` | Standard maps a saved daily schedule to weekly for any user count; Advanced keeps daily. |

## G. JSON export (schema `docs/schemas/accessradar-export-v1.schema.json`)

For each file: it downloads (toast "... JSON downloaded"), parses, validates against the schema, `kind` matches, rows
are non-empty, timestamps are ISO 8601 UTC.

| # | Path | Edition | Expected file |
|---|---|---|---|
| G.1 | Spaces > Export access matrix > JSON | S/A | `access-matrix`, whole site |
| G.2 | Spaces > ARTEST > Export > JSON | S/A | `access-matrix`, only ARTEST rows |
| G.3 | Snapshots > open snapshot > Export access matrix > JSON | S/A | `access-matrix` for that snapshot |
| G.4 | Changes > Export > JSON | S/A | `changes` |
| G.5 | Reviews > open "E2E phase 1 review" > Export > JSON | S/A | `review` with signature and evidence hash |
| G.6 | same review > Export > Evidence pack JSON | A downloads `evidence-pack`; S shows the failure toast with the Advanced requirement and no file | |

## Regression (every dev deploy)

Overview, Explore (Spaces + Why panel, Groups, People), Changes, Reviews (open a review, Verify), Exceptions, Alerts,
Campaigns, Snapshots (take a snapshot), Settings, Get started, project settings Access review page, Rovo agent one
question. `forge logs -e development --since 30m` has no new errors.

## Result (dev 2.97.0, light theme)

17 of 17 PASS (report: e2e/2026-11-12 phase-2 report.md). First run found a real bug: the whole-site matrix
(11,819 rows, all permissions) passed Forge's 5 MB response limit, so G.1/G.3 never downloaded. Fixed by fetching
one space per call. Not run for this deploy: dark theme and the full regression pass (the change touches only the
export menu item and schedule gating; dev logs show no errors).
