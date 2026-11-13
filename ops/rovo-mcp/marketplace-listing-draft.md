# Marketplace listing draft for rovo:mcp (DRAFT, do not save in the partner console)

Change only after the prod deploy and after checking that no ECOHELP review is open (a listing save can start a review). Consult MarginRadar first (family rule for irreversible Marketplace changes).

## More details (replace the Rovo sentence in docs/LISTING.md §2.3 / line "Advanced also includes a read-only Rovo agent ...")

Old: "Advanced also includes a read-only Rovo agent that answers from the latest snapshot (Jira admins only; Rovo must be enabled on the site)."

New (166 chars): "Advanced also includes a read-only Rovo agent and five MCP tools for Rovo or your own AI client, answering from the latest snapshot (Jira admins only, admin-enabled)."

Re-run `docs/listing-check.py` for the More details limit (≤1000) after the swap.

## Highlight 1 caption, optional extra sentence (caption ≤220)

"Ask Rovo or your AI client: who can administer PAY, and why?" (60 chars) Use only if the caption stays ≤220 in total.

## Editions tab (Advanced-only features)

Replace "Rovo agent (read-only)" with "Rovo agent and MCP tools (read-only)".

## Privacy & Security tab

- "Does your app use AI?" stays No for app-side AI. Add to the explanation: "AccessRadar calls no AI service. Its read-only tools can be called by Atlassian Rovo and, if the customer's admin enables it, by an MCP client the user connects through Atlassian OAuth."
- Data storage / egress answers unchanged (Forge SQL only, no egress).

## Release note (≤80 chars)

"Rovo MCP tools: ask AccessRadar from Rovo or your AI client (Advanced)" (70 chars)
