# AccessRadar: layout standard conformance

Audit of `static/app/src` against the Radrly layout standard v1.1 (`/workspace/radrly/layout-standard.md`, MarginRadar
`faa1ed8`), its checklist (chapter 13), `.cursor/rules/accessradar-ui.mdc` and `static/app/src/designSystem.guard.test.ts`.
Branch `ui/layout-standard-conformance`, base `origin/main` `10a5bb1`. Paths are relative to `static/app/src/` unless
they start with `src/` or `docs/`; line numbers refer to this branch.

Status values:

- **PASS**: met before this branch.
- **FIXED**: gap closed on this branch. The fix column says how.
- **ADAPTED**: met in AccessRadar's form of the rule (AccessRadar has no issue panel, gadget or wizard). The reason is given.
- **DEVIATION**: a deliberate, documented difference that needs Marcin's decision (see "Decisions").
- **ACCEPTED**: a former DEVIATION or ADAPTED rule that Marcin accepted on 2026-11-11 19:57 (see "Decisions").
- **OPEN**: SHOULD-level or larger gap, left for a later phase with a reason.
- **N/A**: the module type does not exist in AccessRadar (`manifest.yml`: three `jira:adminPage`, one
  `jira:projectSettingsPage`, no issue panel, no dashboard gadget).

## Checklist (chapter 13)

### General

| Rule | Status | Evidence (file:line) | Fix |
|---|---|---|---|
| R-0.1 MUST no raw button/input/select/textarea/table/dialog | PASS | guard rule 1 (`designSystem.guard.test.ts`), `ELEMENT_ALLOWLIST` empty | none needed. `views/SpikePanel.tsx` (dev only) also had raw `<p>`, `<code>`, `<span className>`; these are now ADS `Text`, `Code`, `Inline`, `Tooltip` |
| R-0.2 MUST tokens only; `token()`/`xcss` in TS, `var(--ds-…, fallback)` in CSS | FIXED | guard rules 2–3; `styles.css` | Spacing and border-width tokens in `styles.css` now carry px fallbacks (`var(--ds-space-300, 24px)`, `var(--ds-border-width, 1px)`). Colour tokens keep no fallback on purpose: the guard forbids colour literals, and light hex fallbacks break dark mode (R-11.5) |
| R-0.3 MUST no `@atlaskit/css` | PASS | guard rule 4 | none |
| R-0.4 MUST `VisuallyHidden`, no sr-only classes | PASS | guard rule 5; `skeletonTable.tsx:7` | none |
| R-0.5 MUST `view.theme.enable()` at start | PASS | `main.tsx:54` | none |
| R-0.7 MUST lazy-load a screen per module | PASS | `main.tsx:15-17` | none |

