from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
import os
S='/workspace/marginradar-shots/'; OUT=S+'highlights/'; B=OUT+'_build/'
FONT=os.path.expanduser('~/.local/share/fonts/atlassian/AtlassianSans-latin.ttf')
W,H=1840,900; BG=(0x16,0x1A,0x1D)
BORDER=(235,235,235)
GAP=24

def font(size,style):
    f=ImageFont.truetype(FONT,size); f.set_variation_by_name(style); return f

def card(img,box,r=8):
    # anti-aliased 1px rounded outline on white
    x0,y0,x1,y1=box; k=4
    w,h=x1-x0+1,y1-y0+1
    m=Image.new('L',(w*k,h*k),0); d=ImageDraw.Draw(m)
    d.rounded_rectangle((0,0,w*k-1,h*k-1),r*k,outline=255,width=k)
    m=m.resize((w,h),Image.LANCZOS)
    img.paste(Image.new('RGB',(w,h),BORDER),(x0,y0),m)

# ---- page for highlight 2: summary + rebuilt forecast card
def page_forecast():
    s1=Image.open(S+'01_WEB_MarginRadar_summary_usage.png').convert('RGB')
    s2=Image.open(S+'02_WEB_forecast_card_runs_out_Oct18.png').convert('RGB')
    pg=Image.new("RGB",(815,575),'white'); pg.paste(s1,(0,0))
    top,bot=437,564
    card(pg,(9,top,802,bot))
    off=427
    pg.paste(s2.crop((15,17,251,117)),(10,17+off))       # title + labels
    pg.paste(s2.crop((300,17,405,117)),(784-(393-300)-1,17+off))  # values, right aligned
    # subtle amber highlight on the "Runs out" row (multiply keeps text dark)
    band=Image.new('RGB',pg.size,'white'); d=ImageDraw.Draw(band)
    d.rounded_rectangle((19,99+off-7,792,112+off+7),6,fill=(255,236,214))
    pg=ImageChops.multiply(pg,band)
    return pg

# ---- page for highlight 3: epic risk card with clean top/bottom edges
def page_epic():
    s=Image.open(S+'03_WEB_epic_risk_table.png').convert('RGB')
    pg=Image.new('RGB',(815,516),'white')
    card(pg,(9,9,802,506))
    pg.paste(s.crop((10,10,801,485)),(10,31))
    # source title is clipped by 1-2px at the top (scroll edge): redraw the same text, same font/size/baseline
    d=ImageDraw.Draw(pg); d.rectangle((20,28,140,50),fill='white')
    d.text((27,44),'Epic risk',font=font(20,'SemiBold'),fill=(23,23,23),anchor='ls')
    return pg

