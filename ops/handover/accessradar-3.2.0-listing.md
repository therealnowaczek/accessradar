# AccessRadar 3.2.0 listing copy (prepare only)

Date: 2026-11-12 (Europe/Warsaw)
From: CMO
To: SEO i Marketplace (browser step later)
Status: site copy is in the radrly repo for accessradar.radrly.com. Do not treat this file as a request to edit the Marketplace listing yet.

AccessRadar is a control in the position test. Change only the version release summary and version release notes. Do not draft or edit Highlights or More details.

---

## Field: Version 3.2.0, Release summary

Limit: 80 characters. Required.

```
Recheck stale Keep, Revoke or Exception decisions when access changes
```

(69 characters)

---

## Field: Version 3.2.0, Release notes

Limit: 1,000 characters.

```
No new scopes. Installs automatically. Runs on Atlassian, zero egress. Signed evidence format unchanged.

- Recheck marks a Keep, Revoke or Exception when its access changed in a later complete snapshot (permissions, or how it is granted: direct, group or role). Renames and wording changes are ignored. Partial snapshots and disappeared access are not flagged. Signed reviews never show a recheck.
- Runs automatically on each new complete snapshot. No button. Not real-time: compares against the latest complete snapshot (Standard weekly, Advanced daily or weekly).
- UI: banner with the count, "Show items to recheck" filter, Recheck pill with the old decision and current access.
- Sign-off (Advanced) and project review assignment submission are blocked until every stale item is decided again (server-side). Bulk Keep skips stale items. A new decision records the current access and a review.rechecked audit event. Standard and Advanced.

https://accessradar.radrly.com/release-notes/#v3-2-0
```

(997 characters)

A fuller version of the same notes is on the site: https://accessradar.radrly.com/release-notes/#v3-2-0

---

## Field: Version 3.2.0, Documentation URL (optional)

If the version form has a documentation URL, set:

```
https://accessradar.radrly.com/release-notes/#v3-2-0
```

---

## Fields not to change

- Name, tagline and summary
- Highlights
- More details
- Editions tab
- Pricing
- Privacy and Security tab
- App screenshots and video

Copy rules used: no em or en dashes, no prices, no "small", Marcin is not named, Recheck is not described as real-time, and the in-app review request (C11, internal) is not mentioned.
