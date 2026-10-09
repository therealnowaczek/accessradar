import sys; sys.path.insert(0,'/workspace/marginradar-shots/gallery-v3/_build')
from gallery import *

def fade_bottom(img,n=30):
    m=Image.new('L',img.size,0); d=ImageDraw.Draw(m)
    for i in range(n): d.line((0,img.height-n+i,img.width,img.height-n+i),fill=int(255*(i/(n-1))**1.4))
    return Image.composite(Image.new('RGB',img.size,'white'),img.convert('RGB'),m)

# ---------- 1. Portfolio
def v1():
    c=base()
    f4=Image.open(S+'04_RET_MarginRadar_92pct_hours_warning.png').convert('RGB')
    r4=uncursor(Image.open(V2+'04_RET_hours_92pct_usage.png').convert('RGB'),383,251)
    ret=Image.new('RGB',(812,206+232),'white')
    ret.paste(f4.crop((10,112,822,318)),(0,0)); ret.paste(r4.crop((0,190,808,424)),(2,206))
    ret.save(B+'v1_ret_panel.png')
    web=uncursor(Image.open(V2+'02_summary_cards_usage_bars.png').convert('RGB'),383,251)
    webc=white_card(web,pad=14,r=18); retc=white_card(ret,pad=10,r=18)
    header(c,"Every project's budget at a glance","Money or hours budgets per project, with live usage, margin and a status that warns you early.",maxw=505,hsize=60,grad_words=('glance',))
    mw=place(c,scale(webc,0.9),990,95,angle=3,glow=(RED,90))
    sR=0.9; mr=place(c,scale(retc,sR),630,420,angle=-2.5,glow=(AMBER,70))
    ov=Overlay()
    p92=mr((10+780)*sR,(10+206+165)*sR)
    ov.curve((1420,724),(p92[0]+8,p92[1]+2),bend=-0.25,col=RED)
    ov.apply(c)
    chip(c,1000,30,'WEB · Northwind Website Rebuild',sub='85% of money budget used · margin 32.3%',col=AMBER)
    chip(c,1810,640,'RET · Acme Support Retainer Q4',sub='92% of hours budget → Warning',col=RED,anchor='r')
    save(c,'gallery-1-portfolio-at-a-glance-1840x900.png')

# ---------- 2. Issue panel
def v2():
    c=base([((700,100,1900,1100),RED,70),((-250,-300,600,380),AMBER,34),((1450,-260,2150,320),MAG,60)])
    f5=Image.open(S+'05_WEB-9_MarginRadar_issue_panel.png').convert('RGB')
    bgj=f5.crop((0,84,1280,800))
    bgj=scale(bgj,1.0).filter(ImageFilter.GaussianBlur(4)); bgj=ImageEnhance.Brightness(bgj).enhance(0.55)
    bgj=rounded(bgj,22)
    place(c,bgj,700,120,angle=0,sh_alpha=180)
    panel=f5.crop((22,408,790,800)); panel=fade_bottom(panel,26); panel.save(B+'v2_issue_panel.png')
    s=1.04; pc=scale(white_card(panel,pad=12,r=20),s)
    mp=place(c,pc,700,260,angle=-2,glow=(RED,120))
    P=lambda u,v: mp((12+u-22)*s,(12+v-408)*s)
    ov=Overlay()
    cost=P(200,560); marg=P(560,640); epic=P(740,773)
    ov.curve((1300,150),(cost[0]+60,cost[1]-30),bend=0.3,col=AMBER)
    ov.curve((1600,470),(marg[0]+120,marg[1]-10),bend=-0.25,col=RED)
    ov.curve((1400,800),(epic[0]+5,epic[1]+12),bend=0.25,col=CRIM)
    ov.apply(c)
    chip(c,1290,70,'Cost from worklogs × rates',sub='WEB-9: $4,060.00 for 58 h',col=AMBER)
    chip(c,1810,470,'Margin per issue',sub='$2,320.00 on $6,380.00 billable',col=RED,anchor='r')
    chip(c,1810,790,'Parent epic WEB-6 at 171% of budget',col=CRIM,anchor='r')
    header(c,'Cost and margin on every issue','The MarginRadar panel shows cost, hours, billable and margin right on the issue, plus how its epic is tracking.',maxw=540,grad_words=('every','issue'))
    save(c,'gallery-2-issue-cost-margin-1840x900.png')

