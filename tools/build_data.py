"""Génère data.js : données des Pokémon 1 à 493 (noms FR, types, évolutions, stats) et atlas de sprites.
Sources : CSV de PokeAPI (github.com/PokeAPI/pokeapi) et sprites de github.com/PokeAPI/sprites.
Usage : python3 tools/build_data.py   (télécharge dans tools/cache puis écrit data.js)"""
import csv, json, base64, io
from PIL import Image
import os, urllib.request
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S=os.path.join(ROOT,'tools','cache')
os.makedirs(S+'/csv',exist_ok=True); os.makedirs(S+'/sprites',exist_ok=True)
def dl(url,path):
  if not os.path.exists(path): urllib.request.urlretrieve(url,path)
for f in ['pokemon_species','pokemon_species_names','pokemon_types','pokemon_evolution','pokemon_stats']:
  dl(f'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/{f}.csv',f'{S}/csv/{f}.csv')
for i in range(1,494):
  dl(f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{i}.png',f'{S}/sprites/{i}.png')
C=S+'/csv/'
def rows(f): return list(csv.DictReader(open(C+f+'.csv',encoding='utf-8')))
sp={int(r['id']):r for r in rows('pokemon_species') if int(r['id'])<=493}
fr={int(r['pokemon_species_id']):r['name'] for r in rows('pokemon_species_names') if r['local_language_id']=='5'}
TYPES=[None,'normal','combat','vol','poison','sol','roche','insecte','spectre','acier','feu','eau','plante','electrik','psy','glace','dragon','tenebres','fee']
ty={}
for r in rows('pokemon_types'):
  i=int(r['pokemon_id'])
  if i<=493: ty.setdefault(i,[]).append((int(r['slot']),TYPES[int(r['type_id'])]))
st={}
for r in rows('pokemon_stats'):
  i=int(r['pokemon_id'])
  if i<=493: st.setdefault(i,{})[int(r['stat_id'])]=int(r['base_stat'])
evo={}
for r in rows('pokemon_evolution'):
  t=int(r['evolved_species_id'])
  if t>493: continue
  lvl=r['minimum_level']
  cand=int(lvl) if lvl else None
  if cand is None:
    trig=r['evolution_trigger_id']
    frm=int(sp[t]['evolves_from_species_id'])
    if sp[frm]['is_baby']=='1': cand=12
    elif r['minimum_happiness']: cand=22
    elif trig=='2': cand=36
    elif trig=='3': cand=30
    else: cand=32
  if t not in evo or (lvl and evo[t][1]==False): evo[t]=(cand,bool(lvl))
# stage
def stage(i):
  s=1
  while sp[i]['evolves_from_species_id']: i=int(sp[i]['evolves_from_species_id']); s+=1
  return s
# atlas
imgs={}
for i in sp:
  im=Image.open(f'{S}/sprites/{i}.png').convert('RGBA'); bb=im.getbbox(); imgs[i]=im.crop(bb)
W=1400; x=y=rh=0; pos={}
for i in sorted(imgs,key=lambda k:-imgs[k].height):
  im=imgs[i]
  if x+im.width>W: x=0;y+=rh+1;rh=0
  pos[i]=(x,y,im.width,im.height); x+=im.width+1; rh=max(rh,im.height)
H=y+rh
at=Image.new('RGBA',(W,H))
for i,(x,y,w,h) in pos.items(): at.paste(imgs[i],(x,y))
pass
b=io.BytesIO(); at.save(b,'PNG',optimize=True)
P=[]
for i in sorted(sp):
  r=sp[i]; s=st[i]
  P.append([i,fr[i],[t for _,t in sorted(ty[i])],int(r['evolves_from_species_id'] or 0),evo.get(i,(0,0))[0],stage(i),
    s[1],max(s[2],s[4]),max(s[3],s[5]),s[6],sum(s.values()),1 if (r['is_legendary']=='1' or r['is_mythical']=='1') else 0,1 if r['is_baby']=='1' else 0,list(pos[i])])
open(os.path.join(ROOT,'data.js'),'w',encoding='utf-8').write('const ATLAS_SRC="data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()+'";\nconst DEX='+json.dumps(P,ensure_ascii=False,separators=(',',':'))+';\n')
print('data.js :', len(P), 'Pokémon, atlas', W, 'x', H)
