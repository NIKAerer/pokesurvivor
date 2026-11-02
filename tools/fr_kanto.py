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
    'route2': 'Route2', 'foret': 'ViridianForest', 'argenta': 'PewterCity',
    # Les intérieurs (on y entre par les portes).
    'bourg_maison': 'PalletTown_PlayersHouse_1F', 'bourg_regis': 'PalletTown_RivalsHouse', 'bourg_labo': 'PalletTown_ProfessorOaksLab',
    'jadielle_centre': 'ViridianCity_PokemonCenter_1F', 'jadielle_boutique': 'ViridianCity_Mart', 'jadielle_maison': 'ViridianCity_House',
    'jadielle_ecole': 'ViridianCity_School', 'argenta_centre': 'PewterCity_PokemonCenter_1F', 'argenta_boutique': 'PewterCity_Mart',
    'argenta_arene': 'PewterCity_Gym', 'argenta_maison1': 'PewterCity_House1', 'argenta_maison2': 'PewterCity_House2',
    'argenta_musee': 'PewterCity_Museum_1F',
    # Chapitre 4 : Route 3, le Mont Sélénite, Route 4.
    'route3': 'Route3', 'mont1': 'MtMoon_1F', 'mont2': 'MtMoon_B1F', 'mont3': 'MtMoon_B2F', 'route4': 'Route4',
    'route4_centre': 'Route4_PokemonCenter_1F',
    # Chapitre 5 : Azuria, Routes 24 et 25 (le Pont Pépite, la maison de Léo).
    'azuria': 'CeruleanCity', 'azuria_centre': 'CeruleanCity_PokemonCenter_1F', 'azuria_boutique': 'CeruleanCity_Mart',
    'azuria_arene': 'CeruleanCity_Gym', 'azuria_velo': 'CeruleanCity_BikeShop', 'azuria_maison1': 'CeruleanCity_House1',
    'azuria_maison2': 'CeruleanCity_House2', 'azuria_maison3': 'CeruleanCity_House3', 'azuria_maison4': 'CeruleanCity_House4',
    'azuria_maison5': 'CeruleanCity_House5', 'route24': 'Route24', 'route25': 'Route25', 'route25_leo': 'Route25_SeaCottage',
    # Chapitre 6 : Route 5, le Souterrain, Route 6, Carmin sur Mer.
    'route5': 'Route5', 'route5_pension': 'Route5_PokemonDayCare', 'souterrain_n': 'UndergroundPath_NorthEntrance',
    'souterrain': 'UndergroundPath_NorthSouthTunnel', 'souterrain_s': 'UndergroundPath_SouthEntrance', 'route6': 'Route6',
    'carmin': 'VermilionCity', 'carmin_centre': 'VermilionCity_PokemonCenter_1F', 'carmin_boutique': 'VermilionCity_Mart',
    'carmin_arene': 'VermilionCity_Gym', 'carmin_club': 'VermilionCity_PokemonFanClub', 'carmin_maison1': 'VermilionCity_House1',
    'carmin_maison2': 'VermilionCity_House2', 'carmin_maison3': 'VermilionCity_House3',
    # Chapitres 7 à 9 : l'Océane, Routes 9 et 10, la Grotte, Lavanville et la Tour Pokémon.
    'ssanne': 'SSAnne_Exterior', 'ssanne_1f': 'SSAnne_1F_Corridor', 'ssanne_2f': 'SSAnne_2F_Corridor', 'ssanne_3f': 'SSAnne_3F_Corridor', 'ssanne_b1f': 'SSAnne_B1F_Corridor', 'ssanne_pont': 'SSAnne_Deck', 'ssanne_cuisine': 'SSAnne_Kitchen', 'ssanne_capitaine': 'SSAnne_CaptainsOffice', 'ssanne_1f_c1': 'SSAnne_1F_Room1', 'ssanne_1f_c2': 'SSAnne_1F_Room2', 'ssanne_1f_c3': 'SSAnne_1F_Room3', 'ssanne_1f_c4': 'SSAnne_1F_Room4', 'ssanne_1f_c5': 'SSAnne_1F_Room5', 'ssanne_1f_c6': 'SSAnne_1F_Room6', 'ssanne_1f_c7': 'SSAnne_1F_Room7', 'ssanne_2f_c1': 'SSAnne_2F_Room1', 'ssanne_2f_c2': 'SSAnne_2F_Room2', 'ssanne_2f_c3': 'SSAnne_2F_Room3', 'ssanne_2f_c4': 'SSAnne_2F_Room4', 'ssanne_2f_c5': 'SSAnne_2F_Room5', 'ssanne_2f_c6': 'SSAnne_2F_Room6', 'ssanne_b1f_c1': 'SSAnne_B1F_Room1', 'ssanne_b1f_c2': 'SSAnne_B1F_Room2', 'ssanne_b1f_c3': 'SSAnne_B1F_Room3', 'ssanne_b1f_c4': 'SSAnne_B1F_Room4', 'ssanne_b1f_c5': 'SSAnne_B1F_Room5', 'route9': 'Route9', 'route10': 'Route10', 'route10_centre': 'Route10_PokemonCenter_1F', 'grotte1': 'RockTunnel_1F', 'grotte2': 'RockTunnel_B1F', 'lavanville': 'LavenderTown', 'lavanville_centre': 'LavenderTown_PokemonCenter_1F', 'lavanville_boutique': 'LavenderTown_Mart', 'lavanville_fuji': 'LavenderTown_VolunteerPokemonHouse', 'lavanville_maison1': 'LavenderTown_House1', 'lavanville_maison2': 'LavenderTown_House2', 'tour1': 'PokemonTower_1F', 'tour2': 'PokemonTower_2F', 'tour3': 'PokemonTower_3F', 'tour4': 'PokemonTower_4F', 'tour5': 'PokemonTower_5F', 'tour6': 'PokemonTower_6F', 'tour7': 'PokemonTower_7F',
    # Chapitre 10 : Route 8, le Souterrain Est-Ouest, Route 7, Céladopole et l'arène d'Érika.
    'route8': 'Route8', 'souterrain_e': 'UndergroundPath_EastEntrance', 'souterrain2': 'UndergroundPath_EastWestTunnel',
    'souterrain_o': 'UndergroundPath_WestEntrance', 'route7': 'Route7', 'celadopole': 'CeladonCity',
    'celadopole_centre': 'CeladonCity_PokemonCenter_1F', 'celadopole_arene': 'CeladonCity_Gym', 'celadopole_magasin': 'CeladonCity_DepartmentStore_1F',
    'celadopole_casino': 'CeladonCity_GameCorner', 'celadopole_resto': 'CeladonCity_Restaurant', 'celadopole_hotel': 'CeladonCity_Hotel',
    'celadopole_maison': 'CeladonCity_House1', 'celadopole_parfum': 'CeladonCity_Condominiums_1F',
    # Chapitre 11 : le repaire de la Team Rocket sous la Salle de jeux.
    'repaire1': 'RocketHideout_B1F', 'repaire2': 'RocketHideout_B2F', 'repaire3': 'RocketHideout_B3F', 'repaire4': 'RocketHideout_B4F',
    # Chapitres 12 et 13 : Safrania, Sylphe SARL et l'arène de Morgane.
    'safrania': 'SaffronCity', 'safrania_centre': 'SaffronCity_PokemonCenter_1F', 'safrania_boutique': 'SaffronCity_Mart',
    'safrania_arene': 'SaffronCity_Gym', 'safrania_dojo': 'SaffronCity_Dojo', 'safrania_maison': 'SaffronCity_House',
    'porte5': 'Route5_SouthEntrance', 'porte6': 'Route6_NorthEntrance', 'porte7': 'Route7_EastEntrance', 'porte8': 'Route8_WestEntrance',
    'sylphe1': 'SilphCo_1F', 'sylphe5': 'SilphCo_5F', 'sylphe7': 'SilphCo_7F', 'sylphe11': 'SilphCo_11F'
}
PEOPLE = ['red_normal', 'prof_oak', 'blue', 'mom', 'nurse', 'brock', 'bug_catcher', 'black_belt', 'clerk',
          'old_man_1', 'boy', 'little_boy', 'youngster', 'camper', 'woman_1', 'fat_man', 'lass', 'gym_guy',
          'little_girl', 'woman_2', 'old_woman', 'scientist', 'gentleman', 'woman_3', 'worker_f', 'worker_m', 'man',
          'rocker', 'hiker', 'beauty', 'super_nerd', 'gamer', 'swimmer_m_land', 'cooltrainer_m', 'daisy', 'balding_man', 'gba_kid', 'rocket_f', 'channeler', 'erika', 'cooltrainer_f', 'picnicker', 'giovanni', 'sabrina', 'misc/item_ball', 'misc/cut_tree', 'misc/ss_anne']