# ---------- 3. Rate cards
def v3():
    c=base([((800,80,1900,1000),MAG,60),((1000,300,1800,1000),RED,60),((-250,-300,600,380),AMBER,34)])
    f7=Image.open(S+'07_MarginRadar_admin_role_rates.png').convert('RGB')
    d=ImageDraw.Draw(f7)
    d.rectangle((262,379,306,405),fill=(203,226,253))       # remove hand pointer over "Roles"
    d.text((265,395),'Roles',font=font(14,'Regular'),fill=(24,96,196),anchor='ls')
    f7.save(B+'v3_07_clean.png')
    table=f7.crop((490,112,1262,492))
    nav=f7.crop((243,330,478,488))
    s=1.25; tc=scale(white_card(table,pad=16,r=20),s)
    mt=place(c,tc,770,60,angle=0,glow=(RED,90))
    T=lambda u,v: mt((16+u-490)*s,(16+v-112)*s)
    ncard=scale(white_card(nav,pad=14,r=16),1.4)
    place(c,ncard,680,560,angle=-4,glow=(AMBER,110))
    z=f7.crop((1010,200,1200,300)); zc=white_card(scale(z,1.8),pad=10,r=18)
    zx,zy=1070,620
    ov=Overlay()
    a_=T(1012,206); b_=T(1200,300)
    ov.ring((a_[0]-6,a_[1]-4,b_[0]+6,b_[1]+6),col=AMBER,w=3,r=12)
    ov.curve((b_[0]+8,(a_[1]+b_[1])/2),(zx+zc.width-30,zy+4),bend=-0.35,col=AMBER,dot=False)
    ov.apply(c)
    place(c,zc,zx,zy,angle=2,glow=(AMBER,140))
    chip(c,1815,700,'Effective-dated rates',sub='every rate has a start date',col=AMBER,anchor='r')
    chip(c,680,836,'Rates by role, user and project',col=RED)
    header(c,'Rate cards that match how you bill','Hourly cost and billable rates by role, person or project. People inherit them from their role.',maxw=540,grad_words=('Rate','cards'))
    save(c,'gallery-3-rate-cards-1840x900.png')

