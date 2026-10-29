#!/usr/bin/env python3
"""fr_kanto.py — les vraies cartes de Pokémon Rouge Feu pour l'Aventure (version de Nika).

Télécharge depuis la décompilation pret/pokefirered les cartes de Bourg Palette
à Argenta (blocs, tuiles, palettes, métatuiles), les dessine en PNG (couche du
dessous + couche du dessus qui passe devant les personnages) et écrit
js/adv/kanto-art.js : images en data: URI, grille de collisions, portes,
connexions, personnages et panneaux. Les sprites des personnages viennent aussi
du jeu (graphics/object_events/pics/people).

    python3 tools/fr_kanto.py            (télécharge dans tools/.fr_cache)
"""
import base64, io, json, os, struct, sys, urllib.request
from PIL import Image

RAW = 'https://raw.githubusercontent.com/pret/pokefirered/master/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '.fr_cache')
OUT = os.path.join(ROOT, 'js', 'adv', 'kanto-art.js')

MAPS = {  # clé du jeu de Nika : nom pret
    'bourg': 'PalletTown', 'route1': 'Route1', 'jadielle': 'ViridianCity',
    'route2': 'Route2', 'foret': 'ViridianForest', 'argenta': 'PewterCity'
}
PEOPLE = ['red_normal', 'prof_oak', 'blue', 'mom', 'nurse', 'brock', 'bug_catcher', 'black_belt', 'clerk',
          'old_man_1', 'boy', 'little_boy', 'youngster', 'camper', 'woman_1', 'fat_man', 'lass', 'gym_guy',
          'little_girl', 'woman_2', 'old_woman', 'scientist', 'gentleman', 'cool_trainer_m', 'woman_3']

NUM_PRI_TILES, NUM_PRI_MT, NUM_PRI_PALS = 640, 640, 7


def fetch(path):
    dst = os.path.join(CACHE, path)
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with urllib.request.urlopen(RAW + path, timeout=60) as r:
            data = r.read()
        open(dst, 'wb').write(data)
    return open(dst, 'rb').read()


def tileset_dir(sym):
    # gTileset_PalletTown -> pallet_town ; gTileset_General -> general
    name = sym[len('gTileset_'):]
    out = ''
    for i, ch in enumerate(name):
        if ch.isupper() and i:
            out += '_'
        out += ch.lower()
    return out


