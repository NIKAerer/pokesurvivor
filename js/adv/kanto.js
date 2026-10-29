/* ============ kanto.js — les lieux de l'Aventure (version de Nika) ============
 * Chaque lieu est une grille de tuiles (32 px du monde) :
 *   .  herbe        ,  fleurs        g  hautes herbes (Pokémon sauvages)
 *   =  chemin       T  arbre         ~  eau          F  barrière
 *   r  rocher       S  panneau       D  porte (dans un bâtiment)
 *   H  maison  L  labo  C  Centre Pokémon  M  Boutique  G  Arène
 * Sorties : quand on sort de la carte par un bord, `exits` dit où l'on arrive.
 * Les personnages (npcs) apparaissent selon l'histoire (`when`).
 */
G.Kanto = (() => {
  const MAPS = {
    bourg: {
      name: 'Bourg Palette', music: 'village',
      rows: [
        'TTTTTTTTT==TTTTTTTTT',
        'T........==........T',
        'T..HHHH..==..HHHH..T',
        'T..HHHH..==..HHHH..T',
        'T..HDHH..==..HHDH..T',
        'T...=....==....=...T',
        'T...============...T',
        'T.,,.....==.....,,.T',
        'T.,,..S..==.....,,.T',
        'T........==........T',
        'T...FFFF.==.LLLLLL.T',
        'T...,,,,.==.LLLLLL.T',
        'T...FFFF.==.LLLLLL.T',
        'T........==.LLLDLL.T',
        'T........=======...T',
        'T.~~~~~~...........T',
        'T.~~~~~~...........T',
        'TTTTTTTTTTTTTTTTTTTT'
      ],
      exits: [{ edge: 'n', from: 9, to: 10, map: 'route1', x: 9, y: 30 }],
      doors: { '4,4': 'home', '15,4': 'rivalHome', '15,13': 'lab' },
      signs: { '6,8': 'Bourg Palette — Une ville aux couleurs pures et blanches.' },
      wild: null
    },
    route1: {
      name: 'Route 1', music: 'route',
      rows: [
        'TTTTTTTTT==TTTTTTTTT',
        'TT.......==.......TT',
        'TT.gggg..==..gggg.TT',
        'TT.gggg..==..gggg.TT',
        'TT.gggg..==..gggg.TT',
        'TT.......==.......TT',
        'TTTTT....==....TTTTT',
        'TT.......==.......TT',
        'TT...S...==.......TT',
        'TTggggg..==..ggggggT',
        'TTggggg..==..ggggggT',
        'TT.......==.......TT',
        'TT..rr...==...rr..TT',
        'TT.......==.......TT',
        'TTTTTTT..==..TTTTTTT',
        'TT.......==.......TT',
        'TT..gggggggggggg..TT',
        'TT..gggggggggggg..TT',
        'TT..gggggggggggg..TT',
        'TT.......==.......TT',
        'TT.......==...,,..TT',
        'TTTT.....==.....TTTT',
        'TT.ggg...==...ggg.TT',
        'TT.ggg...==...ggg.TT',
        'TT.......==.......TT',
        'TT..~~~~.==.......TT',
        'TT..~~~~.==.......TT',
        'TT.......==.......TT',
        'TT.ggggg.==.ggggg.TT',
        'TT.ggggg.==.ggggg.TT',
        'TT.......==.......TT',
        'TTTTTTTTT==TTTTTTTTT'
      ],
      exits: [
        { edge: 's', from: 9, to: 10, map: 'bourg', x: 9, y: 1 },
        { edge: 'n', from: 9, to: 10, map: 'jadielle', x: 11, y: 18 }
      ],
      signs: { '5,8': 'Route 1 — Bourg Palette ↔ Jadielle' },
      wild: [[16, 2, 4], [19, 2, 4], [21, 3, 4], [19, 3, 5]]
    },
    jadielle: {
      name: 'Jadielle', music: 'village',
      rows: [
        'TTTTTTTTTTT==TTTTTTTTTTT',
        'T..........==..........T',
        'T.GGGGGG...==...MMMM...T',
        'T.GGGGGG...==...MMMM...T',
        'T.GGGGGG...==...MMDM...T',
        'T.GGGDGG...==.....=....T',
        'T....==============....T',
        'T..........==..........T',
        'T.,,.......==.......,,.T',
        'T..HHHH....==...CCCCC..T',
        'T..HHHH....==...CCCCC..T',
        'T..HDHH....==...CCDCC..T',
        'T...=......==.....=....T',
        'T...===============....T',
        'T..........==..........T',
        'T..~~~.....==.....S....T',
        'T..~~~.....==..........T',
        'T..........==..........T',
        'T..........==..........T',
        'TTTTTTTTTTT==TTTTTTTTTTT'
      ],
      exits: [
        { edge: 's', from: 11, to: 12, map: 'route1', x: 9, y: 1 },
        { edge: 'n', from: 11, to: 12, map: 'foret', x: 10, y: 38 }
      ],
      doors: { '5,5': 'gymJadielle', '18,4': 'mart', '4,11': 'house', '18,11': 'center' },
      signs: { '18,15': 'Jadielle — Une ville éternellement verte.' },
      wild: null
    },
    foret: { name: 'Forêt de Jade', music: 'forest', rows: null,
      exits: [
        { edge: 's', from: 9, to: 11, map: 'jadielle', x: 11, y: 1 },
        { edge: 'n', from: 9, to: 11, map: 'argenta', x: 11, y: 18 }
      ],
      wild: [[10, 3, 5], [13, 3, 5], [11, 4, 6], [14, 4, 6], [25, 4, 6], [10, 5, 6]]
    },
    argenta: {
      name: 'Argenta', music: 'village',
      rows: [
        'TTTTTTTTTTTTTTTTTTTTTTTT',
        'T......................T',
        'T...GGGGGGGG...CCCCC...T',
        'T...GGGGGGGG...CCCCC...T',
        'T...GGGGGGGG...CCDCC...T',
        'T...GGGGDGGG.....=.....T',
        'T.......===========....T',
        'T..........==..........T',
        'T.rr.......==.......rr.T',
        'T..HHHH....==...MMMM...T',
        'T..HHHH....==...MMMM...T',
        'T..HDHH....==...MMDM...T',
        'T...=......==.....=....T',
        'T...===============....T',
        'T..........==..........T',
        'T.rr...S...==......rr..T',
        'T..........==..........T',
        'T..........==..........T',
        'T..........==..........T',
        'TTTTTTTTTTT==TTTTTTTTTTT'
      ],
      exits: [{ edge: 's', from: 11, to: 12, map: 'foret', x: 10, y: 1 }],
      doors: { '8,5': 'gymArgenta', '17,4': 'center', '18,11': 'mart', '4,11': 'house' },
      signs: { '7,15': 'Argenta — Une ville grise comme la pierre.' },
      wild: null
    }
  };

  // La forêt : un labyrinthe d'arbres creusé une fois pour toutes (même tracé à chaque partie).
  (function forest() {
    const W = 22, H = 40, g = Array.from({ length: H }, () => Array(W).fill('T'));
    let seed = 4242;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const dig = (x, y, c = '.') => { if (x > 0 && x < W - 1 && y >= 0 && y < H && g[y][x] === 'T') g[y][x] = c; };
    // Chemin (3 tuiles de large) qui serpente du bas au haut, toujours relié.
    let x = 10, prev = 10;
    for (let y = H - 1; y >= 0; y--) {
      if (y <= 3 || y >= H - 3) x = 10;
      else if (y % 5 === 0) x = Math.max(3, Math.min(W - 4, x + (rnd() < 0.5 ? -4 : 4)));
      if (x !== prev) for (let xx = Math.min(prev, x) - 1; xx <= Math.max(prev, x) + 1; xx++) { dig(xx, y, '='); dig(xx, y + 1, '='); }
      for (let k = -1; k <= 1; k++) dig(x + k, y, '=');
      prev = x;
    }
    // Clairières de hautes herbes de part et d'autre.
    for (let y = 2; y < H - 2; y++) for (let xx = 1; xx < W - 1; xx++) {
      if (g[y][xx] !== 'T') continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]].some(([dx, dy]) => (g[y + dy] || [])[xx + dx] === '=');
      if (near && rnd() < 0.55) g[y][xx] = 'g';
    }
    for (let y = 4; y < H - 4; y += 7) { const cx = 3 + Math.floor(rnd() * (W - 6)); for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) dig(cx + dx - 1, y + dy, 'g'); }
    // Le Samouraï garde la sortie, au nord.
    g[1][8] = 'S';
    MAPS.foret.rows = g.map(r => r.join(''));
    MAPS.foret.signs = { '8,1': 'Forêt de Jade — Sortie vers Argenta' };
  })();

  /** Les personnages, selon l'avancée (flags). trainer: équipe [[dex, niveau]], sees: tuiles de vue. */
  const NPCS = {
    bourg: [
      { id: 'mom', look: 'mom', x: 5, y: 5, dir: 'down', talk: f => f.starter
        ? [['Maman', 'Prends soin de tes Pokémon ! Et n\'oublie pas de changer de sous-vêtements tous les jours !']]
        : [['Maman', 'Le grand jour ! Le Prof. Chen t\'attend devant son labo, au sud.']] },
      { id: 'chen', look: 'chen', x: 15, y: 14, dir: 'up', event: 'chen' },
      { id: 'rival1', look: 'rival', x: 12, y: 14, dir: 'right', when: f => f.starter && !f.rival1, event: 'rival1' },
      { id: 'kid', look: 'villager', x: 13, y: 8, dir: 'left', talk: () => [['Garçon', 'Il paraît qu\'on peut capturer des Pokémon dans les hautes herbes de la Route 1 !']] }
    ],
    route1: [
      { id: 'r1a', look: 'villager', x: 12, y: 13, dir: 'left', talk: () => [['Promeneur', 'Les Piafabec sont très rancuniers. Ne les embête pas !']] }
    ],
    jadielle: [
      { id: 'jold', look: 'villager', x: 8, y: 7, dir: 'down', talk: f => f.ch1done
        ? [['Vieil homme', 'La Forêt de Jade est au nord. Les Pokémon Insecte y pullulent !']]
        : [['Vieil homme', 'Bienvenue à Jadielle ! Le Centre Pokémon, c\'est le bâtiment au toit rouge.']] }
    ],
    foret: [
      { id: 'scout1', look: 'scout', x: 0, y: 30, dir: 'left', trainer: { name: 'Scout Léo', team: [[10, 5], [10, 5]], sees: 3, coins: 80,
        meet: 'Hé ! Toi aussi tu chasses les insectes ? Combat !', lose: 'Mes Chenipan…' } },
      { id: 'scout2', look: 'scout', x: 0, y: 18, dir: 'right', trainer: { name: 'Scout Mila', team: [[13, 6], [14, 6]], sees: 3, coins: 90,
        meet: 'Attention, mes Aspicot piquent !', lose: 'Bien joué…' } },
      { id: 'samurai', look: 'samurai', x: 0, y: 4, dir: 'down', trainer: { name: 'Le Samouraï', team: [[11, 7], [127, 9]], sees: 4, coins: 200,
        meet: 'Halte ! Tu viens de Bourg Palette ? Alors affronte-moi et mon Scarabrute !', lose: 'Quelle force… La sortie est juste derrière moi.' } }
    ],
    argenta: [
      { id: 'aold', look: 'villager', x: 13, y: 7, dir: 'down', talk: f => f.pierre
        ? [['Habitant', 'Tu as battu Pierre ? Incroyable ! La route vers le Mont Sélénite ouvrira bientôt.']]
        : [['Habitant', 'Le champion Pierre utilise des Pokémon Roche. L\'Eau et la Plante leur font très mal !']] }
    ]
  };

  // Place les dresseurs de la forêt sur le chemin (le tracé est généré).
  (function placeForest() {
    const rows = MAPS.foret.rows;
    for (const n of NPCS.foret) {
      const r = rows[n.y];
      let best = -1;
      for (let x = 1; x < r.length - 1; x++) if (r[x] === '=' && (best < 0 || (n.dir === 'left' ? x > best : x < best))) best = x;
      n.x = n.id === 'samurai' ? 10 : Math.max(1, Math.min(r.length - 2, best + (n.dir === 'left' ? 1 : -1)));
      if (rows[n.y][n.x] === 'T') rows[n.y] = rows[n.y].slice(0, n.x) + '.' + rows[n.y].slice(n.x + 1);
    }
  })();

  /** Les chapitres : titre, lieu, objectif affiché, et l'intro. */
  const CHAPTERS = [
    null,
    { title: 'Le départ', goal: 'Va voir le Prof. Chen devant son labo, puis rejoins Jadielle par la Route 1.',
      intro: [['', 'Bourg Palette. Aujourd\'hui, tu deviens dresseur Pokémon !'], ['Maman', 'Le Prof. Chen t\'attend devant son labo, au sud. Vas-y vite !']] },
    { title: 'La Forêt de Jade', goal: 'Traverse la Forêt de Jade au nord de Jadielle, jusqu\'à Argenta.',
      intro: [['', 'Chapitre 2 · La Forêt de Jade'], ['Infirmière Joëlle', 'La Forêt de Jade est au nord de Jadielle. On dit qu\'un samouraï y défie tous les voyageurs…']] },
    { title: 'Le Badge Roche', goal: 'Défie Pierre, le champion de l\'arène d\'Argenta.',
      intro: [['', 'Chapitre 3 · Le Badge Roche'], ['', 'Argenta ! L\'arène de Pierre est le grand bâtiment au nord-ouest.']] },
    { title: 'À suivre…', goal: 'La suite de l\'aventure (Mont Sélénite, Azuria…) arrive bientôt !',
      intro: [['', 'Chapitre 4 · À suivre'], ['', 'Bravo ! La suite de l\'aventure arrive bientôt : le Mont Sélénite et Azuria.']] }
  ];

  for (const k in MAPS) {
    const m = MAPS[k];
    const w = m.rows[0].length;
    if (m.rows.some(r => r.length !== w)) console.error('[Kanto] carte ' + k + ' : lignes de longueurs différentes');
  }

  return { MAPS, NPCS, CHAPTERS };
})();
