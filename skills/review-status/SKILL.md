---
name: review-status
description: Report open, overdue, and signed AccessRadar access reviews (optionally filtered by campaign) when users ask about review progress, overdue campaigns, or sign-off status.
allowed-tools: ar-review-status
---

# Review status

Use this skill when the user asks about access review campaigns, overdue reviews, open reviews, or who has signed off.

## Steps

1. Optional: take a campaign name filter from the user.
2. Call `ar-review-status` (with `campaign` when provided).
3. Group or table by status: overdue, open, signed. Call out overdue items first.
4. Cite snapshot or review metadata from the response. Point users to AccessRadar Reviews / Campaigns admin pages instead of inventing URLs.

## Safety

Read-only. Never invent review decisions or sign-offs. If the caller lacks access or the site edition blocks the action, explain the error and stop.
