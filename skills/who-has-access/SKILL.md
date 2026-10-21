---
name: who-has-access
description: Answer who can access a Jira space (or one permission), why a person or group has that grant, and what a person can access across spaces — from AccessRadar snapshots.
allowed-tools: ar-who-can-access ar-why ar-person-access
---

# Who has access

Use this skill when the user asks who can access a space, why someone has a permission, or what a person can reach across spaces.

## Steps

1. Clarify the space (`projectKey`) and optional permission. Prefer `accountId` over display name when identifying a person.
2. For space membership / permission holders → call `ar-who-can-access`.
3. For “why does X have Y?” → call `ar-why` with the same space (and permission if known).
4. For “what can this person access?” across spaces → call `ar-person-access`.
5. Prefer tables. Cap at the rows the action returns. Cite snapshot sequence and time. Mention coverage/limitation notes from the response.

## Safety

Read-only. Never invent people or grants. Never recommend that AccessRadar change Jira permissions.
