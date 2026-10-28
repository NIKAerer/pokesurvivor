/* ============ roles.js — les rôles de l'équipe (version de Nika) ============
 * Chaque espèce a un rôle (G.BASE[dex][6], js/data/stats.js). Comme l'équipe
 * n'a qu'une barre de PV (celle du chef), chaque rôle donne un BONUS PASSIF à
 * toute l'équipe :
 *   tankA  tank armure    +PV max, moins de dégâts physiques (contact)
 *   tankM  tank magique   +PV max, moins de dégâts spéciaux (tirs, zones)
 *   melee  mêlée          vol de vie sur tous les dégâts de l'équipe
 *   mage   mage           +dégâts
 *   dps    DPS            +vitesse d'attaque (recharge)
 *   soin   soigneur       soin continu de la barre de PV
 *   vit    support vitesse +vitesse de déplacement
 * Le rôle du chef compte double. Plusieurs Pokémon du même rôle s'additionnent,
 * mais chacun donne moins que le précédent (DIM).
 *
 * Les vraies stats servent aussi au combat : une attaque physique (cat P)
 * utilise l'Attaque, une spéciale (cat S) l'Attaque Spé ; le chef encaisse le
 * contact avec sa Défense et les tirs avec sa Défense Spé.
 */
G.Roles = (() => {
  const INFO = {
    tankA: { name: 'Tank', ico: 'role_tank', color: '#b0bfd2', team: 'PV max + résiste aux coups physiques' },
    tankM: { name: 'Tank', ico: 'role_tank', color: '#b0bfd2', team: 'PV max + résiste aux attaques spéciales' },
    melee: { name: 'Mêlée', ico: 'role_melee', color: '#ff8a5c', team: 'Vol de vie sur tous les dégâts' },
    mage:  { name: 'Mage', ico: 'role_mage', color: '#c99bff', team: 'Dégâts de toute l\'équipe' },
    dps:   { name: 'DPS', ico: 'role_dps', color: '#ffd23f', team: 'Vitesse d\'attaque de toute l\'équipe' },
    soin:  { name: 'Soigneur', ico: 'role_soin', color: '#6fe39a', team: 'Soigne la barre de PV en continu' },
    vit:   { name: 'Support vitesse', ico: 'role_vit', color: '#8fe8ff', team: 'Vitesse de déplacement de l\'équipe' }
  };
  // Ce que donne UN Pokémon de ce rôle (le chef en vaut 2).
  const PER = { hp: 0.10, red: 0.06, vamp: 0.012, dmg: 0.08, cd: 0.07, regen: 0.004, spd: 0.06 };
  const DIM = [1, 0.6, 0.4, 0.25, 0.15];
  const LEAD = 2;

  const zero = () => ({ units: {}, hp: 0, physRed: 0, specRed: 0, vamp: 0, dmg: 0, cd: 1, regen: 0, spd: 0 });
  let b = zero();
  let vampPool = 0;

  function of(dex) { const s = G.BASE && G.BASE[dex]; return s ? s[6] : 'melee'; }
  function info(dex) { return INFO[of(dex)]; }
  /** Rôle simplifié pour les attaques (les deux tanks partagent les mêmes). */
  function moveRole(dex) { const r = of(dex); return r === 'tankA' || r === 'tankM' ? 'tank' : r; }
  function stats(dex) { return G.BASE && G.BASE[dex]; }

  /** Multiplicateur d'attaque selon la catégorie (même formule que pokedex.js). */
  function catMul(dex, cat) {
    const s = stats(dex);
    if (!s) return 1;
    const v = cat === 'P' ? s[1] : s[3];
    return 0.70 + v / 100 * 0.55;
  }
  /** Part de l'attaque de base que garde une attaque de cette catégorie (≤ 1). */
  function catK(dex, cat) {
    const s = stats(dex);
    if (!s) return 1;
    return catMul(dex, cat) / Math.max(catMul(dex, 'P'), catMul(dex, 'S'));
  }
  /** Dégâts encaissés par le chef selon sa Défense (P) ou sa Défense Spé (S). */
  function guardK(dex, cat) {
    const s = stats(dex);
    if (!s || !cat) return 1;
    const d = cat === 'P' ? s[2] : s[4];
    return G.U.clamp(1.2 - d / 250, 0.7, 1.15);
  }
  /** Pour les ennemis : part de leur puissance en contact (P) ou en tir (S). */
  function foeK(dex, cat) {
    const s = stats(dex);
    if (!s) return 1;
    const k = 2 * (cat === 'P' ? s[1] : s[3]) / (s[1] + s[3]);
    return G.U.clamp(k, 0.6, 1.4);
  }

  /** Recalcule les bonus d'équipe (au début, à chaque recrue, à chaque évolution). */
  function recompute() {
    const L = G.Team.leader;
    const nb = zero();
    if (L) {
      const u = nb.units;
      u[of(L.dex)] = LEAD;
      const seen = {};
      for (const a of G.Team.allies) {
        const r = of(a.dex), k = seen[r] || 0;
        seen[r] = k + 1;
        u[r] = (u[r] || 0) + DIM[Math.min(k, DIM.length - 1)];
      }
      const n = r => u[r] || 0;
      nb.hp = (n('tankA') + n('tankM')) * PER.hp;
      nb.physRed = Math.min(0.4, n('tankA') * PER.red);
      nb.specRed = Math.min(0.4, n('tankM') * PER.red);
      nb.vamp = n('melee') * PER.vamp;
      nb.dmg = n('mage') * PER.dmg;
      nb.regen = Math.min(0.015, n('soin') * PER.regen);
      nb.spd = n('vit') * PER.spd;
      nb.cd = 1 / (1 + n('dps') * PER.cd);
      G.Talents.recompute(); G.Talents.fold(nb);      // talents de l'équipe (talents.js)
      b = nb;
      syncHp(L);
    } else b = nb;
  }

  /** PV max : le bonus des tanks s'ajoute aux PV « sans rôle » du chef (suivi en continu). */
  function syncHp(L) {
    const plain = L.maxHp - (L.roleHp || 0);
    const want = Math.round(plain * b.hp);
    const d = want - (L.roleHp || 0);
    if (!d) return;
    L.roleHp = want;
    L.maxHp += d;
    L.hp = d > 0 ? L.hp + d : Math.min(L.hp, L.maxHp);
  }

  function reset() { b = zero(); vampPool = 0; G.Talents.reset(); }

  /** Vol de vie de l'équipe (mêlée) : mis de côté puis rendu, au plus 2 % des PV max par seconde. */
  function onDamage(dmg) { if (b.vamp > 0) vampPool += dmg * b.vamp; }

  function update(dt) {
    const L = G.Team.leader;
    if (!L || L.dead) { vampPool = 0; return; }
    syncHp(L);
    const rg = b.regen + G.Talents.regenNow();
    if (rg > 0 && L.hp < L.maxHp) L.hp = Math.min(L.maxHp, L.hp + L.maxHp * rg * dt);
    if (vampPool > 0) {
      const h = Math.min(vampPool, L.maxHp * 0.02 * dt);
      vampPool -= h;
      if (L.hp < L.maxHp) L.hp = Math.min(L.maxHp, L.hp + h);
      vampPool = Math.min(vampPool, L.maxHp * 0.1);
    }
  }

  /** Lignes lisibles des bonus actuels (HUD) : { ico, txt }. */
  function lines() {
    const out = [];
    const pct = v => Math.round(v * 100) + ' %';
    const L = (r, txt) => out.push({ ico: 'role_' + r, txt });
    if (b.hp) L('tank', 'PV max +' + pct(b.hp));
    if (b.physRed) L('tank', 'Dégâts physiques -' + pct(b.physRed));
    if (b.specRed) L('tank', 'Dégâts spéciaux -' + pct(b.specRed));
    if (b.vamp) L('melee', 'Vol de vie ' + (Math.round(b.vamp * 1000) / 10) + ' %');
    if (b.dmg) L('mage', 'Dégâts +' + pct(b.dmg));
    if (b.cd < 1) L('dps', 'Vitesse d\'attaque +' + pct(1 / b.cd - 1));
    if (b.regen) L('soin', 'Soin ' + (Math.round(b.regen * 1000) / 10) + ' % PV/s');
    if (b.spd) L('vit', 'Vitesse +' + pct(b.spd));
    return out;
  }

  /** Pastille HTML du rôle (menus, cartes). */
  function chip(dex, long) {
    const r = INFO[of(dex)];
    return `<span class="role-chip" style="--r:${r.color}" title="${r.team}">${G.Icons.html(r.ico, 12, 'role-ico')}${r.name}${long ? ' · <small>' + r.team + '</small>' : ''}</span>`;
  }
  const CAT_NAME = { P: 'Physique', S: 'Spéciale' };
  const MOVE_ROLE = { tank: 'Tank', melee: 'Mêlée', mage: 'Mage', dps: 'DPS', soin: 'Soin', vit: 'Vitesse' };
  /** Icône du rôle d'une attaque (tank, melee, mage, dps, soin, vit). */
  const moveIco = role => role ? 'role_' + role : null;
  /** <img> pixel de l'icône d'un rôle ('tank', 'mage'...). */
  const iconHtml = (role, size = 12) => G.Icons.html('role_' + role, size, 'role-ico');

  return { INFO, CAT_NAME, MOVE_ROLE, moveIco, iconHtml, chip, of, info, moveRole, stats, catMul, catK, guardK, foeK, recompute, reset, onDamage, update, lines,
           get b() { return b; } };
})();
