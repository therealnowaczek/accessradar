from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops, ImageEnhance
import os, math
S='/workspace/marginradar-shots/'; V2=S+'v2/'; OUT=S+'gallery-v3/'; B=OUT+'_build/'
FONT=os.path.expanduser('~/.local/share/fonts/atlassian/AtlassianSans-latin.ttf')
W,H=1840,900; BG=(0x16,0x1A,0x1D)
AMBER=(255,181,71); RED=(255,91,58); MAG=(176,18,74); CRIM=(211,38,74)
TXT=(240,243,245); SUB=(159,173,188)

def font(size,style='Regular'):
    f=ImageFont.truetype(FONT,size); f.set_variation_by_name(style); return f

def base(glows=None):
    c=Image.new('RGBA',(W,H),BG+(255,))
    g=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(g)
    for box,col,a in (glows or [((900,150,1900,1100),RED,70),((-250,-300,600,380),AMBER,34),((1450,-260,2150,320),MAG,60)]):
        d.ellipse(box,fill=col+(a,))
    g=g.filter(ImageFilter.GaussianBlur(160)); c=Image.alpha_composite(c,g)
    # faint dot grid for texture
    dots=Image.new('RGBA',(W,H),(0,0,0,0)); dd=ImageDraw.Draw(dots)
    for y in range(18,H,36):
        for x in range(18,W,36): dd.point((x,y),fill=(255,255,255,14))
    return Image.alpha_composite(c,dots)

def grad(w,h,cols=(AMBER,RED,CRIM)):
    g=Image.new('RGB',(w,1))
    for i in range(w):
        t=i/max(1,w-1)
        if t<.5: a,b,u=cols[0],cols[1],t/.5
        else: a,b,u=cols[1],cols[2],(t-.5)/.5
        g.putpixel((i,0),tuple(int(a[k]+(b[k]-a[k])*u) for k in range(3)))
    return g.resize((w,h))

def rounded(img,r):
    w,h=img.size; k=4
    m=Image.new('L',(w*k,h*k),0); ImageDraw.Draw(m).rounded_rectangle((0,0,w*k-1,h*k-1),r*k,fill=255)
    m=m.resize((w,h),Image.LANCZOS); o=img.convert('RGBA'); o.putalpha(ImageChops.multiply(o.getchannel('A'),m)); return o

def scale(img,s):
    return img.resize((round(img.width*s),round(img.height*s)),Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.1,40,2))

