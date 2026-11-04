# AccessRadar

Atlassian Forge app for Jira (read-only access review, Runs on Atlassian). Custom UI is React and Atlaskit.

Follow `.cursor/rules/accessradar-ui.mdc` on every change. Cursor applies it automatically. It matches the ESLint design-system rules in `eslint.config.mjs`, the design-system guard test, button placement, sticky headers, language and date rules, and the zero-egress limits that `npm run check` enforces.

After editing any file, run `npx eslint` and `npx prettier --check` on those files and fix every error. Before finishing, run `npm run check`.
