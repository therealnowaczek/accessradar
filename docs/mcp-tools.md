# AccessRadar MCP tools (`rovo:mcp`, Preview)

AccessRadar exposes its five read-only Rovo actions as tools through one `rovo:mcp` module (`accessradar-mcp`, name "AccessRadar MCP"). The same tools are available to custom agents in Rovo Studio and, after an admin enables it, to external MCP clients (Claude, Cursor and others) on Atlassian's MCP endpoint. Atlassian runs the MCP layer (OAuth, tool discovery, protocol); AccessRadar adds no server, no egress and no new scopes, so the app stays eligible for Runs on Atlassian.

## Tools

All tools are `actionVerb: GET`, run the `ar-rovo` function (`src/rovo/handler.ts`) and read only AccessRadar's own snapshots and reviews in Forge SQL. Each answer has at most 50 rows, with a note when rows were cut.

| Tool (action key) | Inputs | Answer |
| --- | --- | --- |
| `ar-who-can-access` | `projectKey` (required), `permission` | People and groups with permissions on a space, from the latest snapshot |
| `ar-why` | `projectKey` (required), `accountId` or `name`, `permission` | Grant path for a person or group on a space permission |
| `ar-person-access` | `accountId` or `name` | Spaces and key permissions for one person |
| `ar-changes-since` | `sinceSeq` or `sinceDate` | Access granted and revoked between two snapshots |
| `ar-review-status` | `campaign` | Open, overdue and signed access reviews |

## Who can call them

Every call, whatever the surface (AccessRadar Rovo agent, Rovo tool, external MCP client), passes the same gates in this order:

1. **Licence:** an inactive Marketplace licence is refused. Outside development and staging a missing licence counts as Standard (it falls back to the runtime app context first).
2. **Jira admin:** the caller (accountId from the invocation context, never from inputs) must have Administer Jira. The check runs as the user first (`GET /rest/api/3/mypermissions?permissions=ADMINISTER`). An MCP-invoked call never uses `asApp()`, because Forge blocks it there (RFC-134). Agent calls may still fall back to `POST /rest/api/3/permissions/check` as the app. Positive answers are cached for 60 s per installation and account.
3. **Edition:** Rovo and MCP tools are an Advanced feature (`features.rovo`). Standard sites get "The AccessRadar Rovo agent requires the Advanced edition..." and no data.

The surface is logged as `surface: mcp | rovo` with the key names of the payload context (no values). Forge does not document a stable MCP flag yet, so `src/rovo/invocation.ts` looks for hints and defaults to `rovo`. Both paths check admin as the user first.

## Setup for admins

1. Install or upgrade AccessRadar (Advanced edition) on the Jira site. Rovo must be active on the site.
2. **Rovo Studio:** Create agent, then Tools, then Add tools, then Connected apps, then AccessRadar, then select the tools.
3. **External MCP clients (off by default):** in Atlassian Administration open Apps, then Sites, then your site, then Connected apps. Select AccessRadar, open the app details and, under Tools, turn on the tools to expose ("Expose tools via external MCP endpoint"). The setting is per site. See Atlassian's "Configure tools for an external MCP server".
4. **Client:** add the remote MCP server `https://mcp.atlassian.com/forge/026c4f6a-266d-4c42-aec5-7394371ad05d`, for example `claude mcp add --transport http accessradar https://mcp.atlassian.com/forge/026c4f6a-266d-4c42-aec5-7394371ad05d`, then connect (`/mcp` in Claude Code). The client opens Atlassian's OAuth 2.1 consent screen: pick the site, sign in, review the scopes and tools, approve.
5. Only Jira admins get answers. Other users who connect get "AccessRadar is available to Jira administrators only".

## Data flow

- Tool inputs go from the AI client to Atlassian's MCP endpoint, which invokes the AccessRadar Forge function on the chosen site with the signed-in user's identity.
- AccessRadar reads its Forge SQL snapshots and reviews and, for the admin check, calls Jira as the user. It makes no outbound call outside Atlassian.
- The tool answer (space keys, group names, display names, permission keys, review names and statuses, at most 50 rows) goes back through Atlassian's MCP endpoint to the AI client the user connected. From then on the client's own terms and retention apply. AccessRadar does not send data to any AI provider by itself.
- Each call adds an audit row (`rovo.action`: actor accountId, action key, row count), kept with the audit-log retention setting.
- The user can disconnect the client in their Atlassian account. The admin can turn the tools off per site in Connected apps.

## Testing

`test/rovoMcp.test.ts` calls each tool with an MCP-shaped payload (inputs at the top level plus Forge's `context`) and covers Standard denial, the missing-licence rule, non-admin denial and the manifest rules (one module, five GET actions, no egress). `test/auth.test.ts` covers the user-first check, asApp throwing, no asApp over MCP, non-admin denial and the per-installation cache. The live end-to-end check with a real MCP client needs OAuth in a browser: see the PR description.
