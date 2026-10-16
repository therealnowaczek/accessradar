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


LOGO_SVG = os.path.join(os.path.dirname(MKT), 'accessradar-logo.svg')   # brand/accessradar-logo.svg (standard logo)


def logo(size, rounded=True, edge=True):
    """The STANDARD AccessRadar logo (brand/accessradar-logo.svg, viewBox 1043; same mark at every size,
    no small/bold variant), rasterised with rsvg-convert at 4x and downsampled. rounded=True gives the
    MarginRadar chiclet (corner radius 22% like the in-app BrandMark, rx 230/1043) with transparent corners."""
    import io, subprocess
    S = size * K
    png = subprocess.run(['rsvg-convert', '-w', str(S), '-h', str(S), LOGO_SVG], check=True, capture_output=True).stdout
    bg = Image.open(io.BytesIO(png)).convert('RGBA')
    P = lambda v: v * S / 1043.0
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
