# In-app Marketplace review request: cross-app audit

Date: 12 November 2026, Europe/Warsaw. Read-only audit of the six Radrly Jira Forge apps that just shipped a one-time in-app Marketplace review request. No code was changed.

Marcin's direction (same day): the different per-app triggers are fine and stay as they are. The standard must unify the UI so users recognise the request across apps: one component pattern, the same placement logic, layout and Atlaskit visual style, the same copy structure, the same button labels, and the same dismiss behaviour. Each app keeps only its own trigger and its app name.

## Sources

Checked out on this box, at the commits that contain the shipped review-request work (or a later main that still includes it):

| App | Repo on the box | HEAD used | Shipped work |
| --- | --- | --- | --- |
| MarginRadar | `/workspace/mr-wave2` | `330d99b` (main, 3.103.0) | P9, PR #120 (`2bb4ac0`) |
| AccessRadar | `/workspace/radrly/accessradar/ship-c1` | `c10934c` (after 3.3.0 / C1) | C11, PR #67 (`256d096`) |
| CapRadar | `/workspace/capradar-competitor-batch` | `ff30926` (prod 3.1.0) | PR #80 (`5afeaa8`) |
| LeakRadar | `/workspace/leakradar` | `fd62ee2` (prod 2.46.0) | CP9, PR #81 (`d36ebe8`) |
| LimitRadar | `/workspace/limitradar-repo` | `705b61f` (prod 4.0.0) | P4, PR #91 (`4e5dc29`) |
| ConfigRadar | `/workspace/repos/configradar` | `abf2e78` (prod 3.0.0) | CP-09 (`f34dd2b`) |

## Comparison

