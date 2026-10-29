/* ============ team.js — l'équipe de 6 (version de Nika) ============
 * Ton starter (G.Player) est le chef : lui seul a des PV et c'est lui que tu
 * diriges. Les cartes de niveau proposent parfois un nouveau Pokémon, jusqu'à
 * 6 en tout. Les autres (G.Ally) te suivent, visent tout seuls et lancent
 * TOUS leurs mouvements (jusqu'à 4, chacun avec sa recharge).
 *
 * L'expérience est partagée : chaque Pokémon reçoit la même XP mais garde son
 * propre niveau (un nouveau commence au niveau 1) et évolue à SON niveau
 * (G.EVOS, js/data/evolutions.js). Le chef évolue aussi.
 *
 * Les bonus globaux (Puissance, Réflexes, boutique...) sont ceux du chef :
 * les alliés les lisent chez lui.
 */
G.Ally = class Ally extends G.Player {
  constructor(mon, leader, slot, shiny = false) {
    super(mon, {}, shiny);
    this.leader = leader;
    this.slot = slot;
    this.ally = true;
    this.x = leader.x; this.y = leader.y;
  }
  // Bonus globaux : ceux du chef (les écritures du constructeur sont ignorées).
  get atkMul() { return this.leader ? this.leader.atkMul : 1; } set atkMul(v) { /* chef */ }
  get cdMul() { return this.leader ? this.leader.cdMul : 1; } set cdMul(v) { /* chef */ }
  get xpMul() { return this.leader ? this.leader.xpMul : 1; } set xpMul(v) { /* chef */ }
  get critChance() { return this.leader ? this.leader.critChance : 0; } set critChance(v) { /* chef */ }
  // Les capacités de soutien (Hâte, Danse Lames, Armure...) d'un allié profitent à
  // toute l'équipe : ses bonus vont au chef (vitesse, défense, soin) et l'attaque
  // est partagée. Avant, ils restaient sur l'allié et ne servaient à rien.
  get buffs() { return this.leader ? this.leader.buffs : this._buffs; } set buffs(v) { this._buffs = v; }

  /** Les alliés lancent tous leurs mouvements à la fois. */
  activeGroup() { return this.moves; }
  activeMove() { return this.moves[0]; }
  setActive() { /* pas de touches 1-4 pour eux */ }
  hurt() { /* seul le starter a des PV */ }
  heal() {}
  addMaxHp() {}
  onDealt() {}

  /** Place dans la formation : un arc derrière le chef. */
  spot() {
    const L = this.leader, n = G.Team.allies.length;
    const back = (L.moveAngle || Math.PI / 2) + Math.PI;
    const a = back + (n === 1 ? 0 : (this.slot / (n - 1) - 0.5) * 2.4);
    const d = 44 + (this.slot % 2) * 22;
    return [L.x + Math.cos(a) * d, L.y + Math.sin(a) * d];
  }

  update(dt) {
    this.anim.update(dt);
    if (this.evoFx) G.Team.evoTick(this, dt);
    if (this.flash > 0) this.flash -= dt;
    if (this.attackFace > 0) this.attackFace -= dt;
    // (les bonus sont ceux du chef : c'est lui qui les fait expirer)
    // --- suivre le chef ---
    const L = this.leader;
    const [tx, ty] = this.spot();
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d > 420) { this.x = tx; this.y = ty; }            // resté coincé : il te rejoint
    const s = Math.max(L.spd, 90) * (d > 90 ? 1.35 : 1.05);
    this.walking = d > 10;
    if (this.walking) {
      const k = Math.min(1, s * dt / d);
      this.x += dx * k; this.y += dy * k;
      if (!G.Sprites.hovers(this.dex) && !this.mon.types.includes('flying')) G.World.collide(this);
      this.moveAngle = Math.atan2(dy, dx);
    }
    // --- viser l'ennemi le plus proche (le boss s'il est à portée) ---
    const all = G.EnemyMgr.all();
    const boss = all.find(e => e.boss && !e.dead && G.U.dist(this.x, this.y, e.x, e.y) < 330);
    const tg = boss || G.Projectiles.nearest(all, this.x, this.y, 520) || G.World.nearestBreakable(this.x, this.y, 200);
    this.target = tg;
    if (tg) this.aim = Math.atan2(tg.y - this.y, tg.x - this.x);
    else if (this.walking) this.aim = this.moveAngle;
    const face = this.attackFace > 0 || !this.walking ? this.aim : this.moveAngle;
    this.anim.dir = G.Sprites.dirFromAngle(face);
    this.anim.loop(this.walking ? 'Walk' : 'Idle', this.walking ? s / 110 : 1);
  }

  draw(ctx) {
    G.Sprites.drawShadow(ctx, this.dex, this.x, this.y);
    if (!G.Team.drawEvo(ctx, this)) this.anim.draw(ctx, this.x, this.y, { color: '#9fb1c9' });
    // Petit niveau au-dessus de la tête.
    ctx.save();
    ctx.font = '700 7px Pixelify,"Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    const y = this.y - this.bodyH - 6;
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.7)';
    const txt = 'N.' + this.level;
    ctx.strokeText(txt, this.x, y);
    ctx.fillStyle = '#d6e2ff';
    ctx.fillText(txt, this.x, y);
    ctx.restore();
  }
};

