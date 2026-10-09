"""Highlight images 1840x900, MarginRadar v3 method (marginradar-shots/highlights/_build/make.py, build_v3):
dark #161A1D canvas with soft glows in the brand palette, logo + 'AccessRadar', headline and subtitle on the left
(no gradient separator under the title, GAP 24), and a REAL 2x screenshot crop placed 1:1 (no scaling) on a white
card r=8 with a 1px #EBEBEB border, supersampled 4x.
Inputs: brand/marketplace/shots/<name>.png (see shots/README.md). Output: brand/marketplace/highlight-*.png
Run: python3 brand/marketplace/_build/make.py            (all three)
     python3 brand/marketplace/_build/make.py 2         (only highlight 2)"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter
from common import OUT, BLUE, INDIGO, VIOLET, font, logo, card, shot, rounded_mask
from texts import HIGHLIGHTS

W, H = 1840, 900; BG = (0x16, 0x1A, 0x1D); GAP = 24
TXT = (240, 243, 245); SUB = (159, 173, 188); NAME = (222, 228, 234)


def base():
    c = Image.new('RGBA', (W, H), BG + (255,))
    g = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    d.ellipse((1000, 120, 1840, 900), fill=INDIGO + (60,))
    d.ellipse((-200, -260, 560, 360), fill=BLUE + (34,))
    d.ellipse((1500, -200, 2100, 300), fill=VIOLET + (44,))
    return Image.alpha_composite(c, g.filter(ImageFilter.GaussianBlur(170)))


def render(src, headline, sub, name, area=(650, 60, 1780, 840)):
    canvas = base()
    ax0, ay0, ax1, ay1 = area
    big = card(src)                                   # 1:1 pixels, white card r=8, 1px #EBEBEB
    if big.width > ax1 - ax0 or big.height > ay1 - ay0:
        raise SystemExit(f'{name}: crop {big.size} is larger than the area {ax1-ax0}x{ay1-ay0}; crop tighter in texts.py (no downscaling)')
    x = ax0 + (ax1 - ax0 - big.width) // 2; y = (H - big.height) // 2
    sm = Image.new('L', (W, H), 0)
    sm.paste(rounded_mask(*big.size, 8).point(lambda v: int(v * 0.75)), (x, y + 22))
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sh.putalpha(sm.filter(ImageFilter.GaussianBlur(34)))
    canvas = Image.alpha_composite(canvas, sh); canvas.alpha_composite(big, (x, y))
    d = ImageDraw.Draw(canvas)
    tx = 96; maxw = x - tx - 60
    hf = font(60, 'Bold'); sf = font(28, 'Regular'); bf = font(26, 'SemiBold')

    def wrap(t, f):
        lines, cur = [], ''
        for wd in t.split():
            tt = (cur + ' ' + wd).strip()
            if d.textlength(tt, font=f) <= maxw: cur = tt
            else: lines.append(cur); cur = wd
        return lines + [cur]
    hl, sl = wrap(headline, hf), wrap(sub, sf)
    block = 52 + 40 + len(hl) * 72 + GAP + len(sl) * 40
    ty = (H - block) // 2
    canvas.alpha_composite(logo(52), (tx, ty))
    d.text((tx + 68, ty + 26), 'AccessRadar', font=bf, fill=NAME, anchor='lm')
    ty += 52 + 40
    for l in hl: d.text((tx, ty), l, font=hf, fill=TXT); ty += 72
    ty += GAP                                            # no gradient separator (MarginRadar v3)
    for l in sl: d.text((tx, ty), l, font=sf, fill=SUB); ty += 40
    out = canvas.convert('RGB'); out.save(os.path.join(OUT, name), optimize=True)
    print(name, out.size, 'shot %dx%d (1:1)' % big.size)


if __name__ == '__main__':
    pick = [int(a) for a in sys.argv[1:]] or [1, 2, 3]
    for i in pick:
        fname, src, crop, title, sub = HIGHLIGHTS[i - 1]
        im = shot(src)
        render(im.crop(crop) if crop else im, title, sub, fname)
