# PokéSurvivor de Nika

Version personnelle (non commerciale) du fan game **PokéSurvivor** de JPTER78,
adaptée pour Nika :

- Générations 1 à 4 seulement, interface et noms en français.
- Partie enregistrée dans le navigateur, sans compte ni serveur.
- Équipe de 6 : les cartes de niveau proposent parfois un nouveau Pokémon ; chacun suit
  le starter, a ses 4 attaques améliorables et évolue à son propre niveau (XP partagée).
- Rôles d'équipe (Tank, Mêlée, Mage, DPS, Soutien), Ligue Pokémon de Kanto, dresseurs rivaux,
  Boutique de Poké Balls et rang des Pokémon.

## Jouer

- **Sur téléphone ou PC : https://nikaerer.github.io/pokesurvivor/**
  Sur iPhone, ouvrir le lien dans Safari puis Partager > « Sur l'écran d'accueil » : le jeu
  s'ouvre en plein écran, marche hors ligne et propose « Forcer le mode horizontal ».
- Chaque push sur `main` republie le site tout seul (`.github/workflows/pages.yml`).

## Développer

- En local : ouvrir `dev.html` avec un petit serveur (`python3 -m http.server`).
- Lien Claude : `python3 tools/pack_sprites.py build` puis `node tools/build_artifact.js build`
  (écrit `build/pokesurvivor-nika.html`).
- Appli / GitHub Pages : en plus, `node tools/build_pwa.js` (écrit `build/pwa/`).

## Crédits

Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)
Code sous licence PolyForm Noncommercial 1.0.0 (voir LICENSE-NONCOMMERCIAL.md).
Sprites : PMD SpriteCollab (CC BY-NC 4.0), voir CREDITS.md. Pokémon © Nintendo / Creatures / GAME FREAK.