| | MarginRadar | AccessRadar | CapRadar | LeakRadar | LimitRadar | ConfigRadar |
| --- | --- | --- | --- | --- | --- | --- |
| **Trigger (keep as is)** | Site has a budgeted space whose earliest worklog is at least 30 days old. | A signed access review, or, if the site never started a review, a second complete snapshot. | First successful period close or export. | First resolved finding, or first scan job that finished. Site-level fact; asked per user. | First completed scan. | First export, or 7 days of stored configuration history (`MIN(first_seen)` on `config_object`). Hidden while the licence is read-only. |
| **Who sees it** | Finance role only (`asFinance` / `canSeeRates`). | Jira admins only (admin resolver). | Finance role only (Jira admin or mapped FINANCE group). UI gated by `shell.finance`. | Team members or admins (`assertTeamOrAdmin`). Widest audience. | Jira admins only. | Jira admins only. Hidden in read-only licence mode. |
| **Screen** | Settings → General only. Not on Portfolio or other product pages. | Overview, near the top (after an active snapshot progress, before other notices). | Close and Exports only. Not on Overview. Appears on the same screen after a successful close or export (`trigger` reloads the flag). | Findings, only when no finding is selected. Explicitly kept off redaction and erasure paths. | Overview, **after** the KPI metrics, before the colour-threshold note and limit cards. | Overview **and** Export, at the top of the page body. Export re-checks after a successful export. |
| **UI pattern** | Atlaskit `SectionMessage`, `appearance="information"`. Review CTA is an **inline `Link` in the body**, not a primary action. | Atlaskit `SectionMessage`, `appearance="discovery"`, `headingLevel="h2"`. Three actions, no body link. | Atlaskit `SectionMessage`, `appearance="discovery"`. Two actions, plus **`isDismissible` (X)**. Primary action has `href`. | Atlaskit `SectionMessage`, `appearance="discovery"`. Two actions, no body link, no X. | Atlaskit `SectionMessage`, `appearance="discovery"`, `headingLevel="h3"`. Three actions. Primary action uses `href` + `target="_blank"` (not `router.open`). | Atlaskit `SectionMessage`, `appearance="discovery"`, `headingLevel="h2"`. Two actions, no body link, no X. |
| **Headline (EN)** | Enjoying MarginRadar? | Finding AccessRadar useful? | Enjoying CapRadar? | Enjoying LeakRadar? | Enjoying LimitRadar? | Enjoying ConfigRadar? |
| **Body (EN)** | You have a month of data in MarginRadar. A short review on the Atlassian Marketplace helps other teams find it. | A short review on Atlassian Marketplace helps other Jira admins find the app. It takes about a minute, and nothing in AccessRadar depends on it. | If CapRadar saved you time, a short review on the Atlassian Marketplace helps other teams find it. It is optional and does not change anything in the app. | LeakRadar has done its first job for you. A short review on the Atlassian Marketplace helps other teams find it. We ask only once. | Your first scan is done. If LimitRadar helps you stay ahead of Jira limits, a short review on Atlassian Marketplace helps other admins find it. | If ConfigRadar has been useful, a short review on the Atlassian Marketplace helps other Jira admins find it. It takes about a minute, and nothing in the app depends on it. |
| **Buttons (EN)** | Inline link: "Write a review on the Marketplace". Actions: "I already reviewed", "Not now". | "Write a review", "I already did", "Not now". | "Leave a review", "Not now", plus an unlabelled X. No "already reviewed". | "Write a review", "Dismiss". No "already reviewed". | "Write a review", "I left a review", "Not now". | "Write a review", "Dismiss". No "already reviewed". |
| **Link** | `https://marketplace.atlassian.com/apps/598215572?tab=reviews&hosting=cloud` (numeric id, no slug). Opened with `router.open`. | `https://marketplace.atlassian.com/apps/3691498947/accessradar-access-review-permission-audit-for-jira?tab=reviews` (id + slug, no `hosting`). Opened with `router.open`. | `https://marketplace.atlassian.com/apps/3800194861/capradar-software-capitalization-r-d-time-for-jira?tab=reviews` (id + slug, no `hosting`). Opened with `router.open`. | `https://marketplace.atlassian.com/apps/1120170598/leakradar-secret-pii-scanner-for-jira-and-confluence?tab=reviews&hosting=cloud` (id + slug + `hosting`). Opened with `router.open`. | `https://marketplace.atlassian.com/apps/3501264641/limitradar-limits-forecast-safe-cleanup-for-jira?tab=reviews&hosting=cloud` (id + slug + `hosting`). Native `href` + `target="_blank"`, no `router.open`. | `https://marketplace.atlassian.com/apps/142824495?tab=reviews` (numeric id only, no slug, no `hosting`). Opened with `router.open`. |
| **Dismiss behaviour** | Permanent, never again. "Not now" is not a snooze. No later reminder. | Permanent, never again. "Not now" is not a snooze. | Permanent, never again. "Not now" and the X both close it for good. | Permanent, never again, **per user**. "Dismiss" is not a snooze. | Permanent, never again. "Not now" is not a snooze, despite the key name `later`. | Permanent, never again. "Dismiss" and following the link both set the same `dismissedAt`. |
| **Storage** | Forge KVS, key `mr-review-prompt`. Record `{ state: 'dismissed' \| 'done', at }`. **Per installation, no account ids.** | SQL `kv` table, key `review-prompt`. Record `{ state: 'dismissed' \| 'done', at }`. **Per site, no account ids.** | Forge KVS, key `prompt:review`. Record `{ firstValueAt, firstValueKind, closedAs: 'DISMISSED' \| 'CLICKED', closedAt }`. **Per installation, no account ids.** | Forge KVS, key `review-prompt-{hmac-sha256(hmacKey, "review-prompt:" + accountId).slice(0, 40)}`. Record `{ answer: 'dismissed' \| 'opened', at }`. **Per user, pseudonymous.** The account id is never stored. | Forge KVS, key `reviewPrompt`. Value is the bare string `'dismissed'` or `'done'` (no timestamp). **Per installation, no account ids.** | SQL `kv` table, key `review:state`. Record `{ firstExportAt?, dismissedAt? }`. Following the link and dismissing are the same flag. **Per site, no account ids.** |
| **Translated into the 12 locales?** | Yes. Keys `reviewPrompt.*` in en-US, de-DE, es-ES, fr-FR, it-IT, ja-JP, ko-KR, nl-NL, pl-PL, pt-BR, zh-CN, zh-TW. | Yes. Keys `reviewPrompt.*` in `en.ts` plus the same 11 locale JSON files. | Yes. Keys `review.*` in en, de, es, fr, it, ja, ko, nl, pl, pt, zh-CN, zh-TW. | Yes. `locales/<locale>/review.json` for en, de, es, fr, it, ja, ko, nl, pl, pt-BR, zh-CN, zh-TW. | Yes. Keys `review.*` in en, de, es, fr, it, ja, ko, nl, pl, ptBR, zhCN, zhTW. | Yes. Keys `review.*` in en plus de-DE, es-ES, fr-FR, it-IT, ja-JP, ko-KR, nl-NL, pl-PL, pt-BR, zh-CN, zh-TW. |
| **Both editions?** | Yes. No Standard/Advanced gate. | Yes. No edition gate. | Yes. No edition gate. Shown only to finance, on both editions. | Yes. No edition gate. | Yes. No edition gate. | Yes. Comment and resolvers say both editions. Hidden only when the licence is read-only, not by plan. |
| **Tracking?** | None. Plain link, no UTM, no Marketplace API, no extra call on click (only the local `saveReviewPrompt`). | None. Same: plain link, no tracking, no Marketplace API, no incentive. | None. Same. `closeReviewPrompt` only stores the local closed state. | None. Same. Comment: no review API and no egress. | None. Comment: no tracking and no Marketplace API call. | None. Link is user navigation via `router.open`, not a fetch. |

