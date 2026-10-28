/* ============ rank.js — rang de chaque Pokémon (version de Nika) ============
 * Chaque Pokémon de ta boîte a un rang de 0 à 10. On le monte avec des
 * Super Bonbons (ramassés sur les ennemis, les boss, les dresseurs et la Ligue).
 * Chaque rang : +5 % de PV et +5 % de dégâts quand tu joues avec lui (game.js).
 *
 * Les Bonbons de l'espèce (doublons de la Boutique, box.js) payent d'abord,
 * les Super Bonbons complètent ce qui manque.
 *
 * Sauvegarde : save.rank = { dex: rang }, save.balls = nombre de Super Bonbons.
 */
G.Rank = (() => {
  const MAX = 10;
  const BONUS = 0.05;
  /** Prix du rang suivant (rang 0 -> 1 : 5 Super Bonbons ... 9 -> 10 : 50). */
  const cost = r => (r + 1) * 5;

  const S = () => G.DB.save || {};
  function of(dex) { const r = S().rank; return r && r[dex] ? Math.min(MAX, r[dex] | 0) : 0; }
  function balls() { return S().balls | 0; }

  /** Ce que coûte le rang suivant : { candy, balls } (Bonbons de l'espèce d'abord). */
  function pay(dex) {
    const c = cost(of(dex)), candy = Math.min(c, G.Box.candy(dex));
    return { candy, balls: c - candy };
  }
  function canUp(dex) { return of(dex) < MAX && balls() >= pay(dex).balls; }

  function up(dex) {
    const s = S(), r = of(dex);
    if (!canUp(dex)) return false;
    const p = pay(dex);
    G.Box.addCandy(dex, -p.candy);
    s.balls -= p.balls;
    s.rank = s.rank || {};
    s.rank[dex] = r + 1;
    G.DB.commit(true);
    return true;
  }

  return { MAX, BONUS, cost, of, balls, pay, canUp, up };
})();
