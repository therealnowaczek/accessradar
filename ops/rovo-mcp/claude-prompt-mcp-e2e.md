# Live MCP test of AccessRadar on dev: prompt for Claude + manual steps

Why manual: the MCP endpoint needs Atlassian OAuth 2.1 consent in a browser as Marcin, and the external-exposure toggle is in Atlassian Administration. Neither can be done headlessly, so the bot did not fake them. Verified headlessly: dev 2.91.0 is deployed with `rovo:mcp`, `forge eligibility` passes, and `https://mcp.atlassian.com/forge/026c4f6a-266d-4c42-aec5-7394371ad05d` answers `401 invalid_token` with OAuth metadata (auth server auth.atlassian.com), so the endpoint exists for the app.

## Manual steps (Marcin, about 5 minutes)

1. https://admin.atlassian.com > Apps > Sites > marginradar.atlassian.net > Connected apps. Open AccessRadar. If there are two entries, pick the Development one (dev 2.91.0 has the tools; prod 2.44.0 does not). App details > Tools: turn on all 5 tools (Who can access a space, Why someone has access, Person access across spaces, Changes since a snapshot, Access review status). Note the exact label of the toggle/section.
2. On the Mac, in Terminal: `claude mcp add --transport http accessradar-dev https://mcp.atlassian.com/forge/026c4f6a-266d-4c42-aec5-7394371ad05d`
3. Start `claude` in `~/accessradar/accessradar`, type `/mcp`, choose accessradar-dev, Authenticate. In the browser: site marginradar.atlassian.net, sign in as yourself (Jira admin), approve.
4. Paste the prompt below into that Claude Code session. (Claude Desktop works too: Settings > Connectors > Add custom connector with the same URL; then skip the `forge logs` part of the prompt.)
5. Optional negative test: repeat step 3 with a non-admin Atlassian account on that site; every tool must answer "AccessRadar is available to Jira administrators only".
6. Send the report from the prompt to the AccessRadar bot.

## Prompt to paste into Claude

```
You are testing the AccessRadar Forge app's MCP tools on its DEVELOPMENT environment. AccessRadar is a read-only Jira access-review app. Its MCP server "accessradar-dev" (https://mcp.atlassian.com/forge/026c4f6a-266d-4c42-aec5-7394371ad05d) should already be connected via Atlassian OAuth to the site marginradar.atlassian.net. Do not change anything in Jira, Atlassian Administration, the repo or any deployment. Read-only test only.

1. List the tools exposed by the accessradar-dev MCP server. Expected exactly 5: ar-who-can-access, ar-why, ar-person-access, ar-changes-since, ar-review-status (the names may carry a prefix). Report the exact names and their input parameters. If the server is not connected or lists no tools, stop and report the exact error text (that usually means the admin toggle in Connected apps is off or OAuth was not completed).

2. Call each tool once and record the raw JSON answer (trim each to the first 5 rows):
   a. ar-who-can-access with projectKey "PAY"
   b. ar-who-can-access with projectKey "PAY" and permission "ADMINISTER_PROJECTS"
   c. ar-why with projectKey "PAY" and name = the first subject name from answer (a) that is a user
   d. ar-person-access with name = the same person
   e. ar-changes-since with no inputs, then once with sinceDate "2026-10-01"
   f. ar-review-status with no inputs
   g. ar-who-can-access with projectKey "NOPE123" (expected: a clear error, "Space NOPE123 not in the latest snapshot")

3. For each call report: tool, inputs, OK or ERROR, the "error" text if any, number of rows, "note", "snapshotSeq". Check that no answer has more than 50 rows. Flag any answer with "requires the Advanced edition", "No Marketplace license found", "available to Jira administrators only", "Authorization check failed" or "Something went wrong" (these mean a gate fired; quote them exactly).

4. If you are running in a terminal on the Mac with the Forge CLI: cd ~/accessradar/accessradar and run `forge logs -e development --since 15m` (read-only). Copy every line containing "[rovo]" or "[auth]". The "[rovo] ok" lines should show surface: 'mcp' and a ctx: [...] list of key names; report both exactly (these tell us the real MCP invocation context shape). Report any "[auth] asApp" line: there should be none for MCP calls.

5. End with a short summary table: tool | result | rows | notes, then one line: "MCP E2E: PASS" if all 5 tools answered with data (and g gave the expected error), otherwise "MCP E2E: FAIL" with the reason.
```