### Frame

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| R-1.1 MUST issue panel before project page | N/A | no `jira:issuePanel`; `routes.ts` `screenFor` | none |
| R-1.2 MUST compact loader before context | ACCEPTED | `main.tsx:67` `AppPhantom` (`skeletons.tsx`) | Every AccessRadar module is a full-height page frame, so the pre-context state is a full-page skeleton, not a 160px loader. Marcin accepted the full-page skeleton as the intended behaviour (2026-11-11); keep it, do not replace it with a compact issue-panel loader. Never a spinner (guard rule 9) |
| R-1.3 MUST licence block only when the licence exists and is inactive | PASS | `main.tsx:68` | none |
| R-1.4 MUST only `.page-scroll` scrolls on desktop | PASS | `styles.css:75` `.page-frame` overflow hidden; `.page-scroll` at `:118`; `ui.tsx:128` `PageScroll` per tab | none |
| R-1.5 MUST frame 100vh, overflow hidden | PASS | `styles.css:75` | none |
| R-1.6 MUST 24px inline padding (16px at ≤768px) | PASS | `styles.css:75`, `:353` | none |
| R-1.7 MUST no page max-width; forms/Details 560px | PASS | `ui.tsx:702` Details `35rem`; `GetStartedScreen.tsx:19`; Settings forms live in the 600px side panel | none |
| R-1.8 MUST project page has no sidebar | PASS | `ProjectReviewScreen.tsx` renders only `ProjectReviewView` (PageFrame) | none |
| R-1.9 MUST spacing only from table 1.2 | PASS | `Stack space="space.300"` sections, `space.200`/`space.150` inside, `MetricGrid` gap `space.150` | none |
| R-1.10 MUST admin sidebar 240px, one line, no shadow | PASS | `styles.css:24-43` | none |
| R-1.12 / R-1.13 issue panel | N/A | no issue panel | none |
| R-1.14 / R-1.15 gadget | N/A | no dashboard gadget | none |
| R-1.16 MUST breakpoints 1023/900/860/768/600/520 | FIXED | CSS: guard rule 11. JS: `ui.tsx:285` | `PageHeader` used `useMaxWidth(899)`; it is now `useMaxWidth(900)`, the shared breakpoint. The new guard rule 14 checks `useMaxWidth(…)` and `matchMedia('(max/min-width: …)')` |
| R-1.17 MUST ≤768px one scroll, no pin, no fade | PASS | `styles.css` single-scroll block | none (the same block now also covers 200% zoom, see R-1.18) |
| R-1.18 MUST 200% zoom: ≤768px layout, nothing cut off | FIXED (phase 1 E2E 1.9) | `styles.css` `@media (max-width: 768px), (max-width: 1023px) and (max-height: 600px)`; guard rule 20; `Table.tsx` | E2E 1.9 at native Chrome 200% on a 1920px screen: the iframe is about 960 x 490 CSS px, so the compact navigation (≤1023px) appeared but the single-scroll block (only `max-width: 768px`) did not, and Overview and the review detail kept the pinned title and the fade. The block now also applies to the compact width with a short viewport (≤600px, a table 1.7 value), which is what 200% zoom produces on wide screens. Guard rule 20 checks the query, the unpinning rules and that height breakpoints use table 1.7 values. Nothing cut off (earlier on this branch): `.table-wrap`, `Table.tsx`, header actions collapse into "More" at ≤900px; guard rule 15 makes every table go through `Table.tsx` (`views/SpikePanel.tsx` moved to `../Table`) |
| R-1.19 MUST `isolation: isolate` on `.page-frame` | PASS | `styles.css:18-21` | none |
| R-1.20 MUST z-index only from table 1.8 | ACCEPTED | `styles.css` `.side-panel-root` (500), `.side-panel` (510) | These values belong to the right-edge side panel, accepted with R-7.5 (2026-11-11). Guard rule 10 allows exactly 1, 100, 500, 510 |

### Navigation

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| R-2.1 MUST `SideNavHeader`/`SideNavBody` in our own `<nav>` + side-nav-items | PASS | `AdminNav.tsx:30-61` | none |
| R-2.2 MUST no `@atlaskit/side-navigation` | PASS | guard rule 7 | none |
| R-2.3 MUST sidebar = brand + groups only | PASS | `AdminNav.tsx:30-61`. The Alerts item shows the open alert count, a functional count, not a marketing badge | none |
| R-2.4 MUST one active item, keyboard | PASS | `isSelected` on `ButtonMenuItem` (`AdminNav.tsx:47`) | none |
| R-2.5 MUST ≤1023px overlay, `@atlaskit/drawer` narrow | PASS | `AdminNav.tsx:68-99`, `styles.css:179` | Two comments still said "navigation becomes a select" (`styles.css`, `ui.tsx` `SplitLayout`); they are corrected |
| R-2.6 SHOULD groups Setup → domain → Organization → Governance | ADAPTED | `routes.ts:18` Home → Explore → Review → Configuration (Settings, then Activity = audit log, last) | none. AccessRadar has one settings page, so it has no Setup or Organization groups |