def place(c,img,x,y,angle=0,shadow=True,glow=None,sh_alpha=150):
    """paste RGBA img with its top-left (pre-rotation centre-preserving) at x,y; returns transformed bbox centre mapping fn"""
    if angle:
        big=img.resize((img.width*2,img.height*2),Image.LANCZOS)
        rot=big.rotate(angle,resample=Image.BICUBIC,expand=True)
        rot=rot.resize((rot.width//2,rot.height//2),Image.LANCZOS)
    else: rot=img
    cx,cy=x+img.width/2,y+img.height/2
    px,py=round(cx-rot.width/2),round(cy-rot.height/2)
    if glow:
        gl=Image.new('RGBA',(W,H),(0,0,0,0)); a=rot.getchannel('A')
        m=Image.new('L',(W,H),0); m.paste(a,(px,py)); m=m.filter(ImageFilter.GaussianBlur(40)).point(lambda v:int(v*glow[1]/255))
        gl.paste(Image.new('RGBA',(W,H),glow[0]+(255,)),(0,0),m); c.alpha_composite(gl)
    if shadow:
        m=Image.new('L',(W,H),0); m.paste(rot.getchannel('A').point(lambda v:int(v*sh_alpha/255)),(px,py+24))
        m=m.filter(ImageFilter.GaussianBlur(30)); sh=Image.new('RGBA',(W,H),(0,0,0,255)); sh.putalpha(m); c.alpha_composite(sh)
    c.alpha_composite(rot,(max(px,0),max(py,0)),(max(-px,0),max(-py,0)))
    rad=math.radians(-angle)
    def map_pt(u,v):  # point in img coords -> canvas coords
        dx,dy=u-img.width/2,v-img.height/2
        return (cx+dx*math.cos(rad)-dy*math.sin(rad), cy+dx*math.sin(rad)+dy*math.cos(rad))
    return map_pt

def white_card(img,pad=0,r=16):
    if pad:
        n=Image.new('RGB',(img.width+2*pad,img.height+2*pad),'white'); n.paste(img,(pad,pad)); img=n
    return rounded(img,r)

class Overlay:
    """supersampled vector layer for arrows/rings"""
    K=3
    def __init__(s): s.im=Image.new('RGBA',(W*s.K,H*s.K),(0,0,0,0)); s.d=ImageDraw.Draw(s.im)
    def P(s,p): return (p[0]*s.K,p[1]*s.K)
    def curve(s,p0,p1,bend=0.25,col=AMBER,w=3,head=True,dot=True):
        (x0,y0),(x1,y1)=p0,p1; mx,my=(x0+x1)/2,(y0+y1)/2; dx,dy=x1-x0,y1-y0
        cx,cy=mx-dy*bend,my+dx*bend
        pts=[((1-t)**2*x0+2*(1-t)*t*cx+t*t*x1,(1-t)**2*y0+2*(1-t)*t*cy+t*t*y1) for t in [i/60 for i in range(61)]]
        s.d.line([s.P(p) for p in pts],fill=col+(255,),width=w*s.K,joint='curve')
        if dot:
            r=7*s.K; X,Y=s.P(p1); s.d.ellipse((X-r,Y-r,X+r,Y+r),fill=col+(255,)); r2=13*s.K; s.d.ellipse((X-r2,Y-r2,X+r2,Y+r2),outline=col+(110,),width=2*s.K)
        sx,sy=s.P(pts[0]); r=4*s.K; s.d.ellipse((sx-r,sy-r,sx+r,sy+r),fill=col+(255,))
    def ring(s,box,col=AMBER,w=3,r=12):
        s.d.rounded_rectangle([v*s.K for v in box],r*s.K,outline=col+(255,),width=w*s.K)
    def apply(s,c): c.alpha_composite(s.im.resize((W,H),Image.LANCZOS))

def chip(c,x,y,text,sub=None,col=AMBER,anchor='l'):
    d=ImageDraw.Draw(c); f=font(24,'SemiBold'); fs=font(19,'Regular')
    tw=d.textlength(text,font=f); sw=d.textlength(sub,font=fs) if sub else 0
    w=int(max(tw,sw))+58; h=54 if not sub else 82
    if anchor=='r': x=x-w
    if anchor=='c': x=x-w//2
    box=Image.new('RGBA',(w,h),(0,0,0,0)); bd=ImageDraw.Draw(box)
    k=4; m=Image.new('RGBA',(w*k,h*k),(0,0,0,0)); md=ImageDraw.Draw(m)
    md.rounded_rectangle((0,0,w*k-1,h*k-1),16*k,fill=(30,35,40,236),outline=(255,255,255,40),width=k*1)
    box=m.resize((w,h),Image.LANCZOS)
    m=Image.new('L',(W,H),0); m.paste(box.getchannel('A'),(x,y+10)); m=m.filter(ImageFilter.GaussianBlur(14)).point(lambda v:v//2)
    sh=Image.new('RGBA',(W,H),(0,0,0,255)); sh.putalpha(m); c.alpha_composite(sh)
    c.alpha_composite(box,(x,y)); d=ImageDraw.Draw(c)
    d.ellipse((x+20,y+27-6,x+32,y+27+6),fill=col)
    d.text((x+42,y+27),text,font=f,fill=TXT,anchor='lm')
    if sub: d.text((x+42,y+58),sub,font=fs,fill=SUB,anchor='lm')
    return (x,y,x+w,y+h)

def header(c,head,sub,x=96,maxw=560,ycenter=None,hsize=68,grad_words=()):
    d=ImageDraw.Draw(c)
    logo=Image.open('/workspace/mr-assets/out/logo-144.png').convert('RGBA').resize((52,52),Image.LANCZOS)
    hf=font(hsize,'Bold'); sf=font(28,'Regular')
    def wrap(t,f,mw):
        lines=[];cur=''
        for wd in t.split():
            tt=(cur+' '+wd).strip()
            if d.textlength(tt,font=f)<=mw: cur=tt
            else: lines.append(cur); cur=wd
        lines.append(cur); return lines
    hl=wrap(head,hf,maxw); sl=wrap(sub,sf,maxw-20)
    lh=int(hsize*1.14)
    block=52+44+len(hl)*lh+40+len(sl)*40
    y=(ycenter or H//2)-block//2
    c.alpha_composite(logo,(x,y)); d.text((x+68,y+26),'MarginRadar',font=font(26,'SemiBold'),fill=(222,228,234),anchor='lm')
    y+=52+44
    for l in hl:
        # words in grad_words get the logo gradient
        cx=x
        for i,wd in enumerate(l.split(' ')):
            t=wd+(' ' if i<len(l.split(' '))-1 else '')
            wpx=d.textlength(t,font=hf)
            if wd.strip('.,') in grad_words:
                m=Image.new('L',(int(wpx)+10,lh+20),0); ImageDraw.Draw(m).text((0,0),wd,font=hf,fill=255)
                g=grad(m.width,m.height).convert('RGBA'); g.putalpha(m); c.alpha_composite(g,(int(cx),y))
            else: d.text((cx,y),t,font=hf,fill=TXT)
            cx+=wpx
        y+=lh
    y+=14
    g=rounded(grad(96,6),3); c.alpha_composite(g,(x,y)); y+=30
    for l in sl: d.text((x,y),l,font=sf,fill=SUB); y+=40

def save(c,name):
    o=c.convert('RGB'); o.save(OUT+name,optimize=True); print(name,o.size)

def uncursor(im,x0,y0,w=11,h=16):
    px=im.load()
    for y in range(y0-5,y0+h+1):
        for x in range(x0-7,x0+w+3): px[x,y]=px[x0-9,y]
    return im
