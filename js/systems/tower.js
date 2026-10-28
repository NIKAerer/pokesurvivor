/* ============ tower.js — la Tour de Combat façon Archero (version de Nika) ============
 * Un mode à part, lancé depuis le menu. Plus de hordes ni de chrono : une suite
 * de salles fermées, une par étage.
 *   - Chaque salle : des Pokémon sauvages du type de l'étage. Tu tires seulement
 *     quand tu t'arrêtes (STILL), comme dans Archero : bouger = esquiver.
 *   - Salle vidée : une carte au choix, puis une porte s'ouvre au nord ;
 *     la traverser mène à l'étage suivant.
 *   - Tous les BOSS_EVERY étages : un dresseur de la Tour et son équipe.
 *   - Partenaire seul (SOLO) : pas de recrues dans les cartes.
 * Tomber termine la partie. Le meilleur étage est gardé.
 *
 * Récompenses : pièces de partie à chaque salle ; au dresseur, pièces et
 * Super Bonbons, une CT tous les 10 étages.
 * Sauvegarde : save.tower = { best, runs }.
 */
G.Tower = (() => {
  const BOSS_EVERY = 5, R = 9;          // rayon des salles, en tuiles
  const STILL = true, SOLO = true;
  const WHO = ['Topdresseur Paul', 'Montagnarde Léa', 'Scientifique Hugo', 'Karatéka Jin', 'Dresseuse Ace Clara',
    'Pokémaniac Théo', 'Kinésiste Inès', 'Ranger Malo', 'Canon Sacha', 'Ninja Kaito', 'Dompteur Rémi', 'Dame Aurélie'];
  const TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying',
    'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel'];

  let active = false, floor = 0, seed = 1, cache = null;
  let room = null;    // { x, y, type, boss, ids, phase: 'fight' | 'door', door, t }
  const S = () => { const s = G.DB.save || {}; s.tower = s.tower || { best: 0, runs: 0 }; return s.tower; };
  const TS = () => G.Tiles.T * G.Sprites.PX;

  function start() { active = true; floor = 0; seed = 1 + Math.floor(Math.random() * 1e6); cache = null; room = null; }
  function end() {
    if (!active) return;
    const T = S();
    T.runs++;
    T.best = Math.max(T.best, floor);
    active = false; room = null;
    G.World.setArena(null);
  }

  /** L'étage suivant (même tirage tant qu'il n'est pas passé) : son type et, s'il y en a un, son dresseur. */
  function step() {
    const f = floor + 1;
    if (cache && cache.floor === f) return cache;
    let r = (seed * 9301 + f * 49297) % 233280;
    const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const type = TYPES[Math.floor(rnd() * TYPES.length)];
    const n = Math.min(3, 1 + Math.floor((f - 1) / 10));
    const lo = Math.min(520, 300 + f * 9), hi = lo + 160;
    const ok = p => G.SPRITE_META[p.dex] && !p.leg && p.types.includes(type);
    let pool = G.DEX.filter(p => ok(p) && p.bst >= lo && p.bst <= hi);
    if (pool.length < n) pool = G.DEX.filter(ok);
    const team = [];
    while (team.length < n && pool.length) team.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0].dex);
    cache = { kind: 'tower', floor: f, who: WHO[Math.floor(rnd() * WHO.length)], type, team, region: 'Tour',
              boss: f % BOSS_EVERY === 0 };
    return cache;
  }
  /** Force des dresseurs (même échelle que la Ligue : 0 = Pierre). */
  const strength = () => floor * 0.6;

  // ---------------- salles ----------------

  /** Les Pokémon sauvages d'une salle : du type de l'étage, plus nombreux et plus forts en montant. */
  function wild(st) {
    const f = st.floor, T = G.Enemies.TIERS, ti = Math.min(T.length - 1, Math.floor((f - 1) / 4));
    let pool = G.Enemies.candidates(T[ti]).filter(p => p.types.includes(st.type));
    if (pool.length < 2) pool = G.Enemies.candidates(T[ti]);
    const n = Math.min(12, 3 + Math.floor(f * 0.7));
    const sc = G.Enemies.scale(f * 35);
    return Array.from({ length: n }, () => {
      const def = G.Enemies.defFor(G.U.pick(pool), T[ti], ti);
      return { def, sc };
    });
  }

  function enter() {
    const st = step(), ts = TS(), pl = G.Game.player;
    const tx = 5000 + Math.floor(Math.random() * 3000), ty = 5000 + Math.floor(Math.random() * 3000);
    room = { x: tx * ts + ts / 2, y: ty * ts + ts / 2, type: st.type, boss: st.boss, ids: [], phase: 'fight', door: null, t: 0 };
    G.EnemyMgr.clear();
    G.Projectiles.clear();
    G.Combat.clearFields();
    G.Hazards.clear();
    G.Weather.clear();
    G.World.setArena({ tx, ty, r: R, type: st.type });
    G.World.setBiome(G.Tiles.arenaBiome(st.type), true);
    pl.x = room.x; pl.y = room.y + ts * (R - 3);
    if (pl.dead) pl.revive(0.3);
    for (const m of G.Team.members()) if (m !== pl) { m.x = pl.x; m.y = pl.y; }
    G.Camera.x = pl.x; G.Camera.y = pl.y;
    G.Game.flash('#ffffff', 0.5);
    if (st.boss) {
      room.ids = G.League.spawnTeam(room.x, room.y - ts * 3.5);
      tame(st, room.ids);
    } else {
      const list = wild(st);
      list.forEach((w, k) => {
        const a = Math.PI + (k + 0.5) / list.length * Math.PI;      // en arc, au nord
        const d = ts * G.U.rand(2.5, R - 3);
        const e = new G.Enemy(w.def, room.x + Math.cos(a) * d, room.y + Math.sin(a) * d * 0.8, w.sc);
        G.EnemyMgr.add(e);
        room.ids.push(e.id);
      });
      G.Spawner.say('Étage ' + st.floor + ' · ' + G.U.TYPE_NAME[st.type], 2.2, true);
    }
    G.Sprites.preload(room.ids.map(id => (G.EnemyMgr.get(id) || {}).dex).filter(Boolean), 6000, false, ['Idle', 'Walk']);
  }

  /** Le dresseur suit la courbe des salles (sinon ~500 fois les PV d'un sauvage et un coup presque mortel) :
   *  son équipe a en tout BOSS_HP fois les PV d'un sauvage de l'étage, et BOSS_DMG fois ses dégâts. */
  const BOSS_HP = 12, BOSS_DMG = 1.8;
  function tame(st, ids) {
    const ref = wild(st), n = Math.max(1, ids.length);
    const hp = ref.reduce((a, w) => a + w.def.hp * w.sc.hp, 0) / ref.length;
    const dmg = ref.reduce((a, w) => a + w.def.dmg * w.sc.dmg, 0) / ref.length;
    for (const id of ids) {
      const e = G.EnemyMgr.get(id);
      if (!e) continue;
      e.maxHp = e.hp = Math.round(hp * BOSS_HP / n * (n > 1 ? 1.3 : 1));
      e.dmg = dmg * BOSS_DMG;
    }
  }

  /** Personne ne sort de la salle. */
  function keepInside() {
    const max = (R - 1.4) * TS();
    for (const e of G.EnemyMgr.all()) {
      const dx = e.x - room.x, dy = e.y - room.y, d = Math.hypot(dx, dy);
      if (d > max) { e.x = room.x + dx / d * max; e.y = room.y + dy / d * max; }
    }
  }

  function cleared() {
    const st = step(), pl = G.Game.player, ts = TS();
    floor = st.floor;
    G.Pickups.pullAll();
    if (st.boss) win(st);
    else {
      const coins = 20 + floor * 6;
      pl.coins += coins;
      G.Spawner.say('Étage ' + floor + ' vidé ! +' + coins + ' pièces', 2.4, true);
      G.Audio.sfx('levelup');
    }
    const T = S();
    if (floor > T.best) { T.best = floor; G.DB.commit(); }
    room.phase = 'door';
    room.door = { x: room.x, y: room.y - ts * (R - 2.5), t: 0 };
    G.Game.bonusCard();                    // une carte au choix entre deux salles
  }

  function win(st) {
    const s = G.DB.save, f = st.floor;
    const coins = 150 + f * 40, balls = 2 + Math.floor(f / 5);
    s.coins += coins;
    s.balls = (s.balls | 0) + balls;
    const ct = f % 10 === 0;
    if (ct) s.ct = (s.ct | 0) + 1;
    G.DB.commit(true);
    G.Spawner.say(st.who + ' battu ! +' + coins + ' pièces, +' + balls + ' Super Bonbons' + (ct ? ', +1 CT' : ''), 4.2, true);
    G.Audio.sfx('legend');
    G.Game.flash('#ffe14d', 0.5);
  }

  function update(dt, pl) {
    if (!active || !pl) return;
    if (!room) { enter(); return; }
    room.t += dt;
    keepInside();
    if (room.phase === 'fight') {
      const alive = room.ids.some(id => { const e = G.EnemyMgr.get(id); return e && !e.dead; });
      if (!alive && room.t > 0.5) cleared();
      return;
    }
    room.door.t += dt;
    if (!pl.dead && G.U.dist2(pl.x, pl.y, room.door.x, room.door.y - 10) < 34 * 34) enter();
  }

  /** La porte de sortie (le portail des failles), triée par Y avec la scène. */
  function drawable() {
    const d = room && room.door;
    if (!d) return null;
    return {
      y: d.y,
      draw(ctx) {
        const P = G.Sprites.PX;
        const img = G.Tiles.propSprite(0, 'rift', Math.floor(d.t * 8) % 4);
        const w = img.width * P, h = img.height * P, a = Math.min(1, d.t * 2);
        ctx.save();
        ctx.globalAlpha = 0.3 * a;
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, 36, 13, 0, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = a;
        ctx.drawImage(img, Math.round(d.x - w / 2), Math.round(d.y - h + 4), w, h);
        // flèche dorée au-dessus du joueur tant que la porte est loin (souvent hors de l'écran)
        const pl = G.Game.player;
        if (pl && !pl.dead && G.U.dist2(pl.x, pl.y, d.x, d.y) > 140 * 140) {
          const an = Math.atan2(d.y - pl.y, d.x - pl.x), bob = Math.sin(d.t * 6) * 4;
          ctx.translate(pl.x + Math.cos(an) * (46 + bob), pl.y - 20 + Math.sin(an) * (46 + bob));
          ctx.rotate(an);
          ctx.globalAlpha = 0.9 * a;
          ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath();
          ctx.stroke(); ctx.fill();
        }
        ctx.restore();
      }
    };
  }

  /** Ennemis encore debout dans la salle (HUD). */
  function left() {
    if (!room || room.phase !== 'fight') return 0;
    return room.ids.filter(id => { const e = G.EnemyMgr.get(id); return e && !e.dead; }).length;
  }

  return { BOSS_EVERY, STILL, SOLO, start, end, step, strength, update, drawable, left, win() {}, lost() {},
           get active() { return active; }, get floor() { return floor; }, get door() { return !!(room && room.door); },
           get room() { return room; }, best: () => S().best };
})();