### Header

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| R-3.1 MUST at most one primary in the header; IconButton with label | PASS | all `PageHeader actions` audited; `ui.tsx` collapses to "More" | none |
| R-3.2 MUST no duplicated CTA | FIXED | `views/SnapshotsView.tsx:127-133` | With no snapshots and one running, the header showed a disabled "Take snapshot now" and the empty state showed an enabled one. The empty state now drops its CTA while a snapshot runs. Reviews, Overview and Snapshots already hide the header CTA when the empty state carries it |
| R-3.3 MUST Heading large for the page, SectionHeader for sections | PASS | `ui.tsx:267`; `Section` (`components.tsx:370`) | New guard rule 18: `Heading size="large"` only in `ui.tsx`. Get started step titles stay `Heading size="small"`, because they are list-item titles inside a page section |
| R-3.4 MUST pinned header = 1px separator + 24px fade | PASS | `styles.css:85-102` | none |
| R-3.5 MUST tabs: Tabs line, fade under the bar, header without a line | PASS | `styles.css:104-110`, `:164`; `ChangesView` uses `PageHeader flush` | none |
| R-3.6 MUST ≤768px no pin, line stays, fade off | FIXED (phase 1 E2E 1.9) | `styles.css` single-scroll block | Also at 200% zoom on wide screens (see R-1.18). The 1px line stays, the fades are off |
| R-3.7 MUST drawer header line + fade from surface-overlay | PASS | `Drawer.tsx:34-42`, `styles.css:323` | none |
| R-3.8 MUST TabList first child; panel scroll + ErrorBoundary | PASS | `ChangesView.tsx`; `ui.tsx:128` `PageScroll` wraps `PanelErrorBoundary` | none |

### Editions

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| R-4.1 MUST override only in Settings, only `canOverride` | ADAPTED | `views/SettingsView.tsx:890-921` `EditionSection`, `edition.canOverride === true` | AccessRadar has a single Settings page and no "Access" sub-page, so the Edition section sits at the top of Settings |
| R-4.2 MUST edition resolved on the server | PASS | `src/domain/edition.ts:106` `resolveEdition`; the UI reads `status.edition.features` | none |
| R-4.3 MUST env → stored → licence; dev without a licence = Advanced | PASS | `src/api/edition.ts:73-83`, `src/domain/edition.ts:1-30` | none |
| R-4.4 MUST kill switches in one `RELEASE_FLAGS` | N/A | AccessRadar has no kill-switched features today; spike code is removed by `scripts/strip-spike.sh` | `RELEASE_FLAGS` is not a file: in MarginRadar it is the constant in `src/domain/release.ts` (`applyReleaseFlags` turns unreleased features off on top of the edition flags). AccessRadar has no such file or constant in any branch, so nothing was added or removed. Add `src/domain/release.ts` with the first feature that needs a kill switch (decision 4) |
| R-4.5 MUST no edition switch in the sidebar or header | PASS | `AdminNav.tsx`, `ui.tsx` PageHeader | none |

### Language

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| R-6.1 MUST language and formats from `context.locale`, one source, en fallback | FIXED | `format.ts` `resolveFormatLocale`/`setFormatLocale`, `parseDateInput`, `dateOrder`; `ui.tsx` `DateField`; `main.tsx:47` | Phase 1 E2E fixes (decisions 3 and 4): the fallback for a missing or invalid locale is `en-US`, and typed dates follow the Jira locale too. `DateField` passes the locale to the ADS `DatePicker`, shows the value with `formatIsoDate` and parses with `parseDateInput(text, locale)`: the numeric order comes from `Intl` (en-US `12/1/2026` = December 1, en-GB/pl-PL `12/1/2026` = 12 January), month names come from the locale or English, ISO `YYYY-MM-DD` is always accepted, the calendar works with the mouse. The helper examples are built from the locale (`dateHelper`). Earlier on this branch: displayed dates were always `en-GB`. `main.tsx` now sets the format locale once from `context.locale` (canonicalised, so `pl_PL` becomes `pl-PL`). `formatLocal`, the new `formatLocalDate`/`formatLocalTime` and `formatIsoDate` use it. Exports keep their fixed ISO formats (`formatLocalExport`, `formatUtc`). `ReviewsView` built its due date with `formatLocal(...).split(',')[0]`, which breaks for en-US; it now uses `formatLocalDate`. `SettingsView` `localHour` now uses `formatLocalTime`. New guard rule 19 rejects ad-hoc date formatting outside `format.ts`. Tests: `format.test.ts` |
| R-6.2 MUST no language switcher anywhere | PASS | guard rule 8 | none |
| R-6.3 MUST time zone from `context.timezone` | PASS | `main.tsx:46`, `format.ts:125` | none |
| R-6.4 MUST a missing key falls back to English text | PASS | `i18n/index.ts`, `i18n/i18n.test.ts` | none |
| R-6.5 MUST no hard-coded UI copy | OPEN | many views | The i18n rollout is on hold by owner decision (standard chapter 14; rules file). Copy is unchanged except for the empty-state sentences under R-8.5 |