# ---------- 4. Trust
def icon(kind,size=64):
    k=4; S_=size*k; im=Image.new('RGBA',(S_,S_),(0,0,0,0))
    g=grad(S_,S_).convert('RGBA'); m=Image.new('L',(S_,S_),0); ImageDraw.Draw(m).rounded_rectangle((0,0,S_-1,S_-1),18*k,fill=255); g.putalpha(m); im.alpha_composite(g)
    d=ImageDraw.Draw(im); w=5*k; col=(255,255,255,255); C=S_/2
    if kind=='egress':   # cloud-ish box with outward arrow crossed out
        d.rounded_rectangle((C-60,C-34,C+24,C+40),10*k//4,outline=col,width=w)
        d.line((C-10,C+2,C+64,C-58),fill=col,width=w); d.line((C+30,C-58,C+64,C-58,C+64,C-24),fill=col,width=w)
        d.line((C-80,C+70,C+80,C-70),fill=(255,255,255,255),width=w)
    if kind=='pin':
        d.ellipse((C-48,C-74,C+48,C+22),outline=col,width=w); d.polygon([(C-40,C-4),(C+40,C-4),(C,C+76)],fill=col)
        d.ellipse((C-48+w,C-74+w,C+48-w,C+22-w),fill=None); d.ellipse((C-18,C-44,C+18,C-8),fill=col)
    if kind=='eye':
        d.arc((C-84,C-70,C+84,C+90),200,340,fill=col,width=w); d.arc((C-84,C-90,C+84,C+70),20,160,fill=col,width=w)
        d.ellipse((C-26,C-26,C+26,C+26),fill=col)
    if kind=='log':
        d.rounded_rectangle((C-56,C-76,C+56,C+76),12,outline=col,width=w)
        for i,yy in enumerate((-40,-8,24)): d.line((C-30,C+yy,C+30 if i<2 else C+6,C+yy),fill=col,width=w)
        d.line((C+10,C+50,C+24,C+64,C+50,C+36),fill=col,width=w)
    return im.resize((size,size),Image.LANCZOS)

def tile(w,h,kind,title,body):
    k=4; t=Image.new('RGBA',(w*k,h*k),(0,0,0,0)); d=ImageDraw.Draw(t)
    d.rounded_rectangle((0,0,w*k-1,h*k-1),22*k,fill=(29,33,37,235),outline=(255,255,255,34),width=k)
    t=t.resize((w,h),Image.LANCZOS); t.alpha_composite(icon(kind),(32,32))
    d=ImageDraw.Draw(t); d.text((32,124),title,font=font(28,'Bold'),fill=TXT)
    f=font(22,'Regular'); y=170; line=''
    for wd in body.split():
        tt=(line+' '+wd).strip()
        if d.textlength(tt,font=f)<=w-64: line=tt
        else: d.text((32,y),line,font=f,fill=SUB); y+=32; line=wd
    d.text((32,y),line,font=f,fill=SUB)
    return t

def v4():
    c=base([((1000,0,1900,700),RED,60),((900,500,1700,1200),MAG,55),((-250,-300,600,380),AMBER,34)])
    f7=Image.open(S+'07_MarginRadar_admin_role_rates.png').convert('RGB')
    head=f7.crop((243,138,478,190)); gov=f7.crop((243,500,478,733))
    snip=Image.new('RGB',(235,52+233+6),'white'); snip.paste(head,(0,0)); snip.paste(gov,(0,58))
    snip.save(B+'v4_settings_snippet.png')
    sc=scale(white_card(snip,pad=14,r=18),1.35)
    tiles=[('egress','No data egress','Built on Forge. MarginRadar makes no calls outside Atlassian.'),
           ('pin','Data residency','App data lives in Forge storage and follows your site\'s location.'),
           ('eye','Role-based visibility','Finance admin, PM and Viewer roles decide who sees rates and margin.'),
           ('log','Audit log','Every budget and rate change is logged. Delete app data in-app.')]
    tw,th=350,300; gx,gy=1060,136
    for i,(k_,t_,b_) in enumerate(tiles):
        x=gx+(i%2)*(tw+28); y=gy+(i//2)*(th+28)
        place(c,tile(tw,th,k_,t_,b_),x,y,shadow=True,sh_alpha=120)
    # amber rings drawn on the card itself so they rotate with it
    k=4; ring=Image.new('RGBA',(sc.width*k,sc.height*k),(0,0,0,0)); rd=ImageDraw.Draw(ring)
    for (v0,v1) in ((576,605),(659,688),(699,728)):
        y0=(14+58+v0-500)*1.35; y1=(14+58+v1-500)*1.35
        rd.rounded_rectangle((10*1.35*k,y0*k,(14+228)*1.35*k,y1*k),10*k,outline=AMBER+(255,),width=3*k)
    sc.alpha_composite(ring.resize(sc.size,Image.LANCZOS))
    place(c,sc,650,215,angle=-3,glow=(RED,130))
    header(c,'Runs on Atlassian. Your data stays there.','No egress, no outside servers. Access, audit log and data controls are built into the app settings.',maxw=520,grad_words=('Atlassian',))
    save(c,'gallery-4-runs-on-atlassian-1840x900.png')

if __name__=='__main__':
    for n in (sys.argv[1:] or ['1','2','3','4']): globals()['v'+n]()
