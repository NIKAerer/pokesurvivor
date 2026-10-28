/* ============ daily-ui.js — calendrier de connexion (version de Nika) ============
 * Une récompense par jour où l'on ouvre le jeu, sur un cycle de 7 cases.
 * Un jour manqué ne remet pas à zéro : on reprend à la case suivante.
 * La 7e case est le gros cadeau, puis le cycle recommence.
 *
 * Sauvegarde : save.login = { step: 0..6 (prochaine case), last: 'AAAA-MM-JJ' }.
 */
G.DailyUI = (() => {
  // c = pièces, b = Super Bonbons, t = Poké Balls à ouvrir (Boutique)
  const DAYS = [
    { c: 200 }, { b: 5 }, { c: 300, t: 1 }, { b: 8 }, { c: 500 }, { b: 10, t: 1 }, { c: 800, b: 15, t: 3 }
  ];
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  function S() { const s = G.DB.save; s.login = s.login || { step: 0, last: '' }; return s.login; }
  function ready() { return !!G.DB.save && !G.DB.guest && S().last !== today(); }

  function label(r) {
    return [r.c ? `<span class="coin"></span> ${r.c}` : '', r.b ? `${G.Icons.html('pball', 16)} ${r.b}` : '',
      r.t ? `${G.Icons.html('ticket', 16)} ${r.t}` : ''].filter(Boolean).join('<br>');
  }

  function claim() {
    const s = G.DB.save, L = S(), r = DAYS[L.step];
    s.coins += r.c || 0;
    s.balls = (s.balls | 0) + (r.b || 0);
    s.tickets = s.tickets || { t1: 0, t10: 0 };
    s.tickets.t1 += r.t || 0;
    L.step = (L.step + 1) % DAYS.length;
    L.last = today();
    G.DB.commit(true);
  }

  /** Ouvre la fenêtre si la récompense du jour attend. `done` quand on la ferme. */
  function maybeShow(done) {
    if (!ready()) return false;
    const L = S();
    let el = document.getElementById('daily-cal');
    if (!el) { el = document.createElement('div'); el.id = 'daily-cal'; document.body.appendChild(el); }
    el.innerHTML = `<div class="dc-box"><h2>Cadeau du jour</h2>
      <p class="sub">Reviens chaque jour : le 7e jour, gros cadeau !</p>
      <div class="dc-grid">${DAYS.map((r, i) => `<div class="dc-day${i < L.step ? ' got' : ''}${i === L.step ? ' now' : ''}${i === 6 ? ' big' : ''}">
        <small>Jour ${i + 1}</small><div class="dc-r">${label(r)}</div>${i < L.step ? '<b class="dc-ok">✓</b>' : ''}</div>`).join('')}</div>
      <button class="btn gold" id="dc-take">Récupérer</button></div>`;
    el.querySelector('#dc-take').onclick = () => {
      claim();
      G.Audio.sfx('buy');
      el.remove();
      if (done) done();
    };
    return true;
  }

  return { maybeShow, ready, DAYS };
})();