def render(shot,headline,sub,name,outdir=None,layout='left',maxsc=2.0,bar=True):
    outdir=outdir or OUT
    canvas=Image.new('RGB',(W,H),BG).convert('RGBA')
    # accent glows from logo palette
    glow=Image.new('RGBA',(W,H),(0,0,0,0)); g=ImageDraw.Draw(glow)
    g.ellipse((1000,120,1840,900),fill=(255,91,58,60))
    g.ellipse((-200,-260,560,360),fill=(255,181,71,28))
    g.ellipse((1500,-200,2100,300),fill=(176,18,74,40))
    glow=glow.filter(ImageFilter.GaussianBlur(170))
    canvas=Image.alpha_composite(canvas,glow)
    # screenshot area (right)
    ax0,ay0,ax1,ay1=(650,60,1780,840) if layout=='left' else (80,150,1760,860)
    sc=min((ax1-ax0)/shot.width,(ay1-ay0)/shot.height,maxsc)
    nw,nh=round(shot.width*sc),round(shot.height*sc)
    if sc>0.999 and maxsc<=1: big=shot          # v3: 1:1, untouched pixels
    elif maxsc<=1: big=shot.resize((nw,nh),Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=0.8,percent=35,threshold=2))
    else: big=shot.resize((nw,nh),Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.2,percent=45,threshold=2))
    x=ax0+(ax1-ax0-nw)//2; y=(H-nh)//2 if layout=='left' else ay0+(ay1-ay0-nh)//2
    r=18; k=4
    mask=Image.new('L',(nw*k,nh*k),0); ImageDraw.Draw(mask).rounded_rectangle((0,0,nw*k-1,nh*k-1),r*k,fill=255)
    mask=mask.resize((nw,nh),Image.LANCZOS)
    sh=Image.new('RGBA',(W,H),(0,0,0,0)); sm=Image.new('L',(W,H),0)
    sm.paste(mask.point(lambda v:v*0.75),(x,y+22)); sm=sm.filter(ImageFilter.GaussianBlur(34))
    sh.putalpha(sm); canvas=Image.alpha_composite(canvas,sh)
    canvas.paste(big.convert('RGBA'),(x,y),mask)
    d=ImageDraw.Draw(canvas)
    if layout=='top':
        logo=Image.open('/workspace/mr-assets/out/logo-144.png').convert('RGBA').resize((52,52),Image.LANCZOS)
        hx=x; cy=(y)//2+4
        canvas.alpha_composite(logo,(hx,cy-26))
        d.text((hx+68,cy),'MarginRadar',font=font(26,'SemiBold'),fill=(222,228,234),anchor='lm')
        sepx=hx+68+d.textlength('MarginRadar',font=font(26,'SemiBold'))+24
        d.rounded_rectangle((sepx,cy-16,sepx+3,cy+16),2,fill=(255,91,58))
        d.text((sepx+27,cy),headline,font=font(40,'Bold'),fill=(240,243,245),anchor='lm')
        out=canvas.convert('RGB'); out.save(outdir+name,optimize=True)
        print(name,out.size,'scale %.2f'%sc,'shot %dx%d'%(nw,nh)); return
    # left text column
    tx=96; maxw=x-tx-60
    logo=Image.open('/workspace/mr-assets/out/logo-144.png').convert('RGBA').resize((52,52),Image.LANCZOS)
    hf=font(60,'Bold'); sf=font(28,'Regular'); bf=font(26,'SemiBold')
    def wrap(t,f):
        lines=[];cur=''
        for wd in t.split():
            tt=(cur+' '+wd).strip()
            if d.textlength(tt,font=f)<=maxw: cur=tt
            else: lines.append(cur); cur=wd
        lines.append(cur); return lines
    hl=wrap(headline,hf); sl=wrap(sub,sf)
    hlh=72; slh=40
    block=52+40+len(hl)*hlh+(28 if bar else 0)+(12 if bar else GAP)+len(sl)*slh
    ty=(H-block)//2
    canvas.alpha_composite(logo,(tx,ty))
    d.text((tx+68,ty+26),'MarginRadar',font=bf,fill=(222,228,234),anchor='lm')
    ty+=52+40
    for l in hl: d.text((tx,ty),l,font=hf,fill=(240,243,245)); ty+=hlh
    if not bar:                      # v3: gradient separator bar removed (owner request)
        ty+=GAP
        for l in sl: d.text((tx,ty),l,font=sf,fill=(159,173,188)); ty+=slh
        out=canvas.convert('RGB'); out.save(outdir+name,optimize=True)
        print(name,out.size,'scale %.3f'%sc,'shot %dx%d'%(nw,nh)); return
    ty+=12
    # accent bar
    bar=Image.new('RGBA',(96,6)); 
    for i in range(96):
        t=i/95; c=(255,int(181+(91-181)*t),int(71+(58-71)*t)) if t<1 else (255,91,58)
        ImageDraw.Draw(bar).line((i,0,i,5),fill=c+(255,))
    bm=Image.new('L',(96*4,24),0); ImageDraw.Draw(bm).rounded_rectangle((0,0,383,23),12,fill=255); bar.putalpha(bm.resize((96,6),Image.LANCZOS))
    canvas.alpha_composite(bar,(tx,ty)); ty+=28
    for l in sl: d.text((tx,ty),l,font=sf,fill=(159,173,188)); ty+=slh
    out=canvas.convert('RGB'); out.save(outdir+name,optimize=True)
    print(name,out.size,'scale %.2f'%sc,'shot %dx%d'%(nw,nh))