### Drawer, modal, fullscreen

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| R-7.1 MUST modal: Cancel (subtle) then primary, right | PASS | `Confirm.tsx:41-59` (the only modal) | New guard rule 13 checks the order inside every `ModalFooter` |
| R-7.2 MUST modal error inline, modal stays open | PASS | `Confirm.tsx` (confirmation only; callers toast) | none |
| R-7.3 MUST `shouldScrollInViewport` for form modals | N/A | no form modals (forms live in the side panel) | none |
| R-7.4 MUST drawer: primary left, Cancel right after | PASS | `Drawer.tsx:244-267`; all 8 `DrawerFooter` uses | New guard rule 13 requires the first footer button to be the primary, allows Cancel only through `onCancel`, and checks that `Drawer.tsx` renders children before Cancel. Also fixed: the Verify panel had a second primary ("Check snapshot integrity", `ReviewsView.tsx:1610`); it is now default appearance |
| R-7.5 MUST drawer = `@atlaskit/drawer` wide; no own panels | ACCEPTED | `Drawer.tsx:137` `LevelSidePanel` (right-edge, Blanket, own focus trap); guard rule 12 | Marcin's decision (2026-11-11): every panel uses the right-side sidebar panel. Commit `f118e9f` (2026-10-27) introduced it; every entity, settings, review and campaign panel already goes through `LevelSidePanel`/`LevelDrawer` (Overview, Spaces, Groups, People, Snapshots, Reviews, Campaigns, Settings), and guard rule 12 rejects a wide ADS drawer or any other own dialog. `@atlaskit/drawer` stays only as the narrow navigation overlay. Do not switch panels to a left-anchored ADS drawer |
| R-7.6 MUST footer 72px end padding, body 40px bottom | PASS | `Drawer.tsx:57`, `:62-69` (`space.300` + `space.600`) | none |
| R-7.7 MUST modals without FAB padding | PASS | `Confirm.tsx` | none |
| R-7.8 MUST fullscreen: primary left, then Back/Skip | ADAPTED | `GetStartedScreen.tsx` has one action per step, no Back/Skip | none |