NUM_PRI_TILES, NUM_PRI_MT, NUM_PRI_PALS = 640, 640, 7


def fetch(path):
    dst = os.path.join(CACHE, path)
    if not os.path.exists(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with urllib.request.urlopen(RAW + path, timeout=60) as r:
            data = r.read()
        open(dst, 'wb').write(data)
    return open(dst, 'rb').read()


_TS = None
def tileset_paths(sym):
    """Chemins des fichiers d'un tileset, lus dans src/data/tilesets/*.h (ils ne suivent pas toujours le nom)."""
    global _TS
    if _TS is None:
        import re
        hd = fetch('src/data/tilesets/headers.h').decode()
        gr = fetch('src/data/tilesets/graphics.h').decode() + fetch('src/graphics.c').decode() + fetch('src/data/tilesets/metatiles.h').decode()
        inc = {}
        for m in re.finditer(r'(\w+)\[\](?:\[16\])?\s*=\s*(INCBIN_U(?:16|32)\("[^"]+"\)|\{[^}]*\})', gr):
            inc[m.group(1)] = re.findall(r'"([^"]+)"', m.group(2))
        _TS = {}
        for m in re.finditer(r'struct Tileset (\w+) =\s*\{(.*?)\};', hd, re.S):
            f = dict(re.findall(r'\.(\w+) = (\w+)', m.group(2)))
            _TS[m.group(1)] = {k: inc.get(f.get(k), []) for k in ('tiles', 'palettes', 'metatiles', 'metatileAttributes')}
    return _TS[sym]


def load_tileset(sym, primary):
    P = tileset_paths(sym)
    tiles_png = P['tiles'][0].replace('.4bpp.lz', '.png').replace('.4bpp', '.png')
    im = Image.open(io.BytesIO(fetch(tiles_png)))
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
            txt = fetch(P['palettes'][i].replace('.gbapal', '.pal')).decode().split()
            cols = [tuple(int(v) for v in txt[3 + j * 3:6 + j * 3]) for j in range(16)]
        except Exception:
            cols = [(255, 0, 255)] * 16
        pals.append(cols)
    mt = fetch(P['metatiles'][0])
    metatiles = [struct.unpack_from('<8H', mt, i * 16) for i in range(len(mt) // 16)]
    at = fetch(P['metatileAttributes'][0])
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


def wild_tables():
    """Pokémon sauvages de Rouge Feu par carte : [[n° Pokédex, niv. min, niv. max], ...] (herbes / grottes)."""
    dex = {}
    req = urllib.request.urlopen('https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv', timeout=60)
    import csv
    for r in csv.DictReader(io.StringIO(req.read().decode())):
        dex[r['identifier']] = int(r['id'])
    out = {}
    for g in json.loads(fetch('src/data/wild_encounters.json'))['wild_encounter_groups']:
        for e in g.get('encounters', []):
            if not e.get('base_label', '').endswith('FireRed') or 'land_mons' not in e:
                continue
            seen = {}
            for m in e['land_mons']['mons']:
                d = dex.get(m['species'][8:].lower().replace('_', '-'))
                if not d:
                    continue
                a = seen.setdefault(d, [d, m['min_level'], m['max_level']])
                a[1], a[2] = min(a[1], m['min_level']), max(a[2], m['max_level'])
            out[e['map']] = list(seen.values())
    return out


def uri(im):
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def main():
    layouts = {l['id']: l for l in json.loads(fetch('data/layouts/layouts.json'))['layouts'] if 'id' in l}
    ts = {}
    out = {'maps': {}, 'people': {}}
    names = {v: k for k, v in MAPS.items()}
    ids = {}
    for key, name in MAPS.items():
        ids[json.loads(fetch('data/maps/%s/map.json' % name))['id'][4:]] = key
    wild = wild_tables()
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
        warps = [{'x': w['x'], 'y': w['y'], 'to': w['dest_map'][4:], 'id': int(w['dest_warp_id']), 'dest': ids.get(w['dest_map'][4:])}
                 for w in mj.get('warp_events', [])]
        objs = [{'x': o['x'], 'y': o['y'], 'gfx': o['graphics_id'][len('OBJ_EVENT_GFX_'):].lower(), 'mv': o['movement_type'][len('MOVEMENT_TYPE_'):].lower(),
                 'trainer': o.get('trainer_type') not in (None, 'TRAINER_TYPE_NONE'), 'sight': o.get('trainer_sight_or_berry_tree_id'),
                 'script': o.get('script')} for o in mj.get('object_events', []) if o.get('type', 'object') == 'object']
        signs = [{'x': b['x'], 'y': b['y'], 'script': b.get('script')} for b in mj.get('bg_events', []) if b.get('type') == 'sign']
        out['maps'][key] = {'name': name, 'inside': mj.get('map_type') == 'MAP_TYPE_INDOOR', 'cave': mj.get('map_type') == 'MAP_TYPE_UNDERGROUND',
                            'wild': wild.get(mj['id'], []), 'w': lay['width'], 'h': lay['height'], 'base': uri(base), 'top': uri(top),
                            'grid': grid, 'conns': conns, 'warps': warps, 'objs': objs, 'signs': signs}
        print(key, lay['width'], 'x', lay['height'], len(out['maps'][key]['base']) // 1024, 'Ko')
    used = {o['gfx'] for m in out['maps'].values() for o in m['objs']}
    for p in PEOPLE + sorted(g for g in used if g not in PEOPLE):
        try:
            im = Image.open(io.BytesIO(fetch('graphics/object_events/pics/%s.png' % (p if '/' in p else 'people/' + p))))
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
        out['people'][p.split('/')[-1]] = uri(im)
    js = ('/* kanto-art.js — généré par tools/fr_kanto.py (ne pas modifier à la main).\n'
          ' * Cartes et personnages de Pokémon Rouge Feu (décompilation pret/pokefirered), usage personnel.\n'
          ' * grid : . sol  # bloqué  g hautes herbes  w eau  v rebord (on saute vers le bas)  < > rebords de côté */\n'
          'G.KantoArt = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(OUT, 'w').write(js)
    print('écrit', OUT, len(js) // 1024, 'Ko')


if __name__ == '__main__':
    main()
