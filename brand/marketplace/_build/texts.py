"""Listing texts used on the images (copied from docs/LISTING.md §3 and §6.3; keep in sync)."""
HIGHLIGHTS = [
    # (output file, screenshot in ../shots, crop box in the 2x screenshot or None, title, subtitle)
    ('highlight-1-why-1840x900.png', 'h1-explore-why-2x.png', None,
     'Every access, with the reason behind it',
     'Open any entry for the path: group membership, project role and permission scheme grant.'),
    ('highlight-2-changes-1840x900.png', 'h2-changes-2x.png', None,
     'What changed since your last review',
     'Compare two snapshots: access granted and revoked, group and scheme changes.'),
    ('highlight-3-signoff-1840x900.png', 'h3-review-signed-2x.png', None,
     'Sign-off you can hand to an auditor',
     'Keep or Revoke each item, then sign off. The review is frozen with a SHA-256 evidence hash.'),
]

if __name__ == '__main__':
    for f, s, c, t, sub in HIGHLIGHTS:
        print(f'{f}: title {len(t)}/50 · {t}\n  {sub}\n  source shots/{s} crop {c}')
