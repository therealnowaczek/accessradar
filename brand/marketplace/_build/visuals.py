"""Gallery images 1840x900 (MarginRadar gallery-v3 layout), AccessRadar shot list from docs/LISTING.md §6.3.
Every crop comes from a REAL 2x screenshot in brand/marketplace/shots/ and is placed on a white card
(r=8, 1px #EBEBEB, 4x supersampled). Crop boxes are None (= whole screenshot) until the shots exist; set
them in CROPS after capture. Chip texts must match the demo data visible in the screenshot.
Run: python3 brand/marketplace/_build/visuals.py [1 2 3 4]"""
import sys
from common import card, shot
from gallery import *

# crop boxes (left, top, right, bottom) in 2x screenshot pixels; fill in after capture
CROPS = {
    'overview': None,          # Overview: latest snapshot + completeness + risk tiles
    'people': None,            # Explore -> People: one person across projects, Why column
    'snapshots': None,         # Snapshots: history with schedule, status, completeness
    'security': None,          # Settings -> Security & data
}


def crop(name, key):
    im = shot(name); box = CROPS[key]
    return im.crop(box) if box else im


def fit(img, maxw, maxh):
    """Never upscale; only downscale if a crop is larger than its slot (prefer tighter crops)."""
    s = min(1.0, maxw / img.width, maxh / img.height)
    return img if s == 1.0 else img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)


def v1():   # S4: Overview with risk indicators
    c = base(); ov = crop('g1-overview-2x.png', 'overview')
    place(c, card(fit(ov, 1060, 760)), 700, 70, glow=(INDIGO, 90))
    chip(c, 1810, 40, 'Admins, inactive users, public grants', sub='risk indicators from the latest snapshot', anchor='r')
    header(c, 'Risks at a glance', 'The latest snapshot with its completeness, and risk indicators for admins, inactive users with access and public grants.', maxw=520)
    save(c, 'gallery-1-overview-risks-1840x900.png')


def v2():   # S5: one person across projects
    c = base([((700, 100, 1900, 1100), VIOLET, 70), ((-250, -300, 600, 380), BLUE, 34), ((1450, -260, 2150, 320), INDIGO, 60)])
    pp = crop('g2-people-2x.png', 'people')
    place(c, card(fit(pp, 1060, 760)), 700, 70, glow=(VIOLET, 90))
    chip(c, 1810, 790, 'Access through the contractors group', anchor='r')
    header(c, 'One person, every project', 'Access level per project and the path for each, such as membership in the contractors group.', maxw=520)
    save(c, 'gallery-2-person-across-projects-1840x900.png')


def v3():   # S6: snapshot history and completeness
    c = base([((800, 80, 1900, 1000), VIOLET, 60), ((1000, 300, 1800, 1000), INDIGO, 60), ((-250, -300, 600, 380), BLUE, 34)])
    sn = crop('g3-snapshots-2x.png', 'snapshots')
    place(c, card(fit(sn, 1060, 760)), 700, 70, glow=(INDIGO, 90))
    header(c, 'Snapshots you can trust', 'Daily or weekly snapshots with status and completeness. AccessRadar shows what it could not read.', maxw=520)
    save(c, 'gallery-3-snapshots-1840x900.png')


def v4():   # S8: Runs on Atlassian, read-only
    c = base([((1000, 0, 1900, 700), INDIGO, 60), ((900, 500, 1700, 1200), VIOLET, 55), ((-250, -300, 600, 380), BLUE, 34)])
    se = crop('g4-security-data-2x.png', 'security')
    place(c, card(fit(se, 1060, 760)), 700, 70, glow=(INDIGO, 110))
    header(c, 'Read-only. Runs on Atlassian.', 'Read scopes only, no data egress. What AccessRadar stores, where and for how long is in Settings.', maxw=520)
    save(c, 'gallery-4-runs-on-atlassian-1840x900.png')


if __name__ == '__main__':
    for n in (sys.argv[1:] or ['1', '2', '3', '4']): globals()['v' + n]()