### Components

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| R-8.1 MUST KPI 4/2/1, 1px border, 8px radius, surface-raised | PASS | `styles.css:204-220`, `ui.tsx:375-385` | none |
| R-8.2 MUST radii via `radius.*`, lines via `border.width*` | PASS | xcss everywhere; CSS now `var(--ds-border-width, 1px)` | fallbacks added (R-0.2) |
| R-8.3 MUST tables only DynamicTable | FIXED | `Table.tsx` | `SpikePanel` now uses `../Table`; guard rule 15 |
| R-8.4 MUST action column VisuallyHidden, RowMenu label | PASS | `skeletonTable.tsx:7`, `components.tsx` RowMenu | none |
| R-8.5 MUST empty state: title, one sentence, at most one CTA | FIXED | `ReviewsView.tsx` "No reviews yet"; `shared.tsx` `NoSnapshot`; `ChangesView.tsx:278`; `AlertsView.tsx:125`; `ProjectReviewView.tsx` "No assigned review"; `src/api/service.ts` `PROJECT_EMPTY_COPY` | Two-sentence descriptions are merged into one sentence with the same facts. New guard rule 16 checks header and description. Phase 1 E2E 1.4.5: the project page still showed two sentences with an em dash, because the server sends the description as `limitation` and the UI only falls back to its own (fixed) text when it is missing. The server strings (`PROJECT_EMPTY_COPY`) are now one sentence without dashes; `test/projectEmptyCopy.test.ts` checks them |
| R-8.6 MUST `headingSize="xsmall"` inside cards/sections | FIXED | `ExceptionsView.tsx:111`, `AlertsView.tsx:125`, `ChangesView.tsx:275-278`, `OverviewView.tsx:210` | `NoSnapshot` takes an optional `headingSize` (`shared.tsx:128-135`). Empty states under filter bars or among sections use `xsmall`. Alone on a page they keep the default |
| R-8.7 MUST toast for action success/error; inline for form errors | FIXED | `ReviewsView.tsx:532`, `CampaignsView.tsx:192`, `PeopleView.tsx:223`, `GetStartedScreen.tsx:56` | The review item panel showed a toast AND an inline error on a failed save; it now shows only the inline error. A failed campaign Preview or Create showed a toast; both now show inline in the form (`SectionMessage`). "Check now" for global permissions and "Take the first snapshot" (Get started) are actions without a form, so they now use toasts |
| R-8.8 / R-8.9 MUST chart tooltip / fixed height | N/A | no charts | none |
| R-8.10 MUST statuses via Lozenge; Badge only for counters | FIXED | `GetStartedScreen.tsx:221`; `CampaignsView.tsx` run assignments | The step number used `Badge` (an ordinal) and is now plain bold text. The campaign run assignment status was plain text and is now `Pill`. New guard rule 18 (Badge allowlist, empty) |

### Forms

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| R-9.1 MUST `noValidate` + Field validation | N/A | no `<form>` elements; controlled ADS fields | New guard rule 17 requires `noValidate` on any future `<form>` |
| R-9.2 MUST label above, help below, error inline | FIXED | `SettingsView.tsx:140`, `:283`; `ui.tsx` `DateField` | `NumberField` shows an `ErrorMessage` under the field when the value is out of range. Key permissions shows "Pick at least one permission." under the Select instead of only as a general error. Phase 0 finding 3: a typed date that is not a date in the user's locale shows the ADS `ErrorMessage` "Enter a valid date, for example 10/27/2026." under the field (the picker still keeps the last valid value) |
| R-9.3 MUST Save left, disabled without changes, isLoading | FIXED | `CampaignsView.tsx` `PreviewBody` | "Create campaign" got `busy` from the parent when the panel level was built, so it never showed loading and could be clicked twice. It now keeps its own `busy`. Settings and review panels already passed |
| R-9.4 MUST general save error under the button | FIXED | `ReviewsView.tsx:1143` | The item panel error sat above the Decision radios. It now sits at the end of the body, directly above the pinned footer, as in every other panel |
| R-9.5 MUST server errors mapped; no "Request payload is not valid." | PASS | `api.ts:18-22` | none |
| R-9.6 MUST info sections as Details | PASS | `SettingsView.tsx` Edition, Security & data | none |

