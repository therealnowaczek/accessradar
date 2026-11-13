# Privacy Policy change for rovo:mcp (DRAFT, accessradar.radrly.com/privacy/)

Bump to Version 1.4, "Last updated" = the prod deploy date. Publish together with the prod deploy, not before.

## Summary (replace bullet 3)

Old: "Atlassian is the only sub-processor (hosting). No external AI or LLM service is used."

New: "Atlassian is the only sub-processor (hosting). AccessRadar calls no external AI or LLM service. If your admin turns on Atlassian's external MCP access for AccessRadar, a Jira admin can ask the AI client they connect with Atlassian sign-in for AccessRadar answers (see AI and Rovo)."

## No egress, no sub-processors (replace the sentence about Rovo)

Old: "It exposes no public REST API of its own; the Rovo actions are Forge modules that run inside Atlassian."

New: "It exposes no public REST API of its own. The Rovo actions, also offered as Rovo and MCP tools, are Forge modules that run inside Atlassian; external access to them goes only through Atlassian's MCP service, with Atlassian sign-in and your admin's approval."

## AI and Rovo (replace the section text)

"AccessRadar does not call any external AI or LLM service. Access resolution and risk indicators are deterministic calculations inside Forge.

The Advanced edition includes five read-only Rovo actions (who can access, why, person access, changes since, review status). They are used by the AccessRadar Rovo agent and are also offered as tools through Atlassian's Rovo MCP service. In Rovo they run under Atlassian's terms and AI trust policies.

External AI clients (off by default). A site or organisation admin can turn on external MCP access for AccessRadar in Atlassian Administration (Apps > Sites > your site > Connected apps). A user can then connect an MCP-compatible AI client of their choice (for example Claude or Cursor) to Atlassian's MCP endpoint and sign in with their Atlassian account. When that user asks, the tool answer (for example space keys, group names, user display names, permission keys and review status, up to 50 rows) is sent through Atlassian to that AI client. AccessRadar answers only Jira administrators, runs the call with the user's own permissions, and sends nothing on its own initiative. The AI client is chosen and authorised by your organisation and its user, so its provider's terms and retention apply to the answers it receives; it is not a Radrly sub-processor. Admins can turn the tools off per site at any time, and users can revoke the client's access in their Atlassian account.

Each tool call is recorded in the AccessRadar audit log (account ID of the caller, action and number of rows) and follows the audit retention setting."

## Data we process (Audit log row, extend "Examples")

Add: "..., including each Rovo or MCP tool call (caller, action, row count)".

## Changes

Add an entry: "Version 1.4 (<date>): AI and Rovo: AccessRadar's read-only Rovo actions are also available as Rovo and MCP tools; external AI clients only when your admin enables them."
