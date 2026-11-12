# AI pre-sort for reviewers (C6): privacy and Privacy & Security notes (draft)

Status: draft for Marcin and the Privacy & Security console. **Nothing here has been published.** The Marketplace listing, the P&S console and the live site were not touched. The feature is not released: it needs Marcin's explicit "tak" and the P&S update below first.

## What it is

On an open review, an Advanced user can press "Suggest review order (AI)". AccessRadar asks a language model which undecided items deserve attention first and shows a priority pill and one short sentence per item. It is advice only: the model never decides, saves a decision, signs, or writes to Jira. The reviewer decides every item.

## Where the model runs

Forge LLMs (`@forge/llm`, manifest module `llm`, model family `claude`). The call goes through Atlassian's platform: no external LLM provider, no API key, no remote, no egress entry, no `fetch`. The app stays a Runs on Atlassian candidate (to be confirmed with `forge eligibility` once deployed, see "Blocker" in decisions-log).

## What is sent to the model (data minimisation)

Per undecided item, at most 120 items per request, highest existing risk first:

| Attribute | Example | Notes |
|---|---|---|
| pseudonym | `r17` | position in the review, never an account id |
| subject type | `user`, `group`, `anonymous`, `conditional` | |
| how access is granted | `group “contractors”`, `role “Developers”`, `named user`, `space lead` | group and role names only; scheme names removed, control characters stripped, 60 characters each |
| existing risk class | `deactivated-account` | the review's own risk score, bucketed |
| deactivated flag | `true` | the existing account flag; no activity claim |
| new since comparison | `true` | |

Never sent: display names, account ids, emails, space keys or names, permission names, scheme names, review notes, exception reasons, issue data, anything about last sign-in or last activity (the app has no such field and the prompt forbids claims about it). `test/presort.test.ts` asserts these are absent from the request.

Group and role names are customer-chosen text. They are placed in a JSON array, the system prompt says they are data and not instructions, and the reply is validated (below), so an injected instruction can at most change the suggested order or the wording of a one-line reason.

## What comes back, and what is kept

The reply must be a JSON array of `{id, priority, reason}`. Only known ids, the three priorities and a reason clipped to 140 characters (control characters and dashes removed) are accepted; anything else is dropped. The suggestions are held in the browser for that page view only. They are not stored by AccessRadar. The audit log records only counts (items considered, suggested) with the user who pressed the button, never the content.

## Edition and access

Advanced only, enforced on the server (the resolver refuses on Standard before any model call). Jira admins only, like every AccessRadar resolver.

## Suggested P&S console and listing answers (for Marcin to review)

- Uses AI: yes, optional, Advanced only, user-triggered (never automatic).
- Provider: Atlassian Forge LLMs; no third-party AI provider; no customer data used by AccessRadar for training or retained by AccessRadar.
- Data shared with the model: pseudonymised, minimised attributes listed above; no personal data fields.
- Egress: none added; no remotes; no external permissions.
- Scopes: no new Jira scope. The new manifest module is `llm` (see decisions-log). Atlassian's own terms for Forge LLMs apply to the model call.
- Data-handling doc (`docs/data-handling.md`) and `docs/LISTING.md` need a matching paragraph when this is approved. They were not edited here.

## Release prerequisites

1. Marcin's "tak".
2. P&S console / App Approval update for the `llm` module ("uses AI").
3. Major version upgrade: Forge reports `MAJOR_VERSION_RULE` ("Change due to usage of core:llm module"). Production needs `forge deploy -e production --approve MAJOR_VERSION_RULE`, and each install needs an admin to approve with `forge install --upgrade` (not run by this branch, on any site).
4. Dev E2E after the dev install is upgraded (not done, see below).
