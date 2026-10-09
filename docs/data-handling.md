# AccessRadar: data handling (as implemented)

This describes what the code does today. Legal wording for the Privacy Policy/DPA is still to be confirmed (see `name-pricing-legal.md`).

## What is stored

All data lives in Forge SQL inside the customer's Atlassian environment (no egress, no external services).

| Data | Where | Personal data |
| --- | --- | --- |
| Projects, permission schemes and grants, project roles and actors, groups, group admin/application access, application roles | `fact` (versioned, one row per version) | Group/project names only |
| People and app accounts: accountId, cached display name, account type, active flag | `fact` (`kind = 'person'`), `stage` during a run | Yes (no e-mail addresses) |
| Group memberships, role actors (accountIds) | `fact` | Yes (accountId) |
| Reviews: scope, items, decisions, notes, signer accountId, sign-off time and time zone, evidence hash | `review`, `review_item` | Yes (accountId, free-text notes) |
| Audit log: actor accountId, action, target id, counts | `audit_event` | Yes (accountId) |
| Personal-data reporting state: accountId, last report time, closed time | `privacy_account` | Yes (accountId) |
| Settings, rate-point usage, privacy run summary | `kv`, `rate_usage` | Fallback admin accountId (only if enabled) |

Issue content, comments, attachments and e-mail addresses are never read.

## Retention

- Snapshots older than the retention setting (Settings → Retention, 30–3650 days, default 395) are deleted after each snapshot, together with fact versions no remaining snapshot needs. Snapshots used by a review are kept with the review.
- The audit log follows the same retention setting. It is purged after each snapshot and daily with the privacy job, so it also applies when no snapshots are taken.
- Reviews (including signed evidence) are kept until they are deleted (drafts) or the app is uninstalled.
- After uninstall, Forge hosted storage is deleted by Atlassian according to its data lifecycle.

## Personal-data reporting (`report:personal-data`)

- A scheduled job runs daily. It collects every accountId stored anywhere above.
- Each accountId is reported **at most once per 7-day cycle** (Atlassian's default `Cycle-Period`); the last report time is kept in `privacy_account`.
- An account Atlassian reports as **closed is never reported again** (`closed_at` is set once).
- Reporting state for accounts no longer stored anywhere (for example removed by retention) is deleted.
- `updated` responses are counted; display names are refreshed by the next snapshot.

## Closed accounts: pseudonymisation, not erasure

When an account is reported closed, AccessRadar **pseudonymises** it:

- the cached display name is replaced in every stored version (`fact`, `stage`) by `Closed account <first 8 hex chars of SHA-256(accountId)>`, and the row is marked `pseudonymized`;
- the pseudonym is re-applied on every daily run, so a later snapshot cannot bring the name back;
- the **accountId is kept** in snapshots, review items (`subject_id`, `decided_by`), reviews (`created_by`, `signed_by`) and the audit log (`actor`). Signed evidence hashes cover accountIds, not names, so verification still works;
- free-text review notes and the attestation text are not changed. The UI asks reviewers not to put personal data in notes.

The accountId still identifies the person indirectly, so this is pseudonymisation under GDPR, not anonymisation. Whether keeping accountIds in signed evidence is acceptable (GDPR Art. 17(3)) is an open legal question (P3a).

## Logs

Production logs contain snapshot numbers, step names, counters, timings, rate-point usage, HTTP status codes and truncated hash prefixes. They do not contain accountIds, names or e-mail addresses:

- Jira error responses are reduced to the HTTP status code before they are logged or stored as coverage reasons (`src/collector/client.ts`).
- Error messages are passed through `redact()` (`src/lib/errors.ts`), which removes quoted values such as `Duplicate entry '<id>'`.
- The week-1 spike and the development self-test log probe results. They run only with `ACCESSRADAR_SPIKE=1` in the development environment, and **production builds strip them**: `scripts/strip-spike.sh` deletes `src/spike/probe.ts` and `src/spike/selftest.ts` and replaces `src/spike/index.ts` and the UI `SpikePanel` with no-op stubs before `forge deploy -e production` (`.github/workflows/deploy-prod.yml`). CI checks that the stripped build type-checks and builds.
