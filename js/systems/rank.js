/* ============ rank.js — rang de chaque Pokémon (version de Nika) ============
 * Chaque Pokémon de ta boîte a un rang de 0 à 10. On le monte avec des
 * Poké Balls (ramassées sur les ennemis, les boss, les dresseurs et la Ligue).
 * Chaque rang : +5 % de PV et +5 % de dégâts quand tu joues avec lui (game.js).
 *
 * Sauvegarde : save.rank = { dex: rang }, save.balls = nombre de Poké Balls.
 */
G.Rank = (() => {
  const MAX = 10;
  const BONUS = 0.05;
  /** Prix du rang suivant (rang 0 -> 1 : 5 Poké Balls ... 9 -> 10 : 50). */
  const cost = r => (r + 1) * 5;

  const S = () => G.DB.save || {};
  function of(dex) { const r = S().rank; return r && r[dex] ? Math.min(MAX, r[dex] | 0) : 0; }
  function balls() { return S().balls | 0; }

  function up(dex) {
    const s = S(), r = of(dex);
    if (r >= MAX || balls() < cost(r)) return false;
    s.balls -= cost(r);
    s.rank = s.rank || {};
    s.rank[dex] = r + 1;
    G.DB.commit(true);
    return true;
  }

  return { MAX, BONUS, cost, of, balls, up };
})();
