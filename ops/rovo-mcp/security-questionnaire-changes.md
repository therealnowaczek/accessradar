# Forge security questionnaire: answer changes for rovo:mcp (DRAFT)

Apply in the Marketplace partner console (Security questionnaire, Partner / Partner-Extended / Forge tabs) only after the prod deploy of `feat/rovo-mcp`, and not while an ECOHELP review is open for AccessRadar. Wording below is a replacement or addition to the current answers; keep everything else.

## Forge tab

**Modules used** (add): `rovo:mcp` (Preview), key `accessradar-mcp`, name "AccessRadar MCP". It exposes the five existing read-only actions as tools: `ar-who-can-access`, `ar-why`, `ar-person-access`, `ar-changes-since`, `ar-review-status`. All are `actionVerb: GET`. No new action, no new function.

**Scopes / permissions changed?** No. The manifest diff adds only the `rovo:mcp` module. No new scopes, no `permissions.external`, no remotes, no Connect.

**Runs on Atlassian:** unchanged. `forge eligibility` on the development build with the module (2.91.0, 11.11.2026): "The version of your app [2.91.0] that's deployed to [development] is eligible for the Runs on Atlassian program."

**Does the app send data outside Atlassian (egress)?** No. AccessRadar makes no outbound network call. The tools run as Forge functions inside Atlassian.

**Does the app use AI / LLMs?** AccessRadar calls no AI or LLM service. Its tools can be called by Atlassian Rovo and, if a site admin turns on external MCP exposure for the app in Atlassian Administration (Apps > Sites > site > Connected apps), by an MCP-compatible AI client that a user connects to Atlassian's MCP endpoint (`https://mcp.atlassian.com/forge/<appId>`) with Atlassian OAuth 2.1. In that case the tool answer is returned through Atlassian's MCP endpoint to the AI client chosen and authorised by the customer's user. External exposure is off by default and is controlled per site by the customer's admin.

**Authentication / authorisation of tool calls:** Atlassian authenticates the user (OAuth for MCP clients, the Atlassian session for Rovo). The invocation carries the user identity; AccessRadar reads the accountId from the server-side invocation context, never from tool inputs. Each call checks, in order: active licence (missing licence outside development = Standard), the caller holds Administer Jira, checked with `asUser()` (`GET /rest/api/3/mypermissions?permissions=ADMINISTER`), and the Advanced edition. MCP-invoked calls never use `asApp()` (Atlassian blocks it for MCP; the app does not attempt it). Non-admins and Standard sites get an error message and no data.

**Data returned by the tools:** read-only answers from AccessRadar's own Forge SQL snapshots and reviews: space keys, group names, user display names, accountIds where the caller passed them, permission keys, grant paths, review names, statuses and due dates. At most 50 rows per call. No e-mail addresses, no work item content.

**Logging and audit:** each call writes one in-app audit row (actor accountId, action key, row count), kept under the audit retention setting. Forge logs contain the action key, the surface (`mcp` or `rovo`), the key names of the invocation context, row count and duration; no accountIds, names or values.

## Partner / Partner-Extended tabs

**Sub-processors:** unchanged: Atlassian only. The AI client a customer's user connects through Atlassian's MCP endpoint is chosen and contracted by the customer, not by Radrly, and is not a Radrly sub-processor.

**Data flow diagram / description:** add one path: "AI client (customer's choice) -> Atlassian MCP endpoint (OAuth as the user) -> AccessRadar Forge function -> Forge SQL; answer returns the same way. AccessRadar itself has no outbound connection."

**Customer controls:** admins enable or disable each tool per site in Connected apps; users can revoke the client's OAuth grant in their Atlassian account; uninstalling the app removes the tools.
