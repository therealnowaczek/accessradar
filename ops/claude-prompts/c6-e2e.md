# AccessRadar C6 (AI pre-sort via Forge LLMs): live dev E2E only

Repo clone: /workspace/radrly/accessradar/ship-c3c8, branch feat/c6-forge-llm-presort (HEAD b50203d, main merged in). Dev environment already has this build deployed as 4.0.0 and the dev install on marginradar.atlassian.net (Jira) was upgraded to major 4. Do NOT redeploy unless you fix a FAIL (then only `forge deploy -e development --non-interactive --approve MAJOR_VERSION_RULE`).

Read first: docs/ai-presort-privacy.md, docs/e2e/c6.md, docs/e2e/c8.md (style), src/domain/presort.ts, src/api/service.ts (presort resolver), static/app/src/views/ReviewsView.tsx. Playwright helpers: /workspace/radrly/accessradar/e2e/_lib/lib.mjs (site, app id, storageState, openApp, setEdition, nav) and e2e/_lib/theme.mjs. Reuse them.

Rules (hard):
- Auth: before any `forge` command run `set -a; . /home/box/.config/radrly/atlassian.env; set +a`. Never print that file, tokens, or $CLAUDE_CODE_OAUTH_TOKEN. Never extract or copy cookies or the session file.
- Allowed forge: `forge logs -e development`, `forge eligibility -e development`, `forge lint`, and the dev deploy above only to fix a FAIL. Forbidden: anything with `-e production`, `forge install` of any kind, git push to main, tags, merges.
- E2E only on https://marginradar.atlassian.net, development install ("Dev" label), project ARTEST ("AccessRadar E2E") only, own test data only (create a review on ARTEST with undecided items, delete it at the end). Do not touch other apps, other projects, MarginRadar settings.
- Playwright storageState: /home/box/.config/radrly/lr-e2e-state.json (read only).
- Editions via Settings > Edition > Override; end on "Use the license". Restore account to English (US) and Light theme at the end.

Test plan (record PASS/FAIL per case):
1. Advanced, light: open an undecided ARTEST review, press "Suggest review order (AI)". Pills (priority) and one short reason per item appear, order suggestion shown; no item gets decided; review status unchanged. Screenshot.
2. Advanced: reasons contain no display names, emails or account ids; no activity/last login claim. Audit/activity entry shows only counts.
3. Advanced, dark: same view renders correctly (pills readable). Screenshot.
4. Standard, light: no Suggest button; calling the resolver is refused server side (unit test reference ok if UI-only, but try UI).
5. Standard, dark: view renders without the button. Screenshot.
6. Failure path is graceful if the LLM errors (only if naturally observed; else mark N/A with unit test reference).
7. Regression: Reviews list, Seats page (C2), one other page load without page errors.
8. `forge logs -e development --since 30m`: no errors, and no prompt content (group names or reasons) logged.
9. `forge eligibility -e development`: Runs on Atlassian eligible.

Output:
- Screenshots and report.md under /workspace/radrly/accessradar/e2e/2026-11-12-c6/.
- Rewrite docs/e2e/c6.md with plan, results table and summary line "N PASS / M FAIL", then commit on feat/c6-forge-llm-presort with message "docs(c6): live dev e2e [skip ci]" (git user is configured in the repo) and `git push origin feat/c6-forge-llm-presort` (never force).
- If you fix a code FAIL: commit with [skip ci], run `npm run check` (only forge lint MAJOR_VERSION_RULE approval is acceptable), redeploy dev as above, rerun.
- Finally write /workspace/radrly/accessradar/e2e/2026-11-12-c6/DONE containing the PASS/FAIL table and the final line `RESULT: GREEN` or `RESULT: RED <reason>`.
Do not ask questions; decide and keep going.
