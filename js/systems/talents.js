/* ============ talents.js — les talents des Pokémon (version de Nika) ============
 * Chaque espèce a son vrai talent des jeux (js/data/talents-dex.js), adapté au
 * survivor. Comme les rôles, les talents de toute l'équipe s'additionnent (le
 * chef compte 1,5 ; le même talent plusieurs fois rapporte de moins en moins).
 *
 * Effets (fx) :
 *   hp pr sr red vamp dmg cd regen spd crit coin xp mag   bonus fixes (part, 0.1 = 10 %)
 *   pinch: type        +40 % de dégâts de ce type quand les PV du chef sont bas (< 35 %)
 *   res: [types, k]    dégâts reçus de ces types réduits de k (1 = immunisé)
 *   wx: [météo, {...}] bonus seulement avec cette météo ('any' = n'importe laquelle)
 *   boss               dégâts contre les boss
 *   guts               dégâts quand les PV du chef sont sous la moitié
 *   burn poison slow reflect   au contact d'un ennemi (brûlure, poison, ralenti, dégâts renvoyés)
 *   stab               dégâts de ses attaques de son propre type (ce Pokémon seulement)
 *   sturdy             une fois par partie, survit à un coup fatal
 */
G.Talents = (() => {
  const FX = {
    'levitate': { res: [['ground'], 1], spd: 0.04 },
    'swift-swim': { wx: ['rain', { spd: 0.25 }] },
    'chlorophyll': { wx: ['sun', { spd: 0.25 }] },
    'pressure': { boss: 0.1, red: 0.03 },
    'intimidate': { pr: 0.1 },
    'thick-fat': { res: [['fire', 'ice'], 0.5] },
    'keen-eye': { crit: 0.05 },
    'run-away': { spd: 0.08 },
    'sturdy': { sturdy: 1 },
    'overgrow': { pinch: 'grass' }, 'blaze': { pinch: 'fire' }, 'torrent': { pinch: 'water' }, 'swarm': { pinch: 'bug' },
    'oblivious': { sr: 0.08 },
    'synchronize': { reflect: 0.15 },
    'shed-skin': { regen: 0.003 },
    'static': { slow: 0.5 },
    'rock-head': { pr: 0.08 },
    'natural-cure': { regen: 0.004 },
    'sand-veil': { wx: ['sand', { red: 0.25 }] },
    'cute-charm': { slow: 0.4 },
    'hyper-cutter': { dmg: 0.05 },
    'poison-point': { poison: 2 },
    'inner-focus': { red: 0.05 },
    'guts': { guts: 0.25 },
    'clear-body': { red: 0.06 },
    'insomnia': { cd: 0.05 },
    'soundproof': { sr: 0.08 },
    'pickup': { coin: 0.15 },
    'water-absorb': { res: [['water'], 1] },
    'shield-dust': { sr: 0.08 },
    'hustle': { dmg: 0.1 },
    'flash-fire': { res: [['fire'], 1] },
    'effect-spore': { poison: 1, slow: 0.3 },
    'limber': { spd: 0.05 },
    'damp': { res: [['fire'], 0.3] },
    'vital-spirit': { cd: 0.05 },
    'stench': { reflect: 0.1 },
    'own-tempo': { red: 0.04 },
    'battle-armor': { pr: 0.1 }, 'shell-armor': { pr: 0.1 },
    'compound-eyes': { crit: 0.04, mag: 0.2 },
    'magnet-pull': { mag: 0.4 },
    'lightning-rod': { res: [['electric'], 1] },
    'early-bird': { xp: 0.08 },
    'illuminate': { mag: 0.25 },
    'flame-body': { burn: 2 },
    'volt-absorb': { res: [['electric'], 1] },
    'speed-boost': { cd: 0.04, spd: 0.06 },
    'magma-armor': { res: [['ice'], 0.5], pr: 0.04 },
    'suction-cups': { pr: 0.06 },
    'sand-stream': { wx: ['sand', { dmg: 0.15 }] },
    'rivalry': { boss: 0.08 },
    'anticipation': { red: 0.05 },
    'steadfast': { spd: 0.06 },
    'trace': { dmg: 0.06 },
    'immunity': { res: [['poison'], 1] },
    'shadow-tag': { slow: 0.5 },
    'serene-grace': { crit: 0.06 },
    'truant': { dmg: 0.3, cd: -0.2 },
    'pure-power': { dmg: 0.2 },
    'liquid-ooze': { reflect: 0.15 },
    'rough-skin': { reflect: 0.25 },
    'water-veil': { res: [['fire'], 0.5] },
    'simple': { dmg: 0.06 },
    'mold-breaker': { boss: 0.1 },
    'sticky-hold': { coin: 0.1 },
    'aftermath': { reflect: 0.2 },
    'snow-warning': { wx: ['snow', { dmg: 0.15 }] },
    'snow-cloak': { wx: ['snow', { red: 0.25 }] },
    'hydration': { wx: ['rain', { regen: 0.008 }] },
    'cursed-body': { slow: 0.5 },
    'wonder-guard': { red: 0.25, hp: -0.3 },
    'plus': { cd: 0.06 }, 'minus': { cd: 0.06 },
    'white-smoke': { red: 0.05 },
    'marvel-scale': { pr: 0.12 },
    'forecast': { wx: ['any', { dmg: 0.12 }] },
    'color-change': { sr: 0.08 },
    'drizzle': { wx: ['rain', { dmg: 0.15 }] },
    'drought': { wx: ['sun', { dmg: 0.15 }] },
    'air-lock': { red: 0.08 },
    'honey-gather': { coin: 0.2 },
    'flower-gift': { wx: ['sun', { dmg: 0.12, red: 0.1 }] },
    'technician': { cd: 0.08 },
    'motor-drive': { res: [['electric'], 1], spd: 0.05 },
    'leaf-guard': { wx: ['sun', { red: 0.2 }] },
    'adaptability': { stab: 0.25 },
    'slow-start': { dmg: 0.2 },
    'bad-dreams': { reflect: 0.2 },
    'multitype': { dmg: 0.15, red: 0.1 }
  };
  const WX = { rain: 'sous la pluie', sun: 'au soleil', sand: 'dans la tempête de sable', snow: 'sous la neige', any: 'avec une météo' };
  const T = t => G.I18n.t(G.U.TYPE_NAME[t]);
  const P = v => (v > 0 ? '+' : '') + Math.round(v * 100) + ' %';

  function idOf(dex) {
    let d = dex;
    const i = G.TALENT_DEX[d - 1];
    return i == null ? null : G.TALENT_IDS[i];
  }
  function name(dex) { const id = idOf(dex); return id ? G.TALENT_NAMES[id] : ''; }

  /** Ce que fait le talent, en une phrase. */
  function desc(dex) {
    const id = idOf(dex), f = id && FX[id];
    if (!f) return '';
    const out = [];
    const bits = (o, tail) => {
      if (o.hp) out.push('PV max ' + P(o.hp) + tail);
      if (o.red) out.push('dégâts reçus ' + P(-o.red) + tail);
      if (o.pr) out.push('dégâts au contact ' + P(-o.pr) + tail);
      if (o.sr) out.push('dégâts des tirs ' + P(-o.sr) + tail);
      if (o.dmg) out.push('dégâts ' + P(o.dmg) + tail);
      if (o.cd) out.push('vitesse d\'attaque ' + P(o.cd) + tail);
      if (o.spd) out.push('vitesse ' + P(o.spd) + tail);
      if (o.regen) out.push('soin ' + (Math.round(o.regen * 1000) / 10) + ' % PV/s' + tail);
      if (o.crit) out.push('coups critiques ' + P(o.crit) + tail);
      if (o.coin) out.push('pièces ' + P(o.coin));
      if (o.xp) out.push('expérience ' + P(o.xp));
      if (o.mag) out.push('ramassage de plus loin (' + P(o.mag) + ')');
    };
    bits(f, '');
    if (f.wx) bits(f.wx[1], ' ' + WX[f.wx[0]]);
    if (f.pinch) out.push('+40 % de dégâts ' + T(f.pinch) + ' quand tes PV sont bas');
    if (f.res) out.push(f.res[1] >= 1 ? 'immunisé contre les attaques ' + f.res[0].map(T).join(' et ') : 'attaques ' + f.res[0].map(T).join(' et ') + ' ' + P(-f.res[1]));
    if (f.boss) out.push('dégâts contre les boss ' + P(f.boss));
    if (f.guts) out.push('dégâts ' + P(f.guts) + ' sous la moitié des PV');
    if (f.burn) out.push('brûle les ennemis qui te touchent');
    if (f.poison) out.push('empoisonne les ennemis qui te touchent');
    if (f.slow) out.push('ralentit les ennemis qui te touchent');
    if (f.reflect) out.push('renvoie ' + P(f.reflect).slice(1) + ' des coups reçus au contact');
    if (f.stab) out.push('ses attaques de son type ' + P(f.stab));
    if (f.sturdy) out.push('une fois par partie, survit à un coup fatal avec 1 PV');
    const s = out.join(', ');
    return s.charAt(0).toUpperCase() + s.slice(1) + '.';
  }

  // ---------------- bonus de l'équipe ----------------
  const DIM = [1, 0.6, 0.4, 0.25, 0.15], LEAD = 1.5;
  const KEYS = ['hp', 'pr', 'sr', 'red', 'vamp', 'dmg', 'cd', 'regen', 'spd', 'crit', 'coin', 'xp', 'mag', 'boss', 'guts', 'reflect', 'burn', 'poison', 'slow', 'sturdy'];
  const zero = () => { const o = { res: {}, pinch: {}, wx: {} }; for (const k of KEYS) o[k] = 0; return o; };
  let b = zero(), sturdyUsed = false;

  function add(o, f, w) { for (const k of KEYS) if (f[k]) o[k] += f[k] * w; }

  /** Appelé par roles.js à chaque changement d'équipe. */
  function recompute() {
    const nb = zero(), L = G.Team.leader;
    if (L) {
      const seen = {};
      G.Team.members().forEach((m, i) => {
        const id = idOf(m.dex), f = id && FX[id];
        if (!f) return;
        const k = seen[id] || 0; seen[id] = k + 1;
        const w = DIM[Math.min(k, DIM.length - 1)] * (i === 0 ? LEAD : 1);
        add(nb, f, w);
        if (f.pinch) nb.pinch[f.pinch] = 1;
        if (f.res) for (const t of f.res[0]) nb.res[t] = Math.min(1, (nb.res[t] || 0) + f.res[1] * (k ? 0.5 : 1));
        if (f.wx) { const o = nb.wx[f.wx[0]] = nb.wx[f.wx[0]] || {}; for (const [kk, v] of Object.entries(f.wx[1])) o[kk] = (o[kk] || 0) + v * w; }
      });
    }
    b = nb;
  }

  /** Les bonus fixes s'ajoutent à ceux des rôles (même plafonds que roles.js). */
  function fold(nb) {
    nb.hp += b.hp;
    nb.physRed = Math.min(0.5, nb.physRed + b.pr + b.red);
    nb.specRed = Math.min(0.5, nb.specRed + b.sr + b.red);
    nb.vamp += b.vamp;
    nb.dmg += b.dmg;
    nb.cd /= Math.max(0.6, 1 + b.cd);
    nb.regen = Math.min(0.02, nb.regen + b.regen);
    nb.spd += b.spd;
  }

  /** Bonus de la météo du moment. */
  function wxNow(key) {
    const w = G.Weather.current;
    if (!w) return 0;
    return ((b.wx[w.kind] && b.wx[w.kind][key]) || 0) + ((b.wx.any && b.wx.any[key]) || 0);
  }
  const lowHp = k => { const L = G.Team.leader; return L && L.hp < L.maxHp * k; };

  /** Multiplicateur de dégâts d'une attaque (combat.js). */
  function moveK(pl, m, e) {
    if (!pl.inTeam) return 1;
    let k = 1 + wxNow('dmg');
    if (m && b.pinch[m.type] && lowHp(0.35)) k *= 1.4;
    if (b.guts && lowHp(0.5)) k *= 1 + b.guts;
    if (b.boss && e && e.boss) k *= 1 + b.boss;
    if (m && pl.mon.types.includes(m.type)) { const f = FX[idOf(pl.dex)]; if (f && f.stab) k *= 1 + f.stab; }
    return k;
  }
  /** Multiplicateur des dégâts reçus (player.js). */
  function hurtK(type) {
    let k = 1 - Math.min(0.5, wxNow('red'));
    if (type && b.res[type]) k *= 1 - b.res[type];
    return k;
  }
  /** Un coup fatal : Fermeté (une fois par partie). */
  function saves(pl, d) {
    if (!b.sturdy || sturdyUsed || G.Team.leader !== pl || d < pl.hp) return false;
    sturdyUsed = true;
    G.Spawner.say('Fermeté ! Ton équipe tient le coup avec 1 PV !', 2.6, true);
    return true;
  }
  /** Un ennemi touche le chef au contact (combat.js). */
  function onContact(e, pl, dmg) {
    if (b.burn) e.applyBurn(Math.ceil(b.burn));
    if (b.poison) e.applyPoison(Math.ceil(b.poison));
    if (b.slow) e.applySlow(Math.min(0.6, b.slow), 1.4);
    if (b.reflect) e.hurt(dmg * Math.min(0.6, b.reflect), '#c9a6ff', e.x - pl.x, e.y - pl.y, 40);
  }
  const spdNow = () => 1 + wxNow('spd');
  const regenNow = () => wxNow('regen');

  function reset() { b = zero(); sturdyUsed = false; }

  /** Pastille HTML (menus, cartes). */
  function chip(dex) {
    const n = name(dex);
    return n ? `<span class="talent-chip" title="${desc(dex)}">${n}</span>` : '';
  }

  return { FX, idOf, name, desc, chip, recompute, fold, moveK, hurtK, saves, onContact, spdNow, regenNow, reset,
           get b() { return b; }, crit: () => b.crit, coinK: () => 1 + b.coin, xpK: () => 1 + b.xp, magK: () => 1 + b.mag };
})();
