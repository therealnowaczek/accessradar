import re
logo=open('logo.svg').read()
inner=re.search(r'<svg[^>]*>(.*)</svg>',logo,re.S).group(1).replace('<title>MarginRadar</title>','')
inner=inner.replace('id="g"','id="lg"').replace('url(#g)','url(#lg)').replace('id="chic"','id="lchic"').replace('url(#chic)','url(#lchic)').replace('id="sheen"','id="lsheen"').replace('url(#sheen)','url(#lsheen)')
def mark(x,y,size): return f'<g transform="translate({x},{y}) scale({size/512})" fill="none">{inner}</g>'
TEXT='#141311'; MUTED='#4a463e'; BG='#fafaf8'; BORDER='#ebe6e1'; STRONG='#cfc8c0'
AMB='#FFB547'; COR='#FF5B3A'; CRIM='#B0124A'; DOT='#D3264A'
SERIF="'Source Serif 4', Georgia, serif"; SANS="'Source Sans 3', Helvetica, Arial, sans-serif"
W,H=1120,548
cx,cy,cw,ch=632,76,424,396
px0,px1=cx+44,cx+cw-30; py0,py1=cy+76,cy+ch-56
X=lambda t: px0+(px1-px0)*t/12
Y=lambda v: py1-(py1-py0)*v/120
budget=100
actual=[(0,0),(1,6),(2,13),(3,21),(4,30),(5,40),(6,49),(7,60)]
fc=[(7,60),(8,71),(9,83),(10,95),(11,107),(12,118)]
tc=10+(budget-95)/12
P=lambda L:' '.join(f'{X(t):.1f},{Y(v):.1f}' for t,v in L)
area=f'M{X(0):.1f},{Y(0):.1f} L'+P(actual)+f' L{X(7):.1f},{Y(0):.1f} Z'
over='M'+P([(tc,budget)]+[p for p in fc if p[0]>tc])+f' L{X(12):.1f},{Y(budget):.1f} Z'
grid=''.join(f'<line x1="{px0}" x2="{px1}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="{BORDER}"/>' for v in (25,50,75))
ticks=''.join(f'<line x1="{X(t):.1f}" x2="{X(t):.1f}" y1="{py1}" y2="{py1+6}" stroke="{STRONG}" stroke-width="1.5"/>' for t in range(0,13,2))
mx,my=X(tc),Y(budget)
defs=f'''<defs>
<linearGradient id="burn" x1="{X(0)}" y1="0" x2="{X(12)}" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="{AMB}"/><stop offset=".55" stop-color="{COR}"/><stop offset="1" stop-color="{CRIM}"/></linearGradient>
<linearGradient id="area" x1="0" y1="{Y(60)}" x2="0" y2="{py1}" gradientUnits="userSpaceOnUse"><stop stop-color="{COR}" stop-opacity=".22"/><stop offset="1" stop-color="{AMB}" stop-opacity=".04"/></linearGradient>
<linearGradient id="pill" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{COR}"/><stop offset="1" stop-color="{CRIM}"/></linearGradient>
<linearGradient id="rule" x1="0" y1="0" x2="1" y2="0"><stop stop-color="{AMB}"/><stop offset=".5" stop-color="{COR}"/><stop offset="1" stop-color="{CRIM}"/></linearGradient>
<radialGradient id="glow" cx="{mx}" cy="{my}" r="140" gradientUnits="userSpaceOnUse"><stop stop-color="{COR}" stop-opacity=".10"/><stop offset="1" stop-color="{COR}" stop-opacity="0"/></radialGradient>
</defs>'''
chart=f'''
<rect x="{cx}" y="{cy}" width="{cw}" height="{ch}" rx="16" fill="#fff" stroke="{BORDER}" stroke-width="1.5"/>
<text x="{cx+30}" y="{cy+44}" font-family="{SANS}" font-weight="600" font-size="15" letter-spacing="1.4" fill="{MUTED}">PROJECT BURN</text>
<g font-family="{SANS}" font-size="15" fill="{MUTED}">
 <line x1="{cx+cw-196}" x2="{cx+cw-176}" y1="{cy+39}" y2="{cy+39}" stroke="{COR}" stroke-width="4" stroke-linecap="round"/>
 <text x="{cx+cw-168}" y="{cy+44}">Actual</text>
 <line x1="{cx+cw-108}" x2="{cx+cw-88}" y1="{cy+39}" y2="{cy+39}" stroke="{CRIM}" stroke-width="3" stroke-dasharray="5 4"/>
 <text x="{cx+cw-80}" y="{cy+44}">Forecast</text>
</g>
{grid}
<line x1="{px0}" x2="{px1}" y1="{py1}" y2="{py1}" stroke="{STRONG}" stroke-width="1.5"/>
{ticks}
<path d="{area}" fill="url(#area)"/>
<path d="{over}" fill="{CRIM}" fill-opacity=".10"/>
<line x1="{px0}" x2="{px1}" y1="{my:.1f}" y2="{my:.1f}" stroke="{TEXT}" stroke-opacity=".7" stroke-width="2.5"/>
<text x="{px0}" y="{my-12:.1f}" font-family="{SANS}" font-weight="600" font-size="16" fill="{MUTED}">Budget</text>
<line x1="{X(7):.1f}" x2="{X(7):.1f}" y1="{my+18:.1f}" y2="{py1}" stroke="{STRONG}" stroke-width="1.5" stroke-dasharray="3 4"/>
<text x="{X(7):.1f}" y="{py1+30}" text-anchor="middle" font-family="{SANS}" font-size="15" fill="{MUTED}">Today</text>
<polyline points="{P(fc)}" fill="none" stroke="{CRIM}" stroke-width="3.5" stroke-dasharray="7 6" stroke-linecap="round"/>
<polyline points="{P(actual)}" fill="none" stroke="url(#burn)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
<circle cx="{X(7):.1f}" cy="{Y(60):.1f}" r="6.5" fill="{COR}" stroke="#fff" stroke-width="2.5"/>
<line x1="{mx:.1f}" x2="{mx:.1f}" y1="{my:.1f}" y2="{py1}" stroke="{CRIM}" stroke-opacity=".45" stroke-width="2"/>
<circle cx="{mx:.1f}" cy="{my:.1f}" r="30" stroke="{DOT}" stroke-opacity=".22" stroke-width="3" fill="none"/>
<circle cx="{mx:.1f}" cy="{my:.1f}" r="19" stroke="{DOT}" stroke-opacity=".4" stroke-width="3" fill="#fff"/>
<circle cx="{mx:.1f}" cy="{my:.1f}" r="9" fill="{DOT}" stroke="#fff" stroke-width="3"/>
<g transform="translate({mx-136:.1f},{my-58:.1f})">
 <rect width="102" height="34" rx="17" fill="url(#pill)"/>
 <text x="51" y="23" text-anchor="middle" font-family="{SANS}" font-weight="600" font-size="16" fill="#fff">Run-out</text>
</g>
<text x="{mx:.1f}" y="{py1+30}" text-anchor="middle" font-family="{SANS}" font-weight="600" font-size="15" fill="{CRIM}">Wk 10</text>
'''
lx=72
left=f'''
{mark(lx,96,104)}
<text x="{lx-3}" y="292" font-family="{SERIF}" font-weight="600" font-size="78" letter-spacing="-2" fill="{TEXT}">MarginRadar</text>
<text x="{lx}" y="336" font-family="{SANS}" font-size="27" fill="{MUTED}">by Radrly</text>
<rect x="{lx}" y="370" width="72" height="4" rx="2" fill="url(#rule)"/>
<text font-family="{SANS}" font-weight="600" font-size="31" fill="{TEXT}">
 <tspan x="{lx}" y="420">Budgets, burn &amp; margin for Jira —</tspan>
 <tspan x="{lx}" y="460">see overruns coming</tspan>
</text>'''
open('banner.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{defs}<rect width="{W}" height="{H}" fill="{BG}"/>{left}{chart}</svg>')
