GRAD='<linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"><stop stop-color="#FFB547"/><stop offset=".5" stop-color="#FF5B3A"/><stop offset="1" stop-color="#B0124A"/></linearGradient>'
MARK='''<path d="M80,212 H432" stroke="#fff" stroke-opacity=".75" stroke-width="24" stroke-linecap="round"/>
<circle cx="338" cy="212" r="64" stroke="#fff" stroke-opacity=".38" stroke-width="12"/>
<circle cx="338" cy="212" r="102" stroke="#fff" stroke-opacity=".18" stroke-width="10"/>
<path d="M96,410 C160,396 214,350 252,306" stroke="#fff" stroke-width="44" stroke-linecap="round"/>
<circle cx="283.3" cy="271.5" r="16" fill="#fff"/><circle cx="376.2" cy="169.5" r="16" fill="#fff"/><circle cx="413.9" cy="128.1" r="16" fill="#fff"/>
<circle cx="338" cy="212" r="32" fill="#fff"/>'''
logo=f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
<title>MarginRadar</title>
<defs>{GRAD}
<clipPath id="chic"><rect width="512" height="512" rx="116"/></clipPath>
<radialGradient id="sheen" cx="0.25" cy="0" r="1.1"><stop stop-color="#fff" stop-opacity=".18"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<g clip-path="url(#chic)">
<rect width="512" height="512" fill="url(#g)"/>
<rect width="512" height="512" fill="url(#sheen)"/>
{MARK}
<circle cx="338" cy="212" r="14" fill="#D3264A"/>
</g>
<rect x="1" y="1" width="510" height="510" rx="115" stroke="#000" stroke-opacity=".08" stroke-width="2"/>
</svg>'''
open('logo.svg','w').write(logo)
VB='62 98 390 342'
def markonly(fill,defs=''):
    MK=MARK.replace('stroke-opacity=".38"','stroke-opacity=".5"').replace('stroke-opacity=".18"','stroke-opacity=".28"')
    # mask: white shapes, black hole for the centre dot
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="780" height="684" viewBox="{VB}" fill="none">
<title>MarginRadar mark</title>
<defs>{defs}
<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">{MK}<circle cx="338" cy="212" r="14" fill="#000"/></mask>
</defs>
<rect x="0" y="0" width="512" height="512" fill="{fill}" mask="url(#m)"/>
</svg>'''
open('logo-mark-white.svg','w').write(markonly('#fff'))
open('logo-mark-gradient.svg','w').write(markonly('url(#g)',GRAD.replace('x1="0" y1="0" x2="512" y2="512"','x1="62" y1="98" x2="452" y2="440"')))
