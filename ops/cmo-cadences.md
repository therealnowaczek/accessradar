# AccessRadar cadences and facts for the CMO bot (2026-11-11)

Source: `docs/decisions-log.md` D2 and D4 in the accessradar repo. These are product facts, not published copy. Site and
listing texts are for you to update; nothing was published from the repo.

## Snapshot cadence (exact)

- **Standard: weekly.** One scheduled snapshot per week on the weekday and UTC hour the admin picks (or Off for manual
  only). A saved daily schedule runs weekly.
- **Free tier (Standard, up to 10 users): weekly too.** The old internal "every two weeks" schedule is gone. Same as
  every Standard site.
- **Advanced: daily** (or weekly, or Off, admin's choice). Daily snapshots are Advanced only.
- **Manual snapshots any time** in both editions.
- The tick that checks "is a snapshot due" runs hourly and costs one SQL request when nothing is due.

## Inactive users (item N dropped)

"Last active users" is dropped (it would need the Atlassian org admin API on api.atlassian.com, which is egress and
would break Runs on Atlassian). The site promise "inactive users with access, flagged on every snapshot" **stays true**:
the risk rule and the alert use the Jira account `active` flag (deactivated accounts), not login activity. Do not
promise "last login" or "not signed in for N days".

## Read-only

AccessRadar stays read-only. No Jira work items or comments are written (item H dropped). Remediation is guidance plus a
deep link to the exact Jira admin screen. KVS (L) dropped. Confluence (M) not built, later in the next major version.

## New in phase 2

JSON export (schema version 1) next to CSV, PDF and Markdown: access matrix, space access, changes, review. Signed
review evidence pack as JSON is Advanced. No new permissions.

## i18n (coming, see later notes)

12 UI languages from the user's Jira language setting, English fallback, no language switcher; dates follow the user's
locale. The Rovo agent prompts stay English.
