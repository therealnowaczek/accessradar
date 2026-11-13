# AccessRadar CMO handoff (prod 3.1.0, 2026-11-12)

For the CMO bot: product sites and Marketplace listings are yours. The AccessRadar product bot must not deploy accessradar.radrly.com or push the radrly repo for this work.

This file is the inventory of what shipped to production on 2026-11-11 and 2026-11-12, what it means for users, and suggested site plus Marketplace console changes with paste-ready English draft text from the AccessRadar repo (`docs/LISTING.md`, `docs/data-handling.md`, `docs/phase-3-scopes-for-marcin.md`, `docs/export-json.md`, `docs/decisions-log.md`, `docs/e2e/i18n-pass3.md`). Character counts use Python `len()` (same as `docs/listing-check.py`).

Nothing in this handoff has been published. Do not treat roadmap items marked Planned on the live site as still planned if they are listed as shipped below.

**Current prod:** 3.1.0 (Forge). **No write scopes, no egress, no remotes.** Runs on Atlassian eligibility unchanged. Support contact stays support@radrly.com. Do not call Radrly small. Do not use em dashes in published copy.

**Consent:** 3.0.0 is a major version. Every site admin must approve the six new read scopes under Manage apps before Sharing and security is live on that site. Sites that have not approved stay on 2.x behaviour; that section shows "Approval needed" and the rest of AccessRadar keeps working. Do not use `forge install --upgrade` on customer sites.

**Sources in the AccessRadar repo:** PRs #58/#60 (2.46.0), phase 2 commit for 2.47.0, i18n first pass for 2.48.0, PR #63 (3.0.0), PRs #64/#65 (listing and data-handling docs), PR #66 (3.1.0). App backups: `prod-backup-2026-11-12-2.46-pre-phase2`, `prod-backup-2026-11-12-2.47.0`, `prod-backup-2026-11-12-2.48.0`, `prod-backup-2026-11-12-3.0.0`.

**Already on the live site (keep, do not regress):** Privacy Policy version 1.4 (2026-11-11) and docs `#mcp` / security AI text for optional MCP tools (Advanced, admin-enabled, no new scopes). Those shipped with 2.45.0, just before this window.

**This AccessRadar run (2026-11-12):** no site files were edited, no commit was made, nothing was pushed to the radrly repo, and nothing was deployed to the VPS.

---

## 1. What shipped to production, 2026-11-11 to 2026-11-12

### 2.46.0 (phases 0 and 1): layout standard and locale/date fixes

