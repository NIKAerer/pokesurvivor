/* ============ gacha-ui.js — banners por generación y animación de tirada ============
 * La lógica (probabilidades, pity, shiny, repetidos) está en systems/gacha.js.
 */
G.GachaUI = (() => {
  const $ = G.UI.$;
  let busy = false;
  let gen = 1;

  function init() {
    $('pull-1').onclick = () => pull(1);
    $('pull-10').onclick = () => pull(10, 't1');
    $('pull-10b').onclick = () => pull(10, 't10');
    $('pull-close').onclick = close;

    const tabs = $('gacha-gens');
    G.Gacha.BANNERS.forEach(b => {
      const t = document.createElement('button');
      t.className = 'gen-tab';
      t.dataset.gen = b.gen;
      t.innerHTML = `<b>${b.name}</b><small>Gen ${b.gen}</small>`;
      t.onclick = () => { gen = b.gen; refresh(); };
      tabs.appendChild(t);
    });
  }

  function open() {
    G.UI.show('scr-gacha', true);
    refresh();
  }

  function refresh() {
    const s = G.DB.save;
    const banner = G.Gacha.BANNERS[gen - 1];
    document.querySelectorAll('#gacha-gens .gen-tab').forEach(t => t.classList.toggle('on', +t.dataset.gen === gen));

    const all = G.DEX.filter(p => G.SPRITE_META[p.dex] && !G.EVO_FROM[p.dex]);   // version de Nika : tout le monde
    const owned = all.filter(p => s.owned[p.dex]).length;
    const shinies = all.filter(p => s.shiny && s.shiny[p.dex]).length;
    const [c1, c2, c3] = banner.color;
    $('banner').style.background =
      `radial-gradient(circle at 80% 30%, rgba(255,210,63,.3), transparent 45%),
       radial-gradient(circle at 15% 80%, rgba(196,123,255,.3), transparent 50%),
       linear-gradient(135deg, ${c1}, ${c2} 55%, ${c3})`;
    $('banner-title').textContent = 'Gacha';
    $('banner-desc').textContent = 'Tous les Pokémon de base, de Bulbizarre à Arceus. Chaque nouveau devient jouable !';
    $('gacha-owned').innerHTML = `Tienes ${owned} de ${all.length}` +
      (shinies ? ` · ${G.Icons.html('shiny', 12)} ${shinies} shiny` : '');

    const feat = $('gacha-feat');
    feat.innerHTML = '';
    for (const dex of G.Gacha.featured(gen)) {
      feat.appendChild(G.UI.spriteCanvas(dex, 170, 190, { lively: true, scale: 2, dir: 1 }));
    }

    const pity = (s.pity && s.pity[gen]) || 0;
    $('gacha-pity').textContent = `Légendaire garanti dans ${G.Gacha.PITY_5 - pity} · Épique garantie dans ${G.Gacha.PITY_4 - (s.pity4 || 0)}`;

    $('gacha-rates').innerHTML = '<h3>Probabilidades</h3>' + G.Gacha.RATES.slice().reverse().map(([r, w]) => `
      <div><span style="color:${G.Gacha.RARITY_COLOR[r]}">${G.UI.stars(r, 10)} ${G.Gacha.RARITY_NAME[r]}</span>
      <span>${w}% · ${G.Gacha.pool(r, gen).length}</span></div>`).join('') +
      `<div><span>${G.Icons.html('shiny', 12)} Shiny</span><span>1%</span></div>
       <p class="note">· Une Épique ou mieux au plus tard toutes les ${G.Gacha.PITY_4} ouvertures (aussi une par une).<br>
       · Après ${G.Gacha.PITY_5} ouvertures sans Légendaire, la suivante en est une.<br>
       · Un doublon donne des Bonbons de son espèce (pour monter son rang). Les shiny ne se répètent pas.<br>
       · Il faut une place libre dans la boîte par Poké Ball ouverte (×10 : 10 places). Agrandis-la ou relâche un Pokémon au menu.<br>
       · Les Poké Balls se gagnent en partie (ennemis, boss, Ligue, Tour) ou s'achètent : ${G.Shop.BASE} pièces, +${G.Shop.STEP} par achat dans la journée, ${G.Shop.DAY} par jour.</p>`;

    const t = s.tickets;
    $('cost-1').innerHTML = `${G.Icons.html('ticket', 18)} 1`;
    $('cost-10').innerHTML = `${G.Icons.html('ticket', 18)} 10`;
    $('cost-10b').innerHTML = `${G.Icons.html('ticket10', 18)} 1`;
    $('gacha-tickets').innerHTML = `Tu as ${G.Icons.html('ticket', 18)} <b>${t.t1}</b> Poké Ball${t.t1 > 1 ? 's' : ''} à ouvrir`
      + ` · Boîte ${s.box.length}/${G.Box.cap()}` + (G.Box.full() ? ' <b class="warn">pleine</b>' : '');
    // Version de Nika : prix du jour (shop.js), il remonte à zéro chaque jour.
    const b = $('buy-t1'), price = G.Shop.price(), left = G.Shop.left();
    b.innerHTML = left > 0
      ? `Acheter ${G.Icons.html('ticket', 16)} · <span class="coin"></span> ${price} <small>(${left}/${G.Shop.DAY} aujourd'hui)</small>`
      : `Plus de Poké Balls à acheter aujourd'hui`;
    b.disabled = !G.Shop.canBuy();
    b.onclick = () => { if (G.Shop.buy()) { G.Audio.sfx('buy'); refresh(); } };
    $('pull-1').disabled = !G.Gacha.costOf(s, 1) || !G.Gacha.roomFor(1);
    $('pull-10').disabled = !G.Gacha.costOf(s, 10, 't1') || !G.Gacha.roomFor(10);
    const room = $('gacha-room');
    if (room) {
      const f = G.Box.free();
      room.innerHTML = f >= 10 ? '' : f > 0
        ? `Il reste ${f} place${f > 1 ? 's' : ''} dans ta boîte : ×10 bloqué.`
        : `Ta boîte est pleine : agrandis-la ou relâche un Pokémon pour ouvrir des Poké Balls.`;
      room.classList.toggle('hidden', f >= 10);
    }
    G.UI.refreshCoins();
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function pull(n, use = 't1') {
    if (busy) return;
    const res = G.Gacha.pull(G.DB.save, n, gen, use);
    if (!res) {
      G.Audio.sfx('error');
      G.UI.toast(G.Gacha.roomFor(n) ? 'Pas assez de Poké Balls : gagne-en en partie' : 'Pas assez de place dans ta boîte');
      return;
    }
    G.Progress.checkAch();
    G.DB.commit(true);
    busy = true;

    const best = Math.max(...res.map(r => r.rarity));
    const fx = $('pull-fx'), slot = $('slot'), out = $('pull-results');
    out.innerHTML = '';
    $('pull-close').classList.add('hidden');
    slot.style.display = '';
    fx.classList.remove('hidden');
    // Version de Nika : bouton pour passer l'animation.
    let skipped = false;
    const sk = $('pull-skip');
    sk.classList.remove('hidden');
    sk.onclick = () => { skipped = true; sk.classList.add('hidden'); G.BallOpen.stop(); };

    // La tragaperras (ui/slots.js) y luego las cartas.
    await G.BallOpen.play(slot, res);        // version de Nika : ouverture de Poké Ball
    G.Audio.sfx('burst', { rarity: best });
    slot.style.display = 'none';

    for (const r of res) {
      const mon = G.DEX_BY[r.dex];
      const c = document.createElement('div');
      c.className = 'pcard r' + r.rarity + (r.shiny ? ' shiny' : '');
      c.style.setProperty('--rc', r.shiny ? '#9ae6ff' : G.Gacha.RARITY_COLOR[r.rarity]);
      c.innerHTML = `<div class="stars">${G.UI.stars(r.rarity, 24)}</div>`;
      c.appendChild(G.UI.spriteCanvas(r.dex, 132, 120, { lively: r.rarity >= 4 || r.shiny, scale: 2, shiny: r.shiny }));
      const tag = r.isNew
        ? `<span class="new">${r.shiny ? '¡SHINY NUEVO!' : '¡NUEVO!'}</span>`
        : `${r.full ? 'Boîte pleine' : 'Repetido'} · ${G.Icons.html('candy', 12)} +${r.candy} Bonbons`;
      c.insertAdjacentHTML('beforeend', `<b>${r.shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${mon.name}</b><div class="tag">${tag}</div>`);
      out.appendChild(c);
      if (!skipped) { G.Audio.sfx('reveal', { rarity: r.rarity }); await wait(n === 10 ? 150 : 0); }
    }
    sk.classList.add('hidden');
    $('pull-close').classList.remove('hidden');
    busy = false;
  }

  function close() {
    $('pull-fx').classList.add('hidden');
    refresh();
  }

  return { init, open, get open_() { return !$('pull-fx').classList.contains('hidden'); } };
})();
