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
  constructor(mon, leader, slot) {
    super(mon, {}, false);
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
    if (this.flash > 0) this.flash -= dt;
    if (this.attackFace > 0) this.attackFace -= dt;
    for (const k in this.buffs) {
      const b = this.buffs[k];
      if (b.n > 0) { b.t -= dt; if (b.t <= 0) b.n = 0; }
    }
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
      if (!G.Sprites.hovers(this.dex)) G.World.collide(this);
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
    this.anim.draw(ctx, this.x, this.y, { color: '#9fb1c9' });
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

  function reset(pl) { leader = pl; allies = []; }

  /** Tous les membres, le chef en premier. */
  function members() { return leader ? [leader, ...allies] : []; }

  function full() { return allies.length + 1 >= MAX; }

  function has(dex) { return members().some(m => m.dex === dex || G.Team.family(m.dex) === G.Team.family(dex)); }

  /** Premier Pokémon de la famille (pour ne pas avoir deux fois Salamèche/Reptincel). */
  function family(dex) { let d = dex; while (G.EVO_FROM[d]) d = G.EVO_FROM[d]; return d; }

  /** Ajoute un Pokémon à l'équipe, niveau 1, avec son mouvement de départ. */
  function recruit(dex) {
    if (!leader || full()) return null;
    const a = new G.Ally(G.DEX_BY[dex], leader, allies.length);
    a.addMove(G.startMoveOf(dex));
    allies.push(a);
    G.Sprites.preload([dex], 4000);
    G.FX.ring(a.x, a.y, 6, 90, '#7fe0ff', 0.6, 5);
    G.FX.burst(a.x, a.y - a.bodyH * 0.5, '#bdf3ff', 24, 180);
    G.Spawner.say(a.mon.name + ' rejoint ton équipe !', 2.8, true);
    G.Audio.sfx('shiny');
    try { G.DB.grant(dex, 'team'); } catch (e) { /* collection : pas grave */ }
    return a;
  }

  /**
   * Les 4 attaques qu'un Pokémon peut apprendre (version de Nika) : son attaque de
   * départ + 3 autres, toujours les mêmes pour sa famille (elles restent après
   * l'évolution). On prend surtout les types de la famille, au plus 1 bonus (buff).
   */
  const sets = {};
  function learnset(dex) {
    const root = family(dex);
    if (sets[root]) return sets[root];
    const start = G.startMoveOf(dex);
    const types = new Set();
    for (const p of G.DEX) if (family(p.dex) === root) p.types.forEach(t => types.add(t));
    let seed = root * 9301 + 49297;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const mix = a => a.map(x => [rnd(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
    const pool = G.Moves.poolFor({ types: [...types] }).filter(id => id !== start);
    const typed = mix(pool.filter(id => G.Moves.BY_ID[id].type !== 'normal'));
    const normal = mix(pool.filter(id => G.Moves.BY_ID[id].type === 'normal'));
    const out = [start];
    let buffs = G.Moves.BY_ID[start].kind === 'buff' ? 1 : 0;
    for (const id of [...typed, ...normal]) {
      if (out.length >= 4) break;
      const m = G.Moves.BY_ID[id];
      if (m.kind === 'buff' && buffs >= 1) continue;
      // varier : pas deux attaques de la même famille tant qu'il y a le choix
      if (out.some(o => G.Moves.BY_ID[o].kind === m.kind) && typed.length + normal.length > 6 && out.length < 3) continue;
      if (m.kind === 'buff') buffs++;
      out.push(id);
    }
    for (const id of [...typed, ...normal]) { if (out.length >= 4) break; if (!out.includes(id)) out.push(id); }
    return (sets[root] = out);
  }

  /** XP partagée : les alliés reçoivent la même XP (le chef la reçoit dans game.js). */
  function shareXp(amount) {
    for (const a of allies) a.gainXp(amount);
    for (const m of members()) checkEvolve(m);
  }

  /** Niveau où ce Pokémon évolue (le plus bas de ses évolutions), ou null. */
  function evoLevel(dex) {
    const e = G.EVOS[dex];
    return e ? Math.min(...e.map(x => x[1])) : null;
  }

  function checkEvolve(p) {
    const lv = evoLevel(p.dex);
    if (lv == null || p.level < lv) return;
    const list = G.EVOS[p.dex].filter(x => G.DEX_BY[x[0]] && G.SPRITE_META[x[0]]);
    if (!list.length) return;
    evolve(p, G.U.pick(list)[0]);
  }

  function evolve(p, to) {
    const old = p.mon, mon = G.DEX_BY[to];
    p.mon = mon; p.dex = to;
    p.shiny = p.shiny && G.Sprites.hasShiny(to);
    p.anim = new G.Sprites.Animator(to, 1, p.shiny);
    p.r = G.Sprites.bodyRadius(to);
    p.bodyH = G.Sprites.bodyHeight(to);
    p.baseSpd = mon.spd; p.baseAtk = mon.atk;
    if (!p.ally) { const gain = Math.max(0, mon.hp - old.hp); p.maxHp += gain; p.hp = Math.min(p.maxHp, p.hp + gain + p.maxHp * 0.25); }
    G.Sprites.preload([to], 4000, p.shiny);
    G.FX.ring(p.x, p.y, 8, 140, '#ffffff', 0.9, 6);
    G.FX.burst(p.x, p.y - p.bodyH * 0.5, '#fff6c2', 50, 260);
    G.Audio.sfx('legend');
    G.Spawner.say(old.name + ' évolue en ' + mon.name + ' !', 3.2, true);
    try { G.DB.grant(to, 'evo'); } catch (e) { /* pas grave */ }
    checkEvolve(p);                    // plusieurs niveaux d'un coup : peut ré-évoluer
  }

  /** Nouveaux Pokémon possibles pour les cartes : formes de base, hasard pondéré par rareté. */
  const RARE_W = { 1: 10, 2: 6, 3: 3, 4: 1.2, 5: 0.4 };
  function recruitOffers(n) {
    if (full()) return [];
    const pool = G.DEX.filter(p => !G.EVO_FROM[p.dex] && !p.leg && G.SPRITE_META[p.dex] && !has(p.dex));
    const out = [];
    for (let i = 0; i < n && pool.length; i++) {
      const total = pool.reduce((s, p) => s + (RARE_W[p.rarity] || 1), 0);
      let r = Math.random() * total, k = 0;
      for (; k < pool.length - 1; k++) { r -= RARE_W[pool[k].rarity] || 1; if (r <= 0) break; }
      out.push(pool.splice(k, 1)[0]);
    }
    return out;
  }

  function update(dt) { for (const a of allies) a.update(dt); }
  function tick(dt, now) { if (!leader || leader.dead) return; for (const a of allies) G.Combat.tick(dt, a, now); }

  return { MAX, reset, members, full, recruit, shareXp, learnset, evoLevel, evolve, recruitOffers, update, tick, family,
           get allies() { return allies; }, get leader() { return leader; } };
})();
