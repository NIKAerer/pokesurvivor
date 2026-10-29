/* ============ adventure.js — le mode Aventure (version de Nika) ============
 * L'histoire de l'anime à Kanto, chapitre par chapitre, façon Zelda :
 *   - pas de hordes ni de vagues : quelques Pokémon sauvages se promènent et
 *     n'attaquent que si tu t'approches (ou si tu les frappes) ;
 *   - un objectif au bout du chemin (flèche dorée) : le champion ou la Team
 *     Rocket de l'épisode, avec ses dialogues ;
 *   - captures : un sauvage mis K.O. reste sonné quelques secondes avec une
 *     Poké Ball au-dessus ; marche dessus pour la lancer. Le Pokémon de
 *     l'épisode (doré) se capture à coup sûr.
 * L'équipe de l'Aventure est à part (pas la Boîte) et se garde d'un chapitre à
 * l'autre : niveau, attaques, évolutions. Pas de cartes de niveau : les
 * Pokémon apprennent et renforcent leurs attaques tout seuls.
 *
 * Sauvegarde : save.adv = { team: [{ dex, lv, xp, moves: [[id, niveau]] }], done }
 *   team[0] mène, les 6 premiers partent en chapitre, les autres attendent.
 */
G.Adventure = (() => {
  const STARTERS = [1, 4, 7];
  const TRAVEL = 6;
  const LEARN = [4, 8, 13, 19, 26, 34];           // niveaux où l'on apprend une attaque (jusqu'à 4)
  const ATK_LV = 1.03;                             // +3 % de dégâts par niveau
  const CATCH = { 1: 0.75, 2: 0.6, 3: 0.45, 4: 0.3, 5: 0.15 };
  // Version de Nika (2026-10-29) : beaucoup moins d'expérience, et un niveau max par chapitre.
  const XP_K = 0.25;
  const capOf = i => 10 + i * 4;                  // chapitre 1 : N. 10 … chapitre 15 : N. 66
  const STUN = 6;                                  // secondes pour lancer la Poké Ball
  const GOAL = 2300;                               // distance de l'objectif (px)
  const WILD_N = 11;

  // [qui parle, texte]
  const CH = [
    { place: 'Route 1', type: 'normal', wild: [16, 19, 21], star: [16], who: 'Nuée de Piafabec', boss: [22],
      intro: [['Prof. Chen', 'Te voilà enfin ! Prends bien soin de ton premier Pokémon.'],
              ['Prof. Chen', 'La Route 1 mène à Jadielle. Fais attention aux Piafabec : ils sont rancuniers…']],
      meet: [['', 'Un Piafabec a été touché par erreur… Toute la nuée arrive, menée par un Rapasdepic furieux !']],
      outro: [['', 'La nuée s\'envole. Ton Pokémon et toi, vous êtes devenus inséparables.'], ['', 'Direction la Forêt de Jade !']] },
    { place: 'Forêt de Jade', type: 'bug', wild: [10, 13, 11, 14, 25], star: [10, 25], who: 'Le Samouraï', boss: [127],
      intro: [['', 'La Forêt de Jade est immense et pleine de Pokémon Insecte.'], ['', 'On dit qu\'un jeune dresseur en armure y défie tous les voyageurs…']],
      meet: [['Le Samouraï', 'Halte ! Tu viens de Bourg Palette ? Alors affronte-moi et mon Scarabrute !']],
      outro: [['Le Samouraï', 'Quelle force… Tu iras loin. La sortie de la forêt est par là.']] },
    { place: 'Argenta', type: 'rock', wild: [74, 27, 21, 50], star: [], who: 'Pierre', boss: [74, 95],
      intro: [['', 'Argenta, la ville grise comme la pierre. Son champion élève seul ses frères et sœurs.']],
      meet: [['Pierre', 'Je suis Pierre, le champion d\'Argenta. Ma défense est dure comme le roc !']],
      outro: [['Pierre', 'Tu as gagné le Badge Roche. Prends soin de tes Pokémon, ils te le rendent bien.']] },
    { place: 'Mont Sélénite', type: 'psychic', wild: [41, 35, 46, 74], star: [35], who: 'Team Rocket', boss: [23, 109, 52],
      intro: [['', 'Le Mont Sélénite cache des Pierres Lune… et des Mélofée qui dansent à la pleine lune.']],
      meet: [['Jessie', 'Préparez-vous à des ennuis !'], ['James', 'Et plutôt deux fois qu\'une !'], ['Miaouss', 'Ces Pierres Lune sont à nous, miaou !']],
      outro: [['', 'La Team Rocket s\'envole vers d\'autres cieux !'], ['', 'Les Mélofée dansent de nouveau autour de leur pierre.']] },
    { place: 'Azuria', type: 'water', wild: [118, 60, 54, 98, 72], star: [98], who: 'Ondine', boss: [120, 121],
      intro: [['', 'Azuria, la ville de l\'eau. L\'arène est tenue par la plus jeune de quatre sœurs.']],
      meet: [['Ondine', 'Je suis Ondine ! Ma stratégie Pokémon, c\'est les Pokémon Eau, et je vais te le prouver !']],
      outro: [['Ondine', 'Bon… tu as mérité le Badge Cascade. Mais je ne te lâche pas pour autant !']] },
    { place: 'Village Caché', type: 'grass', wild: [43, 69, 1, 48], star: [1], who: 'Team Rocket', boss: [24, 110, 52],
      intro: [['', 'Au fond des bois, un village où une jeune fille soigne les Pokémon blessés.'], ['', 'Un Bulbizarre veille sur eux.']],
      meet: [['James', 'Tous ces Pokémon sans dresseur… quelle aubaine !'], ['Jessie', 'On les emporte tous !']],
      outro: [['', 'Les Pokémon du village sont saufs. Bulbizarre a vu ton courage.']] },
    { place: 'Route 24', type: 'fighting', wild: [4, 56, 21, 19], star: [4, 56], who: 'Bande de Férosinge', boss: [57],
      intro: [['', 'Sous la pluie, un Salamèche attend sur un rocher le dresseur qui l\'a abandonné…'], ['', 'Plus loin, des Férosinge très énervés gardent la route.']],
      meet: [['', 'Un Colossinge déchaîné bloque le passage !']],
      outro: [['', 'La route est libre. Un nouvel ami t\'a peut-être rejoint en chemin.']] },
    { place: 'Escouade Carapuce', type: 'water', wild: [7, 79, 129, 116], star: [7], who: 'Chef de l\'Escouade', boss: [8, 7],
      intro: [['', 'Des Carapuce à lunettes de soleil font la loi dans la ville.']],
      meet: [['', 'L\'Escouade Carapuce te barre la route, son chef en tête !']],
      outro: [['', 'Les Carapuce ont compris : être pompiers, c\'est mieux que voyous.']] },
    { place: 'Carmin sur Mer', type: 'electric', wild: [100, 81, 25, 96], star: [], who: 'Major Bob', boss: [26],
      intro: [['', 'Carmin sur Mer et son port. Le champion était soldat, et il n\'aime pas les petits Pokémon.']],
      meet: [['Major Bob', 'Ha ! Ton équipe est toute petite, baby ! Mon Raichu va la griller !']],
      outro: [['Major Bob', 'Tu m\'as eu, baby ! Voilà le Badge Foudre.']] },
    { place: 'Céladopole', type: 'grass', wild: [43, 69, 70, 114, 102], star: [], who: 'Érika', boss: [114, 70, 44],
      intro: [['', 'Céladopole sent le parfum. Son arène est un jardin plein de fleurs.']],
      meet: [['Érika', 'Bienvenue… J\'espère que vous aimez les Pokémon Plante autant que moi.']],
      outro: [['Érika', 'Vous avez gagné le Badge Prisme. Revenez sentir nos fleurs !']] },
    { place: 'Lavanville', type: 'ghost', wild: [92, 93, 63, 96], star: [93], who: 'Morgane', boss: [64],
      intro: [['', 'À Lavanville, la tour des Pokémon est hantée. Un Spectrum farceur y joue des tours.']],
      meet: [['Morgane', '…Je savais que tu viendrais. Mon Kadabra a déjà vu ta défaite.']],
      outro: [['Morgane', 'Tu m\'as fait rire… Prends le Badge Marais.']] },
    { place: 'Parc Safari', type: 'poison', wild: [128, 111, 115, 123, 48], star: [128], who: 'Koga', boss: [49, 110],
      intro: [['', 'Au Parc Safari de Parmanie, des troupeaux de Tauros courent dans les plaines.']],
      meet: [['Koga', 'Un ninja ne recule jamais. Mes Pokémon Poison vont t\'épuiser.']],
      outro: [['Koga', 'Belle technique. Le Badge Âme est à toi.']] },
    { place: 'Cramois\'Île', type: 'fire', wild: [58, 77, 126, 37, 131], star: [131], who: 'Auguste', boss: [59, 78, 126],
      intro: [['', 'Sur l\'île volcanique, le champion pose des énigmes… et brûle tout.']],
      meet: [['Auguste', 'Hahaha ! Es-tu prêt à brûler ? Mes Pokémon sortent du volcan !']],
      outro: [['Auguste', 'Tu as éteint mon feu ! Prends le Badge Volcan.']] },
    { place: 'Jadielle', type: 'ground', wild: [111, 27, 28, 104, 88], star: [88], who: 'Giovanni', boss: [53, 34, 112],
      intro: [['', 'Retour à Jadielle. L\'arène a enfin rouvert… mais qui en est le champion ?']],
      meet: [['Giovanni', 'Le chef de la Team Rocket est aussi le champion de Jadielle. Surpris ?']],
      outro: [['Giovanni', 'Hmph. Garde ce Badge Terre. Nous nous reverrons.']] },
    { place: 'Plateau Indigo', type: 'dragon', wild: [66, 67, 95, 147, 148], star: [147], who: 'Régis', boss: [9, 31, 59],
      intro: [['', 'Le Plateau Indigo. Huit badges en poche, la Ligue t\'attend.'], ['', 'Ton rival de toujours est déjà là.']],
      meet: [['Régis', 'Alors, tu es arrivé jusqu\'ici ? Je vais te montrer qui est le meilleur dresseur de Bourg Palette !']],
      outro: [['Régis', 'Pfff… Bien joué. Cette fois, c\'est toi le meilleur.'], ['Prof. Chen', 'Bravo ! Ton aventure à Kanto est terminée… pour l\'instant !']] }
  ];

  const S = () => {
    const s = G.DB.save;
    s.adv = s.adv || { team: [], done: 0 };
    return s.adv;
  };

  let active = false, ci = 0, ch = null, won = false;
  let goal = null, phase = 'intro', bossIds = [], starDone = false, talkQ = null, caught = [], nTravel = 0;

  // ---------------- équipe ----------------
  const family = d => G.Team.family(d);
  const owns = dex => S().team.some(m => family(m.dex) === family(dex));
  function leaderDex() { const t = S().team; return t.length ? t[0].dex : STARTERS[0]; }
  function pickStarter(dex) {
    const A = S();
    A.team = [{ dex, lv: 5, xp: 0, moves: [] }];
    A.done = 0;
    G.DB.commit();
  }
  function setLeader(i) {
    const t = S().team;
    if (i <= 0 || i >= t.length) return;
    t.unshift(t.splice(i, 1)[0]);
    G.DB.commit();
  }

  /** Met un Pokémon au niveau voulu (sans cartes), puis ses attaques sauvées. */
  function shape(p, m) {
    for (let i = 0; i < 99 && p.level < m.lv; i++) p.gainXp(Math.max(1, p.xpNext - p.xp));
    p.xp = Math.min(m.xp || 0, p.xpNext - 1);
    p.atkMul *= Math.pow(ATK_LV, p.level - 1);
    p._advLv = p.level;
    const B = G.Moves.BY_ID;
    const saved = (m.moves || []).filter(([id]) => B[id]);
    if (!saved.length) saved.push([G.startMoveOf(p.dex), 1]);
    for (const [id, lvl] of saved) {
      if (!p.addMove(id)) continue;
      const mv = p.moves.find(x => x.id === id);
      for (let k = 1; mv && k < lvl; k++) if (G.Moves.nextUpText(mv)) G.Moves.levelUp(mv);
    }
    p.setActive(0);
  }

  // ---------------- chapitre ----------------
  function start(i) {
    active = true; ci = i; ch = CH[i]; won = false;
    goal = null; phase = 'intro'; bossIds = []; starDone = false; talkQ = null; caught = [];
  }

  /** Appelé par Game.startRun : l'équipe de l'Aventure et la zone du chapitre. */
  function setup(pl) {
    const team = S().team.slice(0, TRAVEL);
    nTravel = team.length;
    shape(pl, team[0]);
    for (const m of team.slice(1)) {
      const a = G.Team.recruit(m.dex);
      if (a) shape(a, m);
    }
    G.Spawner.say('Chapitre ' + (ci + 1) + ' · ' + ch.place, 3, true);
    G.World.setBiome(G.Tiles.arenaBiome(ch.type), true);
    goal = { x: pl.x + G.U.rand(-500, 500), y: pl.y - GOAL, t: 0 };
    G.Sprites.preload(ch.wild.concat(ch.boss), 8000, false, ['Idle', 'Walk']);
  }

  const tierIx = () => Math.min(G.Enemies.TIERS.length - 1, Math.floor(ci / 4));
  const sc = () => G.Enemies.scale(25 + ci * 32);

  function defOf(dex) {
    const T = G.Enemies.TIERS, ti = tierIx();
    return G.Enemies.defFor(G.DEX_BY[dex], T[ti], ti);
  }

  /** Un Pokémon sauvage qui se promène (enemy.js : calm). */
  function wildAt(dex, x, y, star = false) {
    if (!G.DEX_BY[dex] || !G.SPRITE_META[dex]) return null;
    const e = new G.Enemy(defOf(dex), x, y, sc());
    e.calm = true; e.home = { x, y };
    e.catchable = star || !owns(dex);
    if (star) { e.star = true; e.golden = true; e.maxHp = e.hp = Math.round(e.maxHp * 2); }
    G.EnemyMgr.add(e);
    return e;
  }

  function populate(pl) {
    const ts = G.Tiles.T * G.Sprites.PX;
    const list = G.EnemyMgr.all();
    for (const e of list) {
      if (e.calm && !e.dead && !e.star && G.U.dist2(e.x, e.y, pl.x, pl.y) > 1600 * 1600) { e.dead = true; e.gone = true; e.fade = 0; }
    }
    const n = list.filter(e => e.calm && !e.dead).length;
    if (n >= WILD_N || phase !== 'explore') return;
    // Vers l'objectif en priorité, hors de l'écran.
    const toGoal = Math.atan2(goal.y - pl.y, goal.x - pl.x);
    const a = toGoal + G.U.rand(-1.4, 1.4), d = G.U.rand(560, 950);
    const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d;
    if (G.World.terrainAt && G.World.terrainAt(Math.floor(x / ts), Math.floor(y / ts)) === 1) return;
    const k = 1 + Math.floor(Math.random() * 2.2);
    const pool = ch.wild.filter(d => !(ch.star.includes(d)));
    const dex = G.U.pick(pool.length ? pool : ch.wild);
    for (let j = 0; j < k; j++) wildAt(dex, x + G.U.rand(-60, 60), y + G.U.rand(-50, 50));
  }

  /** Le Pokémon de l'épisode, une fois, à mi-chemin. */
  function maybeStar(pl) {
    if (starDone || phase !== 'explore') return;
    const done = 1 - Math.hypot(goal.x - pl.x, goal.y - pl.y) / GOAL;
    if (done < 0.35) return;
    starDone = true;
    const dex = ch.star.find(d => !owns(d));
    if (!dex) return;
    const a = Math.atan2(goal.y - pl.y, goal.x - pl.x);
    const e = wildAt(dex, pl.x + Math.cos(a) * 380, pl.y + Math.sin(a) * 380, true);
    if (e) G.Spawner.say('Un ' + e.name + ' sauvage ! Mets-le K.O. pour le capturer', 4, true);
  }

  // ---------------- captures ----------------
  /** enemy.js : un sauvage capturable tombe à 0 PV → il reste sonné. */
  function stun(e) {
    if (!active || !e.catchable || e.stunned || e.boss) return false;
    e.hp = 1; e.stunned = STUN; e.angry = false;
    e.kx = e.ky = 0;
    G.Audio.sfx('select');
    G.FX.ring(e.x, e.y, e.r, e.r * 3, '#ffffff', 0.4, 3);
    return true;
  }

  function capture(e, pl) {
    e.stunned = 0;
    const ok = e.star || Math.random() < (CATCH[G.DEX_BY[e.dex].rarity] || 0.5);
    G.FX.burst(e.x, e.y - e.bodyH * 0.5, ok ? '#ff5a5a' : '#ffffff', 22, 160);
    if (!ok) {
      G.Spawner.say('Oh non ! ' + e.name + ' s\'est échappé de la Poké Ball…', 2.6, true);
      e.dead = true; e.gone = true; e.fade = 0;
      return;
    }
    e.dead = true; e.gone = true; e.fade = 0;
    G.Audio.sfx('shiny');
    G.FX.ring(e.x, e.y, 6, 90, '#ffd23f', 0.6, 5);
    const lv = Math.max(2, Math.round(pl.level * 0.75));
    const m = { dex: e.dex, lv, xp: 0, moves: [] };
    caught.push(e.dex);
    if (!G.Team.full()) {
      const a = G.Team.recruit(e.dex);
      if (a) { shape(a, m); a._adv = true; }
      G.Spawner.say(e.name + ' est capturé et rejoint ton équipe !', 3, true);
    } else {
      S().team.push(m);
      G.Spawner.say(e.name + ' est capturé ! (envoyé dans ta réserve)', 3, true);
    }
    G.DB.grant && G.DB.grant(e.dex, 'adv');
  }

  // ---------------- progression (sans cartes) ----------------
  function growth() {
    for (const p of G.Team.members()) {
      if (p.guestT || p._advLv == null) continue;
      while (p._advLv < p.level) {
        p._advLv++;
        p.atkMul *= ATK_LV;
        const lv = p._advLv;
        if (LEARN.includes(lv) && p.slots.length < p.maxMoves) {
          const B = G.Moves.BY_ID;
          const pool = [...new Set(G.Team.learnset(p.dex))].filter(id => B[id] && !p.hasMove(id));
          if (pool.length) {
            const id = G.U.pick(pool);
            p.addMove(id);
            G.Spawner.say(p.mon.name + ' apprend ' + B[id].name + ' !', 2.6, true);
            continue;
          }
        }
        if (lv % 2 === 0) {
          const ups = p.moves.filter(m => G.Moves.nextUpText(m));
          if (ups.length) G.Moves.levelUp(G.U.pick(ups));
        }
      }
    }
  }

  // ---------------- dialogues ----------------
  function talk(lines, cb) { talkQ = { lines, cb }; }
  function flushTalk() {
    if (!talkQ || !G.Game.beginChoice()) return;
    const q = talkQ; talkQ = null;
    G.AdvUI.talk(q.lines, () => { G.Game.endChoice(); if (G.Touch) G.Touch.reset(); if (q.cb) q.cb(); });
  }

  // ---------------- boss ----------------
  function spawnBoss() {
    phase = 'boss';
    const T = G.Enemies.TIERS, ti = tierIx(), s = sc();
    const ref = ch.wild.map(defOf);
    const hp = ref.reduce((a, d) => a + d.hp * s.hp, 0) / ref.length;
    const dmg = ref.reduce((a, d) => a + d.dmg * s.dmg, 0) / ref.length;
    const n = ch.boss.length;
    // Les Pokémon sauvages du coin s'écartent.
    for (const e of G.EnemyMgr.all()) if (e.calm && !e.stunned) { e.dead = true; e.gone = true; e.fade = 0; }
    ch.boss.forEach((dex, k) => {
      const p = G.DEX_BY[dex];
      if (!p || !G.SPRITE_META[dex]) return;
      const def = Object.assign(G.Enemies.defFor(p, T[ti], ti), { behavior: k % 2 ? 'ranged' : 'charger', shotCd: 1.2, range: 260 });
      const e = new G.Enemy(def, goal.x + (k - (n - 1) / 2) * 80, goal.y, s, true);
      e.maxHp = e.hp = Math.round(hp * (10 + ci * 0.8) / n * (n > 1 ? 1.3 : 1));
      e.dmg = dmg * 1.7;
      e.champion = true;
      G.EnemyMgr.add(e);
      bossIds.push(e.id);
    });
    G.Audio.sfx('boss');
    G.Camera.kick(1.2);
    G.Spawner.say(ch.who + ' te défie !', 3, true);
  }

  function update(dt, pl) {
    if (!active || !pl || !goal) return;
    goal.t += dt;
    flushTalk();
    if (phase === 'intro') { phase = 'explore'; talk(ch.intro); return; }
    growth();
    populate(pl);
    maybeStar(pl);
    // Sonnés : Poké Ball en marchant dessus, sinon ils se réveillent et filent.
    for (const e of G.EnemyMgr.all()) {
      if (!e.stunned || e.dead) continue;
      e.stunned -= dt;
      if (e.stunned <= 0) { e.stunned = 0; G.Spawner.say(e.name + ' s\'est enfui…', 2, true); e.dead = true; e.gone = true; e.fade = 0; continue; }
      if (!pl.dead && G.U.dist2(e.x, e.y, pl.x, pl.y) < (e.r + pl.r + 16) ** 2) capture(e, pl);
    }
    if (phase === 'explore' && G.U.dist2(pl.x, pl.y, goal.x, goal.y) < 420 * 420) {
      phase = 'meet';
      talk(ch.meet, spawnBoss);
    }
    if (phase === 'boss') {
      const alive = bossIds.some(id => { const e = G.EnemyMgr.get(id); return e && !e.dead; });
      if (!alive) { phase = 'won'; won = true; G.Pickups.pullAll(); talk(ch.outro, () => G.Game.quit()); }
    }
  }

  /** Fin du chapitre (gagné, perdu ou abandonné) : on garde les progrès de l'équipe. */
  function finish(dead) {
    if (!active) return null;
    const A = S(), s = G.DB.save;
    const travel = G.Team.members().filter(m => !m.guestT && m._advLv != null).map(m => ({
      dex: m.dex, lv: m.level, xp: Math.floor(m.xp), moves: m.moves.map(x => [x.id, x.lvl])
    }));
    // (les captures envoyées en réserve pendant le chapitre sont déjà au bout de la liste)
    if (travel.length) A.team = travel.concat(A.team.slice(nTravel));
    let coins = 0;
    if (won) {
      coins = 120 + ci * 60;
      s.coins += coins;
      A.done = Math.max(A.done, ci + 1);
      A.reward = ci;                 // un choix de récompense à faire sur la carte (adv-ui.js)
    }
    G.DB.commit(true);
    const res = { won, dead, ch: ci, place: ch.place, coins, caught: caught.slice() };
    active = false; goal = null; ch = null;
    return res;
  }

  /** La flèche vers l'objectif, les Poké Balls au-dessus des sonnés. */
  function drawables() {
    if (!active || !goal) return [];
    const out = [];
    const pl = G.Game.player;
    if (phase === 'explore' || phase === 'meet') {
      out.push({ y: goal.y, draw(ctx) {
        const t = goal.t;
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.1;
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.ellipse(goal.x, goal.y, 70, 26, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
        G.Icons.draw(ctx, 'medal1', goal.x - 16, goal.y - 52 - Math.abs(Math.sin(t * 2)) * 6, 32);
        if (pl && !pl.dead && G.U.dist2(pl.x, pl.y, goal.x, goal.y) > 300 * 300) {
          const an = Math.atan2(goal.y - pl.y, goal.x - pl.x), bob = Math.sin(t * 6) * 4;
          ctx.translate(pl.x + Math.cos(an) * (52 + bob), pl.y - 20 + Math.sin(an) * (52 + bob));
          ctx.rotate(an);
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath();
          ctx.stroke(); ctx.fill();
        }
        ctx.restore();
      } });
    }
    for (const e of G.EnemyMgr.all()) {
      if (!e.stunned || e.dead) continue;
      out.push({ y: e.y + 1, draw(ctx) {
        const b = Math.abs(Math.sin(goal.t * 5)) * 5;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y - e.bodyH - 20, 15, -Math.PI / 2, -Math.PI / 2 + 6.2832 * (e.stunned / STUN)); ctx.stroke();
        ctx.globalAlpha = 1;
        G.Icons.draw(ctx, 'pball', e.x - 10, e.y - e.bodyH - 30 - b, 20);
        ctx.restore();
      } });
    }
    return out;
  }

  /** Pour le HUD. */
  /** L'expérience d'un Pokémon de l'équipe (game.js, team.js) : réduite, et rien au-delà du niveau max. */
  function xpFor(p, xp) { return p.level >= capOf(ci) ? 0 : xp * XP_K; }

  /** Les 3 récompenses de fin de chapitre : capturer, apprendre une attaque, s'entraîner. */
  function rewards() {
    const A = S(), i = A.reward;
    if (i == null || !CH[i] || !A.team.length) return [];
    const c = CH[i], out = [], B = G.Moves.BY_ID;
    const lead = A.team[0];
    const seed = (i + 1) * 7919 + A.team.length * 31;          // même tirage tant que le choix n'est pas fait
    const pick = (list, k = 0) => list[(seed + k) % list.length];
    // 1. Capturer un Pokémon du chapitre (ou de son boss) qu'on n'a pas encore.
    const pool = [...new Set(c.wild.concat(c.boss))].filter(d => G.DEX_BY[d] && G.SPRITE_META[d] && !owns(d));
    if (pool.length) {
      const dex = pick(pool), lv = Math.max(2, Math.round(lead.lv * 0.8));
      out.push({ kind: 'catch', dex, title: 'Capturer ' + G.DEX_BY[dex].name, desc: 'Il rejoint ton équipe au niveau ' + lv + '.',
        apply: () => { A.team.push({ dex, lv, xp: 0, moves: [] }); G.DB.grant(dex, 'adv'); } });
    }
    // 2. Apprendre (ou renforcer) une attaque.
    const known = m => (m.moves && m.moves.length ? m.moves : [[G.startMoveOf(m.dex), 1]]).filter(([id]) => B[id]);
    const travel = A.team.slice(0, TRAVEL);
    const learners = travel.filter(m => known(m).length < 4 && G.Team.learnset(m.dex).some(id => B[id] && !known(m).some(k => k[0] === id)));
    if (learners.length) {
      const m = pick(learners, 1), ks = known(m);
      const opts = [...new Set(G.Team.learnset(m.dex))].filter(id => B[id] && !ks.some(k => k[0] === id));
      const id = pick(opts, 2);
      out.push({ kind: 'move', dex: m.dex, move: id, title: G.DEX_BY[m.dex].name + ' apprend ' + B[id].name, desc: B[id].desc || '',
        apply: () => { m.moves = ks.concat([[id, 1]]); } });
    } else {
      const m = pick(travel, 1), ks = known(m), k = pick(ks, 2);
      out.push({ kind: 'move', dex: m.dex, move: k[0], title: G.DEX_BY[m.dex].name + ' renforce ' + B[k[0]].name, desc: 'Son attaque gagne 2 niveaux.',
        apply: () => { k[1] += 2; m.moves = ks; } });
    }
    // 3. S'entraîner : +2 niveaux pour toute l'équipe qui part.
    out.push({ kind: 'train', title: 'Entraînement', desc: '+2 niveaux pour les ' + travel.length + ' Pokémon de ton équipe.',
      apply: () => { for (const m of travel) { m.lv += 2; m.xp = 0; } } });
    return out;
  }
  function takeReward(r) {
    const A = S();
    if (A.reward == null) return;
    r.apply();
    A.reward = null;
    G.DB.commit(true);
  }

  function info() {
    if (!active || !ch) return null;
    const pl = G.Game.player;
    const d = pl && goal ? Math.hypot(goal.x - pl.x, goal.y - pl.y) : 0;
    return { n: ci + 1, place: ch.place, who: ch.who, phase, dist: Math.round(d / 10), caught: caught.length, cap: capOf(ci) };
  }

  return { CH, STARTERS, TRAVEL, xpFor, rewards, takeReward, capOf, start, setup, update, finish, stun, drawables, info, leaderDex, pickStarter, setLeader,
           state: S, get active() { return active; }, get won() { return won; } };
})();
