# Security page change for rovo:mcp (DRAFT, accessradar.radrly.com/security/)

Publish with the prod deploy. Update "Reviewed against the AccessRadar source code ... on <date>".

## Data flow (diagram description and bullets)

Diagram `<desc>`: replace "Nothing leaves Atlassian: there is no connection to external servers, third-party APIs or AI services." with:
"AccessRadar makes no outbound calls: there is no connection from the app to external servers, third-party APIs or AI services. If your admin enables external MCP access, a signed-in Jira admin's AI client can request read-only answers through Atlassian's MCP endpoint."

Diagram box "None. AccessRadar makes no outbound calls." stays. Add a dashed box outside the Atlassian cloud: "AI client (optional, off by default)" with an arrow to a box inside "Atlassian MCP endpoint (OAuth as the user)" and on to "AccessRadar (Forge app)". Label: "admin-enabled, read-only answers".

Add a bullet after "Admins see results inside Jira...":
"- Optional, Advanced: the five read-only Rovo actions are also Rovo and MCP tools. A site admin can expose them to external MCP clients in Atlassian Administration > Apps > Sites > your site > Connected apps (off by default). The client connects to Atlassian's MCP endpoint and the user signs in with Atlassian OAuth. AccessRadar runs the call as that user and returns at most 50 rows through Atlassian; the app opens no connection of its own."

## Scopes

Add after the table: "The Rovo and MCP tools use the same read scopes. No scope was added for them."

## Access control (add a bullet)

"- Rovo and MCP tools (Advanced): every call checks an active licence, then that the caller is a Jira administrator using the caller's own identity (asUser; MCP calls never run as the app), then the Advanced edition. The caller's account comes from Atlassian's invocation context, never from the tool's inputs. Non-admins and Standard sites get an error and no data. Each call is written to the in-app audit log."

## AI statement (replace)

"AccessRadar does not call any external AI or LLM service. The Advanced edition includes five read-only Rovo actions (GET) used by the AccessRadar Rovo agent and offered as tools through Atlassian's Rovo MCP service. Inside Rovo they run under Atlassian's terms. An admin can also expose them to external MCP-compatible AI clients (off by default, per site); the answers then go through Atlassian's MCP endpoint to the client the user signed in with, under that client's terms. Access resolution and risk indicators are deterministic calculations over Jira permission data inside Forge."

## llms.txt / llms-full.txt (one line each, same deploy)

"Rovo and MCP tools (Advanced, Preview): five read-only tools via Atlassian's MCP endpoint https://mcp.atlassian.com/forge/026c4f6a-266d-4c42-aec5-7394371ad05d; admin-enabled per site, Atlassian OAuth, Jira admins only, no egress, Runs on Atlassian."