def load_tileset(sym, primary):
    d = 'data/tilesets/' + ('primary/' if primary else 'secondary/') + tileset_dir(sym) + '/'
    im = Image.open(io.BytesIO(fetch(d + 'tiles.png')))
    if im.mode != 'P':
        im = im.convert('P')
    w, h = im.size
    px = im.load()
    tiles = []
    for ty in range(h // 8):
        for tx in range(w // 8):
            tiles.append([[px[tx * 8 + x, ty * 8 + y] & 15 for x in range(8)] for y in range(8)])
    pals = []
    for i in range(16):
        try:
            txt = fetch(d + 'palettes/%02d.pal' % i).decode().split()
            cols = [tuple(int(v) for v in txt[3 + j * 3:6 + j * 3]) for j in range(16)]
        except Exception:
            cols = [(255, 0, 255)] * 16
        pals.append(cols)
    mt = fetch(d + 'metatiles.bin')
    metatiles = [struct.unpack_from('<8H', mt, i * 16) for i in range(len(mt) // 16)]
    at = fetch(d + 'metatile_attributes.bin')
    attrs = [struct.unpack_from('<I', at, i * 4)[0] for i in range(len(at) // 4)]
    return {'tiles': tiles, 'pals': pals, 'mt': metatiles, 'attr': attrs}


def render(layout, pri, sec):
    W, H = layout['width'], layout['height']
    blocks = fetch(layout['blockdata_filepath'])
    pal = [pri['pals'][i] if i < NUM_PRI_PALS else sec['pals'][i] for i in range(16)]
    base = Image.new('RGBA', (W * 16, H * 16), pal[0][0] + (255,))
    top = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 0))
    bp, tp = base.load(), top.load()
    grid = []
    for by in range(H):
        row = ''
        for bx in range(W):
            v = struct.unpack_from('<H', blocks, (by * W + bx) * 2)[0]
            mid, col = v & 0x3FF, (v >> 10) & 3
            mt = pri['mt'][mid] if mid < NUM_PRI_MT else sec['mt'][mid - NUM_PRI_MT]
            attr = pri['attr'][mid] if mid < NUM_PRI_MT else sec['attr'][mid - NUM_PRI_MT]
            beh, layer = attr & 0x1FF, (attr >> 29) & 3
            for k, e in enumerate(mt):
                t, hf, vf, p = e & 0x3FF, (e >> 10) & 1, (e >> 11) & 1, (e >> 12) & 15
                tile = pri['tiles'][t] if t < NUM_PRI_TILES else (sec['tiles'][t - NUM_PRI_TILES] if t - NUM_PRI_TILES < len(sec['tiles']) else None)
                if tile is None:
                    continue
                q = k & 3
                ox, oy = bx * 16 + (q & 1) * 8, by * 16 + (q >> 1) * 8
                over = k >= 4 and layer == 0         # couche du dessus : devant les personnages
                for y in range(8):
                    for x in range(8):
                        c = tile[7 - y if vf else y][7 - x if hf else x]
                        if not c:
                            continue
                        rgb = pal[p][c] + (255,)
                        bp[ox + x, oy + y] = rgb
                        if over:
                            tp[ox + x, oy + y] = rgb
            if beh in (0x10, 0x11, 0x12, 0x13, 0x15, 0x17, 0x1B):
                ch = 'w'
            elif beh == 0x3B:
                ch = 'v'
            elif beh == 0x38:
                ch = '>'
            elif beh == 0x39:
                ch = '<'
            elif col:
                ch = '#'
            elif beh == 0x02:
                ch = 'g'
            else:
                ch = '.'
            row += ch
        grid.append(row)
    return base, top, grid


def uri(im):
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def main():
    layouts = {l['id']: l for l in json.loads(fetch('data/layouts/layouts.json'))['layouts'] if 'id' in l}
    ts = {}
    out = {'maps': {}, 'people': {}}
    names = {v: k for k, v in MAPS.items()}
    for key, name in MAPS.items():
        mj = json.loads(fetch('data/maps/%s/map.json' % name))
        lay = layouts[mj['layout']]
        for s, prim in ((lay['primary_tileset'], True), (lay['secondary_tileset'], False)):
            if s not in ts:
                ts[s] = load_tileset(s, prim)
        base, top, grid = render(lay, ts[lay['primary_tileset']], ts[lay['secondary_tileset']])
        conns = [{'dir': c['direction'], 'map': names.get(c['map'][4:].title().replace('_', ''), c['map']), 'offset': c['offset']}
                 for c in (mj.get('connections') or [])]
        for c in conns:  # MAP_ROUTE1 -> Route1, MAP_VIRIDIAN_CITY -> ViridianCity
            raw = next(x['map'] for x in mj['connections'] if x['direction'] == c['dir'])
            pn = ''.join(w.title() for w in raw[4:].split('_'))
            c['map'] = names.get(pn, pn)
        warps = [{'x': w['x'], 'y': w['y'], 'to': w['dest_map'][4:], 'id': w['dest_warp_id']} for w in mj.get('warp_events', [])]
        objs = [{'x': o['x'], 'y': o['y'], 'gfx': o['graphics_id'][len('OBJ_EVENT_GFX_'):].lower(), 'mv': o['movement_type'][len('MOVEMENT_TYPE_'):].lower(),
                 'trainer': o.get('trainer_type') not in (None, 'TRAINER_TYPE_NONE'), 'sight': o.get('trainer_sight_or_berry_tree_id'),
                 'script': o.get('script')} for o in mj.get('object_events', []) if o.get('type', 'object') == 'object']
        signs = [{'x': b['x'], 'y': b['y'], 'script': b.get('script')} for b in mj.get('bg_events', []) if b.get('type') == 'sign']
        out['maps'][key] = {'name': name, 'w': lay['width'], 'h': lay['height'], 'base': uri(base), 'top': uri(top),
                            'grid': grid, 'conns': conns, 'warps': warps, 'objs': objs, 'signs': signs}
        print(key, lay['width'], 'x', lay['height'], len(out['maps'][key]['base']) // 1024, 'Ko')
    for p in PEOPLE:
        try:
            im = Image.open(io.BytesIO(fetch('graphics/object_events/pics/people/%s.png' % p)))
        except Exception as e:
            print('pas de sprite', p, e)
            continue
        im = im.convert('RGBA') if im.mode != 'P' else im
        if im.mode == 'P':
            pal = im.getpalette()
            rgba = Image.new('RGBA', im.size)
            src, dst = im.load(), rgba.load()
            for y in range(im.height):
                for x in range(im.width):
                    i = src[x, y]
                    dst[x, y] = (0, 0, 0, 0) if i == 0 else (pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2], 255)
            im = rgba
        out['people'][p] = uri(im)
    js = ('/* kanto-art.js — généré par tools/fr_kanto.py (ne pas modifier à la main).\n'
          ' * Cartes et personnages de Pokémon Rouge Feu (décompilation pret/pokefirered), usage personnel.\n'
          ' * grid : . sol  # bloqué  g hautes herbes  w eau  v rebord (on saute vers le bas)  < > rebords de côté */\n'
          'G.KantoArt = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(OUT, 'w').write(js)
    print('écrit', OUT, len(js) // 1024, 'Ko')


if __name__ == '__main__':
    main()
