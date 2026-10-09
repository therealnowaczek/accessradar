"""Gallery building blocks, MarginRadar gallery-v3 method (marginradar-shots/gallery-v3/_build/gallery.py),
in the AccessRadar palette. Screenshot crops always sit on a white card r=8 with a 1px #EBEBEB border (common.card),
supersampled 4x. Used by visuals.py."""
import os, math
from PIL import Image, ImageDraw, ImageFilter
from common import OUT, BLUE, INDIGO, VIOLET, font, logo, card, gradient, rounded_mask

W, H = 1840, 900; BG = (0x16, 0x1A, 0x1D); GAP = 24
TXT = (240, 243, 245); SUB = (159, 173, 188)
ACCENT = (127, 156, 245)       # light indigo for chips/arrows on the dark background (contrast)


def base(glows=None):
    c = Image.new('RGBA', (W, H), BG + (255,))
    g = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    for box, col, a in (glows or [((900, 150, 1900, 1100), INDIGO, 70), ((-250, -300, 600, 380), BLUE, 34), ((1450, -260, 2150, 320), VIOLET, 60)]):
        d.ellipse(box, fill=col + (a,))
    c = Image.alpha_composite(c, g.filter(ImageFilter.GaussianBlur(160)))
    dots = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dd = ImageDraw.Draw(dots)
    for y in range(18, H, 36):
        for x in range(18, W, 36): dd.point((x, y), fill=(255, 255, 255, 14))
    return Image.alpha_composite(c, dots)


def place(c, img, x, y, angle=0, shadow=True, glow=None, sh_alpha=150):
    """Pastes an RGBA card at x,y (optionally rotated about its centre); returns a mapper img->canvas coords."""
    if angle:
        big = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
        rot = big.rotate(angle, resample=Image.BICUBIC, expand=True)
        rot = rot.resize((rot.width // 2, rot.height // 2), Image.LANCZOS)
    else:
        rot = img
    cx, cy = x + img.width / 2, y + img.height / 2
    px, py = round(cx - rot.width / 2), round(cy - rot.height / 2)
    if glow:
        m = Image.new('L', (W, H), 0); m.paste(rot.getchannel('A'), (px, py))
        m = m.filter(ImageFilter.GaussianBlur(40)).point(lambda v: int(v * glow[1] / 255))
        gl = Image.new('RGBA', (W, H), glow[0] + (255,)); gl.putalpha(m); c.alpha_composite(gl)
    if shadow:
        m = Image.new('L', (W, H), 0); m.paste(rot.getchannel('A').point(lambda v: int(v * sh_alpha / 255)), (px, py + 24))
        sh = Image.new('RGBA', (W, H), (0, 0, 0, 255)); sh.putalpha(m.filter(ImageFilter.GaussianBlur(30))); c.alpha_composite(sh)
    c.alpha_composite(rot, (max(px, 0), max(py, 0)), (max(-px, 0), max(-py, 0)))
    rad = math.radians(-angle)

    def map_pt(u, v):
        dx, dy = u - img.width / 2, v - img.height / 2
        return (cx + dx * math.cos(rad) - dy * math.sin(rad), cy + dx * math.sin(rad) + dy * math.cos(rad))
    return map_pt


class Overlay:
    """Supersampled (4x) layer for connector curves and rings."""
    K = 4

    def __init__(s): s.im = Image.new('RGBA', (W * s.K, H * s.K), (0, 0, 0, 0)); s.d = ImageDraw.Draw(s.im)
    def P(s, p): return (p[0] * s.K, p[1] * s.K)

    def curve(s, p0, p1, bend=0.25, col=ACCENT, w=3, dot=True):
        (x0, y0), (x1, y1) = p0, p1; mx, my = (x0 + x1) / 2, (y0 + y1) / 2; dx, dy = x1 - x0, y1 - y0
        cx, cy = mx - dy * bend, my + dx * bend
        pts = [((1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1) for t in [i / 60 for i in range(61)]]
        s.d.line([s.P(p) for p in pts], fill=col + (255,), width=w * s.K, joint='curve')
        if dot:
            r = 7 * s.K; X, Y = s.P(p1); s.d.ellipse((X - r, Y - r, X + r, Y + r), fill=col + (255,))
            r2 = 13 * s.K; s.d.ellipse((X - r2, Y - r2, X + r2, Y + r2), outline=col + (110,), width=2 * s.K)
        sx, sy = s.P(pts[0]); r = 4 * s.K; s.d.ellipse((sx - r, sy - r, sx + r, sy + r), fill=col + (255,))

    def ring(s, box, col=ACCENT, w=3, r=8):
        s.d.rounded_rectangle([v * s.K for v in box], r * s.K, outline=col + (255,), width=w * s.K)

    def apply(s, c): c.alpha_composite(s.im.resize((W, H), Image.LANCZOS))


def chip(c, x, y, text, sub=None, col=ACCENT, anchor='l'):
    d = ImageDraw.Draw(c); f = font(24, 'SemiBold'); fs = font(19, 'Regular')
    w = int(max(d.textlength(text, font=f), d.textlength(sub, font=fs) if sub else 0)) + 58; h = 82 if sub else 54
    if anchor == 'r': x -= w
    if anchor == 'c': x -= w // 2
    k = 4; m = Image.new('RGBA', (w * k, h * k), (0, 0, 0, 0))
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * k - 1, h * k - 1), 16 * k, fill=(30, 35, 40, 236), outline=(255, 255, 255, 40), width=k)
    box = m.resize((w, h), Image.LANCZOS)
    sm = Image.new('L', (W, H), 0); sm.paste(box.getchannel('A'), (x, y + 10))
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 255)); sh.putalpha(sm.filter(ImageFilter.GaussianBlur(14)).point(lambda v: v // 2)); c.alpha_composite(sh)
    c.alpha_composite(box, (x, y)); d = ImageDraw.Draw(c)
    d.ellipse((x + 20, y + 21, x + 32, y + 33), fill=col)
    d.text((x + 42, y + 27), text, font=f, fill=TXT, anchor='lm')
    if sub: d.text((x + 42, y + 58), sub, font=fs, fill=SUB, anchor='lm')
    return (x, y, x + w, y + h)


def header(c, head, sub, x=96, maxw=560, ycenter=None, hsize=64):
    """Logo + 'AccessRadar', headline, GAP 24, subtitle. No gradient separator (MarginRadar v3 owner request)."""
    d = ImageDraw.Draw(c); hf = font(hsize, 'Bold'); sf = font(28, 'Regular')

    def wrap(t, f, mw):
        lines, cur = [], ''
        for wd in t.split():
            tt = (cur + ' ' + wd).strip()
            if d.textlength(tt, font=f) <= mw: cur = tt
            else: lines.append(cur); cur = wd
        return lines + [cur]
    hl, sl = wrap(head, hf, maxw), wrap(sub, sf, maxw - 20); lh = int(hsize * 1.14)
    y = (ycenter or H // 2) - (52 + 44 + len(hl) * lh + GAP + len(sl) * 40) // 2
    c.alpha_composite(logo(52), (x, y)); d.text((x + 68, y + 26), 'AccessRadar', font=font(26, 'SemiBold'), fill=(222, 228, 234), anchor='lm')
    y += 52 + 44
    for l in hl: d.text((x, y), l, font=hf, fill=TXT); y += lh
    y += GAP
    for l in sl: d.text((x, y), l, font=sf, fill=SUB); y += 40


def save(c, name):
    o = c.convert('RGB'); o.save(os.path.join(OUT, name), optimize=True); print(name, o.size)
