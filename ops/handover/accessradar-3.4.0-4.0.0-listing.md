# AccessRadar 3.4.0 and 4.0.0 listing copy (prepare only)

Date: 2026-11-12 (Europe/Warsaw)
From: CMO
To: SEO i Marketplace (browser step later)
Status: site copy is in the radrly repo for accessradar.radrly.com (commits a0b6a9b and 6b1b0e7 on origin/main). Do not treat this file as a request to edit the Marketplace listing yet.

AccessRadar is a control in the position test. Change only the version release summaries, version release notes, and the Privacy and Security items below. Do not draft or edit Highlights, overview or More details in this file. Version 4.1.0 (the unified in-app review prompt) stays off the site and is not part of this listing copy.

Verified in the app repo (`/workspace/accessradar`, tags `prod-backup-2026-11-12-3.3.0`, `prod-backup-2026-11-12-3.4.0`, `prod-backup-2026-11-12-4.0.0`): 3.4.0 added no scopes or modules; 4.0.0 added only the Forge `llm` module (`accessradar-presort`, model family `claude`). No new Jira scopes. Do not paste an unqualified "never sends names" claim: the verified payload includes group and role names in the access type.

A Marketplace 4.0.0 version is expected (Forge production 4.0.0 was deployed tonight; existing installs need admin approval of the major). There is no evidence in the repo or deploy notes that a Marketplace listing version 4.0.0 already exists. Privacy and Security "uses AI" answers were still needed from CMO at the time of the prod deploy.

---

## Field: Version 3.4.0, Release summary

Limit: 80 characters. Required.

```
Tracked groups, sample campaign, more risk rules, seats, space self review
```

(74 characters)

---

## Field: Version 3.4.0, Release notes

Limit: 1,000 characters.

```
A minor update. No new scopes, no egress and no re-consent. Still Runs on Atlassian.

- Tracked groups (Standard and Advanced): track selected groups and see a weekly diff of the access they grant and of members who joined or left.
- Sample review campaign (Standard and Advanced): invented data stored only in the app. It never reads or writes Jira data and is not evidence. Real campaigns stay Advanced.
- More risk rules (Standard and Advanced): including public filters and dashboards, and a deactivated account in an admin group (the account flag only, no activity or last sign-in claim).
- Seat view (Standard and Advanced): groups that grant each product, and review candidates. Candidates only, not a statement about use. Jira gives apps no last sign-in data.
- Space admin self review (Standard and Advanced): a space administrator can start, work and submit a review of their own space. Campaign assignments and signing stay Advanced.

https://accessradar.radrly.com/release-notes/#v3-4-0
```

(998 characters)

---

## Field: Version 3.4.0, Documentation URL (optional)

If the version form has a documentation URL, set:

```
https://accessradar.radrly.com/release-notes/#v3-4-0
```

---

## Field: Version 4.0.0, Release summary

Limit: 80 characters. Required.

```
AI pre-sort for reviewers (Advanced; Forge LLMs, advice only)
```

(61 characters)

---

## Field: Version 4.0.0, Release notes

Limit: 1,000 characters.

```
A major version: an Atlassian Forge LLM module was added, with no new Jira scopes. A Jira administrator must accept the update under Manage apps. Still Runs on Atlassian.

- AI pre-sort (Advanced only): a Jira administrator can press Suggest review order (AI) on an open review. AccessRadar asks Atlassian Forge LLMs for a suggested order. No third-party AI, no egress, and the data stays on Atlassian. Optional; runs only when that button is pressed.
- Per item, for at most 120 items: a pseudonymous label, the access type (including group and role names), the risk class, the deactivated-account flag, and whether the item is new. Never display names, account ids, emails, space or scheme names, notes or issue data.
- Suggestions stay in the browser for that page view. AccessRadar does not store them or use them for training. The audit log records counts only.
- This is advice only. The reviewer decides every item.

https://accessradar.radrly.com/release-notes/#v4-0-0
```

