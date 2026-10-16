#!/usr/bin/env python3
"""pack_sprites.py — regroupe les sprites en planches (version de Nika).

Un lien Claude accepte au plus 511 fichiers, et le jeu en a ~3500
(assets/pokemon/{dex}/[s/]{Anim}.png). On colle donc toutes les animations
de plusieurs Pokémon dans une seule planche PNG :

  - normaux : 2 Pokémon par planche   -> build/sprites/n{i}.png
  - shiny   : 4 Pokémon par planche   -> build/sprites/s{i}.png

et on écrit l'endroit de chaque animation dans build/sprite-atlas.js :

  G.SPRITE_ATLAS = { "25": ["n12", {Idle:[x,y], Walk:[x,y], ...}], "25s": [...] }

js/core/sprites.js découpe ensuite chaque animation de sa planche.

Usage : python3 tools/pack_sprites.py [dossier_de_sortie]   (défaut : build)
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'pokemon')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'build')
ANIMS = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint']
MAX_DEX = 493


def anims_of(dex, shiny):
    d = os.path.join(SRC, str(dex), 's' if shiny else '')
    return [(a, os.path.join(d, a + '.png')) for a in ANIMS if os.path.isfile(os.path.join(d, a + '.png'))]


def pack(items):
    """Rangées simples (shelf) : items = [(clé, image)] -> (largeur, hauteur, {clé: (x, y)})."""
    items = sorted(items, key=lambda it: -it[1].height)
    width = max(2048, max(im.width for _, im in items))
    x = y = row_h = 0
    pos = {}
    for key, im in items:
        if x + im.width > width:
            x, y, row_h = 0, y + row_h, 0
        pos[key] = (x, y)
        x += im.width
        row_h = max(row_h, im.height)
    return width, y + row_h, pos


def to_palette(im):
    """Palette exacte (sans perte) si l'image a au plus 256 couleurs, sinon l'image telle quelle."""
    a = np.asarray(im).reshape(-1, 4).copy()
    a[a[:, 3] == 0] = 0                      # tous les pixels transparents pareils
    cols, idx = np.unique(a.view(np.uint32).ravel(), return_inverse=True)
    if len(cols) > 256:
        return im
    rgba = cols.view(np.uint8).reshape(-1, 4)
    p = Image.fromarray(idx.astype(np.uint8).reshape(im.height, im.width), 'P')
    p.putpalette(rgba[:, :3].ravel().tolist())
    p.info['transparency'] = bytes(rgba[:, 3].tolist())
    return p


def build(group, shiny, name, atlas):
    items = []
    for dex in group:
        for anim, path in anims_of(dex, shiny):
            items.append(((dex, anim), Image.open(path).convert('RGBA')))
    if not items:
        return 0
    w, h, pos = pack(items)
    sheet = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for key, im in items:
        sheet.paste(im, pos[key])
    # Palette (PNG 8 bits) quand il y a 256 couleurs ou moins : 2 à 3 fois plus léger.
    sheet = to_palette(sheet)
    extra = {'transparency': sheet.info['transparency']} if sheet.mode == 'P' else {}
    sheet.save(os.path.join(OUT, 'sprites', name + '.png'), optimize=True, **extra)
    for dex in group:
        a = {anim: list(pos[(dex, anim)]) for (d, anim) in pos if d == dex}
        if a:
            atlas[str(dex) + ('s' if shiny else '')] = [name, a]
    return 1


def main():
    os.makedirs(os.path.join(OUT, 'sprites'), exist_ok=True)
    dexes = [d for d in range(1, MAX_DEX + 1) if os.path.isdir(os.path.join(SRC, str(d)))]
    atlas, files = {}, 0
    for i in range(0, len(dexes), 2):
        files += build(dexes[i:i + 2], False, 'n%d' % (i // 2), atlas)
    for i in range(0, len(dexes), 4):
        files += build(dexes[i:i + 4], True, 's%d' % (i // 4), atlas)
    with open(os.path.join(OUT, 'sprite-atlas.js'), 'w') as f:
        f.write('/* Généré par tools/pack_sprites.py : où se trouve chaque animation dans les planches. */\n')
        f.write('G.SPRITE_ATLAS = ' + json.dumps(atlas, separators=(',', ':')) + ';\n')
    print('planches :', files, '· Pokémon :', len(dexes))


if __name__ == '__main__':
    main()
