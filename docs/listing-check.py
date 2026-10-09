#!/usr/bin/env python3
"""Checks AccessRadar Marketplace listing fields: length limits, no trailing period on the
tagline, the count written in LISTING.md, and that every text appears verbatim in LISTING.md.
Counts use Python len() (Unicode code points; newlines count as 1)."""
import re, sys, pathlib

listing = (pathlib.Path(__file__).parent / "LISTING.md").read_text(encoding="utf-8")
md_block = re.search(r"### 2\.3 More details.*?```\n(.*?)\n```", listing, re.S).group(1)

# (key, text, limit). Texts must match LISTING.md exactly.
FIELDS = [
    ("App name", "AccessRadar – Access Review & Permission Audit for Jira", 60),
    ("Tagline", "See who can access what in Jira and why, what changed since your last review, and sign off with evidence auditors can check", 130),
    ("Tagline short", "Who has access to what in Jira, and why. Read-only access reviews with audit-ready evidence", 130),
    ("Summary", "See who has access to what in Jira and why: group, project role and permission scheme. Scheduled snapshots, diffs, signed access reviews and CSV/PDF evidence for SOC 2 and ISO 27001. Read-only. Runs on Atlassian.", 250),
    ("More details", md_block, 1000),
    ("H1 title", "Every access, with the reason behind it", 50),
    ("H1 description", "Pick a project, group or person and see who holds which permission. Open any entry for the path: group membership, project role and permission scheme grant. Issue-dependent grants are labelled as such.", 220),
    ("H1 caption", "Explore by project: people and groups with their key permissions, and the Why panel tracing one grant from group to project role to the permission scheme.", 220),
    ("H2 title", "What changed since your last review", 50),
    ("H2 description", "Daily or weekly snapshots, plus one on demand. Compare any two to see access granted and removed, group membership and scheme changes, filtered by project, group or permission. Export the diff to CSV.", 220),
    ("H2 caption", "Changes view: two snapshots compared, with access granted and removed listed separately and filters by project, group and permission.", 220),
    ("H3 title", "Sign-off you can hand to an auditor", 50),
    ("H3 description", "Mark each item Keep or Revoke, then sign off. The review is frozen with a SHA-256 evidence hash and exported as CSV and a PDF evidence pack for SOC 2 and ISO 27001. Read-only, Runs on Atlassian.", 220),
    ("H3 caption", "Review sign-off: summary of decisions, who signed and when (UTC and local time), and the SHA-256 evidence hash printed in the PDF and CSV export.", 220),
    ("Release summary", "First public release: who has access and why, snapshots, diffs, signed reviews", 80),
    ("S4 caption", "Overview: latest snapshot and its completeness, with risk indicators for admins, inactive users with access and public grants.", 220),
    ("S5 caption", "One person across all projects: access level per project and the path for each, such as membership in the contractors group.", 220),
    ("S6 caption", "Snapshot history with schedule, status and completeness; take a snapshot now at any time.", 220),
    ("S7 caption", "PDF evidence pack: review scope, snapshots, signer, timestamps, evidence hash, methodology and flagged items, ready for your auditor.", 220),
    ("S8 caption", "Security and data: read-only scopes, no egress, what AccessRadar stores, where and for how long.", 220),
    ("S9 caption", "Get started in three steps: see what is collected, pick a daily or weekly schedule, take your first snapshot.", 220),
    ("S10 caption", "AccessRadar supports Jira's light and dark themes.", 220),
]
STATED = {  # counts written in LISTING.md
    "App name": 55, "Tagline": 123,
    "Tagline short": 91, "Summary": 212, "More details": 979, "H1 title": 39, "H1 description": 201,
    "H1 caption": 154, "H2 title": 35, "H2 description": 200, "H2 caption": 133, "H3 title": 35,
    "H3 description": 194, "H3 caption": 145, "Release summary": 78,
}
ok = True
for key, text, limit in FIELDS:
    n = len(text)
    problems = []
    if n > limit: problems.append("OVER LIMIT")
    if key.startswith("Tagline") and text.rstrip().endswith("."): problems.append("trailing period")
    if text not in listing: problems.append("not found verbatim in LISTING.md")
    if key in STATED and STATED[key] != n: problems.append(f"stated {STATED[key]}")
    ok &= not problems
    print(f"{'OK ' if not problems else 'ERR'} {key:24} {n:4}/{limit}  {'; '.join(problems)}")
# Pricing (§8): progressive from the first user on Atlassian's fixed tiers; 1–10 flat $0.
TIERS = [(100, 0.75), (250, 0.55), (1000, 0.35), (2500, 0.20), (5000, 0.15), (None, 0.12)]
def monthly(users):
    if users <= 10: return 0.0
    total, lo = 0.0, 0
    for hi, rate in TIERS:
        top = users if hi is None else min(users, hi)
        if top > lo: total += (top - lo) * rate
        if hi is None or users <= hi: break
        lo = hi
    return round(total, 2)
for users, stated in [(10, 0), (25, 18.75), (50, 37.5), (100, 75), (250, 157.5), (500, 245), (1000, 420), (2500, 720), (5000, 1095)]:
    m = monthly(users); good = abs(m - stated) < 0.005
    row = f"| {users:,} | ${stated:,.2f} |"
    found = row in listing
    ok &= good and found
    print(f"{'OK ' if good and found else 'ERR'} pricing {users:>5} users  ${m:,.2f}/month  annual ${m*10:,.2f}{'' if found else '  row not found in LISTING.md'}")
print("Categories: 2 (Security and compliance, Administrative tools); keywords: 4 (Audit, Compliance, User permissions, Risk Management)")
sys.exit(0 if ok else 1)
