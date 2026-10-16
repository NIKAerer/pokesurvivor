#!/usr/bin/env python3
"""make_evos.py — niveaux d'évolution pour l'équipe (version de Nika).

Lit tools/data/pokemon_species.csv et pokemon_evolution.csv (PokeAPI) et écrit
js/data/evolutions.js :  G.EVOS = { 1: [[2, 16]], 133: [[134, 30], [135, 30], ...] }

Dans le jeu tout évolue au niveau : les évolutions par pierre, échange ou
bonheur reçoivent un niveau de remplacement.
"""
import csv
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'tools', 'data')
MAX = 493
FALLBACK = {2: 32, 3: 30, 4: 22}     # 2 échange · 3 objet/pierre · autre (bonheur...) ; voir evolution_trigger


def main():
    species = {int(r['id']): r for r in csv.DictReader(open(os.path.join(D, 'pokemon_species.csv')))}
    evo = {}
    for r in csv.DictReader(open(os.path.join(D, 'pokemon_evolution.csv'))):
        to = int(r['evolved_species_id'])
        if to > MAX:
            continue
        frm = species[to]['evolves_from_species_id']
        if not frm:
            continue
        frm = int(frm)
        lvl = int(r['minimum_level']) if r['minimum_level'] else None
        if lvl is None:
            lvl = 18 if species[frm]['is_baby'] == '1' else FALLBACK.get(int(r['evolution_trigger_id']), 22)
        cur = evo.setdefault(frm, {})
        cur[to] = min(cur.get(to, 99), lvl)
    with open(os.path.join(ROOT, 'js', 'data', 'evolutions.js'), 'w') as f:
        f.write('/* ============ evolutions.js — GÉNÉRÉ par tools/make_evos.py ============\n')
        f.write(' * Version de Nika : chaque Pokémon de l\'équipe évolue à son propre niveau.\n')
        f.write(' * G.EVOS[dex] = [[évolution, niveau], ...] (plusieurs = au hasard, ex. Évoli).\n */\n')
        f.write('G.EVOS = {\n')
        f.write(',\n'.join('  %d: %s' % (k, str(sorted([[t, l] for t, l in v.items()])).replace(' ', '')) for k, v in sorted(evo.items())))
        f.write('\n};\n')
        f.write('/** Formes de base (sans pré-évolution) : le gacha de starters ne donne que celles-là. */\n')
        f.write('G.EVO_FROM = {};\nfor (const k in G.EVOS) for (const [t] of G.EVOS[k]) G.EVO_FROM[t] = +k;\n')
    print(len(evo), 'Pokémon évoluent')


if __name__ == '__main__':
    main()
