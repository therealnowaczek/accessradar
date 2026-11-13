# AccessRadar rovo:mcp: drafts (NOT published)

Branch `feat/rovo-mcp` (repo therealnowaczek/accessradar). Nothing here is live. Do not rsync this folder to the VPS: it sits inside the site copy only because the task asked for this path. Move it out of the site tree, or exclude it, before any site deploy.

- `security-questionnaire-changes.md`: answer changes for the Forge security questionnaire (Partner / Forge tabs)
- `privacy-policy-change.md`: Privacy Policy text change (accessradar.radrly.com/privacy/)
- `security-page-change.md`: security page text change (accessradar.radrly.com/security/)
- `marketplace-listing-draft.md`: listing sentences (More details, highlight caption, Privacy & Security tab note)
- `claude-prompt-mcp-e2e.md`: self-contained prompt for Marcin to paste into Claude (Code or Desktop) for the live MCP test on dev, plus manual steps

All texts should go out together with the prod deploy of the PR. Not before: the site and listing must match what runs on production.
