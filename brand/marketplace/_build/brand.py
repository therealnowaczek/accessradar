"""Logo 144x144 and banner 1120x548 for AccessRadar, in the MarginRadar banner layout
(mark, name, 'by Radrly', accent rule, two-line functionality line on the left; product visual card on the right).
Run: python3 brand/marketplace/_build/brand.py  -> brand/marketplace/logo-144.png, banner-1120x548.png,
banner-1120x548-gradient.png (variant: full brand gradient background, white text)."""
import os
from PIL import Image, ImageDraw
from common import MKT, K, BLUE, INDIGO, VIOLET, font, gradient, logo, rounded_mask

TEXT = (23, 43, 77); MUTED = (68, 84, 111); BG = (248, 249, 251); BORDER = (220, 223, 228); SUBTLE = (98, 111, 134)
W, H = 1120, 548


def save(img, name):
    p = os.path.join(MKT, name); img.save(p, optimize=True); print(name, img.size)


def pill(d, xy, text, f, fg, bg, pad=12, h=30):
    x, y = xy; w = d.textlength(text, font=f) + 2 * pad
    d.rounded_rectangle((x, y, x + w, y + h), h // 2, fill=bg)
    d.text((x + pad, y + h / 2), text, font=f, fill=fg, anchor='lm')
    return x + w


def why_card(dark=False):
    """Right-hand visual: the 'Why' path for one grant, as in Explore -> Projects -> Why? (fictional demo data)."""
    cw, ch = 424, 396
    S = Image.new('RGBA', (cw * K, ch * K), (0, 0, 0, 0)); d = ImageDraw.Draw(S)
    d.rounded_rectangle((0, 0, cw * K - 1, ch * K - 1), 16 * K, fill=(255, 255, 255, 255), outline=BORDER + (255,), width=int(1.5 * K))
    f = lambda sz, st='Regular': font(sz * K, st)
    X = lambda v: v * K
    d.text((X(30), X(44)), 'WHY · PAY', font=f(15, 'SemiBold'), fill=MUTED, anchor='ls')
    pill(d, (X(cw - 30) - d.textlength('Edit issues', font=f(15, 'SemiBold')) - X(24), X(26)), 'Edit issues', f(15, 'SemiBold'), (0, 85, 204), (233, 242, 255), pad=X(12), h=X(28))
    # subject row
    d.ellipse((X(30), X(70), X(70), X(110)), fill=(64, 50, 148))
    d.text((X(50), X(90)), 'RN', font=f(15, 'Bold'), fill='white', anchor='mm')
    d.text((X(84), X(84)), 'Riley Novak', font=f(19, 'SemiBold'), fill=TEXT, anchor='ls')
    d.text((X(84), X(105)), 'New since snapshot #12', font=f(14), fill=SUBTLE, anchor='ls')
    # path: group -> role -> scheme
    steps = [('Group', 'contractors', VIOLET), ('Project role', 'Developers', INDIGO), ('Permission scheme', 'PAY permission scheme', BLUE)]
    y0 = 138; step = 56
    lx = X(48)
    L = K * step * (len(steps) - 1)
    col = Image.new('RGBA', (K * 4, L), (0, 0, 0, 0))
    for i in range(L):
        t = i / (L - 1); a, b, u = (VIOLET, INDIGO, t / .5) if t < .5 else (INDIGO, BLUE, (t - .5) / .5)
        ImageDraw.Draw(col).line((0, i, K * 4, i), fill=tuple(int(a[k] + (b[k] - a[k]) * u) for k in range(3)) + (255,))
    S.alpha_composite(col, (lx - 2 * K, X(y0 + 14)))
    for i, (lab, val, c) in enumerate(steps):
        yy = y0 + i * step
        d.ellipse((lx - X(13), X(yy) + X(1), lx + X(13), X(yy) + X(27)), fill='white', outline=c + (255,), width=X(3))
        d.ellipse((lx - X(6), X(yy) + X(8), lx + X(6), X(yy) + X(20)), fill=c + (255,))
        d.text((X(76), X(yy) + X(9)), lab.upper(), font=f(12, 'SemiBold'), fill=SUBTLE, anchor='ls')
        d.text((X(76), X(yy) + X(33)), val, font=f(19, 'SemiBold'), fill=TEXT, anchor='ls')
    # evidence row
    d.line((X(30), X(ch - 84), X(cw - 30), X(ch - 84)), fill=BORDER + (255,), width=K)
    d.text((X(30), X(ch - 52)), 'Evidence hash (SHA-256)', font=f(13, 'SemiBold'), fill=SUBTLE, anchor='ls')
    d.text((X(30), X(ch - 28)), '4f1c9a7e…d2b05e83', font=font(17 * K, 'Regular'), fill=TEXT, anchor='ls')
    pill(d, (X(cw - 30) - d.textlength('SIGNED', font=f(13, 'Bold')) - X(24), X(ch - 60)), 'SIGNED', f(13, 'Bold'), (33, 110, 78), (220, 255, 241), pad=X(12), h=X(28))
    return S.resize((cw, ch), Image.LANCZOS)


def banner(variant='light'):
    if variant == 'gradient':
        c = gradient(W, H).convert('RGBA'); fg, sub = (255, 255, 255), (234, 236, 250)
    else:
        c = Image.new('RGBA', (W, H), BG + (255,)); fg, sub = TEXT, MUTED
    d = ImageDraw.Draw(c); lx = 72
    mark = logo(104)
    c.alpha_composite(mark, (lx, 96))
    d.text((lx - 3, 292), 'AccessRadar', font=font(76, 'Bold'), fill=fg, anchor='ls')
    d.text((lx, 336), 'by Radrly', font=font(27), fill=sub, anchor='ls')
    rule = gradient(72, 4, diagonal=False) if variant != 'gradient' else Image.new('RGB', (72, 4), 'white')
    rule = rule.convert('RGBA'); rule.putalpha(rounded_mask(72, 4, 2)); c.alpha_composite(rule, (lx, 370))
    tf = font(31, 'SemiBold')
    d.text((lx, 420), 'Who has access in Jira, and why.', font=tf, fill=fg, anchor='ls')
    d.text((lx, 460), 'Read-only access reviews', font=tf, fill=fg, anchor='ls')
    card = why_card()
    # soft shadow under the card
    sm = Image.new('L', (W, H), 0); sm.paste(rounded_mask(424, 396, 16).point(lambda v: v // 4), (632, 76 + 10))
    from PIL import ImageFilter
    sm = sm.filter(ImageFilter.GaussianBlur(18)); shd = Image.new('RGBA', (W, H), (9, 30, 66, 255)); shd.putalpha(sm)
    c.alpha_composite(shd); c.alpha_composite(card, (632, 76))
    return c.convert('RGB')


if __name__ == '__main__':
    save(logo(144), 'logo-144.png')
    save(banner('light'), 'banner-1120x548.png')
    save(banner('gradient'), 'banner-1120x548-gradient.png')
