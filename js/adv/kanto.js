/* ============ kanto.js — les lieux de l'Aventure (version de Nika) ============
 * Les cartes sont les vraies cartes de Pokémon Rouge Feu (kanto-art.js, généré
 * par tools/fr_kanto.py) : images, collisions, portes, connexions, habitants.
 * Ici : ce que le jeu de Nika en fait. Noms, musique, Pokémon sauvages, ce que
 * fait chaque porte (selon le bâtiment où elle mène), textes des panneaux,
 * personnages de l'histoire (positions en cases de la carte) et chapitres.
 */
G.Kanto = (() => {
  const MAPS = {
    bourg: {
      name: 'Bourg Palette', music: 'village', wild: null, ch: 1,
      doors: { PLAYERS_HOUSE: 'home', RIVALS_HOUSE: 'rivalHome', OAKS_LAB: 'lab' },
      start: { x: 6, y: 8 }
    },
    route1: { name: 'Route 1', ch: 1, music: 'forest', wild: [[16, 2, 4], [19, 2, 4], [19, 3, 5], [16, 3, 5], [21, 3, 5]], doors: {} },   // Piafabec, comme dans l'animé
    jadielle: {
      name: 'Jadielle', music: 'village', wild: null,
      doors: { POKEMON_CENTER: 'center', GYM: 'gymJadielle', MART: 'mart', SCHOOL: 'school', HOUSE: 'house' }
    },
    route2: {
      name: 'Route 2', ch: 2, music: 'forest', wild: [[16, 3, 5], [19, 3, 5], [10, 4, 5], [13, 4, 5], [29, 4, 6], [32, 4, 6]],
      doors: { FOREST_SOUTH_ENTRANCE: 'link', FOREST_NORTH_ENTRANCE: 'link', DIGLETTS_CAVE: 'cave', ROUTE2_HOUSE: 'house', EAST_BUILDING: 'house' }
    },
    foret: {
      name: 'Forêt de Jade', ch: 2, music: 'forest', wild: [[10, 3, 5], [13, 3, 5], [11, 4, 6], [14, 4, 6], [25, 3, 5], [10, 5, 6]],
      doors: { FOREST_SOUTH_ENTRANCE: 'link', FOREST_NORTH_ENTRANCE: 'link' }
    },
    argenta: {
      name: 'Argenta', music: 'village', wild: null,
      doors: { MUSEUM: 'museum', GYM: 'gymArgenta', MART: 'mart', POKEMON_CENTER: 'center', HOUSE: 'house' }
    }
  };

  /** Les intérieurs (vraies cartes du jeu) : nom affiché. Musique calme, pas de Pokémon sauvages. */
  const ROOMS = {
    bourg_maison: 'Ta maison', bourg_regis: 'Maison de Régis', bourg_labo: 'Labo du Prof. Chen',
    jadielle_centre: 'Centre Pokémon de Jadielle', jadielle_boutique: 'Boutique de Jadielle', jadielle_maison: 'Maison de Jadielle',
    jadielle_ecole: 'École des dresseurs', argenta_centre: 'Centre Pokémon d\'Argenta', argenta_boutique: 'Boutique d\'Argenta',
    argenta_arene: 'Arène d\'Argenta', argenta_maison1: 'Maison d\'Argenta', argenta_maison2: 'Maison d\'Argenta', argenta_musee: 'Musée d\'Argenta'
  };
  for (const k in ROOMS) MAPS[k] = { name: ROOMS[k], music: 'village', wild: null, doors: {}, inside: true };

  /** Textes des panneaux (par script du jeu). */
  const SIGNS = {
    PalletTown_EventScript_OaksLabSign: 'Laboratoire Pokémon du Prof. Chen',
    PalletTown_EventScript_PlayersHouseSign: 'Ta maison',
    PalletTown_EventScript_RivalsHouseSign: 'Maison de Régis',
    PalletTown_EventScript_TownSign: 'Bourg Palette — Une ville aux couleurs pures et blanches.',
    PalletTown_EventScript_TrainerTips: 'Conseil : à la fin de chaque chapitre, un nouveau Pokémon peut rejoindre ton équipe !',
    Route1_EventScript_RouteSign: 'Route 1 — Bourg Palette ↔ Jadielle',
    Route2_EventScript_DiglettsCaveSign: 'Cave Taupiqueur',
    Route2_EventScript_RouteSign: 'Route 2 — Jadielle ↔ Argenta',
    ViridianForest_EventScript_ExitSign: 'Sortie de la Forêt de Jade — Argenta est tout près !',
    PewterCity_EventScript_MuseumSign: 'Musée des Sciences d\'Argenta',
    PewterCity_EventScript_PoliceNotice: 'Avis : la Team Rocket rôde dans la région. Soyez prudents !',
    PewterCity_EventScript_GymSign: 'Arène d\'Argenta — Champion : Pierre, le dur à cuire !',
    PewterCity_EventScript_TrainerTips: 'Conseil : les Pokémon Eau et Plante font très mal aux Pokémon Roche.',
    PewterCity_EventScript_CitySign: 'Argenta — Une ville grise comme la pierre.'
  };
  const SIGN_DEFAULT = 'Conseil de dresseur : soigne tes Pokémon au Centre Pokémon avant un gros combat !';

  /** Ce que disent les habitants du jeu (par script), sinon une phrase selon le personnage. */
  const TALK = {
    PalletTown_EventScript_SignLady: 'La technologie est incroyable ! On peut échanger des Pokémon avec ses amis !',
    PalletTown_EventScript_FatMan: 'Je pêche souvent dans l\'étang. Il paraît qu\'un Léviator vit au large…',
    Route1_EventScript_MartClerk: 'Bonjour ! Je travaille à la Boutique de Jadielle. Viens nous voir pour acheter des Potions !',
    Route1_EventScript_Boy: 'Les Pokémon sauvages vivent dans les hautes herbes. Fais attention en les traversant !',
    ViridianCity_EventScript_OldMan: 'L\'arène de Jadielle est fermée depuis longtemps… Personne ne sait où est son champion.',
    ViridianCity_EventScript_Woman: 'La Forêt de Jade est au nord, après la Route 2. On s\'y perd facilement !',
    ViridianCity_EventScript_Youngster: 'Tu as vu ? L\'Agent Jenny cherchait un garçon avec un Pikachu blessé…',
    ViridianCity_EventScript_Boy: 'Ces arbres-là peuvent être coupés avec Coupe. Mais il faut un badge…',
    ViridianCity_EventScript_DreamEaterTutor: 'Zzz… Hein ? Je rêvais d\'un Ronflex…',
    ViridianForest_EventScript_Youngster: 'Les dresseurs de la forêt adorent les Pokémon Insecte. Prépare-toi !',
    ViridianForest_EventScript_Boy: 'J\'ai vu un Pikachu dans la forêt ! Ils sont très rares.',
    PewterCity_EventScript_Lass: 'Pierre est le champion de l\'arène. Ses Pokémon Roche sont très résistants.',
    PewterCity_EventScript_MuseumGuide: 'Tu as visité le Musée ? Il y a un fossile d\'Ptéra !',
    PewterCity_EventScript_FatMan: 'Les Pokémon de Pierre ne craignent pas les attaques Normal.',
    PewterCity_EventScript_BugCatcher: 'Pierre est super fort ! Il faut des Pokémon Eau ou Plante.',
    PewterCity_EventScript_GymGuide: 'Tu vas défier Pierre ? Bonne chance, champion en herbe !',
    PewterCity_EventScript_RunningShoesAide: 'Le Prof. Chen m\'a parlé de toi. Bon voyage !',
    PalletTown_RivalsHouse_EventScript_Daisy: 'Régis est parti voir le Prof. Chen. Il dit qu\'il deviendra le meilleur dresseur du monde !',
    PalletTown_ProfessorOaksLab_EventScript_Aide1: 'Le Prof. Chen étudie les Pokémon depuis des années. C\'est le plus grand chercheur de Kanto !',
    PalletTown_ProfessorOaksLab_EventScript_Aide2: 'Je suis l\'assistant du Prof. Chen. Je range ses notes… il y en a partout !',
    PalletTown_ProfessorOaksLab_EventScript_Aide3: 'Chaque Pokémon a ses propres attaques. Ils en apprennent de nouvelles en montant de niveau !',
    ViridianCity_PokemonCenter_1F_EventScript_Gentleman: 'Les Centres Pokémon soignent gratuitement. Profites-en avant chaque route !',
    ViridianCity_PokemonCenter_1F_EventScript_Boy: 'L\'Infirmière Joëlle a une sœur dans chaque ville. Elles se ressemblent toutes !',
    ViridianCity_PokemonCenter_1F_EventScript_Youngster: 'Plus un Pokémon monte de niveau, plus il apprend d\'attaques puissantes.',
    ViridianCity_Mart_EventScript_Youngster: 'Les Potions, c\'est la base. Prends-en toujours avant la forêt !',
    ViridianCity_Mart_EventScript_Woman: 'Mon Pokémon adore quand je le soigne avec une Potion.',
    ViridianCity_House_EventScript_BaldingMan: 'Ma fille a donné un surnom à son Piafabec : Speary !',
    ViridianCity_House_EventScript_LittleGirl: 'Piafabec est mon meilleur ami. Il pique un peu, mais il est gentil !',
    ViridianCity_House_EventScript_Speary: 'Piafabec : Piaf ! Piaf !',
    ViridianCity_School_EventScript_Woman: 'Bienvenue à l\'école des dresseurs ! Le Feu bat la Plante, l\'Eau bat le Feu, la Plante bat l\'Eau.',
    ViridianCity_School_EventScript_Lass: 'Les attaques de statut, comme Rugissement, baissent les stats de l\'adversaire. Très utile !',
    PewterCity_PokemonCenter_1F_EventScript_Jigglypuff: 'Rondoudou : Rondou… dou… (Il chante une berceuse.)',
    PewterCity_PokemonCenter_1F_EventScript_Gentleman: 'Les Pokémon Roche de Pierre résistent au Feu et aux attaques Vol.',
    PewterCity_PokemonCenter_1F_EventScript_Youngster: 'Rondoudou chante et tout le monde s\'endort ! Ça m\'arrive à chaque fois…',
    MysteryEventClub_EventScript_Woman: 'Bienvenue au club ! Ici on parle de Pokémon toute la journée.',
    PewterCity_PokemonCenter_1F_EventScript_GBAKid1: 'On échange nos Pokémon avec le câble Link !',
    PewterCity_PokemonCenter_1F_EventScript_GBAKid2: 'Mon Racaillou contre ton Chenipan ? D\'accord !',
    PewterCity_Mart_EventScript_Youngster: 'Pierre ? Il est très fort, mais il a bon cœur. Il s\'occupe de ses dix frères et sœurs !',
    PewterCity_Mart_EventScript_Boy: 'Une Potion soigne 20 PV. Prends-en plusieurs pour l\'arène !',
    PewterCity_Gym_EventScript_GymGuy: 'Hé, futur champion ! Pierre utilise des Pokémon Roche. L\'Eau et la Plante sont tes meilleures armes !',
    PewterCity_House1_EventScript_BaldingMan: 'Mon fils adore son Nidoran. Ils jouent toute la journée.',
    PewterCity_House1_EventScript_LittleBoy: 'Nidoran, Nidoran ! Viens jouer !',
    PewterCity_House1_EventScript_Nidoran: 'Nidoran♂ : Nido !',
    PewterCity_House2_EventScript_OldMan: 'Les Pokémon apprennent leurs attaques en grandissant. Un Pokémon bien entraîné est redoutable !',
    PewterCity_House2_EventScript_LittleBoy: 'Moi aussi, un jour, je battrai Pierre !',
    PewterCity_Museum_1F_EventScript_Scientist1: 'Bienvenue au Musée des Sciences ! Admire nos fossiles de Pokémon préhistoriques.',
    PewterCity_Museum_1F_EventScript_OldMan: 'C\'est un fossile de Ptéra. Ce Pokémon volait il y a des millions d\'années.',
    PewterCity_Museum_1F_EventScript_OldAmberScientist: 'Cet Ambre Vieux contient peut-être l\'ADN d\'un Pokémon disparu…',
    PewterCity_Museum_1F_EventScript_Scientist2: 'La navette spatiale du deuxième étage est notre fierté !',
    PewterCity_Museum_1F_EventScript_SeismicTossTutor: 'Un jour j\'apprendrai Frappe Atlas à mes Pokémon !'
  };

  /** Personnages de l'histoire (cases de la carte). look = sprite du jeu (people/*.png). */
  const NPCS = {
    bourg: [],
    bourg_maison: [
      { id: 'mom', look: 'mom', name: 'Maman', x: 8, y: 4, dir: 'left', event: 'mom' }
    ],
    bourg_labo: [
      { id: 'chen', look: 'prof_oak', x: 6, y: 3, dir: 'down', event: 'chen' },
      // Les trois Poké Balls sur la table, comme dans le jeu.
      { id: 'ball1', look: 'item_ball', x: 8, y: 4, dir: 'down', ball: 16, when: f => !f.starter },
      { id: 'ball7', look: 'item_ball', x: 9, y: 4, dir: 'down', ball: 19, when: f => !f.starter },
      { id: 'ball4', look: 'item_ball', x: 10, y: 4, dir: 'down', ball: 25, when: f => !f.starter },
      { id: 'rival1', look: 'blue', x: 5, y: 4, dir: 'down', event: 'rival1', when: f => !f.rival1 }
    ],
    jadielle_centre: [{ id: 'joy', look: 'nurse', x: 7, y: 2, dir: 'down', event: 'center' }],
    argenta_centre: [{ id: 'joy', look: 'nurse', x: 7, y: 2, dir: 'down', event: 'center' }],
    jadielle_boutique: [{ id: 'clerk', look: 'clerk', x: 2, y: 3, dir: 'right', event: 'mart' }],
    argenta_boutique: [{ id: 'clerk', look: 'clerk', x: 2, y: 3, dir: 'right', event: 'mart' }],
    argenta_arene: [{ id: 'pierre', look: 'brock', x: 6, y: 5, dir: 'down', event: 'pierre' }],
    route1: [],
    jadielle: [],
    route2: [],
    foret: [
      // Le Samouraï garde la sortie nord, comme dans l'animé.
      { id: 'samurai', look: 'black_belt', x: 5, y: 11, dir: 'down', trainer: { name: 'Le Samouraï', team: [[11, 7], [127, 9]], sees: 4, coins: 200, smart: true,
        meet: 'Halte ! Tu viens de Bourg Palette ? Alors affronte-moi et mon Scarabrute !', lose: 'Quelle force… La sortie est juste derrière moi.' } }
    ],
    argenta: []
  };
  /** Les dresseurs du jeu (Forêt de Jade), par script : leur équipe. */
  const TRAINERS = {
    ViridianForest_EventScript_Rick: { name: 'Scout Ricky', team: [[10, 6], [13, 6]], coins: 80, meet: 'Hé ! Toi aussi tu chasses les insectes ? Combat !', lose: 'Mes insectes…' },
    ViridianForest_EventScript_Doug: { name: 'Scout Doug', team: [[13, 7], [14, 7]], coins: 90, meet: 'Attention, mes Aspicot piquent !', lose: 'Bien joué…' },
    ViridianForest_EventScript_Sammy: { name: 'Scout Sammy', team: [[13, 9]], coins: 90, meet: 'Tu ne passeras pas !', lose: 'Je dois encore m\'entraîner.' },
    ViridianForest_EventScript_Anthony: { name: 'Scout Antoine', team: [[10, 7], [11, 8]], coins: 100, meet: 'Je viens de capturer un Chenipan !', lose: 'Il va évoluer, tu verras !' },
    ViridianForest_EventScript_Charlie: { name: 'Scout Charlie', team: [[14, 8], [10, 8]], coins: 100, meet: 'Mes Pokémon sont prêts !', lose: 'Tu es trop fort…' },
    PewterCity_Gym_EventScript_Liam: { name: 'Campeur Liam', team: [[50, 10], [27, 11]], coins: 150, meet: 'Tu veux défier Pierre ? Il faudra d\'abord me battre !', lose: 'Tu es prêt pour Pierre…' }
  };

  /** Les chapitres : titre, objectif affiché, et l'intro. */
  const CHAPTERS = [
    null,
    { title: 'Le départ', goal: 'Va voir le Prof. Chen dans son labo, puis rejoins Jadielle par la Route 1, au nord.',
      intro: [['', 'Bourg Palette. Aujourd\'hui, tu deviens dresseur Pokémon !'], ['Maman', 'Le Prof. Chen t\'attend dans son labo, au sud du village. Vas-y vite !']] },
    { title: 'La Forêt de Jade', goal: 'Prends la Route 2 au nord de Jadielle et traverse la Forêt de Jade jusqu\'à Argenta.',
      intro: [['', 'Chapitre 2 · La Forêt de Jade'], ['Infirmière Joëlle', 'La Forêt de Jade est au nord, par la Route 2. On dit qu\'un samouraï y défie tous les voyageurs…']] },
    { title: 'Le Badge Roche', goal: 'Défie Pierre, le champion de l\'arène d\'Argenta.',
      intro: [['', 'Chapitre 3 · Le Badge Roche'], ['', 'Argenta ! L\'arène de Pierre est à l\'ouest de la ville.']] },
    { title: 'À suivre…', goal: 'La suite de l\'aventure (Mont Sélénite, Azuria…) arrive bientôt !',
      intro: [['', 'Chapitre 4 · À suivre'], ['', 'Bravo ! La suite de l\'aventure arrive bientôt : le Mont Sélénite et Azuria.']] }
  ];

  // ---------------- Chapitres 4 à 6 : Mont Sélénite, Azuria, Carmin sur Mer ----------------
  Object.assign(MAPS, {
    route3: { name: 'Route 3', ch: 4, music: 'forest', doors: {} },
    mont1: { name: 'Mont Sélénite', ch: 4, music: 'cave', doors: {} },
    mont2: { name: 'Mont Sélénite · Sous-sol 1', ch: 4, music: 'cave', doors: {} },
    mont3: { name: 'Mont Sélénite · Sous-sol 2', ch: 4, music: 'cave', doors: {} },
    route4: { name: 'Route 4', ch: 4, music: 'forest', doors: {} },
    azuria: { name: 'Azuria', ch: 5, music: 'village', wild: null, doors: { CERULEAN_CAVE: 'grotte' } },
    route24: { name: 'Route 24 · Pont Pépite', ch: 5, music: 'forest', doors: {} },
    route25: { name: 'Route 25', ch: 5, music: 'forest', doors: {} },
    route5: { name: 'Route 5', ch: 6, music: 'forest', doors: { ROUTE5_SOUTH_ENTRANCE: 'safrania' } },
    route6: { name: 'Route 6', ch: 6, music: 'forest', doors: { ROUTE6_NORTH_ENTRANCE: 'safrania' } },
    carmin: { name: 'Carmin sur Mer', ch: 6, music: 'village', wild: null, doors: { SSANNE: 'ssanne' } }
  });
  const ROOMS2 = {
    route4_centre: ['Centre Pokémon du Mont Sélénite', 4], azuria_centre: ['Centre Pokémon d\'Azuria', 5], azuria_boutique: ['Boutique d\'Azuria', 5],
    azuria_arene: ['Arène d\'Azuria', 5], azuria_velo: ['Magasin de vélos', 5], azuria_maison1: ['Maison d\'Azuria', 5], azuria_maison2: ['Maison cambriolée', 5],
    azuria_maison3: ['Maison d\'Azuria', 5], azuria_maison4: ['Maison d\'Azuria', 5], azuria_maison5: ['Maison d\'Azuria', 5], route25_leo: ['Cottage de Léo', 5],
    route5_pension: ['Pension Pokémon', 6], souterrain_n: ['Souterrain · entrée nord', 6], souterrain: ['Souterrain', 6], souterrain_s: ['Souterrain · entrée sud', 6],
    carmin_centre: ['Centre Pokémon de Carmin', 6], carmin_boutique: ['Boutique de Carmin', 6], carmin_arene: ['Arène de Carmin', 6], carmin_club: ['Fan Club Pokémon', 6],
    carmin_maison1: ['Maison du pêcheur', 6], carmin_maison2: ['Maison de Carmin', 6], carmin_maison3: ['Maison de Carmin', 6]
  };
  for (const k in ROOMS2) MAPS[k] = { name: ROOMS2[k][0], ch: ROOMS2[k][1], music: k === 'souterrain' ? 'cave' : 'village', wild: null, doors: {}, inside: true };
  // Les dresseurs d'arène : des Pokémon du type de l'arène.
  MAPS.azuria_arene.pool = [118, 116, 120, 54, 60, 72, 90];
  MAPS.carmin_arene.pool = [100, 81, 25, 125];

  /** Les cartes voisines pas encore faites : pourquoi on ne passe pas. */
  const CLOSED = {
    SaffronCityConnection: 'Un garde bloque le chemin de Safrania : « J\'ai si soif… Je ne laisse passer personne ! »',
    Route11: 'La Route 11 est fermée pour travaux. La suite de l\'aventure arrive bientôt !'
  };
  const DOORS = {
    grotte: 'Un dresseur garde l\'entrée : la Grotte Azurée est interdite. On dit qu\'un Pokémon terriblement puissant y dort…',
    safrania: 'Le garde du poste : « J\'ai tellement soif ! Je ne laisse passer personne vers Safrania ! »'
  };

  Object.assign(SIGNS, {
    Route3_EventScript_RouteSign: 'Route 3 — Argenta ↔ Mont Sélénite',
    MtMoon_1F_EventScript_ZubatSign: 'Attention : les Nosferapti du Mont Sélénite détestent la lumière. Ne les dérangez pas !',
    Route4_EventScript_MtMoonSign: 'Mont Sélénite — Entrée du tunnel',
    Route4_EventScript_RouteSign: 'Route 4 — Mont Sélénite ↔ Azuria',
    CeruleanCity_EventScript_CitySign: 'Azuria — Une ville mystérieuse aux couleurs de l\'eau.',
    CeruleanCity_EventScript_GymSign: 'Arène d\'Azuria — Championne : Ondine, la sirène des Pokémon Eau !',
    CeruleanCity_EventScript_BikeShopSign: 'Magasin de vélos — Le meilleur vélo de Kanto !',
    CeruleanCity_EventScript_TrainerTips: 'Conseil : les Pokémon Plante et Électrik battent les Pokémon Eau.',
    CeruleanCity_BikeShop_EventScript_Bicycle: 'Un Vélo flambant neuf : 1 000 000 pièces. Ça fait cher…',
    CeruleanCity_Gym_EventScript_GymStatue: 'Arène d\'Azuria — Championne : Ondine',
    CeruleanCity_House2_EventScript_WallHole: 'La Team Rocket a fait un grand trou dans le mur !',
    CeruleanCity_House5_EventScript_BerryCrushRankings: 'Un tableau de scores… Rien d\'intéressant.',
    Route25_EventScript_SeaCottageSign: 'Cottage de Léo, le maniaque des Pokémon',
    Route25_SeaCottage_EventScript_Computer: 'L\'ordinateur de Léo. Un programme bizarre s\'appelle « Téléporteur ».',
    Route5_EventScript_UndergroundPathSign: 'Souterrain — Azuria ↔ Carmin sur Mer',
    Route6_EventScript_UndergroundPathSign: 'Souterrain — Carmin sur Mer ↔ Azuria',
    VermilionCity_EventScript_CitySign: 'Carmin sur Mer — Le port des couchers de soleil.',
    VermilionCity_EventScript_PokemonFanClubSign: 'Fan Club Pokémon — Tous les fans sont les bienvenus !',
    VermilionCity_EventScript_GymSign: 'Arène de Carmin — Champion : Major Bob, l\'éclair américain !',
    VermilionCity_EventScript_HarborSign: 'Port de Carmin — Ici accoste l\'Océane.',
    VermilionCity_EventScript_SnorlaxNotice: 'Avis : un Ronflex dort au milieu de la Route 12. Merci de ne pas le réveiller.',
    VermilionCity_Gym_EventScript_GymStatue: 'Arène de Carmin — Champion : Major Bob',
    VermilionCity_PokemonFanClub_EventScript_RulesSign1: 'Règle n°1 : écouter poliment les autres membres parler de leurs Pokémon.',
    VermilionCity_PokemonFanClub_EventScript_RulesSign2: 'Règle n°2 : ne jamais se moquer du Pokémon d\'un autre membre.',
    VermilionCity_House3_EventScript_Letter: 'Une lettre : « Cher Pikachu, ne pars plus jamais à l\'aventure sans moi ! »'
  });

  Object.assign(TALK, {
    Route3_EventScript_Youngster: 'Le Mont Sélénite est tout près. Il y a des Mélofée qui dansent sous la lune, à ce qu\'on dit !',
    MtMoon_1F_EventScript_BaldingMan: 'Je suis Seymour, scientifique. Les Mélofée viendraient de l\'espace ! La Pierre Lune serait tombée du ciel avec eux…',
    Route4_EventScript_Woman: 'Ouf, tu es sorti du Mont Sélénite ! Moi j\'ai eu peur des Nosferapti.',
    Route4_EventScript_Boy: 'Azuria est juste à l\'est. Sa championne, Ondine, est redoutable avec ses Pokémon Eau !',
    Route4_EventScript_MegaPunchTutor: 'Mon Ultimapoing fait trembler la montagne ! Hya !',
    Route4_EventScript_MegaKickTutor: 'Ultimawashi ! Mes jambes sont plus solides que le Mont Sélénite !',
    Route4_PokemonCenter_1F_EventScript_Gentleman: 'Les Pokémon de la grotte sont plus forts qu\'à Argenta. Soigne-toi souvent !',
    Route4_PokemonCenter_1F_EventScript_Boy: 'Un garçon aux cheveux verts et une fille aux cheveux rouges sont passés… avec un Miaouss qui parlait !',
    Route4_PokemonCenter_1F_EventScript_Youngster: 'Les fossiles du Mont Sélénite intéressent beaucoup de monde. Même des gens louches…',
    Route4_PokemonCenter_1F_EventScript_Newspaper: 'Le journal : « Un Pikachu fait sauter un Centre Pokémon à Jadielle ! »',
    CeruleanCity_EventScript_Policeman: 'Je suis le cousin de l\'Agent Jenny. Une maison a été cambriolée par la Team Rocket !',
    CeruleanCity_EventScript_LittleBoy: 'L\'arène d\'Azuria fait aussi des spectacles aquatiques. Les sœurs d\'Ondine sont des stars !',
    CeruleanCity_EventScript_BaldingMan: 'Tu cherches un vélo ? Le magasin du sud vend les meilleurs, mais c\'est hors de prix.',
    CeruleanCity_EventScript_Slowbro: 'Flagadoss : … … … (Il a oublié ce qu\'il voulait dire.)',
    CeruleanCity_EventScript_Lass: 'Flagadoss, Choc Mental ! … Il dort encore. Ce Pokémon est trop lent !',
    CeruleanCity_EventScript_Youngster: 'Au nord, il y a le Pont Pépite. Cinq dresseurs t\'y attendent à la suite !',
    CeruleanCity_EventScript_Woman: 'Ondine a quitté Azuria un temps pour suivre un garçon qui lui devait un vélo… Drôle d\'histoire !',
    CeruleanCity_EventScript_CeruleanCaveGuard: 'Interdit d\'entrer ! Seuls les plus grands dresseurs peuvent visiter la Grotte Azurée.',
    CeruleanCity_PokemonCenter_1F_EventScript_Gentleman: 'Tu as vu le Psykokwak d\'Ondine ? Il a toujours mal à la tête, le pauvre.',
    CeruleanCity_PokemonCenter_1F_EventScript_Rocker: 'Léo, sur la Route 25, adore les Pokémon. Il en a des milliers sur son ordinateur !',
    CeruleanCity_PokemonCenter_1F_EventScript_Youngster: 'Les Pokémon Eau d\'Ondine sont rapides. Un Pokémon Plante ou Électrik t\'aidera !',
    CeruleanCity_PokemonCenter_1F_EventScript_Lass: 'J\'ai vu un Salamèche abandonné près des routes au nord… J\'espère qu\'il a trouvé un ami.',
    CeruleanCity_PokemonCenter_1F_EventScript_PokemonJournalMisty: 'Journal Pokémon : « Ondine rêve de devenir la meilleure dresseuse de Pokémon Eau du monde. »',
    CeruleanCity_Mart_EventScript_Woman: 'Les Total Soin guérissent le poison, la paralysie et le sommeil. Très pratique !',
    CeruleanCity_Mart_EventScript_Youngster: 'Contre Ondine, prends beaucoup de Potions. Ses Pokémon frappent fort !',
    CeruleanCity_Gym_EventScript_GymGuy: 'Hé, futur champion ! Ondine utilise des Pokémon Eau. Électrik et Plante sont tes meilleures armes !',
    CeruleanCity_BikeShop_EventScript_Clerk: 'Un vélo ? 1 000 000 pièces ! … Une fille rousse est venue en réclamer un : le sien a été grillé par l\'éclair d\'un Pikachu !',
    CeruleanCity_BikeShop_EventScript_Youngster: 'Un jour j\'aurai un vélo. En attendant, je cours !',
    CeruleanCity_BikeShop_EventScript_Woman: 'Ces vélos se plient pour tenir dans le sac. Génial, non ?',
    CeruleanCity_House1_EventScript_BadgeGuy: 'Les badges prouvent ta force. Avec deux badges, les Pokémon t\'obéissent jusqu\'au niveau 30 !',
    CeruleanCity_House2_EventScript_Hiker: 'Les voleurs de la Team Rocket sont passés par le trou du mur ! Ils ont pris ma CT Tunnel !',
    CeruleanCity_House2_EventScript_Lass: 'Un des voleurs se cache derrière la maison. Quelqu\'un doit l\'arrêter !',
    CeruleanCity_House3_EventScript_Dontae: 'Mon Kokiyas a pincé la queue de mon Ramoloss… Et il est devenu un Flagadoss !',
    CeruleanCity_House3_EventScript_OldWoman: 'Les Pokémon de mon petit-fils sont tous des Pokémon Eau. Comme ceux d\'Ondine !',
    CeruleanCity_House4_EventScript_WonderNewsBerryMan: 'Les baies poussent partout à Kanto. Les Pokémon les adorent.',
    CeruleanCity_House5_EventScript_BerryPowderMan: 'Je broie des baies toute la journée. Une passion comme une autre !',
    Route24_EventScript_Rocket: 'Bravo, tu as battu les cinq dresseurs du Pont Pépite ! … Ça te dirait de rejoindre la Team Rocket ? Non ? Dommage…',
    Route25_EventScript_Beauty: 'Léo habite le cottage au bout de la route. Il est un peu… spécial.',
    Route25_EventScript_Man: 'J\'ai entendu une voix bizarre dans le cottage de Léo. Comme un Pokémon qui parle !',
    Route5_PokemonDayCare_EventScript_DaycareMan: 'Bienvenue à la Pension ! On garde les Pokémon pendant les grands voyages. Le tien a l\'air bien trop attaché à toi pour rester ici !',
    UndergroundPath_NorthEntrance_EventScript_Saige: 'Le Souterrain relie Azuria à Carmin sur Mer. C\'est long, mais sans Pokémon sauvages !',
    UndergroundPath_SouthEntrance_EventScript_Woman: 'Carmin sur Mer est juste au sud. On y sent l\'odeur de la mer !',
    VermilionCity_EventScript_Woman: 'L\'Océane est un bateau de croisière. On y fait une grande fête de dresseurs !',
    VermilionCity_EventScript_OldMan1: 'Le Major Bob a combattu à la guerre avec ses Pokémon Électrik. Il est redoutable !',
    VermilionCity_EventScript_OldMan2: 'Mon Machoc aplatit le terrain pour construire une maison. Bon travail, Machoc !',
    VermilionCity_EventScript_Machop: 'Machoc : Machoc ! (Il tape le sol de toutes ses forces.)',
    VermilionCity_EventScript_Sailor: 'Ahoy ! L\'Océane reste au port quelques jours. Il faut un billet pour monter à bord.',
    VermilionCity_EventScript_FerrySailor: 'Ton billet, s\'il te plaît ! … Pas de billet, pas de bateau.',
    VermilionCity_EventScript_OaksAide: 'Je suis un assistant du Prof. Chen. Il paraît que l\'Escouade Carapuce aide maintenant les pompiers de Carmin !',
    VermilionCity_PokemonCenter_1F_EventScript_Man: 'Le Major Bob trouve que les Pikachu sont trop petits. Il faut les faire évoluer en Raichu, qu\'il dit !',
    VermilionCity_PokemonCenter_1F_EventScript_Hiker: 'Un Pikachu a battu le Raichu du Major Bob, un jour. Grâce à sa vitesse !',
    VermilionCity_PokemonCenter_1F_EventScript_Youngster: 'Les attaques Électrik ne font rien aux Pokémon Sol. Ça peut servir contre le Major Bob !',
    VermilionCity_PokemonCenter_1F_EventScript_VSSeekerWoman: 'L\'Infirmière Joëlle de Carmin ? C\'est la cousine de celle d\'Azuria !',
    VermilionCity_PokemonCenter_1F_EventScript_PokemonJournalLtSurge: 'Journal Pokémon : « Le Major Bob a installé des pièges électriques dans son arène. »',
    VermilionCity_Mart_EventScript_CooltrainerF: 'Il y a des gens louches qui rôdent près du port. Encore la Team Rocket ?',
    VermilionCity_Mart_EventScript_BaldingMan: 'Un Pokémon bien soigné, c\'est un Pokémon qui gagne. Achète des Potions !',
    VermilionCity_Gym_EventScript_GymGuy: 'Hé, futur champion ! Le Major Bob a caché deux interrupteurs dans les poubelles. Il faut les trouver l\'un après l\'autre !',
    VermilionCity_PokemonFanClub_EventScript_Chairman: 'Je suis le président du Fan Club ! Mon Ponyta est le plus beau Pokémon du monde… Tu veux que je te raconte ? Non ? Une autre fois, alors !',
    VermilionCity_PokemonFanClub_EventScript_WorkerF: 'Le président parle de ses Pokémon pendant des heures. Bon courage !',
    VermilionCity_PokemonFanClub_EventScript_Pikachu: 'Pikachu : Pika pika ! (Il refuse de rentrer dans sa Poké Ball.)',
    VermilionCity_PokemonFanClub_EventScript_Seel: 'Otaria : Ouh ouh ! (Il fait tourner un ballon sur son nez.)',
    VermilionCity_PokemonFanClub_EventScript_Woman: 'Mon Pikachu ne veut jamais rester dans sa Poké Ball. Il préfère mon épaule !',
    VermilionCity_PokemonFanClub_EventScript_FatMan: 'Mon Otaria est le plus mignon. Bien plus que ton Pikachu, désolé !',
    VermilionCity_House1_EventScript_FishingGuru: 'Je suis le pêcheur de Carmin. Mon frère vit près de la mer, lui aussi. La pêche, c\'est toute ma vie !',
    VermilionCity_House2_EventScript_Elyssa: 'Mon Pokémon préféré ? Pikachu, évidemment ! Il est trop mignon.',
    VermilionCity_House3_EventScript_Boy: 'Mon Roucool porte des lettres pour moi. Plus rapide que la poste !',
    VermilionCity_House3_EventScript_Pidgey: 'Roucool : Roucou ! (Il a une lettre dans le bec.)',
    VermilionCity_House3_EventScript_Lass: 'J\'écris à mon ami de Bourg Palette. Roucool va la lui apporter !'
  });

  /** Les dresseurs importants des nouveaux lieux (les autres ont une équipe des Pokémon du coin). */
  Object.assign(TRAINERS, {
    Route6_EventScript_Ricky: { name: 'Chef de l\'Escouade Carapuce', team: [[7, 16], [7, 17], [8, 19]], coins: 400, smart: true,
      meet: 'Halte ! Nous sommes l\'Escouade Carapuce ! Personne ne passe sans nous battre ! (Ils mettent leurs lunettes de soleil.)',
      lose: 'Tu es trop cool… L\'Escouade Carapuce va aider les pompiers de Carmin, maintenant !' },
    Route6_EventScript_Nancy: { name: 'Pique-niqueuse Nancy', team: [[43, 16], [16, 17]], coins: 200, meet: 'Tu as vu ces Carapuce à lunettes ? Ils sont trop drôles !', lose: 'Bravo !' },
    CeruleanCity_Gym_EventScript_Luis: { name: 'Nageur Luis', team: [[116, 16], [118, 16]], coins: 250, meet: 'Ondine est la meilleure ! Tu ne la verras pas !', lose: 'Glou glou…' },
    CeruleanCity_Gym_EventScript_Diana: { name: 'Pique-niqueuse Diana', team: [[118, 19]], coins: 250, meet: 'Je suis une fan d\'Ondine ! Elle va te noyer sous les vagues !', lose: 'Ondine va te battre, elle !' },
    VermilionCity_Gym_EventScript_Baily: { name: 'Mécano Baily', team: [[100, 20], [100, 20]], coins: 300, meet: 'Bzzt ! Mes Voltorbe vont exploser de joie !', lose: 'Court-circuit…' },
    VermilionCity_Gym_EventScript_Dwayne: { name: 'Marin Dwayne', team: [[25, 19], [25, 19]], coins: 300, meet: 'Le Major Bob est mon capitaine ! À l\'abordage !', lose: 'Je coule…' },
    VermilionCity_Gym_EventScript_Tucker: { name: 'Gentleman Tucker', team: [[25, 23]], coins: 400, meet: 'Mon Pikachu est très bien élevé. Il va vous électriser, cher ami.', lose: 'Quelle élégance…' },
    MtMoon_B2F_EventScript_Grunt1: { name: 'Sbire Rocket', team: [[19, 11], [41, 11]], coins: 220, meet: 'La Team Rocket prend tous les fossiles ! Dégage !', lose: 'Grr… Les chefs vont être furieux.' },
    MtMoon_B2F_EventScript_Grunt2: { name: 'Sbire Rocket', team: [[27, 11], [19, 11], [23, 11]], coins: 220, meet: 'Tu cherches des ennuis, gamin ?', lose: 'Je file prévenir Jessie et James !' },
    MtMoon_B2F_EventScript_Grunt3: { name: 'Sbire Rocket', team: [[19, 13], [20, 13]], coins: 260, meet: 'On creuse pour trouver la Pierre Lune ! Ne nous dérange pas !', lose: 'Ce n\'était qu\'un échauffement…' },
    MtMoon_B2F_EventScript_Grunt4: { name: 'Sbire Rocket', team: [[41, 12], [109, 12]], coins: 240, meet: 'Les fossiles valent une fortune ! Ils sont à nous !', lose: 'Bon, garde-les, tes cailloux…' }
  });
  /** Les noms des dresseurs selon leur tenue (quand le jeu ne donne qu'un prénom). */
  const CLASSES = {
    youngster: 'Gamin', lass: 'Fillette', bug_catcher: 'Scout', camper: 'Campeur', picnicker: 'Pique-niqueuse', hiker: 'Montagnard',
    scientist: 'Scientifique', rocket_m: 'Sbire Rocket', super_nerd: 'Intello', sailor: 'Marin', gentleman: 'Gentleman', beauty: 'Beauté',
    black_belt: 'Karatéka', balding_man: 'Mécano', swimmer_m_water: 'Nageur', cooltrainer_m: 'Topdresseur', cooltrainer_f: 'Topdresseuse'
  };

  Object.assign(NPCS, {
    // Le vendeur de Magicarpe, comme James dans l'animé.
    route4_centre: [{ id: 'karp', look: 'balding_man', x: 1, y: 3, dir: 'right', event: 'magikarp' }],
    mont1: [{ id: 'clefairy1', mon: 35, x: 40, y: 5, dir: 'down', talk: () => [['', 'Mélofée : Mélo ! Mélo ! (Il danse autour d\'un éclat de Pierre Lune.)']] }],
    // Jessie, James et Miaouss gardent les fossiles.
    mont3: [
      { id: 'jessie', look: 'rocket_f', x: 15, y: 9, dir: 'down', event: 'rocket', when: f => !f.rocket1 },
      { id: 'james', look: 'rocket_m', x: 16, y: 9, dir: 'down', event: 'rocket', when: f => !f.rocket1 },
      { id: 'meowth', mon: 52, x: 17, y: 9, dir: 'down', event: 'rocket', when: f => !f.rocket1 },
      { id: 'miguel', look: 'scientist', x: 13, y: 11, dir: 'up', event: 'fossil' }
    ],
    azuria: [
      // Régis et ses pom-pom girls bloquent le Pont Pépite.
      { id: 'regis2', look: 'blue', x: 23, y: 2, dir: 'down', event: 'regis2', when: f => !f.regis2 },
      { id: 'grunt_az', look: 'rocket_m', x: 33, y: 6, dir: 'left', trainer: { name: 'Sbire Rocket', team: [[19, 15], [23, 17]], sees: 3, coins: 400,
        meet: 'Hé hé ! J\'ai volé la CT de cette maison ! Tu ne diras rien à personne, hein ?', lose: 'D\'accord, d\'accord ! Je rends la CT… La Team Rocket reviendra !' } }
    ],
    azuria_arene: [
      { id: 'ondine', look: 'misty', x: 8, y: 6, dir: 'down', event: 'ondine' },
      { id: 'psyduck', mon: 54, x: 10, y: 7, dir: 'down', talk: () => [['', 'Psykokwak : Psy… ? (Il se tient la tête. Il a encore la migraine.)']] }
    ],
    route25_leo: [
      { id: 'leo', mon: 35, x: 10, y: 6, dir: 'down', event: 'leo', when: f => !f.leo },
      { id: 'bill', look: 'bill', x: 7, y: 5, dir: 'down', talk: () => [['Léo', 'Merci encore ! Si tu croises un Pokémon rare, montre-le-moi !']], when: f => !!f.leo }
    ],
    route6: [
      { id: 'sq1', mon: 7, x: 11, y: 21, dir: 'right', talk: () => [['', 'Carapuce : Cara cara ! (Il remonte ses lunettes de soleil.)']] },
      { id: 'sq2', mon: 7, x: 14, y: 21, dir: 'left', talk: () => [['', 'Carapuce : Carapuce ! (Il prend la pose.)']] }
    ],
    carmin_arene: [{ id: 'surge', look: 'lt_surge', x: 5, y: 2, dir: 'down', event: 'surge' }]
  });

  /** Les déclencheurs de l'histoire : quand on entre dans une zone (cases de la carte). */
  const ZONES = {
    mont3: [{ x0: 9, y0: 8, x1: 19, y1: 11, ev: 'rocket', when: f => !f.rocket1 }],
    azuria: [{ x0: 22, y0: 3, x1: 24, y1: 6, ev: 'regis2', when: f => !f.regis2 }]
  };

  CHAPTERS.splice(4, 1,
    { title: 'Le Mont Sélénite', goal: 'Prends la Route 3 à l\'est d\'Argenta et traverse le Mont Sélénite jusqu\'à Azuria.',
      intro: [['', 'Chapitre 4 · Le Mont Sélénite'], ['Pierre', 'Je confie l\'arène à mon père. Moi, je veux devenir Éleveur Pokémon ! Je te suis jusqu\'au Mont Sélénite.'],
              ['Pierre', 'Fais attention : il paraît que la Team Rocket veut voler la Pierre Lune…']] },
    { title: 'Azuria et Ondine', goal: 'Défie Ondine, la championne de l\'arène d\'Azuria.',
      intro: [['', 'Chapitre 5 · Azuria et Ondine'], ['Fille rousse', 'Hé, toi ! Tu me dois un vélo ! … Ah non, pardon, je t\'ai pris pour quelqu\'un d\'autre.'],
              ['', 'Azuria, la ville de l\'eau. Son arène est tenue par Ondine… et au nord, le Pont Pépite mène chez Léo.']] },
    { title: 'Carmin sur Mer', goal: 'Prends la Route 5 au sud d\'Azuria, passe par le Souterrain et défie le Major Bob à Carmin sur Mer.',
      intro: [['', 'Chapitre 6 · Carmin sur Mer'], ['Ondine', 'Je viens avec toi ! Tant que tu ne m\'as pas remboursé ce vélo, je ne te lâche pas !'],
              ['', 'Au sud d\'Azuria, la Route 5 et le Souterrain mènent à Carmin sur Mer, la ville du port.']] },
    { title: 'À suivre…', goal: 'La suite de l\'aventure (l\'Océane, Safrania…) arrive bientôt !',
      intro: [['', 'Chapitre 7 · À suivre'], ['', 'Bravo ! Trois badges ! La suite arrive bientôt : la grande fête de l\'Océane et la ville de Safrania.']] });

  // ---------------- Chapitres 7 à 9 : l'Océane, la Grotte, Lavanville et la Tour Pokémon ----------------
  Object.assign(MAPS, {
    route9: { name: 'Route 9', ch: 8, music: 'forest', doors: {} },
    route10: { name: 'Route 10', ch: 8, music: 'forest', doors: { POWER_PLANT: 'centrale' } },
    grotte1: { name: 'Grotte', ch: 8, music: 'cave', doors: {}, dark: true },
    grotte2: { name: 'Grotte · Sous-sol', ch: 8, music: 'cave', doors: {}, dark: true },
    lavanville: { name: 'Lavanville', ch: 9, music: 'cave', wild: null, doors: {} }
  });
  const ROOMS3 = {
    ssanne: ['Quai de l\'Océane', 7], ssanne_1f: ['L\'Océane · Pont 1', 7], ssanne_2f: ['L\'Océane · Pont 2', 7], ssanne_3f: ['L\'Océane · Pont 3', 7],
    ssanne_b1f: ['L\'Océane · Cale', 7], ssanne_pont: ['L\'Océane · Pont supérieur', 7], ssanne_cuisine: ['L\'Océane · Cuisines', 7], ssanne_capitaine: ['Cabine du capitaine', 7],
    route10_centre: ['Centre Pokémon de la Grotte', 8], lavanville_centre: ['Centre Pokémon de Lavanville', 9], lavanville_boutique: ['Boutique de Lavanville', 9],
    lavanville_fuji: ['Maison de M. Fuji', 9], lavanville_maison1: ['Maison de Lavanville', 9], lavanville_maison2: ['Maison du Sage', 9]
  };
  for (let i = 1; i <= 7; i++) ROOMS3['ssanne_1f_c' + i] = ['L\'Océane · Cabine', 7];
  for (let i = 1; i <= 6; i++) ROOMS3['ssanne_2f_c' + i] = ['L\'Océane · Cabine', 7];
  for (let i = 1; i <= 5; i++) ROOMS3['ssanne_b1f_c' + i] = ['L\'Océane · Cabine des marins', 7];
  for (let i = 1; i <= 7; i++) ROOMS3['tour' + i] = ['Tour Pokémon · ' + i + (i === 1 ? 'er' : 'e') + ' étage', 9];
  for (const k in ROOMS3) MAPS[k] = { name: ROOMS3[k][0], ch: ROOMS3[k][1], music: /^tour/.test(k) ? 'cave' : 'village', wild: null, doors: {}, inside: true };
  CLOSED.Route12 = 'Un énorme Ronflex dort au milieu de la Route 12. Impossible de passer !';
  CLOSED.Route8 = 'La Route 8 mène à Céladopole. La suite de l\'aventure arrive bientôt !';
  DOORS.centrale = 'La Centrale électrique est fermée. On y entend des grésillements… un Pokémon Électrik légendaire ?';

  Object.assign(SIGNS, {
    Route9_EventScript_RouteSign: 'Route 9 — Azuria ↔ Grotte',
    Route10_EventScript_NorthRockTunnelSign: 'Grotte — Il fait très noir à l\'intérieur !',
    Route10_EventScript_SouthRockTunnelSign: 'Grotte — Sortie sud, Lavanville est tout près.',
    Route10_EventScript_PowerPlantSign: 'Centrale électrique',
    Route10_EventScript_NorthRouteSign: 'Route 10 — Azuria ↔ Lavanville',
    Route10_EventScript_SouthRouteSign: 'Route 10 — Lavanville',
    LavenderTown_EventScript_TownSign: 'Lavanville — La ville noble et violette.',
    LavenderTown_EventScript_SilphScopeNotice: 'Avis : des fantômes ont été vus dans la Tour Pokémon. Âmes sensibles, s\'abstenir !',
    LavenderTown_EventScript_VolunteerHouseSign: 'Maison des Pokémon de M. Fuji',
    LavenderTown_EventScript_PokemonTowerSign: 'Tour Pokémon — Ici reposent les Pokémon disparus.'
  });
  Object.assign(TALK, {
    SSAnne_1F_Corridor_EventScript_Sailor: 'Bienvenue à bord de l\'Océane ! Ce soir, grande fête pour tous les dresseurs !',
    SSAnne_1F_Corridor_EventScript_WorkerM: 'Il paraît que deux serveurs bizarres et un Miaouss se sont glissés à bord…',
    SSAnne_2F_Corridor_EventScript_Sailor: 'Le capitaine est dans sa cabine, au bout du couloir. Il n\'a pas l\'air bien…',
    SSAnne_3F_Corridor_EventScript_Sailor: 'Le pont supérieur est par là. Attention, ça tangue !',
    SSAnne_Deck_EventScript_BaldingMan: 'Je n\'aime pas ce ciel… Une tempête approche.',
    SSAnne_Deck_EventScript_Sailor: 'Ahoy ! Les Pokémon Eau adorent sauter près du bateau.',
    SSAnne_Deck_EventScript_Youngster: 'Je suis venu pour la fête, mais j\'ai le mal de mer…',
    SSAnne_Kitchen_EventScript_Chef1: 'Ce soir au menu : Magicarpe à la crème ! … Je plaisante !',
    SSAnne_Kitchen_EventScript_Chef2: 'Le capitaine ne mange plus rien. Il a le mal de mer, le pauvre.',
    SSAnne_Kitchen_EventScript_Chef3: 'Sors de ma cuisine ! … Bon, d\'accord, prends un petit gâteau.',
    SSAnne_Kitchen_EventScript_Chef4: 'Un Miaouss a volé du poisson tout à l\'heure. Et il parlait !',
    SSAnne_Kitchen_EventScript_Chef5: 'Les dresseurs mangent beaucoup. Leurs Pokémon encore plus !',
    SSAnne_Kitchen_EventScript_Chef6: 'Je prépare la fête des dresseurs. Tout doit être parfait !',
    SSAnne_Kitchen_EventScript_Chef7: 'Psst ! Le capitaine a appris Coupe à son Pokémon. Pratique pour couper les arbres !',
    SSAnne_1F_Room1_EventScript_Gentleman: 'Un dresseur m\'a échangé son Papilusion contre mon Rattata… On a tous les deux pleuré en se quittant !',
    SSAnne_1F_Room2_EventScript_Woman: 'Les dresseurs de l\'Océane viennent du monde entier !',
    SSAnne_1F_Room3_EventScript_LittleGirl: 'Mon Grodoudou fait des bulles quand il dort !',
    SSAnne_1F_Room3_EventScript_Wigglytuff: 'Grodoudou : Grooo… (Il est tout doux.)',
    SSAnne_1F_Room3_EventScript_BaldingMan: 'Ma fille adore son Grodoudou.',
    SSAnne_1F_Room4_EventScript_Woman: 'J\'ai vu un vendeur de Magicarpe sur le quai… Méfie-toi des bonnes affaires !',
    SSAnne_1F_Room6_EventScript_Woman: 'La croisière dure une semaine. J\'espère qu\'il fera beau !',
    SSAnne_2F_Room1_EventScript_Gentleman: 'Le capitaine est un grand dresseur. Mais un piètre marin !',
    SSAnne_2F_Room3_EventScript_Gentleman: 'J\'ai un Pokémon de chaque type. Enfin, presque !',
    SSAnne_2F_Room3_EventScript_OldMan: 'Dans ma jeunesse, on voyageait en Lokhlass sur la mer !',
    SSAnne_2F_Room5_EventScript_Gentleman: 'Les Pokémon d\'ici sont si raffinés…',
    SSAnne_2F_Room5_EventScript_LittleBoy: 'Je veux être capitaine plus tard ! Ou dresseur !',
    SSAnne_2F_Room6_EventScript_Woman1: 'Quelle belle fête ! On danse avec ses Pokémon !',
    SSAnne_2F_Room6_EventScript_Woman2: 'Mon Pokémon a mangé tout le buffet…',
    SSAnne_B1F_Room5_EventScript_Boy: 'Mon Machopeur soulève les caisses de la cale. Il est super fort !',
    SSAnne_B1F_Room5_EventScript_Machoke: 'Machopeur : Machoo ! (Il porte trois caisses à la fois.)',
    Route10_PokemonCenter_1F_EventScript_Gentleman: 'La Grotte est noire comme la nuit. Avance doucement !',
    Route10_PokemonCenter_1F_EventScript_FatMan: 'Il paraît qu\'un Électhor dort dans la Centrale électrique…',
    Route10_PokemonCenter_1F_EventScript_Youngster: 'Après la Grotte, c\'est Lavanville. Une ville un peu triste…',
    Route10_PokemonCenter_1F_EventScript_Aide: 'Je travaille pour le Prof. Chen. Il dit que ton Pokédex avance bien !',
    LavenderTown_EventScript_LittleGirl: 'Tu crois aux fantômes ? Moi, j\'en ai vu un dans la Tour Pokémon !',
    LavenderTown_EventScript_WorkerM: 'La Team Rocket est montée dans la Tour Pokémon ! M. Fuji a disparu…',
    LavenderTown_EventScript_Boy: 'Les gens de Lavanville viennent prier pour leurs Pokémon dans la Tour.',
    LavenderTown_PokemonCenter_1F_EventScript_Gentleman: 'Le soir, on entend des rires dans la Tour Pokémon… Ce sont des Spectrum, paraît-il.',
    LavenderTown_PokemonCenter_1F_EventScript_Lass: 'Un Spectrum adore faire des farces. Il a fait rire une petite fille toute la nuit !',
    LavenderTown_PokemonCenter_1F_EventScript_Youngster: 'Les Pokémon Spectre ne craignent pas les attaques Normal !',
    LavenderTown_PokemonCenter_1F_EventScript_BaldingMan: 'M. Fuji est un homme bon. Il s\'occupe des Pokémon abandonnés.',
    LavenderTown_Mart_EventScript_BaldingMan: 'Les Total Soin, c\'est utile contre les Pokémon qui endorment.',
    LavenderTown_Mart_EventScript_Rocker: 'Les fantômes, ça n\'existe pas… Hein ? C\'était quoi ce bruit ?!',
    LavenderTown_Mart_EventScript_Youngster: 'Je vends des souvenirs de la Tour Pokémon. Brr…',
    LavenderTown_House1_EventScript_CooltrainerF: 'Cet Osselait a perdu sa maman à cause de la Team Rocket… Il pleure souvent sous son crâne.',
    LavenderTown_House1_EventScript_Cubone: 'Osselait : Osse… (Il serre son os très fort.)',
    LavenderTown_House2_EventScript_NameRater: 'Je suis le Sage des noms. Ton Pokémon a un très joli nom !',
    LavenderTown_VolunteerPokemonHouse_EventScript_Nidorino: 'Nidorino : Nido ! (Il joue avec les enfants.)',
    LavenderTown_VolunteerPokemonHouse_EventScript_Psyduck: 'Psykokwak : Psy ? (Encore un mal de tête.)',
    LavenderTown_VolunteerPokemonHouse_EventScript_LittleBoy: 'M. Fuji nous a recueillis, moi et ces Pokémon.',
    LavenderTown_VolunteerPokemonHouse_EventScript_Youngster: 'M. Fuji est parti à la Tour Pokémon… Il n\'est pas revenu !',
    LavenderTown_VolunteerPokemonHouse_EventScript_LittleGirl: 'Les Pokémon abandonnés trouvent une famille ici.',
    PokemonTower_1F_EventScript_WorkerF: 'Ici reposent les Pokémon disparus. Prie pour eux en silence.',
    PokemonTower_1F_EventScript_Channeler: 'Je sens des esprits… Ils sont nombreux, plus haut dans la Tour.',
    PokemonTower_1F_EventScript_Woman1: 'Mon Rattata… Tu me manques tellement.',
    PokemonTower_1F_EventScript_Woman2: 'On dit que l\'esprit d\'un Ossatueur hante le 6e étage.',
    PokemonTower_1F_EventScript_BaldingMan: 'Je viens chaque jour pour mon vieux Caninos. Il était si fidèle.',
    PokemonTower_2F_EventScript_Channeler: 'Les fantômes de la Tour aiment jouer des tours… comme un certain Spectrum.',
    PokemonTower_5F_EventScript_Channeler: 'Ce cercle est sacré. Tes Pokémon y retrouvent leurs forces.'
  });
  Object.assign(CLASSES, { channeler: 'Mystimaniac', poke_maniac: 'Pokémaniac', fisher: 'Pêcheur', chef: 'Cuisinier', worker_m: 'Ouvrier' });

  Object.assign(NPCS, {
    ssanne_2f: [{ id: 'regis3', look: 'blue', x: 30, y: 3, dir: 'down', event: 'regis3', when: f => !f.regis3 }],
    ssanne_pont: [
      { id: 'jessie2', look: 'rocket_f', x: 10, y: 6, dir: 'down', event: 'rocket2', when: f => !f.rocket2 },
      { id: 'james2', look: 'rocket_m', x: 11, y: 6, dir: 'down', event: 'rocket2', when: f => !f.rocket2 },
      { id: 'meowth2', mon: 52, x: 12, y: 6, dir: 'down', event: 'rocket2', when: f => !f.rocket2 }
    ],
    ssanne_capitaine: [{ id: 'captain', look: 'captain', x: 5, y: 4, dir: 'down', event: 'captain' }],
    tour2: [{ id: 'regis4', look: 'blue', x: 16, y: 5, dir: 'down', event: 'regis4', when: f => !f.regis4 }],
    tour6: [{ id: 'ghost', mon: 105, ghost: true, x: 12, y: 14, dir: 'up', event: 'ghost', when: f => !f.ossatueur }],
    tour7: [{ id: 'fuji', look: 'mr_fuji', x: 11, y: 4, dir: 'down', event: 'fuji', when: f => !f.fuji }],
    lavanville_fuji: [{ id: 'fuji2', look: 'mr_fuji', x: 3, y: 3, dir: 'down', event: 'fujiHome', when: f => !!f.fuji }]
  });
  Object.assign(ZONES, {
    ssanne_2f: [{ x0: 29, y0: 5, x1: 32, y1: 7, ev: 'regis3', when: f => !f.regis3 }],
    ssanne_pont: [{ x0: 3, y0: 5, x1: 15, y1: 11, ev: 'rocket2', when: f => !f.rocket2 }],
    tour2: [{ x0: 13, y0: 3, x1: 19, y1: 8, ev: 'regis4', when: f => !f.regis4 }],
    tour6: [{ x0: 10, y0: 11, x1: 13, y1: 15, ev: 'ghost', when: f => !f.ossatueur }]
  });

  CHAPTERS.splice(7, 1,
    { title: 'L\'Océane', goal: 'Monte à bord de l\'Océane avec le billet de Léo et trouve le capitaine du bateau.',
      intro: [['', 'Chapitre 7 · L\'Océane'], ['Ondine', 'Une fête sur un bateau de croisière ? Et c\'est gratuit avec le billet de Léo ? On y va !'],
              ['', 'L\'Océane est amarrée au port de Carmin sur Mer, au sud de la ville.']] },
    { title: 'La Grotte et Lavanville', goal: 'Coupe l\'arbre à l\'est d\'Azuria, prends la Route 9 et traverse la Grotte jusqu\'à Lavanville.',
      intro: [['', 'Chapitre 8 · La Grotte et Lavanville'], ['Pierre', 'Me revoilà ! Pour aller à Lavanville, il faut passer par la Grotte, à l\'est d\'Azuria. Il y fait noir comme dans un four !'],
              ['Ondine', 'Et l\'arbre qui bloque la Route 9 ? … Ah, mais tu as appris Coupe sur l\'Océane !']] },
    { title: 'La Tour Pokémon', goal: 'Monte au sommet de la Tour Pokémon de Lavanville et sauve M. Fuji de la Team Rocket.',
      intro: [['', 'Chapitre 9 · La Tour Pokémon'], ['Petite fille', 'Tu vas dans la Tour Pokémon ? Il y a des fantômes là-haut… et la Team Rocket a enlevé M. Fuji !'],
              ['Ondine', 'D… des fantômes ? Je… je t\'attends ici, d\'accord ?']] },
    { title: 'À suivre…', goal: 'La suite de l\'aventure (Céladopole, Érika…) arrive bientôt !',
      intro: [['', 'Chapitre 10 · À suivre'], ['', 'Bravo ! La suite arrive bientôt : Céladopole, son grand magasin et la championne Érika.']] });

  // ---------------- Chapitre 10 : Céladopole et Érika ----------------
  const GRASS = [43, 44, 69, 70, 102, 114, 1, 2, 46, 47, 48, 12];
  Object.assign(MAPS, {
    route8: { name: 'Route 8', ch: 10, music: 'forest', doors: { WEST_ENTRANCE: 'safrania' } },
    route7: { name: 'Route 7', ch: 10, music: 'forest', doors: { EAST_ENTRANCE: 'safrania' } },
    celadopole: { name: 'Céladopole', ch: 10, music: 'village', wild: null, doors: { PRIZE_ROOM: 'prix' } }
  });
  const ROOMS4 = {
    souterrain_e: ['Souterrain · Entrée est', 10], souterrain2: ['Souterrain Est-Ouest', 10], souterrain_o: ['Souterrain · Entrée ouest', 10],
    celadopole_centre: ['Centre Pokémon de Céladopole', 10], celadopole_arene: ['Arène de Céladopole', 10], celadopole_magasin: ['Grand Magasin de Céladopole', 10],
    celadopole_casino: ['Salle de jeux', 10], celadopole_resto: ['Restaurant de Céladopole', 10], celadopole_hotel: ['Hôtel de Céladopole', 10],
    celadopole_maison: ['Maison de Céladopole', 10], celadopole_parfum: ['Résidence de Céladopole', 10]
  };
  for (const k in ROOMS4) MAPS[k] = { name: ROOMS4[k][0], ch: ROOMS4[k][1], music: /^souterrain/.test(k) ? 'cave' : 'village', wild: null, doors: {}, inside: true };
  MAPS.celadopole_arene.pool = GRASS;
  delete CLOSED.Route8;
  CLOSED.Route16 = 'La Route 16 mène à la Piste Cyclable. Il faut un vélo… La suite de l\'aventure arrive bientôt !';
  DOORS.prix = 'Le comptoir des lots de la Salle de jeux. Il faut des jetons… et tu n\'en as pas !';
  Object.assign(CLASSES, { biker: 'Motard', old_man_1: 'Papi' });
  Object.assign(SIGNS, {
    Route8_EventScript_RouteSign: 'Route 8 — Lavanville ↔ Safrania',
    Route8_EventScript_UndergroundPathSign: 'Souterrain — Route 7 ↔ Route 8',
    Route7_EventScript_UndergroundPathSign: 'Souterrain — Route 7 ↔ Route 8',
    CeladonCity_EventScript_CitySign: 'Céladopole — La ville des rêves aux couleurs de l\'arc-en-ciel.',
    CeladonCity_EventScript_GymSign: 'Arène de Céladopole · Championne : Érika — La princesse de la nature.',
    CeladonCity_EventScript_DeptStoreSign: 'Grand Magasin de Céladopole — Tout pour les dresseurs !',
    CeladonCity_EventScript_GameCornerSign: 'Salle de jeux de Céladopole — Ouvert jour et nuit.',
    CeladonCity_EventScript_MansionSign: 'Résidence de Céladopole',
    CeladonCity_EventScript_TrainerTips1: 'Astuce : les Pokémon Plante craignent le Feu, la Glace, le Poison, le Vol et l\'Insecte !',
    CeladonCity_EventScript_TrainerTips2: 'Astuce : Poudre Dodo et Para-Spore sont redoutables. Pense aux Réveil et aux Total Soin !'
  });
  Object.assign(TALK, {
    CeladonCity_EventScript_LittleGirl: 'Érika fait les meilleurs parfums de Kanto ! Sa boutique sent si bon…',
    CeladonCity_EventScript_Woman: 'Le Grand Magasin a cinq étages ! Enfin, il paraît. Moi je reste au premier.',
    CeladonCity_EventScript_OldMan1: 'Mon Ptitard a évolué en Tartard ! Il nage dans la fontaine tous les matins.',
    CeladonCity_EventScript_OldMan2: 'Les Pokémon de la Salle de jeux ? On dit que la Team Rocket s\'y cache…',
    CeladonCity_EventScript_FatMan: 'Mon Tartard et moi, on fait de la gym ensemble ! Une, deux !',
    CeladonCity_EventScript_Poliwrath: 'Tartard : Taaar ! (Il fait des pompes.)',
    CeladonCity_EventScript_RocketGrunt1: 'Hé, gamin ! Tu n\'as rien vu, compris ? Circule !',
    CeladonCity_EventScript_RocketGrunt2: 'La Salle de jeux est à nous… euh, je veux dire, j\'aime bien jouer, c\'est tout !',
    CeladonCity_EventScript_SoftboiledTutor: 'Les Pokémon Plante d\'Érika adorent le soleil de Céladopole.',
    CeladonCity_EventScript_Boy: 'Il paraît qu\'Érika s\'endort parfois pendant ses combats… mais elle est très forte !',
    CeladonCity_EventScript_SilphCoScientist: 'Je travaille à Sylphe SARL, à Safrania. Mais le garde ne me laisse plus rentrer…',
    CeladonCity_PokemonCenter_1F_EventScript_Gentleman: 'Céladopole est la plus grande ville de Kanto. On y trouve de tout !',
    CeladonCity_PokemonCenter_1F_EventScript_CooltrainerF: 'Érika est si élégante… Ses Pokémon sentent bon les fleurs.',
    CeladonCity_PokemonCenter_1F_EventScript_Youngster: 'Contre l\'arène d\'Érika, prends des Pokémon Feu ou Vol !',
    CeladonCity_DepartmentStore_1F_EventScript_Receptionist: 'Bienvenue au Grand Magasin ! Les étages sont en travaux, désolée.',
    CeladonCity_Condominiums_1F_EventScript_TeaWoman: 'Tu veux du thé ? Ah, il n\'en reste plus… Les gardes de Safrania ont tout bu !',
    CeladonCity_Condominiums_1F_EventScript_Meowth: 'Miaouss : Miaou ! (Il ne parle pas, lui.)',
    CeladonCity_Condominiums_1F_EventScript_Clefairy: 'Mélofée : Mélo mélo !',
    CeladonCity_Condominiums_1F_EventScript_Nidoran: 'Nidoran : Nido ?',
    CeladonCity_GameCorner_EventScript_InfoClerk: 'Bienvenue à la Salle de jeux ! Les machines sont en panne aujourd\'hui.',
    CeladonCity_GameCorner_EventScript_CoinsClerk: 'Des jetons ? Désolé, il n\'y en a plus.',
    CeladonCity_GameCorner_EventScript_GymGuy: 'Psst ! Le poster au fond de la salle… Il cache quelque chose, j\'en suis sûr.'
  });
  Object.assign(NPCS, {
    celadopole_arene: [{ id: 'erika', look: 'erika', x: 6, y: 4, dir: 'down', event: 'erika' }]
  });
  CHAPTERS.splice(10, 1,
    { title: 'Céladopole et Érika', goal: 'Prends la Route 8 à l\'ouest de Lavanville, passe par le Souterrain et la Route 7, puis défie Érika à Céladopole.',
      intro: [['', 'Chapitre 10 · Céladopole et Érika'], ['Pierre', 'Prochaine étape : Céladopole ! Le garde de Safrania ne laisse passer personne, alors on passe par le Souterrain.'],
              ['Ondine', 'Céladopole ! Le Grand Magasin, les parfums… et la championne Érika, qui adore les Pokémon Plante.'],
              ['Pierre', 'Son arène est cachée derrière des petits arbres. Heureusement que tu connais Coupe !']] },
    { title: 'À suivre…', goal: 'La suite de l\'aventure (la Team Rocket de la Salle de jeux, Safrania…) arrive bientôt !',
      intro: [['', 'Chapitre 11 · À suivre'], ['', 'Bravo ! Quatre badges ! La suite arrive bientôt : la Team Rocket se cache sous la Salle de jeux…']] });

  // ---------------- Les épisodes du chapitre 6 : les starters de l'animé (Salamèche, Bulbizarre, Carapuce) ----------------
  // Version de Nika : plus de chapitres entre les chapitres. Ils se jouent avant le Major Bob.
  CHAPTERS[6].pre = [
    { id: 'sala', title: 'Salamèche abandonné', goal: 'Au nord d\'Azuria, après le Pont Pépite, un Salamèche attend sur un rocher de la Route 24. Va la voir.',
      intro: [['', 'Chapitre 6 · Salamèche abandonné'], ['Ondine', 'Je viens avec toi ! Tant que tu ne m\'as pas remboursé ce vélo, je ne te lâche pas !'],
              ['Pierre', 'Avant de partir vers Carmin… Un pêcheur m\'a parlé d\'un Salamèche qui attend son dresseur depuis des jours, au nord, sur la Route 24.'],
              ['Ondine', 'Avec la pluie qui arrive ? Sa flamme va s\'éteindre ! Il faut y aller tout de suite !']] },
    { id: 'bulbi', title: 'Le village caché', goal: 'Prends la Route 5 au sud d\'Azuria et trouve le village caché où Mélodie soigne les Pokémon blessés.',
      intro: [['', 'Chapitre 7 · Le village caché'], ['Pierre', 'On dit qu\'au bout de la Route 5, une fille cache un village pour les Pokémon blessés ou abandonnés.'],
              ['Ondine', 'Et qu\'un Bulbizarre très fort le protège. Personne n\'arrive à le battre !']] },
    { id: 'cara', title: 'L\'Escouade Carapuce', goal: 'Passe par le Souterrain jusqu\'à la Route 6 : l\'Escouade Carapuce y fait la loi.',
      intro: [['', 'Chapitre 8 · L\'Escouade Carapuce'], ['Pierre', 'Au bout du Souterrain, la Route 6 mène à Carmin sur Mer.'],
              ['Ondine', 'Attention : une bande de Carapuce à lunettes de soleil y joue des tours aux voyageurs. Même l\'Agent Jenny n\'arrive pas à les attraper !']] }
  ];
  Object.assign(CHAPTERS[6], {
    goal: 'Continue la Route 6 jusqu\'à Carmin sur Mer et défie le Major Bob dans son arène.',
    intro: [['', 'Chapitre 6 · Carmin sur Mer'], ['', 'Au bout de la Route 6, Carmin sur Mer, la ville du port, et son arène électrique.'],
            ['Pierre', 'Le Major Bob a caché son bureau derrière une barrière électrique. Il paraît que les interrupteurs sont dans les poubelles…']]
  });
  NPCS.route24 = [
    { id: 'charmander', mon: 4, x: 5, y: 9, dir: 'down', event: 'sala', when: f => !f.sala },
    { id: 'damien', look: 'cooltrainer_m', x: 8, y: 8, dir: 'left', event: 'sala', when: f => !f.sala }
  ];
  NPCS.route5 = [
    { id: 'melodie', look: 'picnicker', x: 17, y: 30, dir: 'down', event: 'bulbi' },
    { id: 'bulbasaur', mon: 1, x: 18, y: 31, dir: 'left', event: 'bulbi', when: f => !f.bulbi },
    { id: 'v_oddish', mon: 43, x: 16, y: 32, dir: 'right', talk: () => [['', 'Mystherbe : Mys ! (Sa feuille est entourée d\'un bandage.)']] },
    { id: 'v_rattata', mon: 19, x: 20, y: 29, dir: 'down', talk: () => [['', 'Rattata : Rattaaa… (Il boite un peu, mais il a l\'air heureux ici.)']] },
    { id: 'v_pidgey', mon: 16, x: 21, y: 31, dir: 'left', talk: () => [['', 'Roucool : Rou rou ! (Son aile guérit bien.)']] }
  ];
  NPCS.route6 = NPCS.route6.concat([
      { id: 'squirtle', mon: 7, x: 12, y: 19, dir: 'down', event: 'cara', when: f => !f.cara },
      { id: 'jenny', look: 'cooltrainer_f', x: 8, y: 19, dir: 'right', event: 'jenny' }
    ]);

  return { MAPS, NPCS, TRAINERS, SIGNS, SIGN_DEFAULT, TALK, CHAPTERS, CLOSED, DOORS, CLASSES, ZONES };
})();
