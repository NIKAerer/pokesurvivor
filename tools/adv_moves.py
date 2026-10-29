#!/usr/bin/env python3
"""adv_moves.py — les vraies attaques des jeux pour l'Aventure (version de Nika).

Lit les tables de PokeAPI (data/v2/csv, téléchargées dans tools/.pokeapi) et écrit
js/adv/moves-data.js :
  G.AdvData = {
    moves: { id: [nom FR, type, classe (0 statut, 1 physique, 2 spécial), puissance, précision,
                  priorité, cible (1 = soi), altération, chance %, [[stat, cran]...], chance stat %,
                  vol de vie %, soin %, coups min, coups max, peur %, taux critique, PP] },
    learn: { dex: [[niveau, id], ...] },          // attaques apprises par niveau (Rouge Feu, sinon Platine)
    stats: { dex: [PV, Atq, Déf, Atq Spé, Déf Spé, Vit] }
  }
"""
import csv, json, os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.pokeapi')
OUT = os.path.join(HERE, '..', 'js', 'adv', 'moves-data.js')
URL = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/%s.csv'
FILES = ['moves', 'move_names', 'move_meta', 'move_meta_stat_changes', 'types', 'pokemon_moves', 'version_groups', 'pokemon_stats']
MAX_DEX = 493
FR = '5'
# Rouge Feu / Vert Feuille d'abord (Gen 1-3), puis Platine et HeartGold (Gen 4).
GROUPS = ['firered-leafgreen', 'emerald', 'platinum', 'heartgold-soulsilver', 'diamond-pearl']
# Statuts des tables : 1 paralysie, 2 sommeil, 3 gel, 4 brûlure, 5 poison, 6 confusion.
AILMENTS = {1: 'par', 2: 'slp', 3: 'frz', 4: 'brn', 5: 'psn', 6: 'cnf'}
STATS = {1: 'hp', 2: 'atk', 3: 'def', 4: 'spa', 5: 'spd', 6: 'spe', 7: 'acc', 8: 'eva'}


def rows(name):
    p = os.path.join(CACHE, name + '.csv')
    if not os.path.exists(p):
        os.makedirs(CACHE, exist_ok=True)
        urllib.request.urlretrieve(URL % name, p)
    with open(p, encoding='utf-8') as f:
        return list(csv.DictReader(f))


def num(v, d=0):
    return int(v) if v not in (None, '') else d


def main():
    types = {r['id']: r['identifier'] for r in rows('types')}
    vg = {r['identifier']: r['id'] for r in rows('version_groups')}
    names = {r['move_id']: r['name'] for r in rows('move_names') if r['local_language_id'] == FR}
    meta = {r['move_id']: r for r in rows('move_meta')}
    sc = {}
    for r in rows('move_meta_stat_changes'):
        sc.setdefault(r['move_id'], []).append([STATS[int(r['stat_id'])], int(r['change'])])

    learn, used = {}, set()
    by = {}
    for r in rows('pokemon_moves'):
        d = int(r['pokemon_id'])
        if d > MAX_DEX or r['pokemon_move_method_id'] != '1':
            continue
        by.setdefault(d, {}).setdefault(r['version_group_id'], []).append((num(r['level'], 1), int(r['move_id']), num(r['order'], 0)))
    for d in range(1, MAX_DEX + 1):
        g = next((by.get(d, {})[vg[x]] for x in GROUPS if vg[x] in by.get(d, {})), None)
        if not g:
            continue
        seen, out = set(), []
        for lv, mid, _ in sorted(g, key=lambda t: (t[0], t[2])):
            if (lv, mid) in seen:
                continue
            seen.add((lv, mid))
            out.append([max(1, lv), mid])
            used.add(mid)
        learn[d] = out

    moves = {}
    for r in rows('moves'):
        mid = int(r['id'])
        if mid not in used:
            continue
        m = meta.get(r['id'], {})
        mm = lambda k: num(m.get(k), 0)
        cls = {'1': 0, '2': 1, '3': 2}[r['damage_class_id']]
        self_target = r['target_id'] in ('4', '5', '7', '13', '15') or mm('meta_category_id') == 7
        moves[mid] = [names.get(r['id'], r['identifier']), types[r['type_id']], cls, num(r['power']), num(r['accuracy']), num(r['priority']),
                      1 if self_target else 0, AILMENTS.get(mm('meta_ailment_id'), ''), mm('ailment_chance'), sc.get(r['id'], []), mm('stat_chance'),
                      mm('drain'), mm('healing'), num(m.get('min_hits')), num(m.get('max_hits')), mm('flinch_chance'), mm('crit_rate'), num(r['pp']),
                      r['identifier']]

    stats = {}
    for r in rows('pokemon_stats'):
        d = int(r['pokemon_id'])
        if d <= MAX_DEX:
            stats.setdefault(d, [0] * 6)[int(r['stat_id']) - 1] = int(r['base_stat'])

    js = ('/* moves-data.js — généré par tools/adv_moves.py (ne pas modifier à la main).\n'
          ' * Les vraies attaques, niveaux d\'apprentissage et statistiques des jeux (données PokeAPI).\n'
          ' */\nG.AdvData = ' + json.dumps({'moves': moves, 'learn': learn, 'stats': stats}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)
    print('écrit', OUT, len(js) // 1024, 'Ko', len(moves), 'attaques', len(learn), 'Pokémon')


if __name__ == '__main__':
    main()
