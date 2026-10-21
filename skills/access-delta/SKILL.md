---
name: access-delta
description: Summarize access granted and revoked between AccessRadar snapshots when users ask what changed, what was added or removed, or what differs since a date or sequence.
allowed-tools: ar-changes-since
---

# Access delta

Use this skill when the user asks what changed in access, what was granted or revoked, or how permissions differ since a date or snapshot.

## Steps

1. Resolve the baseline: prefer an explicit `sinceSeq`; otherwise use `sinceDate` (ISO). If neither is given, ask once or use the previous snapshot via the action’s default.
2. Call `ar-changes-since` with the resolved inputs.
3. Summarize grants vs revokes in tables. Highlight admin / sensitive permissions first when present.
4. Cite both snapshot sequences and times from the response. Say when results are truncated.

## Safety

Read-only. Never invent changes. If the action returns a coverage or limitations note, mention it.