(976 characters)

---

## Field: Version 4.0.0, Documentation URL (optional)

If the version form has a documentation URL, set:

```
https://accessradar.radrly.com/release-notes/#v4-0-0
```

---

## Field: Privacy and Security tab, permissions / data-access (additive only)

There are no new Jira scopes in 3.4.0 or 4.0.0. Add the text below to the existing permissions / data-access (scope justification) section, or use it if the form asks for a justification of the new Forge LLM module. Change nothing else that already justifies earlier scopes. Repo docs describe the existing scope justification field as about 1,000 to 1,100 characters (`docs/listing-check.py`); confirm the live field limit before combining this with the current text. If it will not fit, keep the current justification and record the LLM module in the AI answers below.

```
Version 3.4.0 adds no new scopes or modules. Version 4.0.0 adds no new Jira scopes. It adds an Atlassian Forge LLM module (accessradar-presort) for optional AI pre-sort on Advanced. A Jira administrator must accept that major update under Manage apps. The module is used only when a Jira administrator presses Suggest review order (AI) on an open review. Per item, for at most 120 items, Atlassian Forge LLMs receive a pseudonymous label, the access type (including group and role names), the risk class, the deactivated-account flag, and whether the item is new. Display names, account ids, emails, space or scheme names, notes and issue data are not sent. Suggestions are not stored and are not used for training. No third-party AI, no remotes and no egress. No data leaves Atlassian.
```

(786 characters)

---

## Privacy and Security / AI and data-handling answers (4.0.0)

Answer these from verified repo facts only. Use the wording below. Do not claim certification or compliance. Do not say the app makes automatic decisions. Do not say names are never sent.

Question names below are inferred from Atlassian's Marketplace Privacy and Security / AI questionnaire and from the CMO brief (the live form labels may differ slightly). Match the closest live label.

### Does your app use AI / Does your app use AI or machine learning / Does your app use generative AI or large language models (LLMs)?

**Yes**, from version 4.0.0. Optional AI pre-sort on Advanced only. A Jira administrator presses Suggest review order (AI) on an open review. Standard has no button, and the server refuses the call. The model suggests a review order. This is advice only: the reviewer decides every item. The app does not use AI for 3.4.0 features.

### Which AI provider / Whose models / Which AI or LLM provider do you use?

Atlassian Forge LLMs on Atlassian's platform. The manifest declares the Forge `llm` module `accessradar-presort` with model family `claude`. This is not a third-party Anthropic (or other) integration: there is no remote, no egress, and no call from AccessRadar to a provider outside Atlassian.

### What data is sent to the AI / What customer or end-user data does the AI process?

Per item, for at most 120 items: a pseudonymous label (`r` plus an index), the access type (including group and role names; scheme names are dropped), the risk class, the deactivated-account flag, and whether the item is new. It never sends display names, account ids, emails, space or scheme names, notes or issue data.

### Where is the data processed?

On Atlassian, by Atlassian Forge LLMs. No egress. No data leaves Atlassian.

### Is data stored by the app or by the AI provider / Do you store the data sent to or returned by the AI?

No. Suggestions are held in the browser for that page view only. AccessRadar does not store the payload or the suggestions. The audit log records counts only (and the admin who pressed the button), not the item text or the model's order.

### Is data used for training / Is customer data used to train AI or machine learning models?

No. Nothing is stored or used for training.

### Do you share data with third parties / Are third-party AI providers used / Does any data leave Atlassian?

No. Third parties: none. No remotes, no egress, and no third-party AI. The data stays on Atlassian.

### Is the AI feature optional / Can customers choose not to use it?

Yes. It is optional, Advanced only, and runs only when a Jira administrator presses the button. Sites that have not accepted the 4.0.0 major update keep working as installed, without the LLM module.

### Does the AI make automated decisions that have a legal or similarly significant effect / Does the app make automatic decisions?

No. This is advice only. The model never decides, and the reviewer decides every item.