### Loaders

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| R-10.1 MUST mirrored skeleton, no layout shift | FIXED | see the "Fix" column | Overview skeleton gains the Weekly digest section (`OverviewView.tsx:124`, `DigestCard.tsx` `DigestSectionPhantom`). The digest skeleton has 5 tiles, not 3. Space detail skeleton includes the key-permission columns (`ProjectsView.tsx:363`). Groups filter bar has 3 controls. Groups, People and Snapshot panels show their real section titles and Details terms instead of a generic block. Review detail adds "Review record". Remediation has 5 columns (Advanced). Chain verify shows the result table. Campaign run panel shows its table and footer. Settings adds "Change alerts" (when enabled) and "Security & data". Project review tiles have hint rows |
| R-10.2 MUST skeletons only `@atlaskit/skeleton` | PASS | `skeletons.tsx:27` `Phantom` | none |
| R-10.3 MUST UI change = skeleton change in the same PR | PASS | this branch updates the skeletons with each view change | none |
| R-10.4 / R-10.5 MUST never a full-page spinner; Spinner with label | PASS | guard rule 9 | none |
| R-10.6 MUST refetch keeps data | PASS | `data.ts` `useCall` keeps `data` while reloading | none |
| R-10.7 MUST drawer/modal header never a skeleton | FIXED | `CampaignsView.tsx:660` | The run panel had no footer while loading or on error; it now renders the real footer in every state |
| R-10.8 MUST first-load table = SkeletonTable | FIXED | `ReviewsView.tsx:1424` | The chain verify panel loaded with text lines; it now uses `SkeletonTable` |
| R-10.9 MUST chart skeleton | N/A | no charts | none |
| R-10.10 MUST `aria-busy` + `aria-label` on the root | PASS | `skeletons.tsx:44` `SkeletonRoot` | none |
| R-10.11 MUST no animated counters | PASS | none in code | none |
| R-10.12 SHOULD no artificial delays | PASS | only the side panel close animation (200ms) and the digest re-poll (`DigestCard.tsx`, 20s, documented) | none |
| R-10.13 MUST load error with retry; error with data = notice | FIXED | `ReviewsView.tsx:1271`, `DigestCard.tsx:78`, `GetStartedScreen.tsx:74`, `CampaignsView.tsx` run panel | Remediation showed a failed load as an empty result and now shows `ErrorState` with retry. Both Verify panels and the chain verify panel now offer retry. The digest error has "Try again" and a stale-data notice. Get started no longer replaces the page on a refresh error and pins a notice instead. The campaign run panel shows a stale-data notice |

### Accessibility, zoom, mobile

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| R-11.1 MUST IconButton with label | PASS | lint `no-empty-icon-button-label`; audit | none |
| R-11.2 MUST focus order = visual order; no `tabIndex > 0` | PASS | audit; only `tabIndex={-1}` on the panel root (`Drawer.tsx:186`) | New guard rule 17 |
| R-11.3 MUST dialogs: focus trap, Escape, focus return | PASS | `Drawer.tsx:71-130` (side panel), ADS modal and nav drawer | none |
| R-11.4 MUST popups open from the keyboard | PASS | ADS Tooltip and DropdownMenu only | none |
| R-11.5 MUST contrast via tokens, dark mode | PASS | guard rules 2–3; no colour fallbacks in CSS | none |
| R-11.6 MUST 200% / ≤768px without page sideways scroll | PASS | `styles.css` single-scroll block, `.table-wrap` | none; E2E 1.9 confirmed nothing is cut off (the pinned header part is R-1.18) |
| R-11.7 MUST reduced motion turns animations off | PASS | `styles.css:301`, `Drawer.tsx:162` | none |

### Enforcement

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| R-12.1 MUST guard test rules 1–9 green, allowlists with `why` | PASS | `designSystem.guard.test.ts` | Extended with rules 13–20 and their self-tests |
| R-12.2 MUST `@atlaskit/eslint-plugin-design-system` rules | PASS | `eslint.config.mjs` | none |
| R-12.3 MUST review screenshot set | OPEN | `docs/e2e/phase-1.md` | Produced by the browser agent on the dev site (the screenshots cannot be taken on the bot box) |

## Rules from `.cursor/rules/accessradar-ui.mdc` not in chapter 13

| Rule | Status | Evidence | Fix |
|---|---|---|---|
| New copy without em dash, en dash or emoji | FIXED | `ProjectReviewView.tsx` "No assigned review" | The one edited description had an em dash. Existing copy elsewhere is unchanged (copy rule applies to new copy) |
| Dates through `format.ts` helpers | FIXED | guard rule 19 | see R-6.1 |
| Drawer header fade selector `ar-drawer-header` | PASS | `styles.css:323` | none |

## Not fixed on this branch (with reasons)

1. ~~**R-7.5 side panel vs ADS drawer**~~: accepted (decision 1).
2. **Header detail skeleton, review scope column**: the review detail skeleton says "Where" while a group-scoped
   review says "Group". The scope is not known until the review loads. This is one header label in a skeleton, not a
   layout shift.
