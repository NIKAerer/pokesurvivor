/* ============ rocket.js — l'invasion de la Team Rocket (version de Nika) ============
 *
 * Une fois par partie (entre 8:00 et 22:00, jamais avec un boss vivant, ni
 * dans une arène, ni pendant la Sentencia), la Team Rocket débarque :
 * Miaouss vole un Pokémon de ton équipe (jamais ton chef) et s'enfuit, escorté
 * par Abo et Smogo.
 *
 *   tu attrapes Miaouss avant LIFE secondes   le Pokémon revient + pièces
 *   Miaouss s'échappe                          le Pokémon est perdu pour cette
 *                                              partie (il reste dans ta boîte)
 *
 * Solo seulement (en coopératif, chaque joueur a sa propre équipe).
 */
G.Rocket = (() => {
  const FROM = 480, TO = 1320, LIFE = 40;
  const MEOWTH = 52, ESCORT = [24, 109];          // Miaouss, Abo, Smogo
  let at = 0, done = false, stolen = null, thief = null;

  function reset() { at = G.U.rand(FROM, TO); done = false; stolen = null; thief = null; }

  function update(dt, pl, time) {
    if (done || G.Coop.active || time < at) return;
    if (G.Rift.inArena || G.Judgment.active || G.EnemyMgr.bossAlive() || G.Game.state !== 'playing') return;
    if (!G.Team.allies.length || !G.SPRITE_META[MEOWTH]) return;
    done = true;
    start(pl, time);
  }

  function spot(pl, d0, d1) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * 6.2832, d = G.U.rand(d0, d1);
      const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d * 0.8;
      if (G.World.isFree(x, y, 16)) return [x, y];
    }
    return [pl.x + d0, pl.y];
  }

  function start(pl, time) {
    const a = G.Team.steal();
    if (!a) return;
    stolen = a;
    G.Sprites.preload([MEOWTH, ...ESCORT]);
    // Miaouss part de là où était le Pokémon volé.
    const mon = G.DEX_BY[MEOWTH];
    const def = { dex: MEOWTH, name: mon.name + ' (Team Rocket)', behavior: 'thief', hp: Math.round(260 * (1 + time / 95)),
                  spd: 84, dmg: 0, xp: 60, loot: 'coins' };
    const [x, y] = spot(pl, 120, 160);
    const e = new G.Enemy(def, x, y, { hp: 1, spd: 1, dmg: 1 });
    e.life = LIFE; e.rocket = true;
    e.maxHp = e.hp = G.Power.bossHp(e.maxHp, 'rival');
    G.EnemyMgr.add(e);
    thief = e;
    // L'escorte : Abo et Smogo, plus solides que les sauvages.
    for (const dex of ESCORT) {
      const m = G.DEX_BY[dex];
      if (!m || !G.SPRITE_META[dex]) continue;
      const [ex, ey] = spot(pl, 200, 260);
      const g = new G.Enemy({ dex, name: m.name + ' (Team Rocket)', hp: Math.round(180 * (1 + time / 80)), spd: 62,
                              dmg: Math.round((20 + time / 30) * G.League.dmgK()), xp: 120, behavior: dex === 109 ? 'ranged' : 'charger',
                              shotDmg: Math.round(10 + time / 60), shotCd: 1.4, range: 240 }, ex, ey, { hp: 1, spd: 1, dmg: 1 });
      g.maxHp = g.hp = G.Power.bossHp(g.maxHp, 'rival') * 0.5;
      g.rocketGuard = true;
      G.EnemyMgr.add(g);
    }
    G.FX.burst(a.x, a.y - 20, '#e8384f', 30, 200);
    G.Spawner.say('La Team Rocket attaque ! Miaouss a volé ' + G.DEX_BY[a.dex].name + ' ! Attrape-le en ' + LIFE + ' s !', 4, true);
    G.Audio.sfx('boss');
    G.Camera.kick(0.8);
  }

  /** Miaouss est K.O. (progress.js) : on récupère le Pokémon. */
  function caught(e) {
    if (!e.rocket || !stolen) return;
    const a = stolen; stolen = null; thief = null;
    const nm = G.DEX_BY[a.dex].name;
    const ok = G.Team.giveBack(a);
    const pl = G.Game.player;
    if (G.DB.save) G.DB.save.coins += 150;
    G.Spawner.say(ok ? nm + ' est de retour ! La Team Rocket s\'envole vers d\'autres cieux ! +150 pièces' : 'La Team Rocket est battue ! +150 pièces', 3.6, true);
    G.Audio.sfx('legend');
    if (pl) G.FX.ring(pl.x, pl.y, 8, 90, '#7fe0ff', 0.7, 5);
  }

  /** Miaouss s'est échappé (enemy.js) : le Pokémon est perdu pour la partie. */
  function escaped(e) {
    if (!e.rocket || !stolen) return;
    const name = G.DEX_BY[stolen.dex].name;
    stolen = null; thief = null;
    G.Team.release();
    G.Spawner.say('Miaouss s\'est échappé avec ' + name + '… Perdu pour cette partie (il reste dans ta boîte).', 4, true);
    G.Audio.sfx('back');
  }

  return {
    reset, update, caught, escaped,
    get stolen() { return stolen; }, get thief() { return thief; },
    /** Pour les tests : l'invasion tout de suite. */
    debugNow() { done = false; at = 0; }
  };
})();
