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
      name: 'Bourg Palette', music: 'village', wild: null,
      doors: { PLAYERS_HOUSE: 'home', RIVALS_HOUSE: 'rivalHome', OAKS_LAB: 'lab' },
      start: { x: 6, y: 8 }
    },
    route1: { name: 'Route 1', music: 'forest', wild: [[16, 2, 4], [19, 2, 4], [19, 3, 5], [16, 3, 5]], doors: {} },
    jadielle: {
      name: 'Jadielle', music: 'village', wild: null,
      doors: { POKEMON_CENTER: 'center', GYM: 'gymJadielle', MART: 'mart', SCHOOL: 'school', HOUSE: 'house' }
    },
    route2: {
      name: 'Route 2', music: 'forest', wild: [[16, 3, 5], [19, 3, 5], [10, 4, 5], [13, 4, 5], [29, 4, 6], [32, 4, 6]],
      doors: { FOREST_SOUTH_ENTRANCE: 'link', FOREST_NORTH_ENTRANCE: 'link', DIGLETTS_CAVE: 'cave', ROUTE2_HOUSE: 'house', EAST_BUILDING: 'house' }
    },
    foret: {
      name: 'Forêt de Jade', music: 'forest', wild: [[10, 3, 5], [13, 3, 5], [11, 4, 6], [14, 4, 6], [25, 3, 5], [10, 5, 6]],
      doors: { FOREST_SOUTH_ENTRANCE: 'link', FOREST_NORTH_ENTRANCE: 'link' }
    },
    argenta: {
      name: 'Argenta', music: 'village', wild: null,
      doors: { MUSEUM: 'museum', GYM: 'gymArgenta', MART: 'mart', POKEMON_CENTER: 'center', HOUSE: 'house' }
    }
  };

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
    PewterCity_EventScript_RunningShoesAide: 'Le Prof. Chen m\'a parlé de toi. Bon voyage !'
  };

  /** Personnages de l'histoire (cases de la carte). look = sprite du jeu (people/*.png). */
  const NPCS = {
    bourg: [
      { id: 'mom', look: 'mom', name: 'Maman', x: 7, y: 8, dir: 'down', talk: f => f.starter
        ? [['Maman', 'Prends soin de tes Pokémon ! Et n\'oublie pas de changer de sous-vêtements tous les jours !']]
        : [['Maman', 'Le grand jour ! Le Prof. Chen t\'attend devant son labo, au sud.']] },
      { id: 'chen', look: 'prof_oak', x: 17, y: 14, dir: 'left', event: 'chen' },
      { id: 'rival1', look: 'blue', x: 14, y: 14, dir: 'right', when: f => f.starter && !f.rival1, event: 'rival1' }
    ],
    route1: [],
    jadielle: [],
    route2: [],
    foret: [
      // Le Samouraï garde la sortie nord, comme dans l'animé.
      { id: 'samurai', look: 'black_belt', x: 5, y: 11, dir: 'down', trainer: { name: 'Le Samouraï', team: [[11, 7], [127, 9]], sees: 4, coins: 200,
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
    ViridianForest_EventScript_Charlie: { name: 'Scout Charlie', team: [[14, 8], [10, 8]], coins: 100, meet: 'Mes Pokémon sont prêts !', lose: 'Tu es trop fort…' }
  };

  /** Les chapitres : titre, objectif affiché, et l'intro. */
  const CHAPTERS = [
    null,
    { title: 'Le départ', goal: 'Va voir le Prof. Chen devant son labo, puis rejoins Jadielle par la Route 1, au nord.',
      intro: [['', 'Bourg Palette. Aujourd\'hui, tu deviens dresseur Pokémon !'], ['Maman', 'Le Prof. Chen t\'attend devant son labo, au sud-est. Vas-y vite !']] },
    { title: 'La Forêt de Jade', goal: 'Prends la Route 2 au nord de Jadielle et traverse la Forêt de Jade jusqu\'à Argenta.',
      intro: [['', 'Chapitre 2 · La Forêt de Jade'], ['Infirmière Joëlle', 'La Forêt de Jade est au nord, par la Route 2. On dit qu\'un samouraï y défie tous les voyageurs…']] },
    { title: 'Le Badge Roche', goal: 'Défie Pierre, le champion de l\'arène d\'Argenta.',
      intro: [['', 'Chapitre 3 · Le Badge Roche'], ['', 'Argenta ! L\'arène de Pierre est à l\'ouest de la ville.']] },
    { title: 'À suivre…', goal: 'La suite de l\'aventure (Mont Sélénite, Azuria…) arrive bientôt !',
      intro: [['', 'Chapitre 4 · À suivre'], ['', 'Bravo ! La suite de l\'aventure arrive bientôt : le Mont Sélénite et Azuria.']] }
  ];

  return { MAPS, NPCS, TRAINERS, SIGNS, SIGN_DEFAULT, TALK, CHAPTERS };
})();
