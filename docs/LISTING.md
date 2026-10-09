# AccessRadar: Atlassian Marketplace listing (ready to paste)

**Partner (vendor):** Radrly (Radrly Sp. z o.o., Poland), the same partner as MarginRadar · **Console:** marketplace.atlassian.com/manage → Radrly → AccessRadar
**Product:** AccessRadar, the access-review twin of MarginRadar · **Build:** dev 2.x (pre-release) · Forge-only, Runs on Atlassian, Custom UI (`jira:adminPage`), Jira Cloud
**Prepared:** 2026-10-09 · Sources: `/workspace/access-review-mvp.md` (§0–§13), `docs/marketplace-checklist.md`, `docs/week1-findings.md`, `manifest.yml`, `/workspace/forge-niche-research.md` (#3), MarginRadar listing (`/workspace/atlassian-marketplace-research/LISTING.md`, structure and Atlassian limits/sources in its §13).
**Character counts:** every count below was measured with `docs/listing-check.py` (Python `len()`, newlines in More details count as 1 character). Run `python3 docs/listing-check.py` after any edit.

---

## 0. Podsumowanie dla Marcina (PL)

- **Nazwa (55/60):** *AccessRadar – Access Review & Permission Audit for Jira*. Nazwa robocza ze specyfikacji (*AccessRadar – Jira Access Review & Permission Audit*) łamie regułę brand guidelines: „Jira” musi stać po „for”, a nie w środku nazwy. Dlatego proponuję wersję z „for Jira” na końcu. Title Case, bez słów app/plugin/add-on/beta/Premium, myślnik nie stoi obok „Jira”. Dwie alternatywy w §1.
- **Limity (jak w MarginRadar, zweryfikowane tam w docs 2026-10-09):** nazwa ≤60, tagline ≤130 **bez kropki na końcu** (z checklisty), summary ≤250, More details ≤1000, 3 highlighty (tytuł ≤50, opis ≤220, podpis ≤220), 2 kategorie + 4 keywords. Wszystkie pola mieszczą się w limitach; skrypt `docs/listing-check.py` to sprawdza i potwierdza, że każdy tekst występuje w tym pliku dosłownie.
- **Kategorie:** Security and compliance + Administrative tools. **Keywords:** Audit, Compliance, User permissions, Risk Management. Dokładnie taki zestaw mają Project Access Review (Akeles), a podobny Access Reviewer360 i AuditAdmin (sprawdzone w Marketplace REST 2026-10-09). To standard niszy, więc nie ma sensu z nim walczyć.
- **Pozycjonowanie bez nazywania konkurentów:** „the why” (ścieżka grantu), uczciwa kompletność, dowód z hashem SHA-256, read-only (kontrast z Access Reviewer360, które robi revoke). Konkurentów (AccessLens, Project Access Review, Project Roles) ani JRACLOUD-71967 **nie wymieniamy** w listingu. Ticket to dobry materiał na stronę /docs albo post w Community, ale dopiero po Twojej decyzji.
- **Ceny (PROPOZYCJA, §8):** Standard $0 do 10 użytkowników, potem $0.60 / $0.48 / $0.32 / $0.20 za użytkownika miesięcznie. Daje to $54/mies., czyli $540/rok za 100 użytkowników, w środku przedziału 500–600 USD ze specyfikacji (§13). Advanced dopiero po akceptacji płatnego listingu i dopiero, gdy powstaną funkcje fazy 2 (kampanie). W listingu nie ma o nim ani słowa.
- **Privacy & Security:** gotowe odpowiedzi w §9. Dwie rzeczy wymagają uczciwego ujawnienia: (1) manifest deklaruje `allowImpersonation: true` na scope'ach odczytu, (2) Atlassian po instalacji dodaje app usera AccessRadar do grup adminów (week1-findings §3), choć aplikacja ma wyłącznie scope'y `read:*`. Pytania prawne oznaczyłem **[TO CONFIRM]**.
- **Do sprawdzenia przed submitem (feature truth check):** PDF evidence pack jest w specyfikacji (M6), ale w kodzie na 2026-10-09 jeszcze go nie ma (jest SHA-256, harmonogram daily/weekly, retencja, ryzyka). Widoki Explore/Changes/Reviews w UI są częściowo placeholderami. Listing opisuje zakres v1.0 ze specyfikacji; nie publikuj go, dopóki build tego nie robi (recenzent sprawdza zgodność listingu z aplikacją). Pełna lista w §11.
- **Bez wymyślonych liczb:** brak liczby klientów, instalacji, opinii, cytatów i obietnic certyfikacji. AccessRadar *wspiera* zbieranie dowodów do SOC 2 / ISO 27001; nie jest certyfikowany i nie gwarantuje zgodności.

---

## 1. App name

| Field | Value | Chars |
|---|---|---|
| **App name (recommended)** | `AccessRadar – Access Review & Permission Audit for Jira` | 55 / 60 |
| Alternative A | `AccessRadar – Permission Audit & Access Reviews for Jira` | 56 / 60 |
| Alternative B | `AccessRadar: Permission Audit, Snapshots & Sign-off for Jira` | 60 / 60 |

Compliance with the brand guidelines: "Jira" comes after "for", Title Case, none of the prohibited words (Atlassian, plugin, beta, add-on, app, Premium), no dash next to "Jira". The spec's working name (`AccessRadar – Jira Access Review & Permission Audit`, 51) puts Jira mid-name, so it is not used.

*(PL) Konflikty nazwy z §12 specyfikacji: 0 wyników „AccessRadar” w Marketplace, ale ta sama nazwa istnieje poza Atlassian (WCAG.World / getaccessradar.com: dostępność WCAG; Vennx „Access Radar”: IAM/GRC, Brazylia). Przed publikacją sprawdź znaki towarowe (EUIPO/USPTO/WIPO) i ponownie unikalność nazwy w dniu submitu.*

---

## 2. Tagline, summary, More details

### 2.1 Tagline (≤130 chars, no trailing period)
> See who can access what in Jira and why, what changed since your last review, and sign off with evidence auditors can check

*(123/130, no trailing period.)* Short alternative: *Who has access to what in Jira, and why. Read-only access reviews with audit-ready evidence* *(91/130)*.

### 2.2 Summary (≤250 chars; plain text, shown in search results)
> See who has access to what in Jira and why: group, project role and permission scheme. Scheduled snapshots, diffs, signed access reviews and CSV/PDF evidence for SOC 2 and ISO 27001. Read-only. Runs on Atlassian.

*(212/250.)*

### 2.3 More details (≤1000 chars; plain text plus bullets and line breaks)
```
Access reviews in Jira Cloud usually mean clicking through permission schemes, project roles and groups, then rebuilding it all in a spreadsheet. AccessRadar shows effective access with the path behind it, keeps history, and turns a review into evidence an auditor can check.

Built for Jira admins and compliance teams:
• Project, group and person views of who holds which permission
• The "why": group → project role → permission scheme grant
• Daily or weekly snapshots, plus one on demand
• Diff two snapshots: access granted and removed, group and scheme changes
• Access reviews: mark items OK or To change, then sign off with a SHA-256 evidence hash
• CSV and PDF evidence export for SOC 2 and ISO 27001 audits
• Risk indicators: admins, inactive users with access, public (anonymous) grants
• Completeness shown for every snapshot

Read-only scopes only: AccessRadar never changes Jira. Runs on Atlassian: no data egress; data stays in Atlassian.

Free for up to 10 users.
```
*(980/1000.)* The long-form version for the docs landing page is in §4.

---

## 3. Highlights (exactly 3; title ≤50, description ≤220, caption ≤220)

### Highlight 1: Effective access + the "why"
- **Title:** Every access, with the reason behind it *(39/50)*
- **Description:** Pick a project, group or person and see who holds which permission. Open any entry for the path: group membership, project role and permission scheme grant. Issue-dependent grants are labelled as such. *(201/220)*
- **Caption:** Explore by project: people and groups with their key permissions, and the Why panel tracing one grant from group to project role to the permission scheme. *(154/220)*
- **Image concept (S1):** Explore → Projects, demo project **PAY "Payments Platform"**, light theme. Matrix of people/groups × key permissions (Browse, Create, Edit, Delete, Administer) with path chips (Role, Group, Direct, Application). Right-hand **Why** panel open for one cell: `Dana Kowal ∈ group contractors → actor of role Developers in PAY → Developers has EDIT_ISSUES in "Default software scheme"`. Crop 580×330: the Why panel with the path.
- **Alt text:** "AccessRadar project view listing who can access the Payments Platform project, with a panel explaining one permission through group, project role and permission scheme"

### Highlight 2: Snapshots + diff
- **Title:** What changed since your last review *(35/50)*
- **Description:** Daily or weekly snapshots, plus one on demand. Compare any two to see access granted and removed, group membership and scheme changes, filtered by project, group or permission. Export the diff to CSV. *(200/220)*
- **Caption:** Changes view: two snapshots compared, with access granted and removed listed separately and filters by project, group and permission. *(133/220)*
- **Image concept (S2):** Changes, light theme. A/B selector on a snapshot timeline (A = last signed review, B = latest). Tabs *Access granted (n) / Access removed (n) / Groups / Schemes & roles*. Visible rows: a contractor added to `jira-admins-demo`, a group removed from Developers in PAY, a new grant in a scheme. Granted/removed shown by text label and icon, not colour alone. Crop 580×330: the granted/removed list.
- **Alt text:** "AccessRadar comparison of two snapshots showing access granted and removed since the last review"

### Highlight 3: Review sign-off + evidence + trust
- **Title:** Sign-off you can hand to an auditor *(35/50)*
- **Description:** Mark each item OK or To change, then sign off. The review is frozen with a SHA-256 evidence hash and exported as CSV and a PDF evidence pack for SOC 2 and ISO 27001. Read-only, Runs on Atlassian. *(195/220)*
- **Caption:** Review sign-off: summary of decisions, who signed and when (UTC and local time), and the SHA-256 evidence hash printed in the PDF and CSV export. *(145/220)*
- **Image concept (S3):** Reviews → "Q4 2026 access review", sign-off screen after signing, light theme. Summary (items, OK, To change), signer (fictional demo admin), signed-at in UTC and local time, base snapshot ID, engine version, the 64-character SHA-256 hash, buttons *Export CSV* / *Export PDF evidence pack*. Optionally the PDF cover page as an inset. Crop 580×330: signer + hash block.
- **Alt text:** "AccessRadar signed access review with decision summary, signer, timestamps and SHA-256 evidence hash"

---

## 4. Long-form description (docs landing page / website; not length-limited)

**AccessRadar – Access Review & Permission Audit for Jira**

In Jira Cloud, effective access comes from several layers at once: the permission scheme on each project, its grants to groups, project roles, users and application roles, the actors in each project role, and group membership. Answering "who can see project X?" or "what can this person do?" means clicking through all of them, and an access review for SOC 2 or ISO 27001 usually ends up as a spreadsheet that is hard to reproduce and hard to defend. AccessRadar collects these layers on a schedule, resolves effective access with the path behind every grant, keeps history, and turns a review into evidence with an integrity hash.

**Who has access, and why**
- Explore by project (who has access), by group (where it reaches) and by person (what they can do).
- Key permissions at a glance (Browse projects, Create, Edit and Delete issues, Administer projects); the full permission list in details.
- The path for every entry, e.g. group → project role → permission scheme grant.
- Grants that depend on the issue (reporter, assignee, user or group custom field) are labelled as conditional, not expanded into people. Grants to anyone are flagged as anonymous access.
- App accounts hidden by default.

**Snapshots and changes**
- Scheduled snapshots, daily or weekly, plus "take a snapshot now".
- Status, progress and completeness for every snapshot: AccessRadar tells you what it could not read instead of hiding gaps.
- Compare any two snapshots: access granted and removed, new and removed projects, group membership changes, scheme and role changes, with filters by project, group and permission.

**Access reviews with sign-off**
- A review = a scope (selected projects or the whole site) + a pinned snapshot, optionally compared with the previous review.
- Mark items OK or To change with a note; bulk actions for uniform items.
- Sign-off records who signed and when (UTC and local time) and freezes the review with a SHA-256 evidence hash over the items, decisions, snapshot content hash and engine version. The hash is tamper-evident, and auditors can recompute it from the CSV (see docs).
- Items marked To change form a to-do list you carry out in Jira yourself. AccessRadar never changes anything.

**Evidence export**
- CSV: access matrix, changes between snapshots, review decisions.
- PDF evidence pack: scope, snapshots, signer, hash, methodology, completeness, summary and flagged items.
- AccessRadar supports evidence collection for SOC 2 and ISO 27001 access-control reviews. It is not a certification and does not guarantee compliance.

**Risk indicators**
- Admins (members of groups with admin or site-admin access).
- Inactive users who still have access.
- Public (anonymous) grants, broad application-role grants and people with wide project-admin rights.

**Runs on Atlassian, read-only**
- Read scopes only: no write or manage scopes. AccessRadar cannot change permissions, schemes, roles, groups or issues, and it cannot read issue content.
- Built on Forge with zero egress: AccessRadar makes no calls outside Atlassian. Exports are generated in your browser.
- App data is stored in Forge hosted storage (Forge SQL) on Atlassian infrastructure. No email addresses are stored.

**Requirements and limits**
- Jira Cloud; AccessRadar is used by Jira administrators.
- Global permissions are shown partially (admin and site-admin access levels, per-person checks): Jira's REST API has no endpoint that lists all global permission holders.
- Team-managed projects are shown with their project-scoped roles.
- Out of scope: issue security levels, filter and dashboard permissions, Confluence, Jira Service Management portal customers, organization-level admin.

*(PL) Ograniczenia (globalne uprawnienia częściowo, team-managed, zakres „Won't”) pochodzą z §3, §6 i week1-findings. Warto je mieć w docs, bo „uczciwość co do kompletności” to nasz wyróżnik.*

---

## 5. Categories and keywords (max 2 categories + 4 keywords, from Atlassian's fixed lists)

| Field | Choice | Why |
|---|---|---|
| Category 1 | **Security and compliance** | Atlassian's description names "auditing tools, compliance management, user provisioning" |
| Category 2 | **Administrative tools** | "user permission management"; the app lives in Jira admin |
| Keyword 1 | **Audit** | Core use case |
| Keyword 2 | **Compliance** | SOC 2 / ISO 27001 evidence |
| Keyword 3 | **User permissions** | Who has access and why |
| Keyword 4 | **Risk Management** | Risk indicators (admins, inactive, public grants) |
| Alternates | Reporting · Analytics | Swap in Reporting if search reports show buyers look for "permission report" |

Sampled 2026-10-09 from Marketplace REST (`/rest/2/addons/{key}` → `tags`): Project Access Review for Jira Cloud = Administrative tools + Security and compliance / Audit, Compliance, User permissions, Risk Management; Access Reviewer360 and AuditAdmin = same categories / Audit, Compliance, User permissions, Analytics. Use the exact names from the console picker. The **Runs on Atlassian** badge is applied automatically (the dev deploy already reports "eligible for the Runs on Atlassian program").

---

## 6. Image list and shot list

### 6.1 Required images

| # | Asset | Size | Format | Content |
|---|---|---|---|---|
| I1 | **App logo** | **144×144** px | PNG/JPG, transparent or chiclet | Radar mark from the MarginRadar/CostRadar family in an AccessRadar accent colour (e.g. a keyhole or shield inside the radar sweep), no text. No Atlassian/Jira logos or look-alikes. Same mark for Forge module icons |
| I2 | **App banner** | **1120×548** px | PNG/JPG | Must include app name, partner name and a functionality line. Left: logo + "AccessRadar" + "by Radrly". Right: crop of the Why panel (S1). Line: "Who has access in Jira, and why. Read-only access reviews" |
| I3 | Highlight 1 image | **1840×900** px (+ crop 580×330) | PNG/JPG | S1 |
| I4 | Highlight 2 image | **1840×900** px (+ crop 580×330) | PNG/JPG | S2 |
| I5 | Highlight 3 image | **1840×900** px (+ crop 580×330) | PNG/JPG | S3 |
| I6–I12 | Extra screenshots (optional, up to 5 per highlight, caption ≤220) | 1840×900 px | PNG/JPG | S4–S10 below |
| — | Partner logo | 144×144 px | PNG/JPG/GIF | Radrly logo (already on the partner profile from MarginRadar) |

Every image needs alt text. Show the app inside the Jira UI, not marketing slides. Capture from **production** (dev shows a "Dev" label: checklist §1), viewport 1840×900 (or 920×450 at 2×), browser chrome hidden, light theme for the three highlights, demo data only, fictional names and avatars.

### 6.2 Demo data to seed (fictional, synthetic seed script)
| Item | Seed |
|---|---|
| Projects | PAY "Payments Platform" (classic), WEB "Website", HR "People Ops" (restricted), OPS "Operations", KAN team-managed |
| Groups | `jira-admins-demo` (admin access), `developers`, `contractors`, `auditors`, `jira-software-users` |
| Situations to show | a contractor gaining Edit in PAY between snapshots; a deactivated user still in `developers` (inactive with access); one scheme granting Browse to anyone in WEB (public grant); one person with Administer projects in 4 projects; app accounts hidden |
| Snapshots | at least 3 (weekly), one pinned to a signed review "Q3 2026 access review" |
| Review | "Q4 2026 access review", scope PAY + HR, ~40 items, 3 marked To change, signed |

### 6.3 Shots
| # | Use | Screen | Theme | Caption (≤220) |
|---|---|---|---|---|
| **S1** | Highlight 1 | Explore → Projects (PAY) + Why panel | Light | see §3 |
| **S2** | Highlight 2 | Changes (A = last signed review, B = latest) | Light | see §3 |
| **S3** | Highlight 3 | Reviews → sign-off screen | Light | see §3 |
| S4 | Extra (H1) | Overview with risk tiles | Light | Overview: latest snapshot and its completeness, with risk indicators for admins, inactive users with access and public grants. |
| S5 | Extra (H1) | Explore → People (one person across projects) | Light | One person across all projects: access level per project and the path for each, such as membership in the contractors group. |
| S6 | Extra (H2) | Snapshots list | Light | Snapshot history with schedule, status and completeness; take a snapshot now at any time. |
| S7 | Extra (H3) | PDF evidence pack, cover + summary page | Light | PDF evidence pack: review scope, snapshots, signer, timestamps, evidence hash, methodology and flagged items, ready for your auditor. |
| S8 | Extra (H3) | Settings → Security & data | Light | Security and data: read-only scopes, no egress, what AccessRadar stores, where and for how long. |
| S9 | Extra (H2) | Get started | Light | Get started in three steps: see what is collected, pick a daily or weekly schedule, take your first snapshot. |
| S10 | Extra (H1) | Overview (same as S4) | Dark | AccessRadar supports Jira's light and dark themes. |

Extra-screenshot caption counts (verified by the script): S4 126 · S5 124 · S6 89 · S7 133 · S8 96 · S9 109 · S10 50 (all ≤220).

---

## 7. Links plan (all on accessradar.radrly.com; every URL must be live before submission)

| Console field | URL | Notes |
|---|---|---|
| Website / app home | https://accessradar.radrly.com | Landing page with the long-form copy (§4) |
| **Documentation URL** (required for Paid via Atlassian) | https://accessradar.radrly.com/docs | Include: in-scope data residency data list, completeness and limits (§4), how to recompute the evidence hash from CSV, why the app user is in admin groups |
| **Support** | https://accessradar.radrly.com/support · marcin@radrly.com | One contact everywhere (checklist §2). State hours and response time [TO CONFIRM], e.g. Mon–Fri 09:00–17:00 CET/CEST, first response within 1 business day; EN + PL |
| Support ticket system | https://accessradar.radrly.com/support | `developerLinks.supportTicketSystem` |
| **Privacy policy** | https://accessradar.radrly.com/privacy | Must match the code: accountId, display name cache, active flag, account type; no emails |
| **End User Terms / EULA** | https://accessradar.radrly.com/terms | Or Atlassian's standard customizable customer agreement |
| **DPA** | https://accessradar.radrly.com/dpa | Final version, no "draft" label (checklist §2) |
| **Security** | https://accessradar.radrly.com/security | Sections Incident response + Secure development (checklist §2); scopes with reasons; impersonation; app user admin groups; no egress; data lifecycle. Security contact marcin@radrly.com |
| App status page (optional) | https://developer.status.atlassian.com | Runs entirely on Forge |
| Forums | Enable the Atlassian Community tag | Checkbox in the version form |

**Release summary (≤80):** First public release: who has access and why, snapshots, diffs, signed reviews *(78/80)*

---

## 8. Pricing: PROPOSAL (follows the MarginRadar schema), USD per month

> **PROPOSAL, not decided.** Based on spec §13 (target ~$500–600 per 100 users per year for Standard). Free up to 10 users is from the brief and the checklist.

| Users (monthly tiers) | **Standard** (proposal) |
|---|---:|
| 1–10 | **$0** (flat, free) |
| 11–100 | $0.60 / user |
| 101–250 | $0.48 / user |
| 251–1000 | $0.32 / user |
| 1001+ (all higher tiers) | $0.20 / user |
| Annual | 10× monthly (Marketplace rule, automatic) |
| Multi-instance | Same as single-instance (checklist §4) |
| Trial | 30-day free trial |

Worked monthly examples (progressive, list price): 25 users $9.00 · 50 users $24.00 · 100 users $54.00 (= $540/year) · 250 users $126.00 · 500 users $206.00.

*(PL) Punkty odniesienia (USD/100 u./rok, spec §13): Access Lens 100, Project Roles 200, AuditAdmin 450, Group Permission Audit 650, AccessLens 900, Access Reviewer360 1 620; Project Access Review darmowa. $540 to środek półki: poniżej AccessLens i Access Reviewer360, powyżej mikroklonów. Do walidacji w rozmowach z adminami/audytorami. Koszt Forge SQL na dużych instancjach trzeba zmierzyć (spec tydz. 7) przed ustaleniem progów.*

**Advanced edition (later, not in this listing):** only after the paid listing is approved and the phase-2 features exist (multi-reviewer campaigns with project leads, escalation, Jira audit-log context, longer retention). Spec suggests ~1.5–2× Standard. Do not mention Advanced in the listing copy until then.

Revenue share: as for MarginRadar (Forge partners keep 100% up to $1M lifetime Forge revenue, then the standard Forge rate).

---

## 9. Privacy & Security tab: proposed answers (draft)

| Question (abbreviated) | Answer | Note |
|---|---|---|
| Stores End-User Data outside Atlassian (excl. logs)? | **No** | Forge SQL on Atlassian infrastructure |
| Processes End-User Data outside Atlassian / the end-user's browser? | **No** | Forge functions only; no `permissions.external`, no Forge Remote, no Connect. CSV/PDF generated in the browser |
| Does the app store personal data? | **Yes** | Atlassian accountId, display name (cache), active status, account type, group memberships and role assignments, review decisions with decider accountId and timestamps. **No email addresses** |
| Logs End-User Data? | **No** [TO CONFIRM] | Spec §8.4: logs without accountIds or emails; collector logs only point estimates and error codes. Verify in code; if not guaranteed, answer Yes (logs stay in the Forge developer console) |
| Logs End-User Data outside Atlassian? | **No** | — |
| Exposes remote REST APIs? | **No** | No web triggers |
| Shares End-User Data with third parties / sub-processors? | **No** | Only Atlassian (Forge hosting) |
| **Data residency** | **Yes: all in-scope End-User Data stored exclusively within the Atlassian Forge platform** | Forge SQL is residency-enabled; publish the in-scope list in /docs |
| Migration between residency locations? | **Yes** | Handled by Forge |
| Stores End-User Data after uninstall? | **Yes: min 0, max 28 days** [TO CONFIRM] | Forge hosted storage lifecycle; Radrly keeps nothing. Same reading as MarginRadar |
| Retention while installed | Snapshots: configurable 30–3650 days (default 395, i.e. 13 months); snapshots pinned by a review are kept; signed reviews kept until uninstall | From `src/db/settings.ts` / spec §8.5 |
| Custom retention on request? | **No**: the customer sets retention in Settings | — |
| Closed accounts | Daily `report:personal-data` check; closed accounts are anonymised (display name replaced by a pseudonym) | `src/privacy.ts` |
| Privacy-enhancing technologies? | **Yes: data minimisation** (no emails; accountId as key; anonymisation of closed accounts) [TO CONFIRM wording] | — |
| GDPR controller? | **No** [LEGAL TO CONFIRM] | — |
| GDPR processor? | **Yes** [LEGAL TO CONFIRM] | Personal data above, processed on the customer's behalf; DPA at /dpa |
| CCPA | **Not applicable / No** [LEGAL TO CONFIRM] | — |
| DPA available? | **Yes**: https://accessradar.radrly.com/dpa | — |
| Transfers EEA data outside the EEA? | **No** [TO CONFIRM] | Hosting follows the customer's Atlassian residency |
| Accesses PATs, passwords or shared secrets? | **No** | — |
| **User impersonation** | **Yes, declared**: `allowImpersonation: true` on the read scopes | Used only as a fallback collector identity when an admin turns it on (week1-findings §4). Decide before the first prod deploy whether to keep it (removing later = major + admin consent) |
| Security contact | marcin@radrly.com | — |
| Security policy link | https://accessradar.radrly.com/security | — |
| Compliance certifications? | **No** | Atlassian's platform certifications cover Forge hosting; do not claim them as Radrly's |
| CAIQ Lite | **No** (for now) | — |
| Encryption at rest outside Atlassian | **Not applicable**: nothing stored outside Atlassian | — |

**Scope justification** (submission form; confirm against the final `manifest.yml`):
- `read:project:jira`, `read:project-category:jira`, `read:issue-type:jira`, `read:project.property:jira`, `read:issue-type-hierarchy:jira`, `read:project-version:jira`, `read:project.component:jira`, `read:avatar:jira`: list projects and their schemes (the granular scope set Jira requires for `project/search`, project roles and group members). AccessRadar does not read issues.
- `read:permission-scheme:jira`, `read:permission:jira`, `read:field:jira`: read permission schemes and grants (including custom-field holders) and check permissions per person.
- `read:project-role:jira`: project roles and their actors.
- `read:group:jira`, `read:user:jira`: groups, group members, admin access levels and user status, to resolve who actually has access.
- `read:application-role:jira`: expand application-role grants into groups.
- `report:personal-data`: Atlassian privacy reporting for closed accounts.
- No write or manage scopes, no `read:jira-work` (the app cannot read issues: verified, `search/jql` returns 401). Remote hosts contacted: **None**.

**App user disclosure** (for /security and the Security Questionnaire): after install, Atlassian adds the AccessRadar app user to admin groups (`atlassian-addons-admin`, `jira-admins-…`) and to the `atlassian-addons-project-access` role. AccessRadar still holds read scopes only, so the API rejects any write; every UI call first checks that the caller is a Jira administrator.

*(PL) To ujawnienie jest ważne: nasza persona (admin robiący audyt) zobaczy app usera w grupie adminów. Lepiej, żeby przeczytała wyjaśnienie u nas, niż znalazła to sama.*

---

## 10. Accuracy notes (keep the listing truthful)
- Every listing claim maps to spec v1.0 Must items M1–M8 or Should S1 (risk indicators). No Advanced, campaigns, revoke, Rovo, Slack/email notifications or Confluence.
- **PDF evidence pack and parts of the UI are not built yet** (2026-10-09). Listing goes live only when the build does what it says.
- Risk indicators match `src/engine/risk.ts`: anonymous, broad-app-role, admins, wide-admin, inactive, large-groups.
- Schedule options match `src/db/settings.ts`: off / daily / weekly (default weekly).
- "Tamper-evident", not "tamper-proof" (spec §8.5). "Supports evidence for SOC 2 / ISO 27001", never "SOC 2 compliant" or "certified".
- No competitor names, no "best/#1", no customer counts, ratings or testimonials. JRACLOUD-71967 (1 011 votes, research 2026-10-09) is not cited in the listing.
- "Data stays in Atlassian" is used; "follows your data residency" is left to the P&S tab and docs until RoA residency is confirmed for production.

---

## 11. Decisions and inputs needed from Marcin
1. **App name:** recommended or Alternative A/B (§1); trademark check.
2. **Pricing:** accept or change the proposal in §8.
3. **Feature truth check before submit:** PDF evidence pack built; Explore (project/group/person), Changes, Reviews with sign-off and CSV export working in prod; risk tiles on Overview; key-permission labels.
4. **`allowImpersonation`:** keep from v1.0 or remove before the first prod deploy.
5. **Live URLs** on accessradar.radrly.com (§7), support hours and response time.
6. **Legal answers** in §9 (processor/controller, retention after uninstall, logging, EEA transfer).
7. **Assets:** logo 144×144, banner 1120×548, S1–S3 at 1840×900 (+ 580×330 crops), optional S4–S10, alt texts.
8. **Keywords:** confirm Audit / Compliance / User permissions / Risk Management.

---

## 12. Sources (checked 2026-10-09)
- MarginRadar listing §13 for Atlassian field limits, brand guidelines, P&S tab and Forge data residency documentation.
- New app categorization system (10 categories incl. Security and compliance, Administrative tools; max 2 + 4): https://developer.atlassian.com/platform/marketplace/new-app-categorization-system-in-marketplace/
- Marketplace REST `/rest/2/addons/{key}` tags for Project Access Review for Jira Cloud, Access Reviewer360, AuditAdmin, Group Permission Audit, Access Review for Jira (2026-10-09).
- AccessRadar spec `/workspace/access-review-mvp.md`, `docs/week1-findings.md`, `docs/marketplace-checklist.md`, `manifest.yml`, `src/engine/risk.ts`, `src/db/settings.ts`, `src/privacy.ts`.
