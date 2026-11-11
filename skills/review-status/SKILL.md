---
name: review-status
description: Report open, overdue, and signed AccessRadar access reviews (optionally only the reviews started by one campaign) when users ask about review progress, overdue reviews, or sign-off status.
allowed-tools: ar-review-status
---

# Review status

Use this skill when the user asks about access reviews, overdue reviews, open reviews, or who has signed off.

A review is one review session with decisions and a sign-off. A campaign is a recurring schedule that starts reviews. Each row returned by `ar-review-status` is a review: call them reviews, never campaigns. `fromCampaign` names the campaign that started the review (empty for a review started by hand).

## Steps

1. Optional: take a campaign name filter from the user.
2. Call `ar-review-status` (with `campaign` when provided).
3. Group or table by status: overdue, open, signed, with a "Review" column (not "Campaign name"). Call out overdue reviews first.
4. Cite snapshot or review metadata from the response. Point users to AccessRadar Reviews / Campaigns admin pages instead of inventing URLs.

## Safety

Read-only. Never invent review decisions or sign-offs. If the caller lacks access or the site edition blocks the action, explain the error and stop.
