/* ============ shop.js — achat de Poké Balls (version de Nika) ============
 * Prix du jour : 250 pièces, +50 à chaque achat, 5 achats par jour au plus.
 * Le compteur repart à zéro chaque jour (save.shopDay = { d: 'AAAA-MM-JJ', n }).
 * Une partie de 15 min rapporte environ 400 à 800 pièces : une Poké Ball
 * coûte donc à peu près une partie.
 */
G.Shop = (() => {
  const BASE = 250, STEP = 50, DAY = 5;
  const S = () => G.DB.save || {};
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  function bought() {
    const s = S(), t = today();
    if (!s.shopDay || s.shopDay.d !== t) s.shopDay = { d: t, n: 0 };
    return s.shopDay.n | 0;
  }
  function left() { return Math.max(0, DAY - bought()); }
  function price() { return BASE + STEP * Math.min(bought(), DAY - 1); }
  function canBuy() { return left() > 0 && (S().coins | 0) >= price(); }
  function buy() {
    if (!canBuy()) return false;
    const s = S();
    s.coins -= price();
    s.tickets = s.tickets || { t1: 0, t10: 0 };
    s.tickets.t1 = (s.tickets.t1 | 0) + 1;
    s.shopDay.n++;
    s.ticketsBought = (s.ticketsBought | 0) + 1;
    G.DB.commit(true);
    return true;
  }

  return { BASE, STEP, DAY, price, left, canBuy, buy };
})();
