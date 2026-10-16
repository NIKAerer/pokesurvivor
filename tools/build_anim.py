"""Génère anim.js : sprites de marche animés (PMD SpriteCollab, CC BY-NC 4.0) des Pokémon 1 à 493.
Garde 3 directions (bas, haut, gauche), recadre chaque Pokémon et range tout dans des atlas de 2048 px.
Usage : python3 tools/build_anim.py   (télécharge dans tools/cache/pmd puis écrit anim.js)"""
import re, io, base64, json, os, urllib.request
from PIL import Image
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P=os.path.join(ROOT,'tools','cache','pmd'); OUT=os.path.join(ROOT,'anim.js')
os.makedirs(P,exist_ok=True)
BASE='https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite'
for i in range(1,494):
  for name,ext in (('AnimData','xml'),('Walk-Anim','png')):
    path=f'{P}/{i}.{ext}'
    if not os.path.exists(path): urllib.request.urlretrieve(f'{BASE}/{i:04d}/{name}.{ext}',path)
ROWS=[0,4,6]  # bas, haut, gauche (la droite = gauche retournée)
strips={}
for i in range(1,494):
  x=open(f'{P}/{i}.xml').read()
  m=re.search(r'<Name>Walk</Name>.*?<FrameWidth>(\d+)</FrameWidth>\s*<FrameHeight>(\d+)</FrameHeight>(.*?)</Anim>',x,re.S)
  w,h=int(m[1]),int(m[2]); d=[int(v) for v in re.findall(r'<Duration>(\d+)',m[3])]
  im=Image.open(f'{P}/{i}.png').convert('RGBA'); n=len(d)
  bb=None
  for r in ROWS:
    for f in range(n):
      b=im.crop((f*w,r*h,f*w+w,r*h+h)).getbbox()
      if b: bb=b if bb is None else (min(bb[0],b[0]),min(bb[1],b[1]),max(bb[2],b[2]),max(bb[3],b[3]))
  cw,ch=bb[2]-bb[0],bb[3]-bb[1]
  st=Image.new('RGBA',(cw*n,ch*3))
  for k,r in enumerate(ROWS):
    for f in range(n):
      st.paste(im.crop((f*w+bb[0],r*h+bb[1],f*w+bb[2],r*h+bb[3])),(f*cw,k*ch))
  strips[i]=(st,cw,ch,d, bb[0]+cw/2-w/2)  # décalage horizontal du centre
PW=2048; pages=[]; meta={}
order=sorted(strips,key=lambda k:-strips[k][0].height)
x=y=rh=0; page=[]
for i in order:
  st=strips[i][0]
  if x+st.width>PW: x=0;y+=rh+1;rh=0
  if y+st.height>PW: pages.append(page); page=[]; x=y=rh=0
  page.append((i,x,y)); meta[i]=[len(pages),x,y]; x+=st.width+1; rh=max(rh,st.height)
pages.append(page)
srcs=[]
for pg in pages:
  H=max(y+strips[i][0].height for i,x,y in pg)
  img=Image.new('RGBA',(PW,H))
  for i,x,y in pg: img.paste(strips[i][0],(x,y))
  b=io.BytesIO(); img.save(b,'PNG',optimize=True); srcs.append('data:image/png;base64,'+base64.b64encode(b.getvalue()).decode())
A={i:meta[i]+[strips[i][1],strips[i][2],round(strips[i][4],1),strips[i][3]] for i in strips}
open(OUT,'w').write('const ANIM_SRC='+json.dumps(srcs)+';\nconst ANIM='+json.dumps(A,separators=(',',':'))+';\n')
print('anim.js :', len(pages), 'atlas,', round(os.path.getsize(OUT)/1e6,1), 'Mo')
