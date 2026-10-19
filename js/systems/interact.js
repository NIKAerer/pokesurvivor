/* ============ interact.js — altares, manantiales, cofres con candado y trampas ============
 * Los objetos los coloca world.js (raros, en el suelo libre); aquí está lo que
 * pasa al tocarlos. Todo se mira alrededor de TU Pokémon:
 *
 *   altar     da un poder de 25 s (Furia, Rayo, Imán o Prisa) y se apaga
 *   spring    cura mientras estás encima; se agota y se recarga sola
 *   bigchest  quédate a su lado CHEST_TIME segundos (mientras te atacan) y se
 *             abre: monedas, tickets y experiencia para subir un nivel
 *   trap      salta al pisarla (tú o un enemigo) y afecta a todo lo cercano:
 *             veneno, pegajosa (ralentiza) o explosiva
 *
 * Cooperativo: altares y manantiales son de cada uno (en cada ordenador); el
 * cofre y las trampas se rompen como cualquier objeto y el anfitrión reparte
 * el botín y el daño a los enemigos (ver world.destroyProp y coop.propBroken).
 */
G.Interact = (() => {
  const CHEST_TIME = 3.5;
  const POWER_TIME = 25;
  const POWERS = [
    { id: 'dmg', name: 'Furia', desc: 'daño ×2', color: '#ff5f6d', on: p => { p.atkMul *= 2; }, off: p => { p.atkMul /= 2; } },
    { id: 'spd', name: 'Rayo', desc: '+45% velocidad', color: '#5fd4ff', on: p => { p.spdMul *= 1.45; }, off: p => { p.spdMul /= 1.45; } },
    { id: 'mag', name: 'Imán', desc: 'atraes todo desde lejos', color: '#ff8ad8', on: p => { p.magnet *= 4; }, off: p => { p.magnet /= 4; } },
    { id: 'cd', name: 'Prisa', desc: '-40% recarga', color: '#ffd23f', on: p => { p.cdMul *= 0.6; }, off: p => { p.cdMul /= 0.6; } }
  ];
  const TRAP_R = 74;
  const authority = () => !G.Coop.active || G.Coop.isHost;
  let healShown = 0, healAcc = 0;

  function update(dt, pl) {
    if (!pl) return;
    for (const p of G.World.specialsNear(pl.x, pl.y, 720)) {
      const d2 = G.U.dist2(pl.x, pl.y, p.x, p.type === 'spring' || p.type === 'trap' ? p.y - 8 : p.y);
      switch (p.type) {
        case 'spring': spring(dt, pl, p, d2); break;
        case 'altar':
          // Contando el tamaño de tu Pokémon: uno grande (Reshiram, Zekrom...) choca
          // con el altar antes de llegar a 30 y no lo podía activar.
          if (!p.used && !pl.dead && d2 < Math.max(30, p.r + pl.r + 14) ** 2) usePower(pl, p);
          break;
        case 'bigchest':
          if (!pl.dead && d2 < Math.max(46, p.r + pl.r + 24) ** 2) {
            if (p.open === 0) G.Audio.sfx('select');
            p.open += dt;
            if (p.open >= CHEST_TIME) { p.open = 0; G.World.breakProp(p); }
          } else if (p.open > 0) p.open = Math.max(0, p.open - dt * 1.5);
          break;
        case 'bush':
          if (p.used) { p.charge += dt / 60; if (p.charge >= 1) { p.used = false; p.charge = 1; } }
          else if (!pl.dead && d2 < (p.r + pl.r + 14) ** 2) eatBerry(pl, p);
          break;
        case 'rival': rival(dt, pl, p, d2); break;
        case 'trap':
          if (!pl.dead && d2 < 13 * 13) G.World.breakProp(p);
          else if (authority() && G.EnemyMgr.queryCircle(p.x, p.y - 8, 3).some(e => !e.flying && !e.remote)) G.World.breakProp(p);
          break;
      }
    }
  }

  function spring(dt, pl, p, d2) {
    if (p.charge < 1) p.charge = Math.min(1, p.charge + dt / 45);
    if (pl.dead || d2 > 26 * 26 || p.charge <= 0.02 || pl.hp >= pl.maxHp) return;
    const before = pl.hp;
    pl.hp = Math.min(pl.maxHp, pl.hp + pl.maxHp * 0.14 * dt);
    healAcc += pl.hp - before;
    p.charge = Math.max(0, p.charge - dt * 0.09);
    if (Math.random() < dt * 14) G.FX.px(pl.x + G.U.rand(-pl.r, pl.r), pl.y - G.U.rand(0, pl.bodyH), '#7dffb0', { vy: -50, life: 0.5 });
    healShown -= dt;
    if (healShown <= 0 && healAcc >= 1) {
      healShown = 0.6;
      G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, '+' + Math.round(healAcc), '#5fe08a');
      healAcc = 0;
      G.Audio.sfx('xp');
    }
    if (p.charge <= 0.02) G.Spawner.say('El manantial se ha secado (se recarga solo)', 2.2, true);
  }

  // ---------------- version de Nika : baies ----------------

  const BERRY_TIME = 20;
  const BERRIES = [
    { name: 'Baie Oran', desc: 'soigne 35% des PV', color: '#5f9bff' },
    { name: 'Baie Lichii', desc: 'dégâts ×1,5', color: '#ff5f6d', on: p => { p.atkMul *= 1.5; }, off: p => { p.atkMul /= 1.5; } },
    { name: 'Baie Sailak', desc: '+35% vitesse', color: '#2fd08a', on: p => { p.spdMul *= 1.35; }, off: p => { p.spdMul /= 1.35; } },
    { name: 'Baie Pitaye', desc: '-30% recharge', color: '#ffd23f', on: p => { p.cdMul *= 0.7; }, off: p => { p.cdMul /= 0.7; } }
  ];

  function eatBerry(pl, p) {
    p.used = true; p.charge = 0;
    const b = BERRIES[p.kind];
    if (b.on) pl.addPower({ id: 'berry' + p.kind, name: b.name, desc: b.desc, color: b.color, on: b.on, off: b.off }, BERRY_TIME);
    else { const h = Math.round(pl.maxHp * 0.35); pl.hp = Math.min(pl.maxHp, pl.hp + h); G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, '+' + h, '#5fe08a'); }
    G.FX.burst(p.x, p.y - 14, b.color, 16, 120);
    G.Audio.sfx('heal');
    G.Progress.event('berry');
    G.Spawner.say(b.name + ' : ' + b.desc + (b.on ? ' pendant ' + BERRY_TIME + ' s' : ''), 2.6, true);
  }

  // ---------------- version de Nika : dresseurs rivaux ----------------
  // Un dresseur attend sur son terrain. Approche-toi : il envoie ses Pokémon
  // (des mini-boss, plus forts avec le temps). Bats-les tous : récompense.
  const TRAINERS = ['Gamin', 'Fillette', 'Scout', 'Montagnard', 'Pêcheur', 'Ornithologue', 'Karatéka',
    'Pokéfan', 'Canon', 'Topdresseur', 'Motard', 'Mentaliste', 'Dompteur', 'Kiné'];
  const NAMES = ['Léo', 'Inès', 'Hugo', 'Jade', 'Noé', 'Lina', 'Tom', 'Rose', 'Max', 'Zoé', 'Sacha', 'Lou'];

  /** L'équipe du dresseur : choisie en le voyant de loin (le temps de charger les sprites). */
  function rivalTeam(p, t) {
    const lo = 300 + Math.min(220, t / 4), hi = lo + 120;
    const pool = G.DEX.filter(m => !m.leg && G.SPRITE_META[m.dex] && m.bst >= lo && m.bst <= hi);
    const n = t < 300 ? 1 : t < 900 ? 2 : 3;
    p.team = G.U.pickN(pool.length >= n ? pool : G.DEX.filter(m => !m.leg && G.SPRITE_META[m.dex]), n).map(m => m.dex);
    p.who = G.U.pick(TRAINERS) + ' ' + G.U.pick(NAMES);
    G.Sprites.preload(p.team);
    p.anim = new G.Sprites.Animator(p.team[0], 1);
  }

  function rival(dt, pl, p, d2) {
    const t = G.Game.st ? G.Game.st.time : 0;
    if (!p.team) rivalTeam(p, t);
    if (p.anim) p.anim.update(dt);
    if (p.used || !authority()) return;
    if (p.foes) {
      if (p.foes.every(e => e.dead)) winRival(pl, p, t);
      return;
    }
    if (pl.dead || d2 > (p.r + pl.r + 60) ** 2) return;
    // Le combat commence.
    const sc = G.Enemies.bossScale(t);
    const hp = Math.round((600 + t * 2.4) * G.League.diff() / Math.sqrt(p.team.length));
    p.foes = p.team.map((dex, k) => {
      const m = G.DEX_BY[dex];
      const def = {
        at: 0, dex, name: m.name, hp, spd: Math.round(G.U.clamp(50 + m.spd * 0.3, 50, 95)),
        dmg: Math.round(26 + t / 30), xp: Math.round(160 + t / 2),
        behavior: k % 2 ? 'ranged' : 'charger', shotDmg: Math.round((26 + t / 30) * 0.55), shotCd: 1.1, range: 260
      };
      const a = Math.random() * 6.2832;
      const e = new G.Enemy(def, p.x + Math.cos(a) * 70, p.y - 30 + Math.sin(a) * 40, sc, true);
      e.dmg *= G.League.dmgK();
      e.rival = true;
      G.EnemyMgr.add(e);
      return e;
    });
    G.Spawner.say(p.who + ' veut se battre ! (' + p.team.map(d => G.DEX_BY[d].name).join(', ') + ')', 3.4, true);
    G.Audio.sfx('boss');
    G.Camera.kick(0.8);
    G.FX.ring(p.x, p.y - 8, 10, 140, '#ff5f6d', 0.6, 5);
  }

  /** Récompenses : des pièces, puis un objet tenu, des tickets ou un pouvoir. */
  function winRival(pl, p, t) {
    p.used = true; p.foes = null;
    const coins = Math.round(30 + t / 8);
    pl.coins += coins;
    const r = Math.random();
    let gift;
    if (r < 0.45) { gift = 'un objet tenu'; G.Game.offerItem(G.Items.roll()); }
    else if (r < 0.75) { const n = t < 600 ? 3 : 5; pl.balls = (pl.balls || 0) + n; G.Game.addBalls(n); gift = '+' + n + ' Super Bonbons'; }
    else { const pw = G.U.pick(POWERS); pl.addPower(pw, POWER_TIME); gift = 'le pouvoir ' + pw.name + ' (' + pw.desc + ')'; }
    G.Spawner.say(p.who + ' est battu ! +' + coins + ' pièces et ' + gift, 3.6, true);
    G.Audio.sfx('legend');
    G.FX.burst(p.x, p.y - 20, '#ffe14d', 40, 240);
    G.Progress.event('rival');
  }

  function drawRival(ctx, p, t) {
    if (!p.anim || p.used || p.foes) return;
    p.anim.dir = 0;
    p.anim.draw(ctx, p.x, p.y - 10);
    // « ! » au-dessus : il attend un adversaire.
    const bob = Math.sin(t * 4 + p.wiggle) * 3, y = p.y - 10 - Math.min(56, G.Sprites.bodyHeight(p.team[0])) - 14 + bob;
    ctx.save();
    ctx.font = '900 22px Pixelify, monospace'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#1b1528'; ctx.strokeText('!', p.x, y);
    ctx.fillStyle = '#ff5f6d'; ctx.fillText('!', p.x, y);
    ctx.restore();
  }

  function usePower(pl, p) {
    p.used = true;
    const pw = POWERS[p.kind];
    pl.addPower(pw, POWER_TIME);
    G.FX.ring(p.x, p.y - 20, 8, 90, pw.color, 0.6, 5);
    G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, pw.color, 24, 200);
    G.Audio.sfx('legend');
    G.Spawner.say('¡Poder ' + pw.name + '! ' + pw.desc + ' durante ' + POWER_TIME + ' s', 3, true);
  }

  /**
   * Una trampa salta (en cada ordenador; ver la cabecera). El daño a enemigos
   * sólo lo hace quien manda; a ti te afecta si estás dentro.
   */
  function trapEffect(p) {
    const x = p.x, y = p.y - 8, k = p.kind;
    const col = ['#c86bdc', '#8bd94a', '#ff7b3d'][k];
    const pal = ['poison', 'grass', 'fire'][k];
    G.FX.ring(x, y, 6, TRAP_R, col, 0.5, k === 2 ? 7 : 4);
    G.FX.burst(x, y - 6, col, k === 2 ? 40 : 22, k === 2 ? 260 : 140);
    for (let i = 0; i < (k === 2 ? 10 : 7); i++) {
      const a = Math.random() * 6.2832, r = G.U.rand(8, TRAP_R * 0.8);
      G.FX.sp(k === 2 ? 'impact' : 'blob', pal, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7 - 6,
              { vy: k === 2 ? -30 : -45, life: G.U.rand(0.4, 0.8) });
    }
    G.Audio.sfx(k === 2 ? 'boss' : 'surge');
    if (k === 2 && G.U.dist2(x, y, G.Camera.x, G.Camera.y) < 500 * 500) G.Camera.kick(0.7);

    const pl = G.Game.player;
    const lvl = pl ? pl.level : 1;
    if (authority()) {
      for (const e of G.EnemyMgr.queryCircle(x, y, TRAP_R)) {
        if (e.remote) continue;
        if (k === 0) { e.applyPoison(5); e.hurt(14 + lvl * 3, '#d47cf0'); }
        else if (k === 1) { e.applySlow(0.65, 4.5); e.hurt(4, '#8bd94a'); }
        else e.hurt(90 + lvl * 18, '#ff7b3d', e.x - x, e.y - y, 220);
      }
    }
    if (pl && !pl.dead && G.U.dist2(x, y, pl.x, pl.y) < (TRAP_R * 0.7) ** 2) {
      pl.invuln = 0;
      if (k === 0) pl.hurt(pl.maxHp * 0.1);
      else if (k === 1) { pl.slowT = 3.5; G.FX.dmgText(pl.x, pl.y - pl.bodyH - 6, '¡Pegajoso!', '#8bd94a'); }
      else pl.hurt(pl.maxHp * 0.2);
    }
  }

  return { update, trapEffect, POWERS, CHEST_TIME, drawRival, BERRIES };
})();
