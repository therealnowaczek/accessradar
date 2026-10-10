# AccessRadar — PRD R1 + R2 (build-ready)

Status: draft for Marcin's approval · 2026-10-10 · baseline `main` @ `9ee84d2` · docs only, no code changed.
Inputs: `src/`, `manifest.yml`, `test/`, `static/app/src`, `docs/FEATURE-PARITY.md` (§4 gaps, §5 differentiators, §6 R1/R2, §7 pricing, §7.1 Forge cost, §7.3 APPROVED pricing).

---

## 0. Podsumowanie (PL)

- **R1 „audit-grade Standard” (8 PR-ów + 1 opcjonalny):** obowiązkowe uzasadnienie przy Revoke i nowa decyzja **Exception z datą wygaśnięcia** (rejestr wyjątków, wygasłe wracają w kolejnej recenzji); sekcja **Coverage & limitations** w PDF/CSV (dziś coverage jest tylko w PDF jako tabela, bez stałych ograniczeń metody i bez CSV); **podpis v2** z hashem snapshotu + hashem coverage (hash snapshotu jest już w dokumencie dowodowym jako `base.contentHash`, R1 dodaje weryfikację przez ponowne przeliczenie i pokazuje go w UI/PDF); **+5 reguł ryzyka** liczonych z danych już zbieranych; **Advanced: weryfikacja remediacji** (Revoke → następny snapshot potwierdza zniknięcie dostępu); **Advanced: evidence pack v1** z mapowaniem SOC 2 CC6.1–6.3 / ISO 27001 A.5.15, A.5.18, A.8.2; **optymalizacja Forge**: `ar-tick` = 1 zapytanie SQL na tick zamiast ~4–6, `timeoutSeconds` dostrojone, lżejszy harmonogram dla darmowego progu.
- **R2 „campaigns” (9 PR-ów):** kampanie cykliczne z delegacją do ownerów projektów (nowy moduł `jira:projectSettingsPage`, **bez nowych scope'ów**), przypomnienia **wyłącznie w aplikacji** (banner + skrzynka „Moje recenzje”, bez e-maila), alerty zmian w aplikacji, agent Rovo (read-only), łańcuch podpisów w Standard.
- **Zmiany scope'ów: żadna nie jest wymagana dla R1 ani R2 w rekomendowanym wariancie.** Opcjonalne (oznaczone jako SCOPE CHANGE → wersja major + ponowna zgoda adminów): przypomnienia/alerty jako issue Jira (`write:jira-work` + `read:jira-work` lub granularne odpowiedniki), reguła „publiczne filtry/dashboardy” (`read:filter:jira`, `read:dashboard:jira`), Forge KVS do „zero SQL przy bezczynności” (`storage:app`). Rekomenduję odłożyć wszystkie trzy.
- **Zero egress zostaje:** brak `external.fetch`, brak e-maili/Slacka/webhooków, PDF/CSV generowane w przeglądarce (jak dziś, `static/app/src/export/*`), brak zewnętrznych CDN/fontów. Kwalifikacja **Runs on Atlassian** zachowana; do zweryfikowania tylko Rovo (patrz §5).
- **Cennik §7.3** wdrażamy dopiero po akceptacji i publikacji na Marketplace (§6). Pytania do Marcina: §9.

---

## 1. Baseline (what the code does today — facts the PRD builds on)

| Area | Today | File |
|---|---|---|
| Modules | 3 × `jira:adminPage` on one Custom UI resource (admin, config, get-started), `scheduledTrigger` hour (`ar-tick`, 120 s) + day (`ar-privacy`), consumer `accessradar-collect` (`ar-collector`, 900 s), lifecycle trigger, Forge SQL `main` | `manifest.yml` |
| Scopes | 15 × `read:*:jira` (granular) + `report:personal-data`. No `write:*`, no `storage:app`, no `external.fetch` | `manifest.yml` |
| Auth | Every resolver: license check → `assertJiraAdmin` (POST `/rest/api/3/permissions/check` asApp, fallback `mypermissions` asUser) → `ensureMigrated` → server-side edition | `src/handlers.ts`, `src/lib/auth.ts` |
| Edition | `featureFlags(edition)`: customSchedules, unlimitedHistory, delegatedReviews, reviewCampaigns, changeAlerts, evidencePack, rovo. Background jobs use last license seen (`kv` row `edition:license`) | `src/domain/edition.ts`, `src/api/edition.ts` |
| Storage | **Forge SQL only.** "KV" = SQL table `kv` (`kvGet`/`kvSet`). No Forge KVS | `src/db/migrations.ts` (v001–v024), `src/db/settings.ts` |
| Reviews | Keep/Revoke + optional Note (Revoke note NOT enforced server-side: `decideItems` has an empty `if`), sign with attestation, SHA-256 over canonical evidence doc incl. `base.contentHash`, `verifyReview` | `src/engine/review.ts`, `src/api/service.ts` |
| Risk | 6 rules: anonymous, inactive, admins, wide-admin, broad-app-role, large-groups | `src/engine/risk.ts` |
| Export | CSV/PDF built **in the browser**; review PDF already prints a coverage table | `static/app/src/export/{csv,pdf,evidence}.ts` |
| Audit actions | `snapshot.started/completed/failed`, `review.created/decided/signed/deleted`, `settings.saved`, `edition.override`, `export` | `src/db/audit.ts` callers |
| Tick | `ensureMigrated` (migration runner reads its table) + `failStale` + `getSettings` + `kv edition:license` + `kv edition:override` + `MAX(started_at)` ≈ 4–6 SQL requests/hour/install, also on idle free installs | `src/handlers.ts`, `src/collector/run.ts` |

Conventions to keep (MarginRadar): Custom UI + Atlaskit/ADS tokens, single admin page with in-app side navigation (`static/app/src/routes.ts` `NAV`), drawers via `StackDrawer`/`DrawerFooter` (primary CTA first, left-aligned, then subtle Cancel), edition gating **server-side** in resolvers (UI only hides/promos), `BadRequest` for validation, `audit()` for every state change, migrations append-only, idempotent, one DDL per entry, no FKs, epoch-ms BIGINT UTC.

---

## 2. Forge constraints & zero egress

### 2.1 Hard rules (apply to every feature)
1. **No egress.** No `permissions.external.fetch`, no email, Slack, Teams, webhooks, external LLMs. Reminders and alerts are **in-app only** (admin page banners, project settings page inbox, Rovo answers). Jira issues/comments only behind an explicit scope change (§2.4) — **not in the recommended plan**. **Delegation reminders never use email** (Forge has no email API without egress; Jira `/issue/{key}/notify` needs an issue + write scope).
2. **CSV/PDF in the browser** (current pattern, `static/app/src/export/*`, pdf lib bundled by Vite). Server returns JSON only, paginated. No server-side PDF (memory/time risk), no file storage.
3. **No external CDNs, fonts, images, analytics** in Custom UI. Everything bundled into `static/app/dist`; ADS tokens + system font stack. `permissions.content` stays `styles: unsafe-inline` only (no `scripts`, no `external`).
4. **Runs on Atlassian eligibility preserved:** data only in Forge SQL (and, if ever approved, Forge KVS), no remote, no egress. Re-check `forge eligibility` (`forge deploy` output / Developer Console "Runs on Atlassian" badge) on every PR that touches `manifest.yml`.
5. **Telemetry = Forge logs + in-app `audit_event`.** No third-party telemetry. Log lines are structured `console.log('[area] event', {...})` without names/emails (accountIds only).

### 2.2 Forge limits we design against
**All numbers below are UNVERIFIED** (from memory of Forge docs, not checked today); **each implementing PR must re-verify against developer.atlassian.com/platform/forge/platform-quotas-and-limits/ before merge** (open item, not verified today).

| Limit | Value (verify) | Design rule |
|---|---|---|
| Resolver (UI) invocation | 25 s | Resolvers never build >20 000 review items (existing cap); heavy work → queue |
| Async consumer / scheduled function `timeoutSeconds` | up to 900 s | Long jobs split into steps (existing `job_step` pattern) |
| Function memory | 256 MB default (configurable) | Keep default; state built per snapshot is already in memory today — new features reuse `stateFor` with cache |
| Resolver payload / response | ~5 MB | Paginate items (page 500) for reviews >5 000 items; evidence pack fetched in pages |
| Async event payload | ~200 KB; ≤50 events per push; delay ≤900 s | Events carry ids only (review id, seq), never item lists |
| Scheduled trigger | per-app intervals: fiveMinute / hour / day / week; same for all installs | Cannot have per-install schedules → cheap gate inside the tick (§3.7) |
| Forge SQL | per-install DB; per-query time limit (seconds) and per-query memory limit; request rate limit; DDL rate-limited; storage quota per install | Batch writes (100–500 rows), indexed lookups, no full scans in resolvers on `fact`; migrations run only in queue consumer / warm container (existing) |
| Forge KVS | needs `storage:app` scope (not granted) | **Not used**; SQL `kv` table instead |
| Forge pricing free pool | per app: 100 000 SQL requests/month etc. (FEATURE-PARITY §7.1) | Every new scheduled path must be O(1) SQL when idle |

### 2.3 Per-feature check (✅ fits · ⚠️ risky, mitigation required)

| Feature | Egress | Limits fit | Risk flag |
|---|---|---|---|
| R1-1 Justification + exceptions | none | ✅ small writes; expiry check piggybacks on review creation + daily `ar-privacy` job | — |
| R1-2 Coverage & limitations | none | ✅ browser export, data already returned | — |
| R1-3 Signature v2 | none | ⚠️ verify recomputes snapshot hash from `fact` rows: for 1.6 M facts too heavy for a 25 s resolver → run as queue job `VERIFY_SNAPSHOT`, result polled | ⚠️ |
| R1-4 5 risk rules | none | ✅ pure functions over in-memory `AccessState` | — |
| R1-5 Remediation verification (Adv) | none | ✅ runs in snapshot `finalize` follow-up event; indexed by `item_key` | — |
| R1-6 Evidence pack v1 (Adv) | none | ⚠️ PDF of 20 000 items in browser may be slow/large → paginated fetch + item appendix capped/CSV attachment-free (separate CSV download) | ⚠️ |
| R1-7 Forge usage optimisation | none | ✅ reduces SQL | — |
| R2-1 Campaigns + delegation | none (in-app only) | ⚠️ new `jira:projectSettingsPage` module: non-Jira-admin callers → new authorization path (security-critical) | ⚠️ |
| R2-2 Change alerts | none | ✅ computed in snapshot finalize; capped 500 alerts/snapshot | — |
| R2-3 Rovo agent | none declared; Atlassian-hosted LLM | ⚠️ Runs on Atlassian eligibility of `rovo:agent` **not verified**; Rovo must be enabled on the site; action timeouts (25 s) → read precomputed data only | ⚠️ |
| R2-4 Signature chain | none | ✅ one extra hash per sign | — |

### 2.4 Scope ledger (all scope names **unverified** until `forge lint` passes with them in a dev branch)
| Need | Scope | In manifest? | Decision |
|---|---|---|---|
| All R1/R2 reads (projects, schemes, roles, groups, users, permissions/check, mypermissions) | existing `read:*:jira` | ✅ | no change |
| Project settings page module, Rovo modules | modules, no scope | n/a | minor version (no re-consent) — verify with `forge deploy` output |
| Reminders/alerts as Jira issues/comments | `write:jira-work`, `read:jira-work` (or `write:issue:jira`, `write:comment:jira`, `read:issue:jira`…) | ❌ | **SCOPE CHANGE → major**; deferred, in-app alternative chosen |
| Public filters/dashboards rule | `read:filter:jira`, `read:dashboard:jira` | ❌ | **SCOPE CHANGE → major**; deferred to R3 |
| Zero-SQL idle tick via Forge KVS | `storage:app` | ❌ | **SCOPE CHANGE → major**; not needed — 1 SQL/tick accepted |

---

## 3. R1 features

### 3.1 R1-1 Mandatory justification + Exceptions with expiry (Standard)

**Problem / story.** Auditors ask "why was this kept/removed?". As a Jira admin, I must give a reason when I Revoke or grant an Exception, and an Exception must expire so it is re-reviewed.

**Placement.** Standard (gap #2, cheap, raises review credibility in the base edition).

**Behaviour.**
- Decisions: `keep` | `revoke` | `exception` | null.
- `revoke` requires note ≥ 10 chars (trimmed). `exception` requires note ≥ 10 chars AND `expiresAt` in (now+1 day … now+366 days], date-only, stored as 23:59:59.999 in signer's TZ converted to UTC epoch ms. `keep` note optional (setting `requireKeepNote`, default false).
- Bulk decide applies one note/expiry to all selected items (existing bulk UX).
- On **sign**, every `exception` item is upserted into `access_exception` (status `active`).
- On **createReview**, any `access_exception` for the same `item_key` that is `active` and not expired is shown as pre-filled `exception` (decision copied, `decidedBy` = original, badge "Exception until …") — admin can override. Expired ones are marked `expired` and the item gets `risk = max(risk, 65)` and badge "Exception expired".
- Daily `ar-privacy` job (already daily) also runs `expireExceptions(now)` — one UPDATE.

**UX.**
- Reviews → review detail: decision `ButtonGroup` gains **Exception**. Clicking Revoke/Exception opens `StackDrawer` "Revoke access" / "Grant exception": `TextArea` "Justification" (required, `Form` validation message "Add a justification (at least 10 characters)"), for exception `DatePicker` (`@atlaskit/datetime-picker` — **new dependency**, bundled) "Expires on"; footer: primary **Revoke** / **Grant exception**, then Cancel.
- New nav item under Review: **Exceptions** (register): `DynamicTable` columns Subject, Project/Group, Permissions, Justification, Expires (Lozenge: `success` active, `moved` expires ≤14 d, `removed` expired), Granted by, Review link. Filters: status `Select`.
- Empty state (`EmptyState`): "No exceptions yet. Exceptions you grant during a review appear here with their expiry date."
- Error: `SectionMessage appearance="error"` with resolver message; validation errors inline in drawer.

**Data model.**
```sql
-- v025_review_item_exception
ALTER TABLE review_item ADD COLUMN expires_at BIGINT NULL
-- v026_access_exception
CREATE TABLE IF NOT EXISTS access_exception (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  item_key VARCHAR(512) NOT NULL,
  subject_type VARCHAR(16) NOT NULL,
  subject_id VARCHAR(256) NOT NULL,
  project_id VARCHAR(32) NULL,
  group_id VARCHAR(128) NULL,
  permissions TEXT NOT NULL,
  justification TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL,
  review_id VARCHAR(36) NOT NULL,
  granted_by VARCHAR(128) NOT NULL,
  granted_at BIGINT NOT NULL,
  closed_at BIGINT NULL,
  closed_reason VARCHAR(32) NULL,
  KEY ix_exc_item (item_key(191), status),
  KEY ix_exc_exp (status, expires_at)
)
```
`status` ∈ `active|expired|superseded|revoked`. Settings JSON (`kv.settings`) gains `requireKeepNote: boolean` (sanitized in `sanitizeSettings`).

**Resolvers / functions.**
- `decideItems({ id, idxs: number[], decision: 'keep'|'revoke'|'exception'|null, note?: string, expiresAt?: number }) → { changed }` — server enforces rules above (`BadRequest` texts fixed in tests).
- `signReview` — additionally upserts exceptions; previous active exception for same `item_key` → `superseded`; an item decided `revoke` closes an active exception (`revoked`).
- New `listExceptions({ status?: string, page?: number }) → { items, total }`.
- `expireExceptions(now: number): Promise<number>` in `src/db/exceptions.ts`, called from `PRIVACY` consumer branch.
- `buildReviewItems` unchanged; new `applyExceptions(items, active: ExceptionRow[], now)` pure fn in `src/engine/exceptions.ts`.

**Jira REST.** None new.

**Edition gating.** None (Standard). `featureFlags` unchanged.

**Evidence.** `EvidenceInput.items[]` gains `expiresAt: string|null` → part of signature v2 (§3.3).

**Acceptance criteria.**
1. Revoke/exception without valid note → `BadRequest`, nothing persisted (UI blocked too).
2. Exception without expiry, expiry in past, or >366 days → `BadRequest`.
3. Signing creates one `access_exception` per exception item; register lists it.
4. New review on later snapshot pre-fills unexpired exceptions; expired ones flagged with risk ≥65.
5. Daily job flips expired rows; audit event written once per run with count.
6. Signed review verification still passes for reviews signed before R1 (signature v1 path).

**Tests.** Unit (`test/review.test.ts`, new `test/exceptions.test.ts`): validation matrix (decision × note length × expiry), `applyExceptions` (active/expired/superseded, item no longer present), expiry timezone conversion (Europe/Warsaw, UTC, Pacific/Auckland edge). Integration (service with mocked `@forge/sql` as in existing tests): sign → register → new review pre-fill → expire → re-review.

**Telemetry/audit.** `review.decided` detail adds `{decision, count, withNote}`; new `exception.granted` (target review id, `{count}`), `exception.expired` (actor `system`, `{count}`), `exception.superseded`. Log `[exceptions] expired {count}`.

**Risks.** Copying a prior decision could look like rubber-stamping → badge + "Accept pre-filled exceptions" requires explicit bulk confirm. Timezone ambiguity → store UTC + signer tz in evidence.

---

### 3.2 R1-2 "Coverage & limitations" statement in PDF/CSV (Standard)

**Story.** As an admin handing evidence to an auditor, I need the export itself to say what AccessRadar could and could not see, so the evidence is not overstated.

**Placement.** Standard (differentiator #2).

**Content (fixed, versioned `LIMITATIONS_VERSION = 1` in `src/domain/limitations.ts`, shared to UI via resolver):**
1. Snapshot-level `coverage[]` rows (status, area, target, reason) — already collected.
2. Static method limitations: team-managed projects use a simplified model; conditional holders (reporter, assignee, user/group custom fields) are listed, not expanded; issue security levels not evaluated; Confluence/JSM customers out of scope; "inactive" = deactivated account, not last-login; global admin view partial (group access levels only); data is a point-in-time snapshot (timestamp + seq + content hash).
3. Completeness verdict: `complete` / `partial (N gaps)` / `failed`.

**UX.** Review detail + Snapshots detail: collapsible `SectionMessage appearance="information"` "Coverage & limitations" (warning appearance when partial). PDF: dedicated page after the summary. CSV: header comment block is non-standard → instead a separate leading section: rows `# coverage,<status>,<area>,<target>,<reason>` then blank line then data; plus **separate file** option "Download coverage CSV". Decision: prepend block with `#` prefix (documented; Excel tolerates) AND offer standalone file.

**Data model.** None (computed). **Resolvers:** `getReview` and `getSnapshot` responses add `limitations: { version, statements: string[] }` and `completeness`. **Jira REST:** none. **Gating:** none.

**AC.** Every review PDF/CSV and matrix PDF/CSV contains the block; partial snapshot shows warning appearance and gap count equal to UI count (`service.ts:89` logic reused); text identical between UI/PDF/CSV (single source).
**Tests.** `export/csv.test.ts`, `pdf.test.ts`, `evidence.test.ts`: block present, partial vs complete, escaping of commas/quotes in reasons.
**Audit.** `export` detail adds `{limitationsVersion}`.
**Risks.** Changing the statement text changes evidence meaning → version number included in signed doc (§3.3).

---

### 3.3 R1-3 Snapshot hash in signature — Signature v2 (Standard)

**Today.** `evidenceDocument` already includes `base.contentHash` and `compare.contentHash`. Gaps: (a) no `signatureVersion`, so any change to the doc breaks old verifications; (b) verify trusts the stored `snap.content_hash` instead of recomputing; (c) coverage and limitations not in the signed doc; (d) not displayed.

**Story.** As an auditor, I can verify that the signed review refers to exactly this snapshot, and that the snapshot itself was not altered.

**Spec.**
- `EvidenceInput` v2 adds: `signatureVersion: 2`, `coverageHash` (sha256 of canonical `coverage[]`), `limitationsVersion`, `items[].expiresAt`, `prevReviewHash: null` (filled in R2-4; field reserved now so v2 doesn't need v3 later), `signerTz`.
- `evidenceDocument(input)` dispatches on `signatureVersion` (missing → v1 legacy canonicalisation, byte-identical to today; covered by golden test).
- Verify modes: **quick** (resolver, today's behaviour + version dispatch) and **deep** (queue job): recompute snapshot content hash from `fact` rows valid at `seq` using the same `facts.ts` hashing as `finalize`, compare to `snap.content_hash` and to the value in the signed doc.

**UX.** Review detail header: "Evidence hash" + "Snapshot #12 hash" as monospace with copy `Button`; **Verify** opens drawer with two steps: "Signature" (instant) and "Snapshot integrity" (`ProgressBar`, polls). Results: `Lozenge success` "Verified" / `removed` "Mismatch" + `SectionMessage error` explaining which hash differs. Snapshot purged by retention → `SectionMessage warning` "Snapshot data was deleted by retention; only the signature can be checked."

**Data model.**
```sql
-- v027_review_sig
ALTER TABLE review ADD COLUMN signature_version INT NOT NULL DEFAULT 1
-- v028_review_cov
ALTER TABLE review ADD COLUMN coverage_hash CHAR(64) NULL
-- v029_verify_job
CREATE TABLE IF NOT EXISTS verify_job (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  review_id VARCHAR(36) NOT NULL,
  seq INT NOT NULL,
  status VARCHAR(16) NOT NULL,
  expected_hash CHAR(64) NULL,
  actual_hash CHAR(64) NULL,
  started_at BIGINT NOT NULL,
  finished_at BIGINT NULL,
  error VARCHAR(500) NULL,
  KEY ix_verify_review (review_id)
)
```

**Functions.** `verifyReview({id}) → { ok, signatureVersion, evidenceHash, recomputed }` (unchanged contract + fields); new `startSnapshotVerify({ reviewId }) → { jobId }` (pushes `{ step: 'VERIFY_SNAPSHOT', jobId }` to `accessradar-collect`); `getVerifyJob({ jobId }) → VerifyJob`. Consumer branch `VERIFY_SNAPSHOT`: streams facts with `first_seen <= seq AND last_seen >= seq` in pages of 3 000 ordered by `(kind,fkey)`, incremental SHA-256 (must equal `finalize` ordering — refactor shared `contentHashStream` in `src/engine/facts.ts`). Budget: 900 s; if >800 s, re-enqueue with cursor (`delayInSeconds: 0`).

**Jira REST.** None. **Gating.** Standard.

**AC.** Old (v1) reviews verify unchanged (golden fixture from `test/fixtures.ts`); new reviews are v2; tampering any item/coverage field → mismatch; deep verify on demo (~7 240 facts) < 10 s; deep verify after purge returns `purged`.
**Tests.** Unit: v1 golden hash, v2 canonical ordering, coverage hash stability; stream hash == finalize hash (property test on fixtures). Integration: sign → mutate `review_item.note` in mocked SQL → verify fails.
**Audit.** `review.signed` detail `{signatureVersion, evidenceHash}`; `review.verified` `{mode, result}`.
**Risks.** Hash ordering drift between finalize and verify = false "mismatch" → single shared function + test. Data purged by retention.

---

### 3.4 R1-4 Five new risk rules (Standard)

All pure functions in `src/engine/risk.ts`, input `AccessState` + `EffectiveAccess[]`, no new collection, no new scopes. `Risk['id']` union extended. Respect `includeAppAccounts` except where stated. When the relevant data is incomplete (coverage gap on that project/group) the item gets `detail: '… (partial data)'` and the rule never claims "none found" — `Risk.partial: boolean` added.

| id | Severity | Definition (exact) | Item id / label |
|---|---|---|---|
| `project-no-admin` | medium | Company-managed project where **no** active `atlassian` account resolves `ADMINISTER_PROJECTS` through any path other than global Jira admin membership. projectLead path counts. Projects whose scheme grants ADMINISTER_PROJECTS only to conditional holders also flagged. Team-managed projects excluded (coverage info). | `projectId` / `KEY: no project admin` (detail: scheme name) |
| `direct-user-grants` | low | Permission-scheme grant with `holderType === 'user'` (single user directly in scheme) for any key permission (`settings.keyPermissions`) on a scheme used by ≥1 project. Also role actors of type user on **≥ `directRoleUserThreshold` (default 10) projects** for the same person are NOT included (that is normal role use). | `${schemeId}:${grantId}` / `<scheme>: <PERMISSION> → <user>` (detail: N projects) |
| `unused-schemes` | low | Permission scheme with no project assigned (`projectsForScheme(id).length === 0`) **or** project role (global role id) that appears in no grant of any used scheme **and** has no actors in any project. Hygiene only. | `scheme:${id}` / `role:${id}` |
| `empty-groups-in-use` | medium | Group whose members were collected (`groupMembers.has(id)`), has 0 active members, and is referenced by a used scheme grant, role actor, or app role. Risk: someone added later silently inherits access. Groups with `members: 'unreadable' | 'not-collected'` excluded and counted in `partial`. | `groupId` / group name (detail: "grants N projects") |
| `app-accounts-admin` | high | Account with `accountType !== 'atlassian'` (app/customer) that is in an `admin`/`site-admin` group **or** resolves `ADMINISTER_PROJECTS` on ≥1 project. Ignores `includeAppAccounts` (always evaluated). | `accountId` / display name (detail: groups or N projects) |

Settings additions: `directRoleUserThreshold` reserved (not used in v1, do not add); none required. Overview risk cards (existing component) render new ids; each card has "Learn more" text in `src/domain/riskCopy.ts`.

**Jira REST.** None new (data from `/permissionscheme?expand=all`, `/project/{id}/role/{roleId}`, `/group/bulk`, `/group/member`, `/users/search` already collected; scopes `read:permission-scheme:jira`, `read:project-role:jira`, `read:group:jira`, `read:user:jira` present).

**AC.** Each rule has a fixture that fires and one that doesn't; partial data never yields `count: 0` without `partial: true`; overview shows 11 cards ordered by severity then count; risk items included in matrix CSV "Risks" sheet section.
**Tests.** `test/engine.test.ts`: 2+ cases per rule, plus app-account visibility toggle and team-managed exclusion.
**Audit.** none (read-only); log `[risk] computed {ms, counts}`.
**Risks.** False positives on `project-no-admin` for sites relying on global admins → copy explains; `unused-schemes` may include default scheme → still listed (hygiene).

---

### 3.5 R1-5 Remediation verification (Advanced)

**Story.** As an admin who marked access as Revoke, I need proof that it was actually removed — the next snapshot confirms or flags it.

**Placement.** Advanced (`featureFlags.remediationVerification` — **new flag**). Standard still records Revoke decisions; status column shows Advanced promo.

**Behaviour.** On sign (Advanced), each `revoke` item creates a `remediation` row `pending`. After every committed snapshot (`finalize` → push `{ step: 'REMEDIATION', seq }`), for each pending row: rebuild item key in new state (same `buildReviewItems` logic for the review scope but only for the subjects involved; implementation: `itemPresent(state, itemKey, keyPermissions)` pure fn):
- key absent → `verified` (seq, at);
- present → `still_present` (stays checkable; after 3 snapshots without change remains `still_present`, highlighted);
- relevant data partial (project/group coverage gap) → `inconclusive`.
- Group-scope items: absent if user no longer member of group.
Manual "Mark as accepted risk" → converts to exception (needs justification + expiry, R1-1 drawer).

**UX.** Review detail: tab **Remediation** (Tabs) with summary `ProgressBar` (verified / total), table columns Subject, Access, Decided by, Status Lozenge (`inprogress` pending, `success` verified #seq, `removed` still present, `default` inconclusive), Checked in snapshot. Overview card "Open remediations". Empty: "No revocations in this review." Standard: `SectionMessage` promo "Verify revocations automatically with Advanced".

**Data model.**
```sql
-- v030_remediation
CREATE TABLE IF NOT EXISTS remediation (
  review_id VARCHAR(36) NOT NULL,
  idx INT NOT NULL,
  item_key VARCHAR(512) NOT NULL,
  status VARCHAR(16) NOT NULL,
  created_at BIGINT NOT NULL,
  checked_seq INT NULL,
  checked_at BIGINT NULL,
  verified_seq INT NULL,
  detail VARCHAR(500) NULL,
  PRIMARY KEY (review_id, idx),
  KEY ix_rem_status (status)
)
```

**Functions.** `listRemediation({ reviewId }) → { rows, summary }` (Adv-gated: Standard returns `{ gated: true }`); consumer step `REMEDIATION { seq }` (idempotent: skips rows with `checked_seq >= seq`); `acceptRemediationRisk({ reviewId, idx, note, expiresAt })`. Gate check in `signReview` and in the consumer via `backgroundEdition()`.

**Jira REST.** None (no write — AccessRadar never revokes; remediation is done by the admin in Jira).

**AC.** Revoke item removed in next snapshot → verified with that seq; unchanged → still_present; partial → inconclusive; Standard never creates rows; downgrade keeps rows readable, stops checks; evidence pack lists statuses.
**Tests.** Unit `itemPresent` for project/group items, partial. Integration: sign (Adv) → fake next snapshot without grant → consumer → verified; edition standard → no-op.
**Audit.** `remediation.checked` (system, `{seq, verified, stillPresent, inconclusive}`), `remediation.accepted`.
**Risks.** Item key instability if engine changes path codes → match on subject+project+permission set, not path codes (itemKey already excludes paths ✅).

---

### 3.6 R1-6 Evidence pack v1 (Advanced)

**Story.** As a compliance owner I want one PDF per review that an auditor accepts without extra explanation.

**Placement.** Advanced (`featureFlags.evidencePack`, exists).

**Content (PDF, built in browser from `getEvidencePack` JSON pages):**
1. Cover: site, review name, scope, base/compare snapshot (seq, timestamps UTC + signer tz, content hashes), signature (signer, time, evidence hash, signatureVersion), verification instructions.
2. Methodology: how effective access is resolved (why-path), engine version, data sources (list of Jira REST endpoints, read-only).
3. Coverage & limitations (R1-2).
4. Summary: counts per decision, new/removed items, risk rule results at base snapshot.
5. Decisions table (all items; appendix pages) with justification, expiry.
6. Exceptions register excerpt (scope-relevant).
7. Remediation status (R1-5).
8. **Control mapping** (static, `src/domain/controls.ts`, versioned):
   - SOC 2 **CC6.1** (logical access security, restricted access) → effective access inventory, why-path, risk rules (anonymous, broad-app-role, app-accounts-admin).
   - SOC 2 **CC6.2** (registration/authorization, removal of access when no longer needed) → Revoke decisions + remediation verification, inactive users rule.
   - SOC 2 **CC6.3** (role-based access, periodic review, least privilege) → signed periodic review, exceptions with expiry, wide-admin rule.
   - ISO/IEC 27001:2022 **A.5.15** access control, **A.5.18** access rights (provision, review, removal), **A.8.2** privileged access rights → admins / wide-admin / app-accounts-admin.
   - Disclaimer: "Mapping supports, but does not by itself demonstrate, control operating effectiveness."
9. Audit trail excerpt (`audit_event` for this review).

**UX.** Review detail → **Download evidence pack** (primary only when signed; unsigned → disabled with tooltip "Sign the review first"). Standard → `Button` with Lock icon opening upgrade drawer. Progress `Flag` while paging. Error flag with retry.

**Data model.** None new (reads existing tables). **Functions.** `getEvidencePack({ id, page, pageSize<=1000 }) → { header, sections, items, nextPage }`, Adv-gated server-side (`REQUIRES_ADVANCED`). **REST:** none. **Gating:** resolver throws `BadRequest(REQUIRES_ADVANCED)` for Standard.

**AC.** Signed review → PDF with 9 sections; items count equals review count; hashes equal UI; Standard call refused server-side; 20 000-item review generates < 60 s on a mid laptop (perf test with fixture) or falls back to "items as CSV" link.
**Tests.** `export/evidence.test.ts`: section presence, mapping table, pagination; resolver gating unit test.
**Audit.** `export` with `{kind:'evidence-pack', reviewId, items}`.
**Risks.** ⚠️ browser memory for large PDFs; legal wording of mappings → Marcin review.

---

### 3.7 R1-7 Forge usage optimisation (all editions, tech)

**Problem.** Hourly `ar-tick` costs ~4–6 SQL requests × 720/month on every install including idle free ones; 100 000 free requests/app/month exhausted by ~20–45 idle installs (§7.1).

**Spec.**
1. **Precomputed gate row.** New `kv` key `tick:gate` = `{ nextDueAt: number|null, staleCheckAfter: number|null, v: 1 }` written whenever settings are saved, edition decision changes, a snapshot starts/finishes. Tick does **one** query: `SELECT v FROM kv WHERE k = 'tick:gate'`; if `now < nextDueAt` and (`staleCheckAfter` null or now < it) → return (1 SQL request). Missing row → slow path once, then writes the gate.
2. **No `ensureMigrated` in the tick fast path.** If the query fails with "table doesn't exist" → push `MIGRATE` and return.
3. **`failStale` only when a snapshot is running** (`staleCheckAfter` set at start, cleared on finish).
4. **Warm-container memo:** module-level cache of the gate for 10 min; invalidation is cross-function so memo only used when `nextDueAt` is > 1 h away. With memo, many ticks do 0 SQL.
5. **"Zero SQL" fully** would need Forge KVS (`storage:app`, SCOPE CHANGE) — not proposed.
6. **timeoutSeconds:** `ar-tick` 120 → 30 (fast path < 1 s; slow path only enqueues); `ar-privacy` 300 → 60 (only enqueues); `ar-lifecycle` explicit 30; `ar-collector` stays 900; `ar-resolver` default (25 s, no change possible above).
7. **Free-tier lighter schedule** (Standard and ≤10 active human users in latest snapshot `stats_json`): scheduled snapshot every 2 weeks (internal `biweekly`, not user-selectable; UI: "Free plan: every two weeks; manual snapshots any time"). The tick stays 1 SQL either way. **Needs Marcin's decision (Q3).** Retention stays 90 days.
8. Measure: log `[tick] fast|slow {sql:n}`; after release read Developer Console usage on a 1 000+ user site.

**Data model.** No DDL; `kv` key `tick:gate`. **Functions.** `computeGate(settings, edition, lastScheduledStart, running): Gate` pure (`src/collector/gate.ts`); `refreshGate()` called from `updateSettings`, `startSnapshot`, `finalize`, `decideForInvocation` on change. **REST/Scopes:** none. **Gating:** customSchedules logic reused.

**AC.** Idle install: ≤1 SQL request per tick (verified with SQL call counter mock); due hour → snapshot starts exactly as today (`isDue` tests stay green); settings change takes effect at next tick; stale running snapshot still failed within 2 h.
**Tests.** `computeGate` table tests (off/weekly/daily/free biweekly, DST irrelevant—UTC); tick integration with mocked `q` counting calls.
**Audit.** none; logs only.
**Risks.** Gate out of sync → missed snapshot. Mitigation: gate self-heals — slow path forced once per 24 h (`checkAfter` max 24 h).

---

## 4. R2 features

### 4.1 R2-1 Recurring review campaigns + delegation to project owners + in-app reminders (Advanced)

**Story.** As a Jira admin I schedule a quarterly access review that automatically creates per-project reviews, assigns each to the project's owner, reminds them, and gives me one progress dashboard. As a project owner (not a Jira admin) I review my project's access inside Jira project settings.

**Placement.** Advanced (`reviewCampaigns`, `delegatedReviews`).

**Delegation surface (no new scopes).** New module:
```yaml
jira:projectSettingsPage:
  - key: accessradar-project-review
    resource: custom-ui
    resolver: { function: ar-project-resolver }
    title: Access review
    layout: blank
function:
  - key: ar-project-resolver
    handler: index.projectResolver
```
Separate resolver function so the admin-only `assertJiraAdmin` path stays untouched. Authorization for every project resolver call: (1) license; (2) `context.extension.project.id` from server context (never payload); (3) caller has `ADMINISTER_PROJECTS` on that project via POST `/rest/api/3/permissions/check` asApp `{ accountId, projectPermissions:[{ permissions:['ADMINISTER_PROJECTS'], projects:[id] }] }` (scope `read:permission:jira` ✅ — already used by `auth.ts`); (4) caller is an assignee of an open assignment for that project OR Jira admin; (5) Advanced. Delegates can only read/decide items of their assignment; cannot sign campaign, cannot see other projects. **Security review required (⚠️).** `projectSettingsPage` is visible only to project admins — matches owner model. Project lead who is not project admin → assignment falls back to campaign owner (shown as "Unassigned").

**Campaign model.** Campaign = template: name, scope (site / projects / project category), frequency (`quarterly|semiannual|annual|once`), start date, review window days (default 14), delegate rule (`projectLead` | explicit map project→accountId | `admin`), reminder offsets (default 7, 3, 1 days before due + overdue daily), key permissions. Run = one execution: takes/uses a snapshot (fresh snapshot started, run waits for commit), creates one `review` per project (existing review engine, `scope.type='projects'`, ids=[project]) with `campaign_run_id`, creates assignments. Campaign owner signs each review, or delegate "submits" and admin signs (setting `delegateCanSign`, default false — Q5).

**Reminders (in-app only, no email, no Jira issues).**
- Project settings page banner: `SectionMessage warning` "Access review due in 3 days — 42 items left".
- Admin page: Campaigns dashboard + Overview card "Overdue delegated reviews".
- "My reviews" list in the project page for the delegate.
- Reminder state rows give an auditable record "reminder shown/issued at".
- Rovo (R2-3) can answer "what reviews are assigned to me".
- Optional later: Jira issue per assignment = **SCOPE CHANGE** (`write:jira-work`/`read:jira-work`), major version — not in R2.
- Known limitation (copy in UI + listing): delegates are not notified outside Jira; admins tell owners via their usual channels. ⚠️ Product risk: completion rates lower than competitors with Jira-issue reminders (Recert). Q4.

**UX.** Admin nav **Review → Campaigns**: `DynamicTable` (Name, Frequency, Next run, Last run progress `ProgressBar`, Status lozenge). "New campaign" drawer (primary **Create campaign**, Cancel): `Textfield` name, `RadioGroup` scope, `Select` projects/categories, `Select` frequency, `DatePicker` start, `Textfield type=number` window, delegate rule `RadioGroup`, override table (project → `UserPicker`-like `Select` fed by snapshot persons — no extra API), reminder offsets. **Preview** step (StackDrawer level 2): projects, assigned owner per project, estimated items, warnings (no admin owner, unassigned). Run detail: per-project rows (owner, items, decided %, due, status), actions "Reassign", "Open review". Project settings page: header, assignment card, item table identical to admin review (shared component `ReviewItemsTable`), **Submit review** primary. Empty states: no campaigns ("Schedule your first recurring review"), no assignment on project page ("No access review is assigned to this project"). Errors: forbidden → `EmptyState` "Only the assigned project admin can review access here".

**Data model.**
```sql
-- v031_campaign
CREATE TABLE IF NOT EXISTS campaign (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  scope_json TEXT NOT NULL,
  frequency VARCHAR(16) NOT NULL,
  start_at BIGINT NOT NULL,
  window_days INT NOT NULL,
  delegate_rule VARCHAR(16) NOT NULL,
  delegate_map TEXT NULL,
  reminder_days VARCHAR(64) NOT NULL,
  key_perms TEXT NOT NULL,
  status VARCHAR(16) NOT NULL,
  next_run_at BIGINT NULL,
  created_by VARCHAR(128) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  KEY ix_campaign_next (status, next_run_at)
)
-- v032_campaign_run
CREATE TABLE IF NOT EXISTS campaign_run (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  campaign_id VARCHAR(36) NOT NULL,
  seq INT NULL,
  status VARCHAR(16) NOT NULL,
  started_at BIGINT NOT NULL,
  due_at BIGINT NOT NULL,
  finished_at BIGINT NULL,
  review_count INT NOT NULL DEFAULT 0,
  error VARCHAR(500) NULL,
  KEY ix_run_campaign (campaign_id, started_at)
)
-- v033_review_campaign
ALTER TABLE review ADD COLUMN campaign_run_id VARCHAR(36) NULL
-- v034_review_campaign_ix
CREATE INDEX ix_review_run ON review (campaign_run_id)
-- v035_review_assignment
CREATE TABLE IF NOT EXISTS review_assignment (
  review_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(32) NOT NULL,
  assignee VARCHAR(128) NULL,
  status VARCHAR(16) NOT NULL,
  due_at BIGINT NOT NULL,
  submitted_at BIGINT NULL,
  submitted_by VARCHAR(128) NULL,
  last_reminder_at BIGINT NULL,
  reminder_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (review_id),
  KEY ix_assign_project (project_id, status),
  KEY ix_assign_assignee (assignee, status)
)
-- v036_notice
CREATE TABLE IF NOT EXISTS notice (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(24) NOT NULL,
  audience VARCHAR(16) NOT NULL,
  project_id VARCHAR(32) NULL,
  account_id VARCHAR(128) NULL,
  ref_id VARCHAR(64) NULL,
  severity VARCHAR(8) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NULL,
  created_at BIGINT NOT NULL,
  dismissed_by VARCHAR(128) NULL,
  dismissed_at BIGINT NULL,
  KEY ix_notice_aud (audience, dismissed_at, created_at),
  KEY ix_notice_proj (project_id, dismissed_at)
)
```
`notice` is shared by reminders (`kind='reminder'|'overdue'`) and alerts (R2-2). Retention: purged with audit retention.

**Functions / events / triggers.**
- Admin resolvers: `listCampaigns()`, `saveCampaign(input) → {id}`, `previewCampaign(input) → {projects:[{id,key,assignee,items}], warnings}`, `startCampaignRun({campaignId}) → {runId}`, `getCampaignRun({runId})`, `reassign({reviewId, accountId|null})`, `pauseCampaign({id})`, `deleteCampaign({id})` (runs/reviews kept).
- Project resolvers (`ar-project-resolver`): `getMyAssignment() → {assignment, review, items(page)}`, `decideAssignedItems({reviewId, idxs, decision, note, expiresAt})` (R1-1 rules), `submitAssignment({reviewId})`, `dismissNotice({id})`.
- Queue steps (existing queue): `CAMPAIGN_RUN {runId}` (starts snapshot if needed; when snapshot not committed → re-push with `delayInSeconds: 300`, max 36 tries), `CAMPAIGN_MATERIALIZE {runId, cursor}` (≤25 projects per event, then re-push; avoids 900 s / memory), `REMINDERS {}`.
- Scheduling: **no new scheduled trigger.** Hourly tick gate (R1-7) includes `nextCampaignAt` and `nextReminderAt` (min over rows) so idle cost stays 1 SQL. Reminder job runs at most once per hour, creates `notice` rows, updates `last_reminder_at`.

**Jira REST.** `/rest/api/3/permissions/check` (POST, `read:permission:jira` — present in manifest ✅), `/rest/api/3/project/search` for categories (`read:project:jira`, `read:project-category:jira` ✅). Everything else from snapshot. No write endpoints.

**Edition gating.** All admin campaign resolvers and project resolvers check `features.reviewCampaigns` / `delegatedReviews` server-side; background steps check `backgroundEdition()`; on downgrade: campaigns paused (`status='paused_edition'`), existing reviews remain usable by admins in the normal Reviews list.

**AC.**
1. Quarterly campaign on 3 projects → at start time a snapshot is taken and 3 reviews + 3 assignments exist; owners = project leads who have ADMINISTER_PROJECTS, others unassigned.
2. A project admin who is not the assignee sees "not assigned"; non-admin cannot load the page (Jira hides it) and resolver rejects direct calls (403 path tested).
3. Delegate decisions are attributed to the delegate in evidence (`decidedBy`), admin signs.
4. Reminder notices appear at configured offsets ±1 h, once each; overdue daily; never email, no external call (manifest unchanged except modules).
5. Idle site with paused campaigns: tick still 1 SQL.
6. Standard edition: campaign resolvers refuse; UI shows promo.
**Tests.** Unit: `nextRunAt(campaign, now)` (quarterly from start, month-end clamping), reminder schedule calc, delegate resolution. Integration: run → materialize paging (60 projects → 3 events), authorization matrix for project resolver (admin/non-admin/assignee/other project/edition), downgrade pause.
**Audit.** `campaign.created|updated|paused|deleted`, `campaign.run_started|run_materialized|run_completed`, `assignment.reassigned|submitted`, `reminder.issued` (system, `{count}`), `notice.dismissed`.
**Risks.** ⚠️ new authorization surface; ⚠️ no out-of-Jira notification; ⚠️ large sites (500 projects → 500 reviews) — materialize paging + per-run cap 1 000 projects; project lead ≠ owner.

---

### 4.2 R2-2 Change alerts (Advanced)

**Story.** As an admin I want to know quickly when someone gains Jira admin, "Anyone" access appears, or a deactivated account still has access.

**Rules (evaluated at snapshot commit vs previous committed snapshot, reusing `engine/diff.ts`):**
- `new-admin`: account newly in `adminAccounts` (high).
- `new-anonymous-grant`: new `anyone` grant on used scheme / scheme newly assigned to a project (high).
- `inactive-with-access`: account deactivated since previous snapshot and still has project access (high); plus still-present weekly digest (medium).
- `new-project-admin` (medium): new ADMINISTER_PROJECTS holder (user) on any project. Configurable on/off per rule.
- `new-app-account-admin` (high) (links R1-4).
Cap 500 alerts per snapshot; overflow → one summary alert.

**Delivery.** In-app only: admin page header bell (`Badge` count) + **Alerts** nav item (`DynamicTable`, filter, Dismiss / "Start review for this"); Overview `SectionMessage` for unread high alerts. Rovo can list them. Jira issue delivery = SCOPE CHANGE, deferred. Daily snapshot (Advanced) bounds detection latency to ≤24 h — stated in UI.

**Data model.** `notice` table (audience `admin`, kind `alert:<rule>`); settings JSON `alerts: { [rule]: boolean }`.
**Functions.** Queue step `ALERTS {seq}` pushed by `finalize` (Advanced only); `evaluateAlerts(prev: AccessState, next: AccessState, rules): Alert[]` pure in `src/engine/alerts.ts`; resolvers `listAlerts({status,page})`, `dismissAlerts({ids})`, `getAlertCount()` (cheap COUNT, included in `getStatus`).
**REST.** None. **Gating.** `changeAlerts` server-side in step + resolvers.
**AC.** Each rule fires once per change, not on unchanged snapshots; first snapshot produces no alerts; Standard never creates alerts; dismissing is audited.
**Tests.** Unit per rule with fixture pairs; cap behaviour; integration finalize→ALERTS→list.
**Audit.** `alert.raised` (system, `{seq, counts}`), `alert.dismissed`.
**Risks.** Noise on first daily snapshots after config changes → digest grouping; latency (snapshot-based, not real-time; real-time would need Jira webhooks/audit log + extra scopes).

---

### 4.3 R2-3 Rovo agent — read-only (Advanced)

**Story.** As a Jira admin I ask Rovo "Who can administer project PAY and why?", "What changed since the last review?", "Which reviews are overdue?".

**Manifest (modules only):**
```yaml
rovo:agent:
  - key: accessradar-agent
    name: AccessRadar
    description: Answers who has access to what in Jira, why, and what changed — from AccessRadar snapshots. Read-only.
    prompt: resource:rovo-prompt;agent.md
    conversationStarters:
      - Who can administer project <KEY>?
      - What changed since the last snapshot?
      - Which access reviews are overdue?
    actions: [ar-who-can-access, ar-why, ar-changes-since, ar-review-status, ar-person-access]
action:
  - key: ar-who-can-access
    name: Who can access a project
    function: ar-rovo
    actionVerb: GET
    description: List people and groups with a permission on a project, from the latest snapshot.
    inputs:
      projectKey: { title: Project key, type: string, required: true, description: Jira project key }
      permission: { title: Permission, type: string, required: false, description: e.g. BROWSE_PROJECTS }
  # ar-why {projectKey, accountId|name, permission}; ar-changes-since {sinceSeq?|sinceDate?};
  # ar-review-status {campaign?}; ar-person-access {accountId|name}
function:
  - key: ar-rovo
    handler: index.rovo
    timeoutSeconds: 25
resources:
  - key: rovo-prompt
    path: resources/rovo
```
(Exact Rovo manifest schema to be re-checked at implementation; schema above follows Forge `rovo:agent` + `action` docs as of 2026.)

**Rules.** Only `GET` actions. Handler `rovo(payload, context)`: license → `assertJiraAdmin(context.accountId)` (agent available to everyone with Rovo; non-admins get "AccessRadar data is available to Jira administrators only") → Advanced (`backgroundEdition` + `context.license` if provided) → read latest committed snapshot (cached state) → return ≤50 rows + "open in AccessRadar" deep link (admin page URL, no egress). Prompt forbids recommending changes as facts and requires mentioning coverage gaps.
**REST.** `permissions/check` (✅). **Scopes.** None new (verify in `forge lint`; if Rovo requires any scope → treat as SCOPE CHANGE, stop and ask).
**AC.** 5 actions return correct data on demo fixtures; non-admin refused; Standard refused with upsell text; response < 10 s on 100 k facts (state cache).
**Tests.** Unit: each action formatter; integration: authorization + edition.
**Audit.** `rovo.action` `{action, rows}` (accountId as actor).
**Risks.** ⚠️ Runs on Atlassian eligibility with Rovo modules unverified; ⚠️ Rovo not enabled on many sites; LLM may hallucinate beyond data → strict prompt, cite snapshot seq/time; privacy: answers contain names (same as UI).

---

### 4.4 R2-4 Signature chain across reviews (Standard)

**Story.** As an auditor I can see that no signed review was removed or altered from the sequence.

**Spec.** Each signed review stores `chain_seq` (1..n across all signed reviews on the site, or per campaign? → **site-wide chain** + campaign label) and `prev_review_hash` = evidence hash of the previous signed review. `prevReviewHash` field (reserved in v2) filled → `signatureVersion: 3` only if canonical doc changes; since field exists in v2 as null, chain reviews remain v2 with non-null value. Deleting a signed review is **blocked** (today `removeReview` — verify whether signed deletion is allowed; R2 forbids it for signed reviews, Q6). Verify chain: walk all signed reviews ordered by `chain_seq`, recompute hashes, report first break.
**UX.** Reviews list: column "Chain #"; **Verify chain** button → drawer result list; evidence PDF shows previous hash.
**Data model.**
```sql
-- v037_review_chain
ALTER TABLE review ADD COLUMN chain_seq INT NULL
-- v038_review_prev
ALTER TABLE review ADD COLUMN prev_review_hash CHAR(64) NULL
-- v039_review_chain_ix
CREATE UNIQUE INDEX uq_review_chain ON review (chain_seq)
```
Concurrency: sign assigns `chain_seq = MAX+1` with unique index; on duplicate key retry once.
**Functions.** `verifyChain() → { ok, length, brokenAt?: chainSeq, reason? }` (queue job if >200 reviews), `signReview` extended.
**REST/Gating.** none / Standard.
**AC.** Sequence contiguous; tamper any signed review → chain verify reports it; pre-R2 signed reviews form chain start (chain begins at first R2 signature; older listed as "pre-chain").
**Tests.** Unit chain walk; concurrency double-sign duplicate key retry.
**Audit.** `review.signed` `{chainSeq}`; `review.chain_verified`.
**Risks.** Retention purge of reviews? Reviews are not purged today (only audit events and facts) — keep it so.

---

## 5. Edition flags (target `src/domain/edition.ts`)

| Flag | R | Std | Adv | Server enforcement points |
|---|---|---|---|---|
| customSchedules | now | ❌ | ✅ | `effectiveSchedule`, `assertSettingsAllowed` |
| unlimitedHistory | now | ❌ | ✅ | same |
| remediationVerification (**new**) | R1 | ❌ | ✅ | `signReview`, `REMEDIATION` step, `listRemediation` |
| evidencePack | R1 | ❌ | ✅ | `getEvidencePack` |
| reviewCampaigns | R2 | ❌ | ✅ | campaign resolvers, `CAMPAIGN_*` steps |
| delegatedReviews | R2 | ❌ | ✅ | `ar-project-resolver` |
| changeAlerts | R2 | ❌ | ✅ | `ALERTS` step, alert resolvers |
| rovo | R2 | ❌ | ✅ | `ar-rovo` |
Standard-only features (exceptions, coverage, signature v2/chain, risk rules) need no flag. `editionView` exposes `comingSoon: string[]` computed from a `RELEASED` constant so Settings promo stays truthful per release. `test/domain/edition.test.ts` extended for the new flag.

---

## 6. Pricing rollout after release (§7.3 APPROVED)

**Precondition:** Marketplace approval + public listing live (and Advanced edition enabled in Marketplace after paid app approval — LISTING.md §8). Nothing below before that.

New tiers (monthly, per user, progressive from user 1):
| Tier | Standard | Advanced |
|---|---:|---:|
| 1–10 | $0 flat | $4 flat |
| 11–100 | $0.55 | $0.99 |
| 101–250 | $0.50 | $0.89 |
| 251–1 000 | $0.40 | $0.79 |
| 1 001+ (all higher tiers) | $0.25 | $0.45 |
Examples: Std 100 u. $55, 250 u. $130, 500 u. $230, 1 000 u. $430; Adv 100 u. $99, 250 u. $232.50, 500 u. $430, 1 000 u. $825. Annual 10× monthly, 30-day trial.

Steps (owner: Marcin for console/site deploy; agent PR for repo files):
1. **Repo PR `docs/pricing-7-3`:** `docs/accessradar-pricing-import.csv` (Standard columns: 0-10 → 0, 11-100 → 0.55, 101-250 → 0.5, 251-1000 → 0.4, every tier ≥1001 → 0.25; add Advanced columns if the import format supports them — verify in partner console, Q7), `docs/LISTING.md` §8 tables + examples + "What each edition includes" (remove *coming soon* for released features), `docs/name-pricing-legal.md` §2.5, `docs/listing-check.py` tier tables, `FEATURE-PARITY.md` §7 status line.
2. **Partner console:** Pricing → Standard tiers; Advanced edition tiers ($4 flat …). Check that existing evaluations/customers follow Marketplace price-change notice rules (60 days for existing customers on increase; this is a decrease vs current entries, so immediate — verify).
3. **Website accessradar.radrly.com:** edit `~/Desktop/CostRadar GIT/radrly/accessradar/` — `index.html#pricing`, `docs/` (editions page), `terms/` (price reference if any); deploy from Mac: `rsync -avz --delete -e "ssh -p 2244 -i ~/.ssh/vps_radrly" "~/Desktop/CostRadar GIT/radrly/accessradar/" root@84.247.134.34:/srv/radrly/accessradar/` (from `docs/site-prompts.md`), then check page + cache.
4. **Edition flags:** no code change for pricing; feature rows follow §5 `RELEASED`.
5. **Verify:** `python docs/listing-check.py`; Marketplace pricing page screenshot; Rest `/rest/2/addons/{key}/pricing/cloud/live` matches CSV.

---

## 7. Versioning & Marketplace impact

- `forge deploy -e production` creates a new app version; for a Marketplace-listed paid app, versions are **private until promoted/submitted** in the partner console. Minor versions (code, modules without new permissions) auto-upgrade installations.
- **Any scope or egress change ⇒ major version**: admins must re-consent; until they do, sites stay on the old version (feature skew, support load). Rovo/projectSettingsPage modules: expected minor — confirm in `forge deploy` output ("requires consent" warning) before merging the manifest PR; if it says major, stop and ask Marcin.
- Recommended order: R1 as 1–2 production deploys (minor). R2 manifest PR (project page + Rovo) as one deploy, so at most one potential consent event.
- Migrations are forward-only and run on first invocation per container + `MIGRATE` on upgrade; every DDL idempotent; ALTERs guarded (TiDB `ADD COLUMN` without IF NOT EXISTS → wrap: runner records applied names so re-run is safe; keep one DDL per entry).
- Listing updates: highlights/feature table per release; Privacy & Security tab unchanged (no new data categories, no egress) — re-confirm when Rovo ships (LLM processing by Atlassian).

---

## 8. PR breakdown (ordered; each small, self-contained, `npm run check` green, no manifest scope change)

| # | Branch | Scope / files | Depends | Size |
|---|---|---|---|---|
| V-00 | `chore/verify-platform-assumptions` | docs/spike-results only (§8b) | — | S |
| R1-01 | `r1/forge-tick-gate` | `src/collector/gate.ts` (new), `src/collector/run.ts`, `src/handlers.ts` (tick fast path), `src/api/service.ts` (refreshGate calls), `manifest.yml` (timeoutSeconds only), `test/collector.test.ts`, new `test/gate.test.ts` | — | S-M (~300 LOC) |
| R1-02 | `r1/risk-rules-5` | `src/engine/risk.ts`, `src/domain/riskCopy.ts`, `static/app/src/views/OverviewView.tsx`, `test/engine.test.ts`, fixtures | — | M (~400) |
| R1-03 | `r1/coverage-limitations` | `src/domain/limitations.ts`, `src/api/service.ts`, `static/app/src/export/{csv,pdf,evidence}.ts`, Review/Snapshots views, export tests | — | S-M |
| R1-04 | `r1/justification-exceptions` | migrations v025–v026, `src/db/exceptions.ts`, `src/engine/exceptions.ts`, `src/db/reviews.ts`, `src/api/service.ts`, `src/handlers.ts` (listExceptions), PRIVACY branch, `static/app/src/views/ReviewsView.tsx`, new `ExceptionsView.tsx`, `routes.ts`, `package.json` (+`@atlaskit/datetime-picker`), tests | — | L (~700) — may split UI into R1-04b |
| R1-05 | `r1/signature-v2` | migrations v027–v029, `src/engine/review.ts` (versioned doc), `src/engine/facts.ts` (stream hash), consumer `VERIFY_SNAPSHOT`, `src/lib/queue.ts` types, service verify, Reviews UI, golden tests | R1-03, R1-04 | M-L |
| R1-06 | `r1/edition-flag-remediation` | `src/domain/edition.ts` (+remediationVerification, RELEASED/comingSoon), `src/api/service.ts` editionView, Settings view, edition tests | — | S |
| R1-07 | `r1/remediation-verification` | migration v030, `src/db/remediation.ts`, `src/engine/remediation.ts`, finalize push `REMEDIATION`, consumer, resolvers, Reviews Remediation tab, Overview card, tests | R1-04, R1-06 | M |
| R1-08 | `r1/evidence-pack-v1` | `src/domain/controls.ts`, `getEvidencePack` resolver, `static/app/src/export/evidencePack.ts`, Reviews UI, tests | R1-03, R1-05, R1-07 | M-L |
| R1-09 | `r1/free-tier-schedule` (optional, after Q3) | `src/collector/gate.ts`, Settings copy, tests | R1-01 | S |
| R1-10 | `docs/r1-listing` | `docs/LISTING.md`, site copy notes, `FEATURE-PARITY.md` | R1-02..08 | S |
| R2-01 | `r2/notice-table` | migration v036, `src/db/notices.ts`, gate fields, status count, tests | R1-01 | S |
| R2-02 | `r2/change-alerts` | `src/engine/alerts.ts`, `ALERTS` step, resolvers, new `AlertsView.tsx`, header badge, settings toggles, tests | R2-01 | M |
| R2-03 | `r2/campaign-model` | migrations v031–v035, `src/db/campaigns.ts`, `src/domain/campaignSchedule.ts` (nextRunAt, reminders), tests | R1-04 | M |
| R2-04 | `r2/campaign-runner` | queue steps `CAMPAIGN_RUN`, `CAMPAIGN_MATERIALIZE`, `REMINDERS`, gate integration, admin resolvers, tests | R2-01, R2-03 | M-L |
| R2-05 | `r2/campaign-admin-ui` | `CampaignsView.tsx`, drawers (create/preview/run), `routes.ts`, shared `ReviewItemsTable` extraction | R2-04 | L |
| R2-06 | `r2/project-review-page` | `manifest.yml` (+`jira:projectSettingsPage`, `ar-project-resolver` function — **no scopes**), `src/handlers.ts` project resolver + `src/lib/projectAuth.ts`, UI entry for project context, authorization tests | R2-05 | M (security review) |
| R2-07 | `r2/signature-chain` | migrations v037–v039, `signReview`, `verifyChain`, block signed delete, Reviews UI, tests | R1-05 | M |
| R2-08 | `r2/rovo-agent` | `manifest.yml` (+`rovo:agent`, `action`, `ar-rovo`, resource `rovo`), `src/rovo/*`, `resources/rovo/agent.md`, tests | R2-02, R2-04 | M (eligibility check) |
| R2-09 | `docs/r2-listing` | LISTING.md, privacy tab check, FEATURE-PARITY | R2-* | S |
| P-01 | `docs/pricing-7-3` | CSV, LISTING §8, name-pricing-legal §2.5, listing-check.py (after Marketplace release only) | release | S |

Total: **21 PRs** (verification: 1, R1: 10 incl. 1 optional, R2: 9, pricing: 1); the scope-requiring work is a separate future major (§8a), not counted. Manifest-touching PRs: R1-01 (timeouts), R2-06, R2-08 — each must paste `forge lint` + `forge deploy -e development` output proving no new permissions.

---

## 8a. Future major version "AccessRadar 2.0 — permissions upgrade" (not R1/R2)

R1 and R2 add **no scopes**. Every feature that needs a new scope is collected here and shipped **together in one major version**, so admins re-consent only once. Scope names are **unverified**.

| Feature | Candidate scopes (unverified) | Why not possible without |
|---|---|---|
| Delegation reminders + change alerts as Jira issues/comments | `read:jira-work`, `write:jira-work` (or granular `read:issue:jira`, `write:issue:jira`, `write:comment:jira`) | creating issues is a write |
| Public filters / dashboards risk rule | `read:filter:jira`, `read:dashboard:jira` | data not readable with current scopes |
| Zero-SQL idle tick | `storage:app` (Forge KVS) | KVS needs this scope; SQL gate (1 req/tick) is the R1 substitute |
| (candidate) Jira audit-log "who changed what between snapshots" | `read:audit-log:jira` / `manage:jira-configuration` (unverified) | audit records endpoint needs admin-level scope |
Still excluded even in 2.0: any egress (email, Slack, webhooks) — breaks zero-egress/Runs on Atlassian.
Process: one branch `v2/permissions-upgrade`, one production deploy, release notes + listing Privacy tab update, monitor upgrade adoption; features detect missing consent at runtime (403 → disabled with explanation), so code must be safe on sites that haven't upgraded.

## 8b. Pre-build verification step (PR V-00, before R1-01)

Branch `chore/verify-platform-assumptions`, docs-only output `docs/spike-results/platform-verification-<date>.md`:
1. Read the official Forge limits page (platform-quotas-and-limits) and record: resolver timeout, `timeoutSeconds` max, memory, payload sizes, async event size/batch/delay, scheduled trigger intervals, Forge SQL per-query time/memory/rows/storage/rate limits, KVS limits. Replace every "unverified" number in §2.2 with the verified value + URL + date.
2. `forge lint` on a scratch branch with (a) `jira:projectSettingsPage` module, (b) `rovo:agent` + `action` modules — confirm no permission prompts; `forge deploy -e development` output must not mention new scopes/consent.
3. Confirm Runs on Atlassian eligibility with (b) in Developer Console.
4. On a scratch branch only (never merged in R1/R2): add candidate scopes from §8a, run `forge lint` to confirm exact names; record results.
5. Confirm `POST /rest/api/3/permissions/check` with `projectPermissions` works asApp for a non-admin account under current scopes (R2-06 dependency).
6. Measure SQL requests per tick before/after R1-01 on dev (Developer Console usage).
Size S. Blocks R1-01 (limits), R2-06 and R2-08.

## 9. Open questions for Marcin (PL)

1. **Przypomnienia bez e-maila:** zgoda, że w R2 przypomnienia są tylko w aplikacji (banner w ustawieniach projektu + panel admina + Rovo)? Alternatywa (issue Jira) wymaga `write:jira-work` = wersja major + ponowna zgoda adminów. Odkładamy?
2. **Reguła „publiczne filtry/dashboardy”** wymaga `read:filter:jira` + `read:dashboard:jira` (major). Odkładamy do R3?
3. **Darmowy próg (≤10 u.):** snapshot co 2 tygodnie zamiast co tydzień — akceptujesz? (Tick i tak spada do 1 zapytania SQL; oszczędność dodatkowa jest mała.)
4. **Delegacja tylko do project adminów** (moduł `jira:projectSettingsPage` widzą tylko oni). Project lead bez uprawnień admina projektu → „Unassigned”. OK?
5. Czy delegat może sam **podpisać** recenzję swojego projektu, czy tylko „Submit”, a podpisuje admin Jira (rekomendacja: admin)?
6. **Blokada usuwania podpisanych recenzji** (potrzebna dla łańcucha podpisów) — zgoda?
7. Plik importu cen: czy konsola partnera przyjmuje kolumny Advanced w tym samym CSV? (do sprawdzenia w konsoli)
8. Mapowanie SOC 2 / ISO w evidence pack — czy chcesz przegląd prawny/konsultanta tekstu disclaimera?
9. Rovo: akceptujesz ryzyko, że nie zweryfikowaliśmy jeszcze zgodności `rovo:agent` z odznaką Runs on Atlassian? Jeśli odznaka by spadła — Rovo wypada z R2.
10. Wyjątki: maksymalny okres 366 dni i minimalne uzasadnienie 10 znaków — OK?