Shipped after phase 1 E2E fixes (PR #58 layout standard v1.1, PR #60 E2E and locale/panel decisions). No new scopes, no egress, no new features that need listing highlights.

**What users see:**

- The admin UI follows the shared Radrly layout standard more closely: one primary action in headers and panels, clearer empty states, skeletons that match the loaded screen, field errors under the field, header actions collapsing into More on narrow widths, and a single-scroll layout at compact width and at 200% zoom so pinned titles and fades do not hide content.
- Displayed and typed dates follow the language in the user's Jira profile (en-US fallback). Date pickers on review due date, exception expiry and campaign start date accept typed and calendar input in that locale.
- Accepted layout decisions stay: full-page skeleton before context (AccessRadar has no issue panel), and the existing right-edge side panel.

**What not to claim:** phase 0 added no user-facing feature. MCP surface detection (item C) is still not built; it waits for a real MCP log shape. Rovo and MCP tools themselves already shipped in 2.45.0 and are already documented on the site.

### 2.47.0 (phase 2): weekly snapshots for free Standard, plus JSON export

**Snapshot cadence (exact, both this release and D2 in `docs/decisions-log.md`):**

- Standard: weekly (one weekday and UTC hour, or Off). A saved daily schedule on Standard runs weekly.
- Free tier (Standard, up to 10 users): weekly too. The old internal every-two-weeks schedule is gone.
- Advanced: daily or weekly (or Off). Daily is Advanced only.
- Manual snapshots any time, both editions.

**JSON export (schema version 1), no new permissions:**

- Added next to CSV, PDF and Markdown in the existing export menus: access matrix (site or one space), changes, and review JSON. Evidence pack JSON is Advanced and only for a signed review. Files are built in the browser, like the other formats, and are not sent anywhere.
- Envelope fields include `schema` (`accessradar-export`), `schemaVersion` (1), `kind`, `generatedBy`, `site`, `exportedAt` (ISO 8601 UTC) and `timeZone`. Coverage and limitations are always included. Column names stay English on purpose (machine-readable).
- Details: `docs/export-json.md`.

**Live site is stale here:** docs still say free sites snapshot every two weeks. That is no longer true.

### 2.48.0: i18n, first pass (12 locales)

UI language comes from the user's Jira profile, with English fallback. There is no language switcher in the app.

**Locales (12):** en-US, de-DE, ja-JP, fr-FR, es-ES, pt-BR, pl-PL, ko-KR, it-IT, nl-NL, zh-CN, zh-TW. `zh`, `zh-SG`, `zh-MY` and `zh-Hans` map to zh-CN; `zh-HK`, `zh-MO`, `zh-TW` and `zh-Hant` map to zh-TW. Any other locale falls back to en-US. Dates already followed the locale from phase 1.

This first pass covered about 350 keys (plain UI sentences and navigation). It was completed by the fuller 3.1.0 pass below. Prefer advertising 12 languages against 3.1.0, not 2.48.0 alone.

No manifest, scope or permission change (dictionaries live in the app bundle, not in manifest translations).

### 3.0.0 (phase 3: I, J, K): Sharing and security, six read-only scopes

Major version. PR #63, approved by Marcin 2026-11-12. One new Explore page, **Sharing and security**. Everything is a GET. Nothing is written to Jira. Item H (writing work items or comments) stays dropped.

**What the page does:**

- **I (both editions):** lists filters and dashboards shared with anyone or all signed-in users (names, owners, share targets).
- **K (both editions):** issue security schemes and levels: who is granted each level, and which spaces use the scheme. Work item content is never read. Snapshots still do not evaluate work-item security levels as part of effective access (the old coverage limitation stays true for the access matrix).
- **J (Advanced):** permission, group and role changes from the Jira audit log for the last 7 days, with before/after values. Jira exposes the audit log on paid plans only; on a free Jira plan the section says it is not available on this site.

Results are shown to the signed-in Jira administrator in the browser. This data is **read live and not stored** in Forge SQL. No outbound call, no new remote, no write scope.

**Six new scopes (all `read:`, all with `allowImpersonation: true`, same as existing read scopes):**

| Scope | Purpose |
|---|---|
| `read:filter:jira` | Read filters and who they are shared with (I) |
| `read:jql:jira` | Required by Jira in the filter search response (I). AccessRadar does not display or store the JQL. |
| `read:dashboard:jira` | Read dashboards and who they are shared with (I) |
| `read:audit-log:jira` | Read audit records for permission, group and role changes (J, Advanced) |
| `read:issue-security-level:jira` | Read security levels and who is granted them (K) |
| `read:issue-security-scheme:jira` | Read issue security schemes and which space uses which (K) |

Already granted and reused: `read:project`, `read:project-role`, `read:group`, `read:user`, `read:avatar`, `read:application-role`, `read:project-category`, `read:issue-type`, `read:issue-type-hierarchy`, `read:project-version`, `read:project.component`. Plus existing `report:personal-data` and the earlier permission-scheme / permission reads. No `read:jira-work`. No write or manage scopes.

**Do not claim:** a twelfth risk rule for public filters and dashboards. The live docs still mark that *risk rule* as Planned. What shipped is the Sharing and security page that lists public sharing, not a new item in the eleven risk rules. Leave the risk-rule count at eleven unless you confirm a new rule in `src/engine/risk.ts`.

**Caveats to keep honest:** audit-log mapping follows the documented record shape (could not be verified on the free dev plan, which returns 403). Security-level tables on dev had a scheme with zero levels; empty state is covered. First paid-site run of the audit-log section should be watched.

### 3.1.0: full i18n coverage

PR #66. No manifest or scope change. About 800 further UI strings moved to keys (templates, fragments, label maps, toasts, errors); 585 new texts translated into the 11 non-English locales.

**E2E (dev):** English 18/18 in light and 18/18 in dark, including Sharing and security on both editions. The other 11 locales passed a smoke test of all 13 nav pages with no raw keys, `undefined` or replacement characters.

**Stays English by design:** exports (CSV, PDF, JSON, Markdown: English column names and ISO formats), Rovo agent prompts and answers, Jira permission names, some server messages, and user data (space names, group names, and so on).

**Translations are machine-drafted, not reviewed by a native speaker.** Do not claim native-quality localisation. A native check of de, fr, pl and ja is still recommended before the listing leans hard on "12 languages".

---

## 2. Suggested site changes (accessradar.radrly.com)

Update only the AccessRadar site. Keep the existing `radrly-consent.css` / `radrly-consent.js` includes intact on every HTML page. Bump `lastmod` in `sitemap.xml` for changed URLs. Leave other app sites alone.

Live pages checked 2026-11-12 still describe the pre-3.0 product: Privacy Policy 1.4 (2026-11-11), security reviewed 11 November 2026, docs reviewed 11 October 2026 with public filters, dashboards and audit-log diffs marked Planned, release notes last updated 2026-10-26 (Version 1.1) plus an 11 November MCP entry, and docs editions text that still says free sites snapshot every two weeks.

### 2.1 Privacy Policy (`/privacy/`) - bump to Version 1.5, date 2026-11-12

Add a short "read live, not stored" note after the data table, add the six scopes to the permissions table, and add a changelog bullet. Do not imply the new Sharing and security fields are written to Forge SQL.

**Note to insert after the data table (after the sentence that email addresses are not stored):**

> From version 3.0, the Sharing and security page also reads, live and only for the signed-in Jira administrator: filter and dashboard names, owners and share targets; issue security scheme and level names, who is granted each level, and which spaces use the scheme; and, on Advanced, Jira audit-log summaries of permission, group and role changes (actor, object, changed values) for the last 7 days. AccessRadar does not store this data, does not display or keep filter JQL, and does not read work item content. Sites that have not approved the 3.0 update do not grant these scopes; that section shows an approval notice and the rest of the app works as before.

**New rows for the Permissions (scopes) table:**

- `read:filter:jira`, `read:dashboard:jira`, `read:jql:jira` - List filters and dashboards and who they are shared with, so the app can find items shared with anyone or all signed-in users. `read:jql:jira` is required by Jira in the filter search response; the JQL is not shown or stored.
- `read:issue-security-scheme:jira`, `read:issue-security-level:jira` - Show issue security schemes, levels, who is granted each level, and which spaces use the scheme. Work items are not read.
- `read:audit-log:jira` - Show permission, group and role changes of the last 7 days, with before and after values (Advanced). Jira exposes the audit log on paid plans only.

**Changelog bullet:**

> Version 1.5 (2026-11-12): Sharing and security (app 3.0.0) reads filter and dashboard sharing, issue security levels and (Advanced) Jira audit-log summaries live. This data is not stored. Six read-only scopes were added. No write scopes and no egress.

Header line: `Last updated: 2026-11-12 · Version 1.5`

Storage, residency, sub-processors, AI/MCP, retention and uninstall answers stay as in 1.4. Personal data that *is* stored is unchanged (account IDs, display names, and so on, still no email addresses).

### 2.2 Security page (`/security/`)

Change the reviewed line to: `Reviewed against the AccessRadar source code (read-only scopes, zero egress) on 12 November 2026.`

Add the same three scope rows as in the privacy table (section Scopes). After the existing "The Rovo and MCP tools use the same read scopes. No scope was added for them." add:

> Six further read scopes were added in 3.0.0 for the Sharing and security page (filters, dashboards, JQL as required by the filter search response, issue security schemes and levels, and the Jira audit log). They are read-only, with the same optional impersonation flag as the other read scopes. They do not allow writes. Updating from 2.x is a major version that a site admin approves.

In Data flow, extend the first step so the app also reads filters, dashboards, issue security schemes and levels, and (Advanced) audit-log records, and add that those results are shown live and not stored in Forge SQL.

Data residency, no egress, and "no write or manage scopes" stay true.

### 2.3 Documentation (`/docs/`)

- Set the reviewed line to 12 November 2026. Keep the Planned marker only for items that are still not shipped.
- In Install / Where you will find AccessRadar, add: Sharing and security, under Explore (both editions; the audit-log section is Advanced).
- After Explore access, add a section **Sharing and security** (draft):

> The Sharing and security page (Explore) lists filters and dashboards shared with anyone or all signed-in users, and issue security schemes and levels (who is granted each level, and which spaces use the scheme). Advanced also shows permission, group and role changes from the Jira audit log of the last 7 days. The page reads Jira with GET requests only and does not store the results. Work item content is not read, and work-item security levels are still not folded into the effective-access matrix. Jira exposes the audit log on paid plans only; on a free Jira plan that section says it is not available. If the site has not approved the 3.0 update, this section shows "Approval needed" and the rest of AccessRadar works as before.

- Risk indicators: keep "eleven rules". Replace the Planned sentence about a public-filters *risk rule* with: public filters and dashboards are listed on Sharing and security; they are not one of the eleven snapshot risk rules.
- Differentiators: replace "No new Jira permissions for campaigns, delegation or alerts. What needs new permissions is Planned." with a factual line: campaigns, delegation and alerts needed no new scopes; 3.0.0 added six read-only scopes for Sharing and security, which a site admin approves as a major update. Still no write scopes.
- Data and residency: add that Sharing and security reads the fields above live and does not store them. Stored data is unchanged.
- Editions: Standard now includes Sharing and security (public filters and dashboards, issue security levels) and weekly scheduled snapshots, including on the free tier (the every-two-weeks wording is wrong and must go). Advanced also includes audit-log changes on that page, and the evidence pack as JSON as well as PDF. Both editions: UI in 12 languages from the Jira profile.
- Add a short **Languages** note: the UI follows the language in the user's Jira profile (12 locales: English, German, Japanese, French, Spanish, Brazilian Portuguese, Polish, Korean, Italian, Dutch, Simplified Chinese, Traditional Chinese), with English fallback, and no language switcher. Exports, Rovo text and Jira permission names stay English. Translations are machine-drafted and have not been reviewed by native speakers.
- Roadmap: remove "Risk rule for publicly shared filters and dashboards" if you only shipped the page, or reword it if you still want a risk *rule* later. Remove "Diffs based on the Jira audit log". Remove "Free-tier schedule options beyond Standard weekly and manual snapshots" (free tier is already weekly). Keep Planned: change alerts or reminders as Jira work items or comments (Advanced), which would need write scopes and is not planned now (item H dropped; AccessRadar stays read-only).
- FAQ "Does AccessRadar ask for new Jira permissions?": replace the current "Not for anything that ships today" answer with:

> Through 2.x, no. Version 3.0.0 adds six read-only scopes so the app can list public filters and dashboards, show issue security levels, and (Advanced) read permission changes from the Jira audit log. A site admin approves that update under Manage apps. AccessRadar still has no write or manage scopes and never changes Jira. Creating alerts as Jira work items is not available and is not planned.

- Coverage line in Snapshots: keep "work item security levels are not evaluated" for the access matrix, and point to Sharing and security for scheme and holder listing.

### 2.4 Release notes (`/release-notes/`)

Bump the page header to `Last updated: 2026-11-12 · Version 1.2`. Add dated entries above the 11 November 2026 MCP notes. Suggested copy:

**12 November 2026, 3.1.0**

- Full UI language coverage in 12 locales, taken from the user's Jira profile (English fallback, no language switcher). About 800 further strings were moved to translation keys. Exports, Rovo text and Jira permission names stay English. Translations are machine-drafted. No new scopes.

**12 November 2026, 3.0.0** (major; site admin approval required)

- New Sharing and security page (Explore): filters and dashboards shared with anyone or all signed-in users, and issue security schemes and levels, on Standard and Advanced.
- Advanced: permission, group and role changes from the Jira audit log of the last 7 days. The audit log is available on paid Jira plans only.
- Six read-only scopes added (`read:filter:jira`, `read:jql:jira`, `read:dashboard:jira`, `read:audit-log:jira`, `read:issue-security-level:jira`, `read:issue-security-scheme:jira`). No write scopes and no egress. Until the admin approves the update, this section shows "Approval needed" and the rest of the app keeps working.
- This data is read live and is not stored by the app.

**12 November 2026, 2.48.0**

- First pass of the 12-locale UI. Completed in 3.1.0.

**12 November 2026, 2.47.0**

- Standard scheduled snapshots are weekly, including on the free tier (up to 10 users). The previous every-two-weeks free-tier schedule is removed. Daily schedules stay Advanced. Manual snapshots remain available on both editions.
- JSON export (schema version 1) next to CSV, PDF and Markdown for the access matrix, changes and reviews. Evidence pack JSON is Advanced. Files are built in the browser. No new scopes.

**11 November 2026, 2.46.0**

- Layout and date fixes: the UI follows the shared Radrly layout standard more closely, and dates follow the language in the user's Jira profile.

Under Documentation changes, add: `12 November 2026: Privacy Policy 1.5, Security and docs updated for Sharing and security, the six read-only scopes, weekly free-tier snapshots, JSON export and 12 UI languages.`

### 2.5 `llms.txt` and `llms-full.txt`

Add bullets, without dropping the existing MCP and read-only lines:

- Sharing and security: public filters and dashboards, issue security levels (both editions); permission, group and role changes from the Jira audit log of the last 7 days (Advanced, paid Jira plans). Read live, not stored. Six read-only scopes in 3.0.0; site admin approval required. No write scopes, no egress.
- JSON export (schema version 1) beside CSV, PDF and Markdown; evidence pack JSON is Advanced.
- Standard scheduled snapshots are weekly, including on the free tier. Daily is Advanced.
- App UI in 12 languages from the user's Jira settings (English fallback, no language switcher). Exports, Rovo text and Jira permission names stay English. Translations are machine-drafted.

`llms-full.txt` should repeat the Sharing and security, cadence, JSON export and languages facts in the docs-equivalent sections, and must not still say that public filters or audit-log diffs are only planned, or that free sites snapshot every two weeks.

---

## 3. Marketplace console checklist

Partner console: marketplace.atlassian.com/manage → Radrly → AccessRadar.

Before saving: (1) check ECOHELP for an open AccessRadar request; if one is open, describe the 3.0.0 scope change in that ticket rather than opening a surprise duplicate; (2) save listing text, Privacy & Security justifications and the questionnaire in one pass where you can. Saving the listing or the Privacy & Security tab may start a review. A later AccessRadar *app* prod deploy during that review creates a new ticket; tell the AccessRadar bot if a review starts. Empty scope Justification fields are an auto-rejection: fill every scope, including the six new ones.

Do not change the app name, categories, keywords, pricing, tagline or (unless you choose the nice-to-have tweaks below) highlight titles.

Limits: name ≤60, tagline ≤130 with no trailing period, summary ≤250, More details ≤1000, highlight title ≤50, highlight description and caption ≤220, version "what's new" / release summary ≤80. Counts below are Python `len()`.

### REQUIRED

**R1. Listing > Details > More details (≤1000).** Replace the live More details with this exact block from `docs/LISTING.md` (974/1000). The new bullet is "Sharing and security: public filters and dashboards, issue security levels, audit-log changes (Advanced)". "CSV/PDF/JSON evidence" already covers 2.47.0.

```
Access reviews in Jira Cloud mean clicking through permission schemes, roles and groups, then rebuilding it in a spreadsheet. AccessRadar shows effective access with the path behind it, keeps history, and turns a review into evidence an auditor can check.

Built for Jira admins and compliance teams:
• Space, group and person views of permissions
• The "why": group → space role → permission scheme grant
• Daily or weekly snapshots, or on demand
• Diff two snapshots: access granted and removed
• Access reviews: Keep, Revoke or Exception (justification + expiry)
• Advanced: SHA-256 evidence hash tied to the snapshot
• Sharing and security: public filters and dashboards, issue security levels, audit-log changes (Advanced)
• Coverage & limitations in every export
• CSV/PDF/JSON evidence; Advanced pack with SOC 2 / ISO mapping

Read-only scopes only: AccessRadar never changes Jira. Runs on Atlassian: no data egress; data stays in Atlassian.

Free for up to 10 users.
```

**R2. Version "what's new" / release summary (≤80), one per version you publish.**

- 3.0.0 (75/80): `Public filters, dashboards and issue security; audit-log changes (Advanced)`
- 3.1.0 (64/80): `UI in 12 languages from the user's Jira settings. No new scopes.`

If the console only shows a single field for the current version, paste the 3.1.0 line, and put the 3.0.0 text in the version body or in Marketplace release notes (R3).

**R3. Marketplace release notes (version body).** Same facts as site release notes in section 2.4. Include: major approval for 3.0.0, the six read scope names, read-live-not-stored, paid-plan caveat for the audit log, no write scopes, no egress, 3.1.0 languages with the machine-drafted caveat, and that exports and Rovo stay English.

Shorter 3.0.0 body you can paste:

> Sharing and security (Explore) lists filters and dashboards shared with anyone or all signed-in users, and issue security schemes and levels, on both editions. Advanced also shows permission, group and role changes from the Jira audit log of the last 7 days (paid Jira plans only). Six read-only scopes were added. This data is read live and is not stored. A site admin must approve the update; until then the section shows "Approval needed" and the rest of the app works as before. AccessRadar still never changes Jira and still makes no calls outside Atlassian.

Shorter 3.1.0 body you can paste:

> The app UI follows the language in the user's Jira profile in 12 locales (English, German, Japanese, French, Spanish, Brazilian Portuguese, Polish, Korean, Italian, Dutch, Simplified Chinese, Traditional Chinese), with English fallback and no language switcher. Exports, Rovo text and Jira permission names stay English. Translations are machine-drafted and have not been reviewed by a native speaker. No new scopes.

**R4. Privacy & Security tab: Justification for every scope, especially the six new ones.** Paste:

- `read:filter:jira`: List filters and who they are shared with, to find filters shared with anyone or all signed-in users.
- `read:jql:jira`: Required by Jira in the filter search response. AccessRadar does not display or store the JQL.
- `read:dashboard:jira`: List dashboards and who they are shared with, to find dashboards shared with anyone or all signed-in users.
- `read:issue-security-scheme:jira`: Read issue security schemes and which spaces use them. Work items are not read.
- `read:issue-security-level:jira`: Read security levels and who is granted them. Work items are not read.
- `read:audit-log:jira`: Show permission, group and role changes of the last 7 days with before and after values (Advanced). Jira exposes the audit log on paid plans only.

Existing read-scope justifications in `docs/LISTING.md` §9 stay valid (spaces, permission schemes, roles, groups, users, application roles, avatars, `report:personal-data`). Re-paste any blank Justification field. Add this common note if the form has a free-text scopes comment:

> All scopes added in 3.0.0 are read-only, with allowImpersonation as on the existing read scopes. There are no write or manage scopes and no permissions.external. Updating from 2.x is a major version: each site admin approves the six new read scopes. Sites that have not approved keep 2.x behaviour.

**R5. Privacy & Security tab: data handling answers.** Most answers are unchanged (see `docs/LISTING.md` §9):

- Stores End-User Data outside Atlassian: **No**
- Processes End-User Data outside Atlassian / the browser: **No**
- Stores personal data: **Yes** (account IDs, display names, and so on; still no email addresses). In any explanation field, add: filter, dashboard, issue-security and Jira audit-log data used on Sharing and security is read live and is not stored by the app.
- Logs End-User Data / logs it outside Atlassian: **No**
- Remote REST APIs: **No**
- Third parties / sub-processors: **No** (Atlassian only)
- Data residency: **Yes: all in-scope End-User Data stored exclusively within the Atlassian Forge platform.** Unchanged, because the new page does not store additional data. In-scope stored data remains snapshots, reviews, exceptions, campaigns, notices and the in-app audit log in Forge SQL, following the Jira site's residency.
- Migration between residency locations: **Yes** (Forge)
- User impersonation: **Yes, declared** on the read scopes, including the six new ones, used only as an optional collector fallback. Impersonation is not used to write.
- DPA: **Yes**, https://accessradar.radrly.com/dpa
- Security policy: https://accessradar.radrly.com/security
- Privacy policy: keep https://accessradar.radrly.com/privacy/ and, after the site ships 1.5, treat that page as the source of truth.
- "Does your app use AI?": keep **No** (the app calls no AI service). Keep the existing MCP explanation from the 2.45.0 checklist if that field is already filled.

**R6. Security questionnaire (Save, then Submit for Review).** Change only the answers that are now stale. Keep MCP / Rovo answers from the 2.45.0 checklist.

Forge tab, paste:

- Scopes or permissions changed: `Yes. Release 3.0.0 adds six read-only Jira scopes: read:filter:jira, read:jql:jira, read:dashboard:jira, read:audit-log:jira, read:issue-security-level:jira and read:issue-security-scheme:jira, all with allowImpersonation like the existing read scopes. No write or manage scopes, no permissions.external, no remotes, no Connect. Release 3.1.0 adds no scopes.`
- Scope justification: the six bullets in R4, plus "read-only, never modifies Jira" (still true).
- Modules used: unchanged (no new module type in 3.0.0 or 3.1.0). Do not remove `rovo:mcp`.
- Runs on Atlassian: unchanged, still eligible (`forge eligibility` was OK after 3.0.0). Paste only a fresh eligibility sentence if you re-run it; do not invent a version string.
- Egress: `No. AccessRadar makes no outbound network call.`
- App-user disclosure (if asked again): after install, Atlassian may add the AccessRadar app user to admin groups. The app still holds read scopes only, so the API rejects writes; every UI call first checks that the caller is a Jira administrator.

Partner / Partner-Extended: sub-processors still Atlassian only. Data-flow description: append that Sharing and security reads filters, dashboards, issue security and (Advanced) audit-log records inside Jira and returns them to the signed-in admin in the browser, with no stored copy and no outbound call.

### Nice-to-have

**N1. Editions tab.** Add to both editions: "Sharing and security: public filters and dashboards, and issue security levels (read-only)". Add to Advanced: "Permission, group and role changes from the Jira audit log (last 7 days, paid Jira plans)". Optionally both editions: "App UI in 12 languages from the user's Jira settings". Confirm Standard snapshot text says weekly (including the free tier), not every two weeks. Keep "Rovo agent and MCP tools (read-only)" on Advanced if that 2.45.0 wording is already there.

**N2. Tagline and summary.** No change required. Current tagline (123/130, no trailing period): `See who can access what in Jira and why, what changed since your last review, and sign off with evidence auditors can check`. Current summary (210/250): `See who has access to what in Jira and why: group, space role and permission scheme. Scheduled snapshots, diffs, signed access reviews and CSV/PDF evidence for SOC 2 and ISO 27001. Read-only. Runs on Atlassian.` A later summary tweak could mention Sharing and security or JSON, but only if it stays ≤250 and stays true.

**N3. Highlights.** Titles can stay. Only extend a description or caption if it remains ≤220 and does not over-claim a new risk rule or native-quality localisation.

**N4. Listing sentence about languages.** If you mention 12 languages in More details or highlights, use: `The app UI follows the language in the user's Jira profile (12 locales), with English fallback. Exports and Rovo stay English. Translations are machine-drafted.` The current More details block (R1) does not include this, on purpose, so it stays at 974/1000. Do not advertise 12 languages until you are comfortable with the machine-drafted caveat.

**N5. Privacy policy version in the console.** After `/privacy/` is 1.5 live, no URL change is needed; just confirm the linked page shows Version 1.5 dated 2026-11-12.

---

## 4. Truth rules for public copy

- Read-only, never modifies Jira. No email, Slack or webhooks. Reminders and alerts stay in the app.
- Runs on Atlassian, zero egress, data in Forge SQL follows the Jira site's residency.
- "Supports evidence for SOC 2 / ISO 27001", never "SOC 2 certified" or "compliant". "Tamper-evident", not "tamper-proof".
- No competitor names, no "best" or "#1", no invented customer, install or rating counts.
- Inactive users means a deactivated Jira account (`active` flag), not last-login age. Do not promise "not signed in for N days".
- Do not say AccessRadar evaluates work-item security as part of who can see a work item. It lists schemes, levels and holders.
- Do not say a new risk rule for public filters shipped. The page lists them.
- 3.0.0 needs admin approval. 3.1.0 does not.
- Machine-drafted translations, not native-reviewed.
- Prices and edition gates are unchanged in this window. JSON evidence pack, audit-log section, Rovo and MCP stay Advanced. Sharing and security I and K are both editions.

---

## 5. Repo pointers for draft text

- Listing field limits and More details: `docs/LISTING.md` §2 and §9, checked by `docs/listing-check.py`
- Data handling, including the Sharing and security "read live, not stored" section: `docs/data-handling.md`
- Scope list and consent: `docs/phase-3-scopes-for-marcin.md`
- JSON export: `docs/export-json.md`
- Cadences and inactive-user wording: `/workspace/radrly/accessradar/cmo-cadences.md` and `docs/decisions-log.md` (D1, D2, D5, D6, phase 3)
- i18n coverage and English-by-design leftovers: `docs/e2e/i18n-pass3.md`
- Earlier MCP console checklist (keep those answers unless a field is stale): `/workspace/radrly/accessradar/rovo-mcp/marketplace-console-checklist.md`
