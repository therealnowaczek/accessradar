# Real 2x screenshots (input for `_build/make.py` and `_build/visuals.py`)

Capture from the AccessRadar admin page on marginradar.atlassian.net after the demo seed (`scripts/demo/seed.py`,
phases 1 and 2, plus the manual steps it prints). Device pixel ratio 2, light theme, Atlassian Sans installed,
no cursor, no Rovo launcher, fictional demo data only. Prefer production (no "Dev" label); production cannot be
installed from the CLI until the Marketplace listing is approved, so crop the label out if you capture from dev.

| File | Screen | Must show |
|---|---|---|
| `h1-explore-why-2x.png` | Explore → Projects → PAY, **Why?** drawer open | Riley Novak (contractors): group “contractors” → role “Developers” → scheme “AR Demo · Standard” |
| `h2-changes-2x.png` | Changes, From #1 → To #2, tab **Granted** | Riley Novak / Casey Brandt gaining Browse/Create/Edit in PAY; tab counts for Revoked, Groups, Schemes & roles |
| `h3-review-signed-2x.png` | Reviews → “Q4 2026 access review” (signed) | “Signed by …” message with UTC + local time and **Evidence hash (SHA-256)**, metrics Items / Decided / Keep / Revoke, first table rows |
| `g1-overview-2x.png` | Overview | Latest snapshot, completeness, risk tiles (admins, inactive with access, anonymous grant) |
| `g2-people-2x.png` | Explore → People → Casey Brandt | Access per project with the path (contractors, admin group) |
| `g3-snapshots-2x.png` | Snapshots | Two or more snapshots, status and completeness |
| `g4-security-data-2x.png` | Settings → Security & data | Read-only scopes, no egress, what is stored and for how long |

Crops: each highlight crop must fit 1130×780 at 1:1 (no scaling); set the box in `_build/texts.py` (highlights) or
`CROPS` in `_build/visuals.py` (gallery). Then run `python3 brand/marketplace/_build/make.py` and `visuals.py`
and check every output with `identify brand/marketplace/*.png`.
