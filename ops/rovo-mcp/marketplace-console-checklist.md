# AccessRadar: Marketplace console checklist for rovo:mcp (do in the browser, after prod 2.45.0)

Prod 2.45.0 with `rovo:mcp` deployed 11.11.2026. Site texts are live (security, privacy v1.4, docs#mcp, release notes).
Before saving anything: (1) check ECOHELP, no open AccessRadar request (on 11.11 none was open); (2) consult MarginRadar (family rule); (3) save everything in ONE pass. Saving the listing or the P&S tab may start a review; a prod deploy during that review creates a new ticket.

## 1. Security questionnaire (Partner console > AccessRadar > Security questionnaire)
Change only these answers. Keep everything else. Then Save, then Submit for Review.

Forge tab
- Modules used: add `rovo:mcp` (Preview), key `accessradar-mcp`, name "AccessRadar MCP"; tools = the 5 existing GET actions ar-who-can-access, ar-why, ar-person-access, ar-changes-since, ar-review-status. No new action/function.
- Scopes or permissions changed: "No. Release 2.45.0 adds only the rovo:mcp module. No new scopes, no permissions.external, no remotes, no Connect."
- Runs on Atlassian: unchanged. Paste: "forge eligibility (production, 2.45.0): The version of your app [2.45.0] that's deployed to [production] is eligible for the Runs on Atlassian program."
- Egress: "No. AccessRadar makes no outbound network call."
- AI / LLM use (paste): "AccessRadar calls no AI or LLM service. Its five read-only tools can be called by Atlassian Rovo and, if a site admin turns on external MCP exposure for the app (Atlassian Administration > Apps > Sites > site > Connected apps, off by default), by an MCP-compatible AI client that a user connects to Atlassian's MCP endpoint (https://mcp.atlassian.com/forge/026c4f6a-266d-4c42-aec5-7394371ad05d) with Atlassian OAuth 2.1. The tool answer is then returned through Atlassian's MCP endpoint to the AI client chosen and authorised by the customer's user."
- AuthN/AuthZ of tool calls (paste): "Atlassian authenticates the user (OAuth for MCP clients, Atlassian session for Rovo). AccessRadar reads the accountId from the server-side invocation context, never from tool inputs, and checks in order: active licence (missing licence outside development = Standard), Administer Jira checked as the user (asUser, GET /rest/api/3/mypermissions?permissions=ADMINISTER), Advanced edition. MCP-invoked calls never use asApp. Non-admins and Standard sites get an error and no data."
- Data returned (paste): "Read-only answers from AccessRadar's own Forge SQL snapshots and reviews: space keys, group names, user display names, accountIds where the caller passed them, permission keys, grant paths, review names, statuses and due dates. At most 50 rows per call. No e-mail addresses, no work item content."
- Logging (paste): "One in-app audit row per call (actor accountId, action key, row count), kept under the audit retention setting. Forge logs hold the action key, surface (mcp or rovo), context key names, row count and duration; no accountIds, names or values."

Partner / Partner-Extended tabs
- Sub-processors: unchanged, Atlassian only. Add note: "The AI client a customer's user connects through Atlassian's MCP endpoint is chosen and contracted by the customer and is not a Radrly sub-processor."
- Data flow description: append "Optional (admin-enabled): AI client (customer's choice) -> Atlassian MCP endpoint (OAuth as the user) -> AccessRadar Forge function -> Forge SQL; the answer returns the same way. AccessRadar has no outbound connection."
- Customer controls: "Admins enable or disable each tool per site in Connected apps; users can revoke the client's OAuth grant in their Atlassian account; uninstalling removes the tools."

## 2. Privacy policy link / version (Listing > Privacy & Security tab and listing links)
- Privacy policy URL: keep https://accessradar.radrly.com/privacy/ (now "Last updated: 2026-11-11 · Version 1.4").
- Security / trust URL: keep https://accessradar.radrly.com/security/ (reviewed 11 November 2026).
- "Does your app use AI?" (or the AI question in P&S): keep the app-side answer No (no AI service called by the app). Explanation field, paste: "AccessRadar calls no AI service. Its read-only tools can be called by Atlassian Rovo and, if the customer's admin enables it, by an MCP client the user connects through Atlassian OAuth."
- Data storage, egress, residency answers: unchanged (Forge SQL only, no egress, follows site residency).
- Fill the Justification for every scope if the form shows it empty (empty = auto-rejection). Scopes are unchanged.

## 3. Editions tab (Advanced-only features)
- Old Advanced item: "Rovo agent (read-only)"
- New Advanced item: "Rovo agent and MCP tools (read-only)"
- Optional extra Advanced line, if the tab allows a new row: "MCP tools for external AI clients (admin-enabled, Jira admins only)". Recommended: yes, as a separate row, because the code gates MCP on `features.rovo` (Advanced). Standard keeps no Rovo/MCP.

## 4. Listing text (Listing > Details)
- More details, old sentence: "Advanced also includes a read-only Rovo agent that answers from the latest snapshot (Jira admins only; Rovo must be enabled on the site)."
- New sentence (166 chars): "Advanced also includes a read-only Rovo agent and five MCP tools for Rovo or your own AI client, answering from the latest snapshot (Jira admins only, admin-enabled)."
- Check the More details total stays ≤1000 chars (repo `docs/listing-check.py`, after updating `docs/LISTING.md` the same way).
- Highlight 1 caption (optional, only if total ≤220): append "Ask Rovo or your AI client: who can administer PAY, and why?"
- Version release note / summary (≤80): "Rovo MCP tools: ask AccessRadar from Rovo or your AI client (Advanced)"
- Do not change tagline, summary, highlights titles, categories or keywords.

## 5. After saving
- Note the ECOHELP ticket number if one is created and do not deploy AccessRadar prod until it is resolved, unless the fix must go into the same ticket.
- Update `docs/LISTING.md` in the repo (More details + Editions) in the same PR as any later change, so listing-check.py keeps matching.