## Differences that matter to users

The triggers differ by design and should stay. Everything below is accidental divergence.

1. **It does not look like the same component.** Five apps use a discovery `SectionMessage`. MarginRadar uses `information` and puts the review CTA in the body as a text link, with "I already reviewed" / "Not now" as the only actions. CapRadar adds an unlabelled dismiss X. LimitRadar uses `h3` instead of `h2`. LimitRadar opens the Marketplace in a new browser tab (`target="_blank"`); the others use Forge `router.open`.

2. **It does not sit in the same place.** AccessRadar and ConfigRadar put it at the top of Overview. LimitRadar puts it mid-page, under the KPIs. CapRadar never shows it on Overview, only on Close and Exports. MarginRadar shows it only on Settings → General, so a finance user who never opens Settings will not see it. LeakRadar shows it on Findings, and hides it the moment a finding is selected.

3. **The words are close, not the same.** Headlines are either "Enjoying {App}?" (five apps) or "Finding AccessRadar useful?". Primary buttons are "Write a review" (four), "Leave a review" (CapRadar), or "Write a review on the Marketplace" (MarginRadar, as a body link). The dismiss label is "Not now" or "Dismiss". The optional third action is "I already reviewed", "I already did", "I left a review", or missing. Bodies mix a trigger-specific first sentence with slightly different promises ("helps other teams" vs "other Jira admins" vs "other admins").

4. **"Not now" never means later.** In every app, dismiss is permanent. There is no snooze. The LimitRadar i18n key is even called `review.later`, but the stored state is a final `dismissed`. Users who expect a reminder will not get one.

5. **Dismissal is per site in five apps, per user in LeakRadar.** In MarginRadar, AccessRadar, CapRadar, LimitRadar and ConfigRadar, one person's dismiss hides the prompt for every other admin on the installation. LeakRadar hashes the account id with HMAC-SHA256 and stores one record per person, so colleagues can still be asked. That is also the only implementation that stores a (pseudonymous) per-user key, which is why a Privacy-tab line was raised separately.

6. **The Marketplace URL is not in one format.** Some links include the app slug, some do not. Some add `hosting=cloud`, some do not. All are otherwise plain (no UTM). The official slugs, already used on the public sites, are listed in the standard below.

