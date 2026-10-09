"""Shared helpers for AccessRadar Marketplace assets (Python + Pillow, MarginRadar method).
Palette: #236BB4 -> #6569CB -> #9B53C6. Font: Atlassian Sans (variable) from ~/.local/share/fonts/atlassian."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
MKT = os.path.dirname(HERE)                      # brand/marketplace
SHOTS = os.environ.get('AR_SHOTS', os.path.join(MKT, 'shots'))   # real 2x screenshots go here
OUT = os.environ.get('AR_OUT', MKT)                              # where the PNGs are written
FONT = os.path.expanduser('~/.local/share/fonts/atlassian/AtlassianSans-latin.ttf')

BLUE = (0x23, 0x6B, 0xB4); INDIGO = (0x65, 0x69, 0xCB); VIOLET = (0x9B, 0x53, 0xC6)
STOPS = ((0.0, BLUE), (0.5, INDIGO), (1.0, VIOLET))
K = 4                                            # supersampling factor everywhere


def font(size, style='Regular'):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(style)
    return f


def gradient(w, h, stops=STOPS, diagonal=True):
    """RGB gradient through the brand stops; diagonal (top-left -> bottom-right) or horizontal."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    t = (x / max(1, w - 1) + y / max(1, h - 1)) / 2 if diagonal else x / max(1, w - 1)
    out = np.zeros((h, w, 3), np.float32)
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (t >= t0) & (t <= t1)
        u = ((t - t0) / (t1 - t0))[m]
        for k in range(3):
            out[..., k][m] = c0[k] + (c1[k] - c0[k]) * u
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGB')


def rounded_mask(w, h, r):
    m = Image.new('L', (w * K, h * K), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * K - 1, h * K - 1), r * K, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def logo(size, rounded=True, sheen=True, edge=True):
    """AccessRadar padlock (geometry of brand/accessradar-logo.svg, viewBox 1043) on the brand
    gradient chiclet. Drawn at 4x and downsampled. rounded=True gives the MarginRadar chiclet
    (corner radius 22% like the in-app BrandMark, rx 230/1043) with transparent corners."""
    S = size * K; s = S / 1043.0
    P = lambda v: v * s
    bg = gradient(S, S).convert('RGBA')
    if sheen:  # soft radial highlight top-left, as in the MarginRadar logo
        y, x = np.mgrid[0:S, 0:S].astype(np.float32)
        d = np.sqrt((x - 0.25 * S) ** 2 + (y - 0.0) ** 2) / (1.1 * S)
        a = (np.clip(1 - d / 0.6, 0, 1) * 0.16 * 255).astype(np.uint8)
        white = Image.new('RGBA', (S, S), (255, 255, 255, 0)); white.putalpha(Image.fromarray(a, 'L'))
        bg.alpha_composite(white)
    lay = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    W_ = (255, 255, 255, 255)
    # shine quad (white 0 -> 50% along (521.5,616)->(672.1,357.9)), under the strokes
    y, x = np.mgrid[0:S, 0:S].astype(np.float32)
    ax, ay, bx, by = P(521.5), P(616), P(672.109), P(357.876)
    vx, vy = bx - ax, by - ay
    t = np.clip(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0, 1)
    inside = (x >= P(521.5)) & (x <= P(818)) & (y >= P(443)) & (y <= P(616))
    a = (t * 0.5 * 255 * inside).astype(np.uint8)
    sh = Image.new('RGBA', (S, S), (255, 255, 255, 0)); sh.putalpha(Image.fromarray(a, 'L'))
    lay.alpha_composite(sh)
    # shackle: two verticals + upper half ellipse, stroke 47, round caps
    sw = P(47)
    d.arc((P(330) - sw / 2 + 0, P(164) - sw / 2, P(713) + sw / 2, P(532) + sw / 2), 180, 360, fill=W_, width=round(sw))
    for cx in (330, 713):
        d.rectangle((P(cx) - sw / 2, P(348), P(cx) + sw / 2, P(443)), fill=W_)
    # body: rounded rect stroked 47 centred on (225,443)-(818,873) r=67
    d.rounded_rectangle((P(225) - sw / 2, P(443) - sw / 2, P(818) + sw / 2, P(873) + sw / 2), P(67) + sw / 2, outline=W_, width=round(sw))
    # keyhole
    r = P(46.125); d.ellipse((P(521.5) - r, P(616) - r, P(521.5) + r, P(616) + r), fill=W_)
    kw = P(38); d.line((P(521.5), P(648), P(521.5), P(725)), fill=W_, width=round(kw))
    for cy in (648, 725):
        d.ellipse((P(521.5) - kw / 2, P(cy) - kw / 2, P(521.5) + kw / 2, P(cy) + kw / 2), fill=W_)
    bg.alpha_composite(lay)
    if edge and rounded:   # 8% black hairline like the MarginRadar chiclet
        e = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(e).rounded_rectangle((K // 2, K // 2, S - 1 - K // 2, S - 1 - K // 2), P(230), outline=(0, 0, 0, 20), width=2 * K)
        bg.alpha_composite(e)
    if rounded:
        m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, S - 1, S - 1), P(230), fill=255)
        bg.putalpha(ImageChops.multiply(bg.getchannel('A'), m))
    return bg.resize((size, size), Image.LANCZOS)


def card(img, r=8, border=(0xEB, 0xEB, 0xEB), pad=0):
    """Screenshot crop on a white card: radius r, 1px border, supersampled 4x. Returns RGBA."""
    if pad:
        n = Image.new('RGB', (img.width + 2 * pad, img.height + 2 * pad), 'white'); n.paste(img, (pad, pad)); img = n
    w, h = img.size
    out = img.convert('RGBA')
    ring = Image.new('L', (w * K, h * K), 0)
    ImageDraw.Draw(ring).rounded_rectangle((0, 0, w * K - 1, h * K - 1), r * K, outline=255, width=K)
    ring = ring.resize((w, h), Image.LANCZOS)
    out.paste(Image.new('RGBA', (w, h), border + (255,)), (0, 0), ring)
    out.putalpha(ImageChops.multiply(out.getchannel('A'), rounded_mask(w, h, r)))
    return out


def shot(name):
    """Opens brand/marketplace/shots/<name>; raises a clear error if the real screenshot is missing."""
    p = os.path.join(SHOTS, name)
    if not os.path.exists(p):
        raise SystemExit(f'missing screenshot: {os.path.relpath(p, MKT)} (see shots/README.md)')
    return Image.open(p).convert('RGB')
