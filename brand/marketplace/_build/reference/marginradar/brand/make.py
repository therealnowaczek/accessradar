import re, subprocess
src=open('marginradar.svg').read()
inner=re.search(r'<svg[^>]*>(.*)</svg>',src,re.S).group(1)
def mark(x,y,size,rx=0):
    s=size/256
    clip=f'<clipPath id="mc"><rect width="256" height="256" rx="{rx}"/></clipPath>'
    return f'<defs>{clip}</defs><g transform="translate({x},{y}) scale({s})" clip-path="url(#mc)">{inner}</g>'
TEXT='#141311'; MUTED='#4a463e'; BG='#fafaf8'; BORDER='#e4e1d8'; STRONG='#c5c0b4'
WARN='#5c4518'; WARNBG='#f5ecda'; WARNB='#d4bf8a'
SERIF="'Source Serif 4', 'Source Serif Pro', Georgia, serif"
SANS="'Source Sans 3', 'Source Sans Pro', Helvetica, Arial, sans-serif"
W,H=1120,548
# chart card geometry
cx,cy,cw,ch=632,76,424,396
px0,px1=cx+44,cx+cw-30   # plot x
py0,py1=cy+76,cy+ch-56   # plot top/bottom
def X(t): return px0+(px1-px0)*t/12
def Y(v): return py1-(py1-py0)*v/120
budget=100
actual=[(0,0),(1,6),(2,13),(3,21),(4,30),(5,40),(6,49),(7,60)]
fc=[(7,60),(8,71),(9,83),(10,95),(11,108),(12,118)]
# crossing between 10 and 11
t_cross=10+(budget-95)/(108-95)
pts=lambda L:' '.join(f'{X(t):.1f},{Y(v):.1f}' for t,v in L)
area_actual=f'M{X(0):.1f},{Y(0):.1f} L'+pts(actual)+f' L{X(7):.1f},{Y(0):.1f} Z'
over=[(t_cross,budget)]+[p for p in fc if p[0]>t_cross]
area_over='M'+pts(over)+f' L{X(12):.1f},{Y(budget):.1f} Z'
grid=''.join(f'<line x1="{px0}" x2="{px1}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="{BORDER}" stroke-width="1"/>' for v in (25,50,75))
ticks=''.join(f'<line x1="{X(t):.1f}" x2="{X(t):.1f}" y1="{py1}" y2="{py1+6}" stroke="{STRONG}" stroke-width="1.5"/>' for t in range(0,13,2))
chart=f'''
<rect x="{cx}" y="{cy}" width="{cw}" height="{ch}" rx="14" fill="#ffffff" stroke="{BORDER}" stroke-width="1.5"/>
<text x="{cx+30}" y="{cy+44}" font-family="{SANS}" font-weight="600" font-size="15" letter-spacing="1.4" fill="{MUTED}">PROJECT BURN</text>
<g font-family="{SANS}" font-size="15" fill="{MUTED}">
 <line x1="{cx+cw-196}" x2="{cx+cw-176}" y1="{cy+39}" y2="{cy+39}" stroke="{TEXT}" stroke-width="4" stroke-linecap="round"/>
 <text x="{cx+cw-168}" y="{cy+44}">Actual</text>
 <line x1="{cx+cw-108}" x2="{cx+cw-88}" y1="{cy+39}" y2="{cy+39}" stroke="{TEXT}" stroke-width="3" stroke-dasharray="5 4"/>
 <text x="{cx+cw-80}" y="{cy+44}">Forecast</text>
</g>
{grid}
<line x1="{px0}" x2="{px1}" y1="{py1}" y2="{py1}" stroke="{STRONG}" stroke-width="1.5"/>
{ticks}
<path d="{area_actual}" fill="{TEXT}" fill-opacity=".06"/>
<path d="{area_over}" fill="{WARNBG}"/>
<!-- budget -->
<line x1="{px0}" x2="{px1}" y1="{Y(budget):.1f}" y2="{Y(budget):.1f}" stroke="{MUTED}" stroke-width="2.5"/>
<text x="{px0}" y="{Y(budget)-12:.1f}" font-family="{SANS}" font-weight="600" font-size="16" fill="{MUTED}">Budget</text>
<!-- today -->
<line x1="{X(7):.1f}" x2="{X(7):.1f}" y1="{Y(budget)+18:.1f}" y2="{py1}" stroke="{STRONG}" stroke-width="1.5" stroke-dasharray="3 4"/>
<text x="{X(7):.1f}" y="{py1+30}" text-anchor="middle" font-family="{SANS}" font-size="15" fill="{MUTED}">Today</text>
<polyline points="{pts(fc)}" fill="none" stroke="{TEXT}" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/>
<polyline points="{pts(actual)}" fill="none" stroke="{TEXT}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
<circle cx="{X(7):.1f}" cy="{Y(60):.1f}" r="6" fill="{TEXT}" stroke="#fff" stroke-width="2.5"/>
<!-- run-out marker -->
<line x1="{X(t_cross):.1f}" x2="{X(t_cross):.1f}" y1="{Y(budget):.1f}" y2="{py1}" stroke="{WARNB}" stroke-width="2"/>
<circle cx="{X(t_cross):.1f}" cy="{Y(budget):.1f}" r="13" fill="{WARNBG}" stroke="{WARNB}" stroke-width="2"/>
<circle cx="{X(t_cross):.1f}" cy="{Y(budget):.1f}" r="6.5" fill="{WARN}"/>
<g transform="translate({X(t_cross)-122:.1f},{Y(budget)-52:.1f})">
 <rect width="100" height="34" rx="17" fill="{WARN}"/>
 <text x="50" y="23" text-anchor="middle" font-family="{SANS}" font-weight="600" font-size="16" fill="#fafaf8">Run-out</text>
</g>
<text x="{X(t_cross):.1f}" y="{py1+30}" text-anchor="middle" font-family="{SANS}" font-weight="600" font-size="15" fill="{WARN}">Wk 10</text>
'''
lx=72
left=f'''
{mark(lx,100,96,rx=20)}
<text x="{lx}" y="290" font-family="{SERIF}" font-weight="600" font-size="78" letter-spacing="-2" fill="{TEXT}">MarginRadar</text>
<text x="{lx+2}" y="334" font-family="{SANS}" font-weight="400" font-size="27" fill="{MUTED}">by Radrly</text>
<line x1="{lx}" x2="{lx+64}" y1="372" y2="372" stroke="{TEXT}" stroke-width="2"/>
<text font-family="{SANS}" font-weight="600" font-size="31" fill="{TEXT}">
 <tspan x="{lx}" y="418">Budgets, burn &amp; margin for Jira —</tspan>
 <tspan x="{lx}" y="458">see overruns coming</tspan>
</text>
'''
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<rect width="{W}" height="{H}" fill="{BG}"/>
{left}{chart}
</svg>'''
open('build/banner.svg','w').write(svg)
