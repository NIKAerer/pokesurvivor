# PokéSurvivor de Nika

Fan game perso inspiré de [PokéSurvivor](https://jpter78.itch.io/pokesurvivor) : un survivor-like (style Vampire Survivors) avec les Pokémon des générations 1 à 4.

Projet non commercial et non affilié à Nintendo, Game Freak ou The Pokémon Company.

## Jouer

Ouvre `index.html` dans un navigateur (aucune installation). Pour obtenir un seul fichier autonome : `sh tools/bundle.sh`, qui écrit `dist/pokesurvivor.html`.

Déplacement : ZQSD, WASD ou flèches. Sur mobile, pose le doigt n'importe où pour le joystick. Pause : Échap.

## Règles

- Tu choisis un starter parmi ceux des générations 1 à 4 (plus Pikachu). C'est le seul Pokémon qui a des PV : s'il tombe K.O., la partie s'arrête.
- La partie est infinie. Les vagues de Pokémon sauvages grossissent et montent de niveau avec le temps, et un légendaire arrive toutes les 4 minutes.
- Toute l'XP ramassée est partagée : chaque Pokémon de l'équipe a son propre niveau et évolue au niveau prévu (les évolutions par pierre, échange ou bonheur ont un niveau de remplacement).
- À chaque niveau de dresseur, tu choisis une carte parmi trois : un nouveau Pokémon (jusqu'à 6 dans l'équipe, la carte ne sort plus ensuite), un Super Bonbon, un boost d'attaque ou de vitesse pour un des Pokémon de l'équipe, ou un objet pour le starter.
- À la place d'une carte de boost, une carte peut donner un objet tenu global (Restes, Bandeau Choix, Orbe Vie, Vive Griffe, Mouchoir Choix, Ceinture Force, Grelot Coque, Aimant, Multi Exp, Pièce Rune), jusqu'au niveau 3.
- Chaque Pokémon a une attaque liée à son premier type. Elle change de nom et devient plus forte quand il évolue (palier 1 à 3 selon ses stats).
- La table des types s'applique contre les Pokémon sauvages. Les immunités comptent comme peu efficaces (×0,25).

## Map et menu

- La map est infinie et générée par biomes : prairie, forêt, plage, lac, montagne, neige, canyon et marais. Les Pokémon sauvages dépendent du biome où ils apparaissent.
- Menu : Jouer (choix du starter parmi ceux débloqués), Gacha, Boutique et Types.
- Gacha : chaque ticket débloque un Pokémon de base des générations 1 à 4 comme starter (Commun 65 %, Rare 25 %, Épique 9 %, Légendaire 1 %). Un doublon rapporte des pièces. Les tickets tombent des Pokémon sauvages (10 par légendaire vaincu) ou s'achètent 120 pièces.
- Boutique : améliorations permanentes globales (PV, attaque, vitesse d'attaque, déplacement, régénération, aimant, XP, pièces, relances de cartes).
- Types : pour chaque type d'attaque, tous les Pokémon classés par efficacité. La pause montre aussi les types que ton équipe frappe en super efficace.
- La progression (pièces, tickets, starters, boutique) est sauvegardée dans le navigateur.

## Fichiers

- `index.html` : interface et styles.
- `game.js` : le jeu (combat, équipe, cartes, objets).
- `world.js` : la map par biomes.
- `meta.js` : menu, sauvegarde, boutique, gacha et table des types.
- `anim.js` : généré par `python3 tools/build_anim.py` (sprites de marche animés PMD SpriteCollab, 3 directions).
- `data.js` : généré par `python3 tools/build_data.py` (noms français, types, stats, évolutions et atlas de sprites des Pokémon 1 à 493, depuis PokeAPI).

## Crédits

- Sprites animés : [PMD SpriteCollab](https://github.com/PMDCollab/SpriteCollab), licence CC BY-NC 4.0 (usage non commercial).
- Données et images des cartes : [PokeAPI](https://pokeapi.co/).