import sys
def build_v1():
  s1=Image.open(S+'01_WEB_MarginRadar_summary_usage.png').convert('RGB')
  p2=page_forecast(); p2.save(B+'h2_composite_source.png')
  p3=page_epic(); p3.save(B+'h3_cleaned_source.png')
  render(s1,'Live cost and margin from your worklogs','Budget, spent, remaining, billable and burn per day, from native Jira worklogs.','highlight-1-cost-margin-1840x900.png')
  render(p2,'Know when the budget runs out, before it does','A 14-day forecast from your burn rate shows the run-out date and the estimate at completion.','highlight-2-forecast-1840x900.png')
  render(p3,'See which epics are over budget','Epic budgets next to delivery progress, so overruns show up while there is still time to act.','highlight-3-epic-risk-1840x900.png')

# ======================= v2 (new screenshots in marginradar-shots/v2) =======================
V2=S+'v2/'; OUT2=OUT+'v2/'

def uncursor(im,x0,y0):
    """Remove the mouse pointer (dark bbox starting x0,y0) by extending the pixels just left of it.
    Background under the pointer is either plain white or a horizontal bar, so this is exact."""
    px=im.load()
    for y in range(y0-5,y0+17):          # pointer + its soft drop shadow
        for x in range(x0-7,x0+14):
            px[x,y]=px[x0-9,y]
    return im

def v2_forecast():
    s=Image.open(V2+'01_forecast_module.png').convert('RGB')
    pg=Image.new('RGB',(414,366),'white')
    card(pg,(9,8,405,357))
    inner=s.crop((10,9,405,350)).copy()          # drops scrollbar (x>=405) and old bottom border
    d=ImageDraw.Draw(inner)
    # Rovo launcher overlapped the 'Window' value: clear it and redraw the value with the app font
    d.rectangle((335-10,302-9,404-10,349-9),fill='white')   # inner coords = src - (10,9)
    d.rectangle((390-10,240-9,404-10,349-9),fill='white')
    d.rectangle((300-10,302-9,404-10,349-9),fill='white')    # launcher shadow
    d.rectangle((0,338-9,394,349-9),fill='white')              # faint shadow row above old border
    d.text((389-10,329-9),'14 days',font=font(14,'Regular'),fill=(41,41,41),anchor='rs')
    pg.paste(inner,(10,9))
    return pg

def v2_summary(fname):
    s=Image.open(V2+fname).convert('RGB')
    return uncursor(s,383,251)

def v2_epic(full=False):
    a=Image.open(V2+'03a_epic_risk_table_top.png').convert('RGB')
    b=Image.open(V2+'03b_epic_risk_table_bottom.png').convert('RGB')
    # 03a has the pointer over the WEB-6 row; 03b shows the same WEB-6 row without it (03a y = 03b y + 179)
    a.paste(b.crop((0,0,808,101)),(0,179))
    body=a.crop((7,0,798,497))
    if full: 
        nb=Image.new('RGB',(791,497+217),'white'); nb.paste(body,(0,0)); nb.paste(b.crop((7,318,798,535)),(0,497)); body=nb
    pg=Image.new('RGB',(805,body.height+17),'white')
    card(pg,(6,6,798,body.height+10))
    pg.paste(body,(7,10))
    return pg

def v2_wide():
    s=uncursor(Image.open(V2+'05_wide_forecast_plus_usage.png').convert('RGB'),383,267)
    s=s.crop((0,4,1231,523)).copy()                  # drop top divider, scrollbar, and rows under the launcher
    px=s.load()
    for y in range(486-4,523-4):                     # clear Rovo launcher, keep card's right border
        for x in range(1180,1231):
            px[x,y]=px[x,480-4]
    # soft fade at the bottom where the page continues
    fade=Image.new('L',s.size,0); fd=ImageDraw.Draw(fade)
    for i in range(18):
        fd.line((0,s.height-18+i,s.width,s.height-18+i),fill=int(255*(i/17)**1.3))
    s=Image.composite(Image.new('RGB',s.size,'white'),s,fade)
    return s