G.Team = (() => {
  const MAX = 6;
  let allies = [];
  let leader = null;

  function reset(pl) { leader = pl; allies = []; held = 0; G.Roles.reset(); G.Roles.recompute(); }

  /** Tous les membres, le chef en premier. */
  function members() { return leader ? [leader, ...allies] : []; }

  // (Un Pokémon volé par la Team Rocket garde sa place jusqu'à la fin du vol.)
  let held = 0;
  function full() { return allies.filter(a => !a.guestT).length + 1 + held >= MAX; }

  /** Version de Nika : jamais plus de MAX Pokémon à l'écran (chef, alliés, invité et Pokémon volé compris). */
  const crowded = () => allies.length + 1 + held >= MAX;
  /** Fait de la place : l'invité temporaire rentre chez lui. */
  function makeRoom() {
    const g = allies.find(a => a.guestT);
    if (!crowded() || !g) return;
    g.guestT = -1;
    guestTick(0);
  }

  /** Version de Nika : un allié sauvage qui t'aide `secs` secondes (Pokémon perdu ramené). */
  function guest(dex, secs) {
    if (!leader || !G.DEX_BY[dex] || crowded()) return null;
    const a = new G.Ally(G.DEX_BY[dex], leader, allies.length);
    a.addMove(G.startMoveOf(dex));
    a.guestT = secs;
    for (let i = 0; i < 60 && a.level < Math.max(1, leader.level - 1); i++) a.gainXp(Math.max(1, a.xpNext - a.xp));
    allies.push(a);
    G.Roles.recompute();
    G.FX.ring(a.x, a.y, 6, 90, '#7dffb0', 0.6, 5);
    return a;
  }
  function guestTick(dt) {
    for (const a of allies.slice()) {
      if (!a.guestT || (a.guestT -= dt) > 0) continue;
      allies.splice(allies.indexOf(a), 1);
      allies.forEach((x, i) => { x.slot = i; });
      G.Roles.recompute();
      G.FX.burst(a.x, a.y - 10, '#7dffb0', 20, 160);
      G.Spawner.say(a.mon.name + ' retourne à la nature. Merci !', 2.6, true);
    }
  }

  function has(dex) { return members().some(m => m.dex === dex || G.Team.family(m.dex) === G.Team.family(dex)); }

  /** Premier Pokémon de la famille (pour ne pas avoir deux fois Salamèche/Reptincel). */
  function family(dex) { let d = dex; while (G.EVO_FROM[d]) d = G.EVO_FROM[d]; return d; }

  /** Ajoute un Pokémon à l'équipe, niveau 1, avec son mouvement de départ. */
  function recruit(dex) {
    if (!leader || full()) return null;
    makeRoom();
    // Version de Nika : un Pokémon dont tu as le shiny rejoint l'équipe en shiny.
    const a = new G.Ally(G.DEX_BY[dex], leader, allies.length, G.DB.ownsShiny(dex));
    a.addMove(G.startMoveOf(dex));
    allies.push(a);
    G.Roles.recompute();               // bonus de rôle de l'équipe
    G.Sprites.preload([dex], 4000, a.shiny);
    G.FX.ring(a.x, a.y, 6, 90, '#7fe0ff', 0.6, 5);
    G.FX.burst(a.x, a.y - a.bodyH * 0.5, '#bdf3ff', 24, 180);
    G.Spawner.say(a.mon.name + ' rejoint ton équipe !', 2.8, true);
    G.Progress.event('recruit', { size: allies.length + 1 });
    G.Audio.sfx('shiny');
    try { G.DB.grant(dex, 'team'); } catch (e) { /* collection : pas grave */ }
    return a;
  }

  /**
   * Les 7 attaques qu'un Pokémon peut apprendre (version de Nika) : son attaque de
   * départ + 6 autres (il n'en garde que 4 : il faut en oublier une pour en
   * apprendre une autre), toujours les mêmes pour sa famille (elles restent après
   * l'évolution). Depuis les rôles (2026-10-19) : 4 attaques de son RÔLE et 3 de
   * son TYPE (l'attaque de départ compte dans l'un des deux). On préfère les
   * types de la famille au type Normal, et pour les attaques qui font des dégâts,
   * la catégorie (physique / spéciale) de sa meilleure Attaque.
   */
  const sets = {};
  const LEARN = 7, ROLE_N = 4;
  function learnset(dex) {
    // (Version de Nika, 2026-10-29 : les CT et le Maître des capacités sont retirés.)
    return baseLearnset(dex);
  }
  function baseLearnset(dex) {
    const root = family(dex);
    if (sets[root]) return sets[root];
    const start = G.startMoveOf(dex);
    const types = new Set();
    for (const p of G.DEX) if (family(p.dex) === root) p.types.forEach(t => types.add(t));
    let seed = root * 9301 + 49297;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const B = G.Moves.BY_ID;
    const role = G.Roles.moveRole(root);
    const st = G.Roles.stats(root);
    const best = st && st[3] > st[1] ? 'S' : 'P';
    const support = role === 'soin' || role === 'vit';
    const score = id => { const m = B[id]; return rnd() + (m.type !== 'normal' ? 1 : 0) + (m.kind !== 'buff' && m.cat === best ? 0.8 : 0); };
    const pool = G.Moves.poolFor({ types: [...types] }).filter(id => id !== start)
      .map(id => [score(id), id]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
    const out = [start];
    let buffs = B[start].kind === 'buff' ? 1 : 0;
    const maxBuffs = support ? 3 : 2;
    let roleN = B[start].role === role ? 1 : 0;
    let typeN = 1 - roleN;
    const take = id => { out.push(id); if (B[id].kind === 'buff') buffs++; };
    const okBuff = id => B[id].kind !== 'buff' || buffs < maxBuffs;
    for (const id of pool) {                         // attaques de rôle
      if (roleN >= ROLE_N) break;
      if (B[id].role !== role || !okBuff(id)) continue;
      take(id); roleN++;
    }
    const typeMax = LEARN - ROLE_N;
    for (const id of pool) {                         // attaques de type (pas de rôle), types de la famille d'abord
      if (out.length >= LEARN || typeN >= typeMax + (ROLE_N - roleN)) break;
      if (out.includes(id) || B[id].role === role || !okBuff(id)) continue;
      // varier : pas deux attaques de la même forme tant qu'il y a le choix
      if (out.some(o => B[o].kind === B[id].kind) && pool.length > 10 && typeN < 2) continue;
      take(id); typeN++;
    }
    for (const id of pool) { if (out.length >= LEARN) break; if (!out.includes(id) && okBuff(id)) take(id); }
    return (sets[root] = out);
  }

  /** XP partagée : les alliés reçoivent la même XP (le chef la reçoit dans game.js). */
  function shareXp(amount) {
    for (const a of allies) a.gainXp(amount);
    for (const m of members()) {
      // Charger le sprite de l'évolution un peu avant, pour qu'il soit prêt.
      const lv = evoLevel(m.dex);
      if (lv && lv - m.level <= 3 && m.evoLoaded !== m.dex) { m.evoLoaded = m.dex; G.Sprites.preload(G.EVOS[m.dex].map(x => x[0])); }
      checkEvolve(m);
    }
  }

  /** Niveau où ce Pokémon évolue (le plus bas de ses évolutions), ou null. */
  function evoLevel(dex) {
    const e = G.EVOS[dex];
    return e ? Math.min(...e.map(x => x[1])) : null;
  }

  function checkEvolve(p) {
    const lv = evoLevel(p.dex);
    if (lv == null || p.level < lv) return;
    let list = G.EVOS[p.dex].filter(x => G.DEX_BY[x[0]] && G.SPRITE_META[x[0]]);
    // Version de Nika : jour / nuit (daynight.js) ; s'il n'y a que celle de l'autre moment, il attend.
    list = list.filter(x => G.DayNight.evoOk(x[0]));
    if (!list.length) return;
    evolve(p, G.U.pick(list)[0]);
  }

  function evolve(p, to) {
    const old = p.mon, mon = G.DEX_BY[to];
    p.mon = mon; p.dex = to;
    p.evoLearn = true;                 // une chance d'apprendre une nouvelle attaque (levelup.js)
    p.shiny = p.shiny && G.Sprites.hasShiny(to);
    const oldAnim = p.anim;
    p.anim = new G.Sprites.Animator(to, 1, p.shiny);
    p.r = G.Sprites.bodyRadius(to);
    p.bodyH = G.Sprites.bodyHeight(to);
    p.baseSpd = mon.spd; p.baseAtk = mon.atk;
    // Le starter : 1,5 × les PV gagnés par l'espèce, et il récupère la moitié de sa vie.
    if (!p.ally) { const gain = Math.round(Math.max(0, mon.hp - old.hp) * 1.5); p.maxHp += gain; p.hp = Math.min(p.maxHp, p.hp + gain + p.maxHp * 0.5); }
    // L'attaque signature devient plus forte à chaque évolution.
    for (const m of p.moves) if (m.def.sig) { m.dmg *= 1.25; G.FX.dmgText(p.x, p.y - p.bodyH - 18, m.name + ' +', '#ffd84a'); }
    G.Sprites.preload([to], 4000, p.shiny);
    // Animation d'évolution : silhouette blanche qui alterne entre l'ancienne et
    // la nouvelle forme, de plus en plus vite, puis éclat (voir drawEvo).
    p.evoFx = { t: 0, old: p.evoFx ? p.evoFx.old : oldAnim, from: p.evoFx ? p.evoFx.from : old.name, to: mon.name };
    p.invuln = Math.max(p.invuln || 0, EVO_T + REVEAL_T + 0.5);
    G.Audio.sfx('levelup');
    G.FX.ring(p.x, p.y, 4, 60, '#ffffff', 0.6, 3);
    G.Game.startEvolving();
    G.Roles.recompute();
    G.Progress.event('pevolve', { dex: to });
    try { G.DB.grant(to, 'evo'); } catch (e) { /* pas grave */ }
    checkEvolve(p);                    // plusieurs niveaux d'un coup : peut ré-évoluer
  }

  const EVO_T = 2.4, REVEAL_T = 1.6;   // silhouette, puis le nouveau Pokémon en couleur

  function evoTick(p, dt) {
    const e = p.evoFx;
    e.t += dt;
    if (e.t < EVO_T) {
      if (Math.random() < dt * 30) G.FX.twinkle(p.x + G.U.rand(-p.r * 2, p.r * 2), p.y - G.U.rand(0, p.bodyH * 1.6));
      return;
    }
    if (!e.shown) {
      // Éclat : on révèle la nouvelle forme en couleur un moment avant la reprise.
      e.shown = true;
      G.FX.ring(p.x, p.y, 8, 150, '#ffffff', 0.9, 6);
      G.FX.burst(p.x, p.y - p.bodyH * 0.5, '#fff6c2', 60, 280);
      if (!p.ally) G.Game.flash('#ffffff', 0.5);
      G.Audio.sfx('legend');
      if (G.Game.state !== 'evolving') G.Spawner.say(e.from + ' évolue en ' + e.to + ' !', 3.2, true);
    }
    if (Math.random() < dt * 8) G.FX.twinkle(p.x + G.U.rand(-p.r * 2, p.r * 2), p.y - G.U.rand(0, p.bodyH * 1.6));
    if (e.t >= EVO_T + REVEAL_T) p.evoFx = null;
  }

  /** Dessine l'évolution en cours ; renvoie false s'il n'y en a pas. */
  function drawEvo(ctx, p) {
    const e = p.evoFx;
    if (!e) return false;
    if (e.t >= EVO_T) {
      // Révélation : halo doré qui s'éteint, le Pokémon évolué en couleur.
      const f = 1 - Math.min(1, (e.t - EVO_T) / REVEAL_T), cy = p.y - p.bodyH * 0.5, R = p.r * 3 + 30;
      ctx.save();
      const g = ctx.createRadialGradient(p.x, cy, 2, p.x, cy, R);
      g.addColorStop(0, 'rgba(255,236,150,' + (0.25 + 0.45 * f) + ')');
      g.addColorStop(1, 'rgba(255,236,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, cy, R, 0, 6.2832); ctx.fill();
      ctx.restore();
      p.anim.draw(ctx, p.x, p.y);
      return true;
    }
    const k = Math.min(1, e.t / EVO_T);
    const a = Math.floor(k * k * 18) % 2 === 0 ? e.old : p.anim;
    a.dir = p.anim.dir;
    ctx.save();
    const cy = p.y - p.bodyH * 0.5, R = p.r * 2.4 + 20 * k;
    const g = ctx.createRadialGradient(p.x, cy, 2, p.x, cy, R);
    g.addColorStop(0, 'rgba(255,255,255,' + (0.35 + 0.5 * k) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, cy, R, 0, 6.2832); ctx.fill();
    ctx.restore();
    a.draw(ctx, p.x, p.y, { flash: true });
    return true;
  }

  /** Version de Nika : la Team Rocket vole un allié au hasard (rocket.js). */
  function steal() {
    const real = allies.filter(x => !x.guestT);       // jamais l'invité temporaire
    if (!real.length) return null;
    const a = real[Math.floor(Math.random() * real.length)];
    allies.splice(allies.indexOf(a), 1);
    allies.forEach((x, i) => { x.slot = i; });
    held = 1;
    G.Roles.recompute();
    return a;
  }
  /** Perdu pour la partie : sa place se libère. */
  function release() { held = 0; }
  /** On le récupère : il revient à sa place derrière le chef. */
  function giveBack(a) {
    held = 0;
    if (!a || !leader || full()) return false;
    makeRoom();
    a.slot = allies.length; a.x = leader.x; a.y = leader.y;
    allies.push(a);
    G.Roles.recompute();
    return true;
  }

  /** Nouveaux Pokémon possibles pour les cartes : formes de base, hasard pondéré par rareté. */
  const RARE_W = { 1: 10, 2: 6, 3: 3, 4: 1.2, 5: 0.4 };
  function recruitOffers(n) {
    if (full()) return [];
    // Version de Nika : seulement les Pokémon que tu possèdes (ta boîte du menu),
    // légendaires capturés compris (rares : poids de leur rareté).
    const own = new Set((G.DB.save && G.DB.save.box) || []);
    const pool = G.DEX.filter(p => own.has(p.dex) && !G.EVO_FROM[p.dex] && G.SPRITE_META[p.dex] && !has(p.dex));
    const out = [];
    for (let i = 0; i < n && pool.length; i++) {
      const total = pool.reduce((s, p) => s + (RARE_W[p.rarity] || 1), 0);
      let r = Math.random() * total, k = 0;
      for (; k < pool.length - 1; k++) { r -= RARE_W[pool[k].rarity] || 1; if (r <= 0) break; }
      out.push(pool.splice(k, 1)[0]);
    }
    return out;
  }

  function update(dt) { guestTick(dt); for (const a of allies) a.update(dt); G.Roles.update(dt); }
  function tick(dt, now) { if (!leader || leader.dead) return; for (const a of allies) G.Combat.tick(dt, a, now); }

  return { MAX, reset, members, full, recruit, shareXp, learnset, evoLevel, evolve, recruitOffers, steal, giveBack, release, guest, update, tick, family, evoTick, drawEvo,
           get allies() { return allies; }, get leader() { return leader; } };
})();
