/* ============ power.js — les ennemis suivent ta puissance (version de Nika) ============
 * Avec l'équipe de 6 qui tire tout, on devenait trop fort trop vite : les boss
 * tombaient en 2 à 5 s et les légendaires des failles en 3 à 6 s (sur 120 s).
 *
 * index()   dégâts par seconde « sur le papier » de toute l'équipe (dégâts du
 *           mouvement × attaque / recharge, critiques compris).
 * mobK()    les ennemis normaux ont plus de PV quand l'équipe frappe plus fort
 *           que le chef seul (le jeu d'origine était équilibré pour 1 Pokémon).
 * bossHp()  un boss a au moins assez de PV pour tenir ~`target` secondes face
 *           à ton équipe ; si le combat dure moins (ou plus) que prévu, les
 *           suivants de la partie s'ajustent (adj).
 */
G.Power = (() => {
  // Part des dégâts « sur le papier » qui touche vraiment un boss (visée,
  // projectiles ratés, types...). Mesuré en simulation (2026-10-19).
  const CAL = 0.30;
  // Durée visée des combats (secondes).
  const TARGET = { boss: 35, legend: 45, rival: 14 };
  let adj = 1;

  function reset() { adj = 1; }

  function memberDps(p) {
    let s = 0;
    for (const m of p.moves || []) {
      if (!m || m.kind === 'buff' || !m.dmg) continue;
      s += m.dmg * p.atkFor(m) * Math.max(1, m.count || 1) / Math.max(0.15, (m.cd || 1) * p.cdMul);
    }
    return s * (1 + (p.critChance || 0) * 0.5);
  }

  /** DPS théorique de toute l'équipe. */
  function index() {
    const pl = G.Game.player;
    if (!pl) return 0;
    let s = memberDps(pl);
    for (const a of G.Team.allies) s += memberDps(a);
    return s;
  }

  /** Combien de fois l'équipe frappe plus fort que le chef seul. */
  function share() {
    const pl = G.Game.player;
    if (!pl) return 1;
    const own = memberDps(pl);
    return own > 0 ? Math.max(1, index() / own) : 1;
  }

  /** Multiplicateurs des ennemis normaux : { hp, dmg }. */
  function mobK() {
    const x = share() - 1;
    return { hp: Math.min(4, 1 + x * 0.55), dmg: Math.min(1.5, 1 + x * 0.1) };
  }

  /** PV d'un boss : au moins de quoi tenir TARGET[kind] secondes. */
  function bossHp(base, kind) {
    return Math.max(base, Math.round(index() * CAL * adj * TARGET[kind]));
  }

  /** À poser sur un boss qui vient d'apparaître. */
  function tag(e, kind) { e.pKind = kind; e.pFirst = null; }

  /** Premier coup reçu (enemy.js). */
  function hit(e) { if (e.pKind && e.pFirst == null) e.pFirst = G.Game.st.time; }

  /** Un boss marqué est tombé : on corrige les suivants. */
  function down(e) {
    if (!e.pKind || e.pFirst == null) return;
    const f = Math.max(1, G.Game.st.time - e.pFirst);
    adj = G.U.clamp(adj * G.U.clamp(Math.pow(TARGET[e.pKind] / f, 0.5), 0.8, 1.35), 0.5, 3);
  }

  /** La faille t'a expulsé (temps écoulé) : les suivants seront plus faciles. */
  function lost() { adj = Math.max(0.5, adj * 0.75); }

  return { reset, index, share, mobK, bossHp, tag, hit, down, lost, get adj() { return adj; }, TARGET };
})();
