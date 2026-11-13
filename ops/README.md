# AccessRadar ops (box infrastructure-critical files)

Copied from the box into this Forge app repo so the files survive a box restart. Originals stay on the box at the paths listed below. This branch only adds `ops/`; it does not change app code on `main`.

Do not merge this into `main` until a human reviews it. Do not deploy from this branch.

## Layout

| Path in repo | Original box path | Purpose |
|---|---|---|
| `ops/claude-prompts/` | `/workspace/radrly/accessradar/claude-prompts/` | Claude CLI prompts for roadmap phases, C-items, C6 E2E, and the unified review-prompt ship. |
| `ops/claude-runs/STATUS.md` | `/workspace/radrly/accessradar/claude-runs/STATUS.md` | Ship/status baseline for the 2026-11-11..12 roadmap and C-item releases (PRs, prod versions, E2E, backup tags). |
| `ops/claude-runs/C-ITEMS-DONE` | `/workspace/radrly/accessradar/claude-runs/C-ITEMS-DONE` | Marker that the C-items chain finished. |
| `ops/claude-runs/box-override.md` | `/workspace/radrly/accessradar/claude-runs/box-override.md` | Box-specific override notes for the chain. |
| `ops/claude-runs/phase-1-box.md` | `/workspace/radrly/accessradar/claude-runs/phase-1-box.md` | Phase 1 box runbook / constraints (including secret-handling rules). |
| `ops/claude-runs/run-citems.sh` | `/workspace/radrly/accessradar/claude-runs/run-citems.sh` | Wrapper that runs the C-items Claude chain. Sources Atlassian credentials from the box env file; does not embed values. |
| `ops/claude-runs/run-roadmap.sh` | `/workspace/radrly/accessradar/claude-runs/run-roadmap.sh` | Wrapper that starts the roadmap Claude chain. |
| `ops/claude-runs/resume-roadmap.sh` | `/workspace/radrly/accessradar/claude-runs/resume-roadmap.sh` | Resume wrapper after a Claude usage-limit interrupt. |
| `ops/claude-runs/ship-phase3.sh` | `/workspace/radrly/accessradar/claude-runs/ship-phase3.sh` | Wrapper for the phase-3 ship prompt. |
| `ops/e2e/phase-0.md` | `/workspace/radrly/accessradar/e2e/phase-0.md` | Phase 0 E2E plan. |
| `ops/e2e/phase-1.md` | `/workspace/radrly/accessradar/e2e/phase-1.md` | Phase 1 E2E plan. |
| `ops/e2e/2026-11-*/` | `/workspace/radrly/accessradar/e2e/2026-11-*/` | Text E2E reports and baselines (markdown, short txt, DONE markers). Screenshots and raw JSON/CSV dumps were not copied. |
| `ops/e2e/_lib/` | `/workspace/radrly/accessradar/e2e/_lib/` | Playwright helper scripts used for AccessRadar E2E on the dev install. They reference a local storage-state path; they do not embed session cookies. |
| `ops/tools/` | `/workspace/radrly/accessradar/tools/` | i18n string scan/extract/codemod helpers (`scan.mjs`, `extract.mjs`, `extract2.mjs`, `addkeys.mjs`). |
| `ops/rovo-mcp/` | `/workspace/radrly/accessradar/rovo-mcp/` | Rovo MCP handoff: listing draft, privacy/security page change notes, console checklist, MCP E2E prompt. |
| `ops/v3-scopes/cmo-handoff.md` | `/workspace/radrly/accessradar/v3-scopes/cmo-handoff.md` | CMO handoff for prod 3.1.0 (scopes, listing/privacy draft text, backup tags). |
| `ops/cmo-cadences.md` | `/workspace/radrly/accessradar/cmo-cadences.md` | Product cadence facts for the CMO (snapshot schedule, inactive-user wording, edition rules). |
| `ops/roadmap-plan-2026-11-11.md` | `/workspace/radrly/accessradar/roadmap-plan-2026-11-11.md` | AccessRadar roadmap plan used for the 11-12 Nov 2026 batch. |
| `ops/pricing/accessradar.md` | `/workspace/radrly/pricing/accessradar.md` | AccessRadar pricing baseline / notes. |
| `ops/ai-visibility/status/accessradar.md` | `/workspace/radrly/ai-visibility/status/accessradar.md` | AI-visibility / GEO status baseline for AccessRadar. |
| `ops/marketplace-seo/review-prompt-audit-2026-11-12.md` | `/workspace/radrly/marketplace-seo/review-prompt-audit-2026-11-12.md` | Spec for unifying the in-app review prompt (shipped as prod 4.1.0). |
| `ops/handover/accessradar-*.md` | `/workspace/radrly/handover/accessradar-*.md` | Listing handover notes for 3.2.0, 3.3.0, and 3.4.0 / 4.0.0. |

Product docs already tracked on `main` (for example `docs/e2e/*.md`, `docs/ai-presort-privacy.md`, `docs/decisions-log.md`) were not duplicated here.

## Excluded on purpose

- Claude chain logs, pid files, resume flags, and logpath symlinks under `claude-runs/`.
- E2E screenshots (`.png`, `.webp`), PDFs, CSVs, and raw JSON result dumps (large test artifacts, not runbooks).
- The public site tree under `/workspace/radrly/accessradar` that is already tracked in the `radrly` website repo (`index.html`, `llms.txt`, privacy/terms, and so on).
- Full Forge app checkouts (`ship-c1`, `ship-c11c5`, `ship-c3c8`, `work-phase1-fixes`, `work-roadmap`).
- Marketing/creative/video/SEO raw exports and screenshots (not infrastructure-critical).
- Secret or session files, which must never be committed (see Restore).

## Restore

Secrets and session material stay out of git. After a box restart, wait until `/tmp/sand-copy-in.log` shows `outcome=hydrated` before treating box files as lost.

Where the secrets live (names and paths only; no values):

- `/home/box/.config/radrly/atlassian.env` holds Forge / Atlassian credentials (including `FORGE_API_TOKEN` and related `ATLASSIAN_*` variables). Keep this file in the box store or Vault. `ops/claude-runs/run-citems.sh` sources it when present. The repo `.gitignore` already ignores `.env` and `.env.*`.
- `CLAUDE_CODE_OAUTH_TOKEN` is expected in the process environment (not in a file in this repo). The C-items wrapper fails closed if it is unset.
- Playwright E2E storage state (session cookies) lives at `/home/box/.config/radrly/lr-e2e-state.json`. Helpers in `ops/e2e/_lib/lib.mjs` point at that path. Do not copy that file into git.
- Do not commit `otp-codes.txt`, `demo-invites.json`, cookie databases, or any `storageState` JSON.

To restore the docs and scripts in this folder onto a new box, check out this branch (or copy `ops/` from it) into the usual box paths listed above, then restore the three secret/session items from Vault or the box store. E2E stays on the AccessRadar development install in the ARTEST project on `marginradar.atlassian.net`, with this bot's own test data only.

Never print or paste token values. Never touch branches `release/production` or `wip/local-2026-10-12`.
