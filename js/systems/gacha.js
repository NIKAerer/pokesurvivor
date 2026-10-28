/* ============ gacha.js — un banner por generación ============
 * Lógica pura: no toca la interfaz. La pantalla está en ui/gacha-ui.js.
 *
 * 9 banners (Kanto ... Paldea). Cada uno con su propio pity.
 * Probabilidades por tirada:  1★ 45% · 2★ 30% · 3★ 17% · 4★ 6.5% · 5★ 1.5%
 * Garantías:
 *   - la tirada ×10 trae al menos un 4★ o superior
 *   - a las 70 tiradas sin 5★ en ese banner, el siguiente es 5★ seguro
 * Shiny: 1 de cada 100 tiradas sale en su versión shiny.
 * Repetidos: version de Nika : des Bonbons de l'espèce (box.js), le triple pour un shiny.
 * Boîte : on ne peut ouvrir que s'il reste assez de places (×1 : 1 place, ×10 : 10 places).
 *
 * Se tira con TICKETS (se consiguen jugando):
 *   ×1   1 ticket
 *   ×10  10 tickets normales, o 1 ticket ×10 (eliges con qué)
 */
G.Gacha = (() => {
  /** ¿Qué gasta una tirada de n? → { t1, t10 } o null si no te llega. */
  /** @param use  't1' (tickets normales) o 't10' (un ticket ×10, sólo para la ×10) */
  function costOf(save, n, use = 't1') {
    const t = save.tickets || { t1: 0, t10: 0 };
    return t.t1 >= n ? { t1: n, t10: 0 } : null;
  }
  /** Version de Nika : il faut une place libre par Poké Ball ouverte. */
  function roomFor(n) { return G.Box.free() >= n; }
  const RATES = [[1, 45], [2, 30], [3, 17], [4, 6.5], [5, 1.5]];
  // Version de Nika (Boutique plus juste) : Légendaire garanti à 50 (au lieu de 70),
  // et une Épica ou mieux au plus tard toutes les 10 ouvertures, même une par une.
  const PITY_5 = 50, PITY_4 = 10;
  const SHINY_RATE = 1 / 100;
  const REFUND = { 1: 15, 2: 30, 3: 60, 4: 120, 5: 300 };
  let forceShiny = 0;           // para pruebas y vídeos: las N próximas salen shiny

  const RARITY_NAME = { 1: 'Común', 2: 'Poco común', 3: 'Rara', 4: 'Épica', 5: 'Legendaria' };
  const RARITY_COLOR = { 1: '#9fb1c9', 2: '#5fe08a', 3: '#4fb4ff', 4: '#c47bff', 5: '#ffcb3d' };

  // Version de Nika : un seul gacha avec tous les Pokémon (gen 1-4), pas de régions.
  const BANNERS = [
    { gen: 1, name: 'Boutique', color: ['#3a1d6e', '#1b2f78', '#0f4d6e'] }
  ];

  // Version de Nika : seulement les formes de base (ils évoluent pendant la partie).
  function inBanner(p) { return !!G.SPRITE_META[p.dex] && !G.EVO_FROM[p.dex]; }

  /** Pokémon de una rareza en un banner. */
  function pool(rarity, gen) { return G.DEX.filter(p => inBanner(p, gen) && p.rarity === rarity); }

  /** Pool no vacío más cercano (algunas generaciones tienen rarezas casi vacías). */
  function poolNear(rarity, gen) {
    for (const d of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
      const r = rarity + d;
      if (r < 1 || r > 5) continue;
      const p = pool(r, gen);
      if (p.length) return { rarity: r, list: p };
    }
    return { rarity, list: G.DEX.filter(p => inBanner(p, gen)) };
  }

  function rollRarity(min = 1) {
    const rates = RATES.filter(([r]) => r >= min);
    const total = rates.reduce((a, [, w]) => a + w, 0);
    let x = Math.random() * total;
    for (const [r, w] of rates) { x -= w; if (x <= 0) return r; }
    return rates[rates.length - 1][0];
  }

  /** Los 3 más fuertes de la generación, para el cartel del banner. */
  function featured(gen) {
    return G.DEX.filter(p => inBanner(p, gen) && p.rarity === 5)
      .sort((a, b) => b.bst - a.bst).slice(0, 3).map(p => p.dex);
  }

  /**
   * Hace `n` tiradas en el banner `gen` sobre el guardado `save` (lo modifica).
   * Devuelve null si no hay monedas, o la lista de resultados:
   *   { dex, rarity, shiny, isNew, refund }
   */
  function pull(save, n, gen = 1, use = 't1') {
    save.box = save.box || [1, 4, 7];
    const cost = costOf(save, n, use);
    if (!cost || !roomFor(n)) return null;
    save.tickets.t1 -= cost.t1;
    save.tickets.t10 -= cost.t10;
    save.pity = save.pity || {};
    save.shiny = save.shiny || {};
    save.pity[gen] = save.pity[gen] || 0;
    save.pity4 = save.pity4 || 0;

    const out = [];
    for (let i = 0; i < n; i++) {
      save.pity[gen]++; save.pity4++;
      let want;
      if (save.pity[gen] >= PITY_5) want = 5;
      else if (save.pity4 >= PITY_4 || (n === 10 && i === n - 1 && !out.some(r => r.rarity >= 4))) want = rollRarity(4);
      else want = rollRarity();

      const { rarity, list } = poolNear(want, gen);
      if (rarity === 5) save.pity[gen] = 0;
      if (rarity >= 4) save.pity4 = 0;
      let mon = G.U.pick(list);
      let shiny = G.Sprites.hasShiny(mon.dex) && (forceShiny > 0 ? (forceShiny--, true) : Math.random() < SHINY_RATE);
      // Los shiny no se repiten: si ya tienes ese, sale otro de la misma rareza
      // cuyo shiny te falte; si los tienes todos, sale normal.
      if (shiny && save.shiny[mon.dex]) {
        const missing = list.filter(p => G.Sprites.hasShiny(p.dex) && !save.shiny[p.dex]);
        if (missing.length) mon = G.U.pick(missing);
        else shiny = false;
      }

      let isNew = false, refund = 0, candy = 0, full = false;
      if (shiny) {
        isNew = !save.shiny[mon.dex];
        if (isNew) save.shiny[mon.dex] = { at: Date.now(), from: 'gacha' };
        else candy = G.Box.CANDY[rarity] * 3;
        if (!save.owned[mon.dex]) save.owned[mon.dex] = { at: Date.now(), from: 'gacha' };
        if (!save.box.includes(mon.dex)) save.box.push(mon.dex);
      } else {
        // Version de Nika : « nouveau » = pas encore jouable (un Pokémon déjà
        // recruté en partie mais pas tiré au gacha devient jouable).
        isNew = !save.box.includes(mon.dex);
        if (!save.owned[mon.dex]) save.owned[mon.dex] = { at: Date.now(), from: 'gacha' };
        if (isNew && G.Box.full()) { isNew = false; full = true; }
        if (isNew) save.box.push(mon.dex);
        else candy = G.Box.CANDY[rarity];
      }
      save.coins += refund;
      G.Box.addCandy(mon.dex, candy);
      out.push({ dex: mon.dex, rarity, shiny, isNew, refund, candy, full });
    }
    save.stats.pulls = (save.stats.pulls || 0) + n;
    return out;
  }

  return { debugForceShiny(n = 1) { forceShiny = n; },
           costOf, roomFor, RATES, PITY_5, PITY_4, SHINY_RATE, REFUND, RARITY_NAME, RARITY_COLOR, BANNERS,
           pool, featured, pull };
})();
