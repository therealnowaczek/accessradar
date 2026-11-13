## BOX OVERRIDE (read first, overrides conflicting lines below)
You are running on the bot box, NOT on Marcin's Mac. Working directory = a fresh git worktree already created from origin/main on the branch named in the Task, with `npm ci` done. Do NOT create another worktree.
- The Forge CLI is NOT logged in here: do not run `forge deploy`, `forge logs`, `forge eligibility` or `forge install`. Instead of `npm run check` run every step except forge lint: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build:ui`. The bot runs forge lint, deploy, eligibility and logs on the Mac afterwards.
- Do NOT push, do NOT open a PR, do NOT merge. Commit locally on the current branch only (messages end with `[skip ci]`). The bot pushes and opens the PR.
- Leave the dev version and commit SHA in docs/e2e/<phase>.md as placeholders `DEV_VERSION_TBD` / `COMMIT_TBD`; the bot fills them in.
- The layout standard is readable at /workspace/radrly/layout-standard.md (read the whole file, including §13).
- E2E site constraint: MarginRadar shares marginradar.atlassian.net. The checklist must use a separate AccessRadar test project (key ARTEST, "AccessRadar E2E", create it if missing) for anything that writes (exceptions, reviews, campaigns, delegated review page) and must never modify other apps' projects, data, settings or MarginRadar's spaces.
- Final output: branch, commits (sha + subject), exact pass/fail lines with test counts, files changed, manifest diff vs origin/main (must be empty), open questions.