7. **The audience is not the same.** AccessRadar, LimitRadar and ConfigRadar ask Jira admins. MarginRadar and CapRadar ask the finance role. LeakRadar asks any team member or admin. That last choice is the one that makes a per-user key necessary; a Marketplace review from a random team member is also a weaker ask.

What already lines up, and should be kept: it is a non-blocking Atlaskit `SectionMessage`, never a modal; it is translated in all 12 locales in every app; it shows in both editions; there is no tracking, no incentive, and no Marketplace API.

## Proposed shared standard

Triggers stay per app, as they are in the table above. The UI, placement logic, copy structure, buttons, link format and dismiss behaviour become one standard. Each app supplies only `{appName}`, its Marketplace id and slug, its existing first-value trigger, and a thin save/load API.

### 1. Component and visual style

- One presentational component: Atlaskit `SectionMessage`.
- `appearance="discovery"`.
- `headingLevel="h2"`.
- Title + one body paragraph (`Text as="p"`) + three `SectionMessageAction`s.
- Do not use `isDismissible` (the unlabelled X). Dismiss must be a labelled, translated button.
- Do not put the Marketplace link in the body. The primary action is the link.
- Never a modal, flag, or custom card.

### 2. Placement logic (same rule, applied on each app's own screens)

1. Put the prompt at the **top of the page body**, immediately below the page header, above metrics, tables and other content. A blocking error or licence banner may sit above it; nothing else should.
2. Mount it on the app's **primary home view** (Overview, or Findings for LeakRadar). If the app's first-value action happens on another screen (Close, Exports, Settings), also mount it there, at the top, so it can appear in the same session.
3. Never mount it on a destructive, approval, sign-off, redaction or erasure path.

Concretely, once adopted: MarginRadar also shows it on the finance home, not only Settings → General; CapRadar also shows it on Overview; LimitRadar moves it above the KPI row; LeakRadar stays on Findings, still hidden when a finding is selected.

### 3. Audience and dismiss behaviour

- Show it only to the app's admin-equivalent role (finance on MarginRadar and CapRadar; Jira admin on AccessRadar, LimitRadar and ConfigRadar; Jira admin, not every team member, on LeakRadar).
- One decision per installation, stored with **no account id**. The first "done" or "dismissed" wins for the site.
- **Never again.** No snooze, no reminder, no expiry.
- "Write a review" and "I already reviewed" both store `done`. "Not now" stores `dismissed`. Both hide the prompt permanently. The two states exist only so we can tell a completed review from a decline, if we ever need that later.
- LeakRadar should drop the per-user HMAC key and use the same site-level record. That also removes the need for a Privacy-tab line about a pseudonymous per-user key.

### 4. Copy template (EN)

The only interpolated value is `{appName}`. Do not mention the trigger in the body; the trigger already decided whether to show the prompt.

```
review.title    Enjoying {appName}?
review.body     A short review on the Atlassian Marketplace helps other teams find it. It takes about a minute, and nothing in {appName} depends on it.
review.write    Write a review
review.done     I already reviewed
review.dismiss  Not now
```

Translate these five keys into the same 12 locales each app already ships (en, de, es, fr, it, ja, ko, nl, pl, pt-BR, zh-CN, zh-TW). Keep the shared English wording identical so the translations can be reused.

### 5. Link format

```
https://marketplace.atlassian.com/apps/{id}/{slug}?tab=reviews&hosting=cloud
```

Plain URL only: no UTM, no other query parameters, no Marketplace API. Open it with Forge `router.open` (prevent the default click, then open, then save `done`).

