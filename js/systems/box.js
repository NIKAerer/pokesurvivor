/* ============ box.js — boîte limitée et Bonbons (version de Nika) ============
 * La boîte (le PC) a 8 places au départ. On l'agrandit de 2 places avec des
 * pièces (le prix monte à chaque fois). Boîte pleine : un nouveau Pokémon de la
 * Boutique est transféré au Prof. Chen et donne ses Bonbons à la place
 * (le Pokédex le compte quand même). Un shiny entre toujours.
 *
 * Bonbons : chaque espèce a les siens (save.candy = { dex: n }). Un doublon de
 * la Boutique donne des Bonbons de son espèce ; ils servent à monter son rang
 * (rank.js), les Super Bonbons complètent ce qui manque.
 *
 * Relâcher un Pokémon libère sa place et donne des Super Bonbons.
 */
G.Box = (() => {
  const START = 8, STEP = 2, MAX = 120;
  /** Bonbons d'un doublon, selon sa rareté (un shiny en double : ×3). */
  const CANDY = { 1: 3, 2: 4, 3: 6, 4: 10, 5: 25 };
  /** Super Bonbons quand on relâche, selon la rareté. */
  const RELEASE = { 1: 2, 2: 3, 3: 5, 4: 8, 5: 15 };

  const S = () => G.DB.save || {};
  const box = () => (Array.isArray(S().box) ? S().box : []);

  /** Les anciennes sauvegardes gardent tous leurs Pokémon : la boîte s'adapte. */
  function fix() {
    const s = S();
    if (!s.box || s.boxFixed) return;
    s.boxFixed = 1;
    if (s.box.length > START) s.boxBonus = s.box.length - START;
  }
  function cap() { const s = S(); fix(); return Math.min(MAX, START + STEP * (s.boxExtra | 0) + (s.boxBonus | 0)); }
  function free() { return Math.max(0, cap() - box().length); }
  function full() { return free() <= 0; }
  /** Prix des 2 places suivantes : 400, 600, 800... */
  function price() { return 400 + 200 * (S().boxExtra | 0); }
  function canExpand() { return cap() < MAX && (S().coins | 0) >= price(); }
  function expand() {
    const s = S();
    if (!canExpand()) return false;
    s.coins -= price();
    s.boxExtra = (s.boxExtra | 0) + 1;
    G.DB.commit(true);
    return true;
  }

  function candy(dex) { const c = S().candy; return c && c[dex] ? c[dex] | 0 : 0; }
  function addCandy(dex, n) {
    const s = S();
    if (!n) return;
    s.candy = s.candy || {};
    s.candy[dex] = Math.max(0, (s.candy[dex] | 0) + n);
  }

  /** Relâcher : il faut garder au moins un Pokémon. Renvoie les Super Bonbons gagnés. */
  function release(dex) {
    const s = S();
    if (box().length <= 1 || !box().includes(dex)) return 0;
    s.box = s.box.filter(d => d !== dex);
    const n = RELEASE[(G.DEX_BY[dex] || {}).rarity] || 2;
    s.balls = (s.balls | 0) + n;
    if (s.partner === dex) { s.partner = s.box[0]; s.partnerShiny = false; }
    G.DB.commit(true);
    return n;
  }

  return { START, STEP, CANDY, cap, free, full, price, canExpand, expand, candy, addCandy, release };
})();