def build_v2():
    os.makedirs(OUT2,exist_ok=True)
    f=v2_forecast(); f.save(B+'v2_h1_forecast_source.png')
    c=v2_summary('02_summary_cards_usage_bars.png'); c.save(B+'v2_h2_cost_margin_source.png')
    e=v2_epic(); e.save(B+'v2_h3_epic_top_source.png')
    ef=v2_epic(True); ef.save(B+'v2_h3_epic_full_source.png')
    r=v2_summary('04_RET_hours_92pct_usage.png'); r.save(B+'v2_g04_source.png')
    w=v2_wide(); w.save(B+'v2_g05_source.png')
    render(f,'Know when the budget runs out, before it does','A 14-day forecast from your burn rate shows the run-out date and the estimate at completion.','highlight-1-forecast-1840x900.png',OUT2)
    render(c,'Live cost and margin from your worklogs','Budget, spent, remaining, billable and burn per day, from native Jira worklogs.','highlight-2-cost-margin-1840x900.png',OUT2)
    render(e,'See which epics are over budget','Epic budgets next to delivery progress, so overruns show up while there is still time to act.','highlight-3-epic-risk-1840x900.png',OUT2)
    render(ef,'See which epics are over budget','Epic budgets next to delivery progress, so overruns show up while there is still time to act.','highlight-3-epic-risk-full-table-1840x900.png',OUT2)
    render(r,'Hours budgets for retainers','Track hours used against the hours budget, with a warning as usage passes your threshold.','gallery-04-ret-hours-92pct-1840x900.png',OUT2)
    render(w,'Budget, usage and forecast on one project page','','gallery-05-forecast-plus-usage-1840x900.png',OUT2,layout='top')

# ======================= v3 (crisp hi-DPI sources in marginradar-shots/hidpi) =======================
HI=S+'hidpi/'; OUT3=OUT+'v3/'

def v3_forecast():
    s=Image.open(HI+'web_forecast_card_2x.png').convert('RGB')
    ImageDraw.Draw(s).rectangle((617,0,s.width-1,s.height-1),fill='white')   # grey scrollbar strip at the right edge
    return s

def v3_epic():
    s=Image.open(HI+'web_epic_risk_top4_2x.png').convert('RGB')
    body=s.crop((0,0,s.width,990))                        # stop above the cut-off divider of the next row
    cap=s.crop((0,0,s.width,30)).transpose(Image.FLIP_TOP_BOTTOM)   # mirrored top edge = clean rounded card bottom
    pg=Image.new('RGB',(s.width,body.height+cap.height),'white'); pg.paste(body,(0,0)); pg.paste(cap,(0,body.height))
    return pg

def build_v3():
    os.makedirs(OUT3,exist_ok=True)
    f=v3_forecast(); f.save(B+'v3_h1_forecast_source.png')
    c=Image.open(HI+'web_summary_cards_usage_2x.png').convert('RGB'); c.save(B+'v3_h2_cost_margin_source.png')
    e=v3_epic(); e.save(B+'v3_h3_epic_source.png')
    kw=dict(outdir=OUT3,maxsc=1.0,bar=False)
    render(f,'Know when the budget runs out, before it does','A 14-day forecast from your burn rate shows the run-out date and the estimate at completion.','highlight-1-forecast-1840x900.png',**kw)
    render(c,'Live cost and margin from your worklogs','Budget, spent, remaining, billable and burn per day, from native Jira worklogs.','highlight-2-cost-margin-1840x900.png',**kw)
    render(e,'See which epics are over budget','Epic budgets next to delivery progress, so overruns show up while there is still time to act.','highlight-3-epic-risk-1840x900.png',**kw)

if __name__=='__main__':
    if 'v3' in sys.argv: build_v3()
    elif 'v2' in sys.argv: build_v2()
    else: build_v1()