| App | `{id}/{slug}` |
| --- | --- |
| MarginRadar | `598215572/marginradar-budget-forecasts-profitability-for-jira` |
| AccessRadar | `3691498947/accessradar-access-review-permission-audit-for-jira` |
| CapRadar | `3800194861/capradar-software-capitalization-r-d-time-for-jira` |
| LeakRadar | `1120170598/leakradar-secret-pii-scanner-for-jira-and-confluence` |
| LimitRadar | `3501264641/limitradar-limits-forecast-safe-cleanup-for-jira` |
| ConfigRadar | `142824495/configradar-configuration-change-audit-for-jira` |

### 6. Editions and tracking

Show it in Standard and Advanced. Hide it only when the licence is unlicensed or read-only. No tracking, no incentive, no extra analytics call.

### 7. Storage contract (site-level, no account ids)

Recommended record, one key per installation:

```ts
export type ReviewPromptState = 'dismissed' | 'done';
export interface ReviewPromptRecord {
  state: ReviewPromptState;
  at: number; // epoch ms
}
```

The key name may stay app-local (`review-prompt` is fine). The shape should be the same. First-value bookkeeping (CapRadar's `firstValueAt`, ConfigRadar's `firstExportAt`) can stay in the same record or in the existing trigger logic; it must not change the UI.

### 8. Shared snippet

Each app bot can paste this component and wire `show`, `appName`, `url` and `onAnswer`. The parent is responsible for the trigger and for persistence.

```tsx
import { router } from '@forge/bridge';
import { Text } from '@atlaskit/primitives';
import SectionMessage, { SectionMessageAction } from '@atlaskit/section-message';

export const reviewUrl = (id: string, slug: string) =>
  `https://marketplace.atlassian.com/apps/${id}/${slug}?tab=reviews&hosting=cloud`;

/** Copy keys (EN). Interpolate {appName}. */
export const REVIEW_COPY_EN = {
  'review.title': 'Enjoying {appName}?',
  'review.body':
    'A short review on the Atlassian Marketplace helps other teams find it. It takes about a minute, and nothing in {appName} depends on it.',
  'review.write': 'Write a review',
  'review.done': 'I already reviewed',
  'review.dismiss': 'Not now',
} as const;

type Translate = (key: keyof typeof REVIEW_COPY_EN, values?: { appName: string }) => string;

/**
 * Shared Marketplace review request. Mount at the top of the page body on the
 * home view (and on the first-value screen, if that is a different page).
 * Never mount on a redaction, erasure, approval or sign-off path.
 */
export function ReviewPrompt({
  show,
  appName,
  url,
  t,
  onAnswer,
}: {
  show: boolean;
  appName: string;
  url: string;
  t: Translate;
  onAnswer: (state: 'done' | 'dismissed') => void;
}) {
  if (!show) return null;
  const remember = (state: 'done' | 'dismissed') => onAnswer(state);
  return (
    <SectionMessage
      appearance="discovery"
      headingLevel="h2"
      title={t('review.title', { appName })}
      actions={[
        <SectionMessageAction
          key="write"
          href={url}
          onClick={(event) => {
            event.preventDefault();
            remember('done');
            void router.open(url);
          }}
        >
          {t('review.write')}
        </SectionMessageAction>,
        <SectionMessageAction key="done" onClick={() => remember('done')}>
          {t('review.done')}
        </SectionMessageAction>,
        <SectionMessageAction key="dismiss" onClick={() => remember('dismissed')}>
          {t('review.dismiss')}
        </SectionMessageAction>,
      ]}
    >
      <Text as="p">{t('review.body', { appName })}</Text>
    </SectionMessage>
  );
}
```

Parent wiring (illustrative):

```ts
// load
const record = await repo.get(); // null | { state, at }
const show = record === null && (await hasFirstValue()); // app-specific trigger
// save: first answer wins
if (!(await repo.get())) await repo.save({ state, at: Date.now() });
```

## Suggested adoption order

No product behaviour should change until the UI is aligned. Each app bot implements the snippet, the five shared strings in all 12 locales, the canonical review URL, site-level storage, and the placement rule. Triggers are not touched. LeakRadar also narrows the audience to Jira admins and removes the per-user key.