3. **Numbers** use `toLocaleString()` with the browser locale (`OverviewView.tsx`, `SnapshotsView.tsx`,
   `SettingsView.tsx`). Not a date rule. A `formatNumber` helper on the Jira locale is a cheap follow-up.
4. ~~**DatePicker input format**~~: fixed in the phase 1 E2E fixes. Typed dates follow the Jira locale (see R-6.1).
5. **Single-item decision toast**: deciding one item inline in the table gives no success toast (bulk does). The row
   updates on screen and a toast per click would be noise. Kept as is.
6. **R-6.5 i18n**: on hold (owner decision).

## Decisions (Marcin, 2026-11-11 19:57)

1. **Drawer (R-7.5)**: every panel uses the right-side sidebar panel (`LevelSidePanel`). Keep it and keep it
   consistent; do not migrate to a left-anchored ADS drawer. R-7.5 and R-1.20 are ACCEPTED. A v1.2 of the standard
   should allow the right-edge panel (z-index 500/510, own focus trap).
2. **R-1.2**: the full-page skeleton (`AppPhantom`) before the Forge context is the intended behaviour. ACCEPTED.
3. **R-6.1 fallback**: a missing or invalid Jira locale falls back to `en-US`. Done in `format.ts`
   (`FALLBACK_FORMAT_LOCALE`).
4. **Typed dates**: displayed and typed dates follow the user's Jira locale, ISO is always accepted, invalid text
   shows a field error. Done (R-6.1, R-9.2).
5. **R-4.4 `RELEASE_FLAGS`**: there is no `RELEASE_FLAGS` file or constant in AccessRadar, so nothing to keep or remove.
   Recommendation: stay N/A; when a feature first needs a kill switch, add `src/domain/release.ts` like MarginRadar
   (constant plus `applyReleaseFlags` over `featureFlags`), not an empty placeholder file.

## Phase 1 E2E fixes (branch `fix/phase-1-e2e`)

| E2E | Symptom | Root cause | Fix |
|---|---|---|---|
| 2.6 | Signed review, snapshot #34 integrity "Mismatch" | Deep verify streamed facts with `limitClause(3000)`, which clamps to `LIMIT 1000`; the loop stopped when a page had fewer than 3000 rows, so every snapshot with more than 1000 facts hashed only its first 1000. It also ordered by SQL `ORDER BY kind, fkey` (collation-dependent) while FINALIZE sorts lines in JS | Verify calls `snapshotContentHash`, the same function FINALIZE uses (id paging, JS sort). The stored hash and signature were never wrong, so a re-run of "Check snapshot integrity" on #34 should show OK. `test/verifyIntegrity.test.ts` |
| 1.9 | Header pinned and fade at 200% zoom | Single-scroll block keyed on width only; 200% on a 1920px screen is ~960px wide | R-1.18 above; guard rule 20 |
| 1.4.5 | Delegated empty state: two sentences, em dash | Server `limitation` copy overrides the fixed UI fallback | R-8.5 above |
| 2.2 | Space CSV export, no file | The space export fetched the whole-site matrix with every permission (then filtered in the browser), then two more calls one after the other: slow and able to pass the 5 MB invoke response limit | `accessMatrix` takes `projectKey` and builds one space on the server; snapshot and overview load in parallel. `test/matrixScope.test.ts`, `export/actions.test.ts` |
| P0-1 | Exceptions show raw ids | The page rendered `subjectId`, `grantedBy` and `projectId` as stored | `exceptionsList` adds `subjectName`, `subjectKind`, `scopeLabel` (`KEY · Name`) and `grantedByName` from the latest snapshot; fallbacks "Unknown user/space/group", "Jira admin". `test/exceptionLabels.test.ts` |
| P0-2 | Rovo says campaigns, apps as `user` | `ar-review-status` rows had `name` + `campaign` keys; subject rows passed `subject.type` (`user` for app accounts) | Rows use `review` + `fromCampaign` and a note that each row is a review; `subjectType` is `app` for app accounts; agent prompt and skills say so |
| P0-3 | Invalid typed date, no message | ADS picker silently keeps the last valid value | R-9.2 above |
