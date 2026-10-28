/* ============ tutor.js — CT et Maître des capacités (version de Nika) ============
 * Les CT se trouvent en partie (boss : 1 fois sur 4, légendaire de faille,
 * victoire en Ligue) et se gardent tout de suite (save.ct).
 * Au menu (onglet Attaques), une CT remplace une des 6 attaques apprenables
 * d'une famille (pas la signature) par une attaque de ses types au choix.
 *
 * Sauvegarde : save.ct = nombre de CT, save.tutor = { famille: { place: attaque } }.
 */
G.Tutor = (() => {
  const BOSS_CT = 1 / 4;
  const S = () => G.DB.save || {};

  function ct() { return S().ct | 0; }
  function add(n = 1) {
    const s = S();
    if (!n || !G.DB.save) return;
    s.ct = (s.ct | 0) + n;
    G.DB.commit('run');
  }
  /** Une CT trouvée en partie (petit texte au-dessus de l'endroit). */
  function found(x, y) {
    add(1);
    G.FX.dmgText(x, y - 30, '+1 CT', '#7fe0ff', true);
    G.Audio.sfx('shiny');
  }

  /** Remplacements choisis pour cette famille : { place: attaque }. */
  function of(root) { const t = S().tutor; return (t && t[root]) || null; }

  /** Les attaques qu'on peut lui apprendre : celles de ses types (et Normal) pas déjà apprenables. */
  function options(dex) {
    const root = G.Team.family(dex), learn = G.Team.learnset(dex);
    const types = new Set();
    for (const p of G.DEX) if (G.Team.family(p.dex) === root) p.types.forEach(t => types.add(t));
    const B = G.Moves.BY_ID;
    return G.Moves.poolFor({ types: [...types] }).filter(id => B[id] && !learn.includes(id))
      .sort((a, b) => (B[a].type === 'normal') - (B[b].type === 'normal') || B[a].type.localeCompare(B[b].type) || B[a].name.localeCompare(B[b].name, 'fr'));
  }

  /** Apprend `id` à la place n° `slot` (1 à 6) de la famille de `dex`. */
  function teach(dex, slot, id) {
    const s = S(), root = G.Team.family(dex);
    if (ct() < 1 || slot < 1 || slot > 6 || !options(dex).includes(id)) return false;
    s.ct--;
    s.tutor = s.tutor || {};
    s.tutor[root] = s.tutor[root] || {};
    s.tutor[root][slot] = id;
    G.DB.commit(true);
    return true;
  }

  return { BOSS_CT, ct, add, found, of, options, teach };
})();
