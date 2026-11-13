You are continuing AccessRadar (Radrly Atlassian Forge app) in /workspace/radrly/accessradar/work-roadmap. Read claude-runs/STATUS.md (../claude-runs/STATUS.md) and docs/phase-3-scopes-for-marcin.md first.

Marcin APPROVED shipping phase 3 (2026-11-12 05:06 in the Jira Apps room: "Jeśli na coś czekacie na mnie, to nie czekajcie, realizujemy plan do spodu!"). Record that in docs/decisions-log.md.

Tasks, in order:
1. PR #63 (feat/phase-3b-sharing-security-audit, six read-only scopes, major 3.0.0): rebase on main if needed, run full tests + `npm run build:ui` + `forge lint`. Verify the manifest adds ONLY read scopes (no write scopes, no egress, no remotes). If anything else is there, stop and write it into STATUS.md.
2. Make sure the app works on sites that have not yet consented to the new scopes (graceful "admin must update the app" state, no crashes). Deploy to dev, run E2E on dev (ARTEST space on marginradar.atlassian.net, Playwright session /home/box/.config/radrly/lr-e2e-state.json, light AND dark theme), including the old-functionality regression.
3. If green: squash-merge #63, tag current prod commit as prod-backup-2026-11-12-<prodversion>, `set -a; . ~/.config/radrly/atlassian.env; set +a`, `forge deploy -e production` (NEVER `forge install --upgrade` on any site), `forge eligibility -e production`, redeploy dev from main, read prod logs for errors.
4. Update repo docs for the new scopes: privacy/security text drafts and listing-text drafts in the repo (do not touch the live Marketplace listing).
5. Then finish i18n coverage: move remaining hard-coded English UI strings into the 12 locales (en-US, de-DE, ja-JP, fr-FR, es-ES, pt-BR, pl-PL, ko-KR, it-IT, nl-NL, zh-CN, zh-TW), E2E on dev, and ship to prod the same way (no scope change).
Rules: never print tokens (atlassian.env, CLAUDE_CODE_OAUTH_TOKEN), never extract cookies, never touch release/production or wip/local-2026-10-12 branches, commit messages end with [skip ci], E2E only in ARTEST on the dev install, do not change other apps' data, do not kill other `claude` processes. Do not stop to ask questions; decide in Radrly's best interest. Keep STATUS.md updated and end with a short summary there.
