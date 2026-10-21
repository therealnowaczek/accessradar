# AccessRadar

Read-only access review for Jira Cloud: who has access to what, why, and what changed since the last review.
Built on Atlassian Forge and eligible for Runs on Atlassian (no egress).

> Status: R1 and R2 are released. Final Marketplace prices (2026-10-14) are in `docs/LISTING.md` §8 and `docs/accessradar-pricing-import.csv`; they go live on the listing at the first release after Marketplace approval.

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

## UI

One Jira admin menu entry (**Apps > AccessRadar**), no manifest `pages`/`sections`. Three `jira:adminPage`
modules share the `custom-ui` resource with `layout: blank` (the app owns its padding, like MarginRadar):

- `accessradar-admin` (title AccessRadar): side navigation with Overview, Explore (Spaces, Groups, People),
  Review (Changes, Reviews, Snapshots) and Settings, switched client-side.
- `accessradar-config` (`useAsConfig`): same app, opens on Settings.
- `accessradar-get-started` (`useAsGetStarted`): separate checklist screen without the sidebar.

The developer spike panel appears in Settings only when `ACCESSRADAR_SPIKE=1` is set for the environment.

## Deploy

No GitHub Actions. Run `npm run check` locally, then Mac-only `forge deploy` (development and/or production). Use `forge install --upgrade` only when scopes/egress change.
