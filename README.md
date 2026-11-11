# AccessRadar

Read-only access review for Jira Cloud: who has access to what, why, and what changed since the last review.
Built on Atlassian Forge and eligible for Runs on Atlassian (no egress).

> Status: R1 and R2 are released. Prices (updated 2026-10-30) are in `docs/LISTING.md` §8 and `docs/accessradar-pricing-import.csv`. **Standard** (live, unchanged): free up to 10 users, then $0.75 / $0.55 / $0.35 / $0.20 / $0.15 / $0.12 per user/month (11–100 / 101–250 / 251–1,000 / 1,001–2,500 / 2,501–5,000 / 5,001+). **Advanced** (new prices published in the partner console 2026-10-30 ~19:58 CET, effective 24 h later): $5 flat up to 10 users, then $1.49 / $1.09 / $0.69 / $0.39 (11–100 / 101–250 / 251–1,000 / 1,001+). Progressive from user 1; annual = 10× monthly; 30-day trial; existing customers keep their previous price for 60 days (Atlassian price-change policy).

## Layout

```
manifest.yml               Forge manifest (3x jira:adminPage on one Custom UI resource, scheduledTrigger, queue consumer, Forge SQL)
src/handlers.ts            resolver, lifecycle trigger, scheduled ticks, queue consumer
src/db/migrations.ts       Forge SQL schema (one DDL per statement, no FK, no trailing semicolon)
src/engine/resolve.ts      pure effective-access resolver (unit tested)
src/lib/                   Jira client by identity, pagination, queue, authorization
src/ui/                    resolver helpers for the admin UI (space list, asUser)
src/spike/probe.ts         week-1 API probes (dev only, enabled by ACCESSRADAR_SPIKE=1)
static/app/                Custom UI (React 18 + Atlaskit/ADS + design tokens), built by Vite to static/app/dist
vite.config.ts             UI build (root static/app, resource `custom-ui`)
docs/week1-findings.md     week-1 spike findings (Polish)
spikes/j.sh                read-only REST probe helper (needs JIRA_API_TOKEN in env; never commit tokens)
```

## Develop

Requires Node 22 or 24 and the Forge CLI (`npm i -g @forge/cli`).

```
npm ci
npm run check        # format:check, lint, typecheck, test, build:ui, forge lint
forge deploy --environment development
```

## Local development guardrails

Cursor reads `.cursor/rules/accessradar-ui.mdc` in every chat (`AGENTS.md` points at it). `.cursor/hooks.json` runs `scripts/cursor-lint-hook.mjs` after the agent edits a file. That hook runs ESLint (`--max-warnings=0`) and Prettier on the edited `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, or `.cjs` file and returns the findings to the agent. Other files are skipped. If `node_modules` is missing, the hook exits quietly. A light `stop` hook repeats any finding still open, once.

`.vscode/extensions.json` recommends the ESLint and Prettier extensions. `.vscode/settings.json` turns on the flat ESLint config, format on save with Prettier, and ESLint fix on an explicit save.

The Husky `pre-commit` hook runs lint-staged (ESLint `--max-warnings=0` and Prettier `--check` on staged files) and `npm run typecheck`. `npm run check` is still the full gate before a deploy. `npm run lint` itself allows warnings, so the design-system warnings already in a few UI files (for example `use-heading-level-in-section-message`, `no-placeholder`) block a commit or show up in the hook only once you edit that file; fix them in the same change. Husky is pinned to 9.1.7 and lint-staged to 16.4.0 (lint-staged 17 needs a newer Node.js than 22.12).

Once, after pulling this: `npm install` (`prepare` enables Husky), install the recommended extensions, and restart Cursor so the project hooks load.

## UI

One Jira admin menu entry (**Apps > AccessRadar**), no manifest `pages`/`sections`. Three `jira:adminPage`
modules share the `custom-ui` resource with `layout: blank` (the app owns its padding, like MarginRadar):

- `accessradar-admin` (title AccessRadar): side navigation with Overview, Explore (Spaces, Groups, People),
  Review (Changes, Reviews, Snapshots) and Settings, switched client-side.
- `accessradar-config` (`useAsConfig`): same app, opens on Settings.
- `accessradar-get-started` (`useAsGetStarted`): separate checklist screen without the sidebar.

The developer spike panel appears in Settings only when `ACCESSRADAR_SPIKE=1` is set for the environment.

## Editions

The edition is decided on the server for every resolver call (`src/api/edition.ts`): Marketplace license `capabilitySet` (case-insensitive), plus `AR_EDITION_OVERRIDE` and the `edition:override` KVS on development and staging only. Flags live in `src/domain/edition.ts`; resolvers refuse with `REQUIRES_ADVANCED` and the UI shows the Advanced `PlanNote`.

- **Standard:** manual and weekly snapshots, 90-day history, Explore with the why path, snapshot diff, reviews with Keep / Revoke / Exception decisions, exceptions with justification and expiry that go into the exception register when the decision is saved (no sign-off needed, `syncReviewExceptions`), CSV / PDF / Markdown export, risk indicators, weekly digest (one in-app summary of the access changes from the last 7 days, built by the `accessradar-digest-weekly` scheduled trigger; `getWeeklyDigest`, `refreshWeeklyDigest`). Reviews signed earlier stay readable (signer, hashes, chain number).
- **Advanced:** everything in Standard plus daily and custom schedules, unlimited history, remediation verification, delegated reviews, recurring campaigns, real-time alerts after every snapshot with configurable alert rules (`changeAlerts`), audit evidence pack, Rovo agent, and (since 2026-10-26, family rule) signed reviews, the site-wide hash chain and Verify (`signatureChain`: `signReview`, `verifyReview`, `verifyChain`, `startSnapshotVerify`, `getVerifyJob`).

Details: `docs/PRD-R1-R2.md` §5, §5.1, §5.2 and §5.3, `docs/LISTING.md` §8.

## Rovo and MCP tools (Advanced, Preview)

The five read-only Rovo actions (`ar-who-can-access`, `ar-why`, `ar-person-access`, `ar-changes-since`, `ar-review-status`) are also exposed as tools by one `rovo:mcp` module: in Rovo Studio and, once a site admin turns them on in Atlassian Administration > Apps > Sites > Connected apps, in external MCP clients at `https://mcp.atlassian.com/forge/026c4f6a-266d-4c42-aec5-7394371ad05d` (OAuth as the user). Same gates as the agent: active licence (missing licence outside dev = Standard), Jira admin checked as the user (never asApp over MCP), Advanced edition, 50 rows max. No new scopes, no egress. Setup, data flow and tests: `docs/mcp-tools.md`.

## Deploy

No GitHub Actions. Run `npm run check` locally, then Mac-only `forge deploy` (development and/or production). Use `forge install --upgrade` only when scopes/egress change.
