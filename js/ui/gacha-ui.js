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

  }

  function open() {
    G.UI.show('scr-gacha', true);
    refresh();
  }

  function refresh() {
    const s = G.DB.save;
    // Version de Nika (2026-10-28) : Boutique refaite au style « Couleur du type ».
    G.PickUI.theme($('scr-gacha'));
    const all = G.DEX.filter(p => G.SPRITE_META[p.dex] && !G.EVO_FROM[p.dex]);   // version de Nika : tout le monde
    const owned = all.filter(p => s.owned[p.dex]).length;
    const shinies = all.filter(p => s.shiny && s.shiny[p.dex]).length;
    $('banner-desc').textContent = 'Tous les Pokémon de base, de Bulbizarre à Arceus. Chaque nouveau devient jouable !';
    $('gacha-owned').innerHTML = `<span class="sh-chip">Pokédex ${owned} / ${all.length}</span>` +
      (shinies ? ` <span class="sh-chip">${G.Icons.html('shiny', 12)} ${shinies} shiny</span>` : '');

    const feat = $('gacha-feat');
    if (feat.dataset.gen !== String(gen)) {
      feat.dataset.gen = gen;
      feat.innerHTML = '';
      for (const dex of G.Gacha.featured(gen)) feat.appendChild(G.UI.spriteCanvas(dex, 170, 190, { lively: true, scale: 2, dir: 1 }));
    }

    const p5 = (s.pity && s.pity[gen]) || 0, p4 = s.pity4 || 0;
    const bar = (label, left, max, c) => `<div class="sh-pb"><span>${label} garanti${label === 'Épique' ? 'e' : ''} dans <b>${left}</b></span>
      <div class="ts-bar"><i style="width:${Math.round(100 * (max - left) / max)}%;background:${c}"></i></div></div>`;
    $('gacha-pity').innerHTML = bar('Épique', G.Gacha.PITY_4 - p4, G.Gacha.PITY_4, G.Gacha.RARITY_COLOR[4])
      + bar('Légendaire', G.Gacha.PITY_5 - p5, G.Gacha.PITY_5, G.Gacha.RARITY_COLOR[5]);

    $('gacha-rates').innerHTML = '<h3>Probabilités</h3>' + G.Gacha.RATES.slice().reverse().map(([r, w]) => `
      <div class="sh-rate" style="--rc:${G.Gacha.RARITY_COLOR[r]}"><span>${G.UI.stars(r, 10)} ${G.Gacha.RARITY_NAME[r]}</span>
      <i><b style="width:${Math.max(3, w)}%"></b></i><span>${w} %</span></div>`).join('') +
      `<div class="sh-rate" style="--rc:#9ae6ff"><span>${G.Icons.html('shiny', 12)} Shiny</span><i><b style="width:3%"></b></i><span>1 %</span></div>
       <details class="sh-rules"><summary>Règles</summary><p>
       · Une Épique ou mieux au plus tard toutes les ${G.Gacha.PITY_4} ouvertures.<br>
       · Après ${G.Gacha.PITY_5} ouvertures sans Légendaire, la suivante en est une.<br>
       · Un doublon donne des Bonbons de son espèce (pour monter son rang). Les shiny ne se répètent pas.<br>
       · Il faut une place libre dans la boîte par Poké Ball ouverte (×10 : 10 places).<br>
       · Les Poké Balls se gagnent en partie (ennemis, boss, Ligue, Tour) ou s'achètent ici.</p></details>`;

    const t = s.tickets;
    $('cost-1').innerHTML = `${G.Icons.html('ticket', 18)} 1`;
    $('cost-10').innerHTML = `${G.Icons.html('ticket', 18)} 10`;
    $('cost-10b').innerHTML = `${G.Icons.html('ticket10', 18)} 1`;
    $('gacha-tickets').innerHTML = `Tu as ${G.Icons.html('ticket', 16)} <b>${t.t1}</b> Poké Ball${t.t1 > 1 ? 's' : ''} à ouvrir`;
    $('pull-1').disabled = !G.Gacha.costOf(s, 1) || !G.Gacha.roomFor(1);
    $('pull-10').disabled = !G.Gacha.costOf(s, 10, 't1') || !G.Gacha.roomFor(10);

    // Acheter des Poké Balls (shop.js) : le prix remonte à zéro chaque jour.
    $('sh-buy-ic').innerHTML = G.Icons.html('ticket', 30);
    const b = $('buy-t1'), price = G.Shop.price(), left = G.Shop.left();
    $('sh-buy-sub').textContent = left > 0 ? `Encore ${left} / ${G.Shop.DAY} aujourd'hui · +${G.Shop.STEP} par achat` : 'Reviens demain : 0 / ' + G.Shop.DAY + ' aujourd\'hui';
    b.innerHTML = left > 0 ? `<span class="coin"></span>${price.toLocaleString('fr')}` : 'Demain';
    b.disabled = !G.Shop.canBuy();
    b.onclick = () => { if (G.Shop.buy()) { G.Audio.sfx('buy'); refresh(); } };

    // Agrandir la boîte, ici aussi : c'est souvent elle qui bloque les ouvertures.
    $('sh-box-ic').innerHTML = G.Icons.html('ball3', 30);
    const cap = G.Box.cap(), atMax = cap >= G.Box.MAX, f = G.Box.free();
    $('sh-box-sub').innerHTML = `Boîte ${cap - f} / ${cap}` + (atMax ? ' · maximum' : ` · +${G.Box.STEP} places`);
    const bx = $('sh-box-buy');
    bx.innerHTML = atMax ? 'MAX' : `<span class="coin"></span>${G.Box.price().toLocaleString('fr')}`;
    bx.disabled = !G.Box.canExpand();
    bx.onclick = () => { if (G.Box.expand()) { G.Audio.sfx('buy'); refresh(); } };

    const room = $('gacha-room');
    room.innerHTML = f >= 10 ? '' : f > 0
      ? `Il reste ${f} place${f > 1 ? 's' : ''} dans ta boîte : ×10 bloqué.`
      : `Ta boîte est pleine : agrandis-la ou relâche un Pokémon pour ouvrir des Poké Balls.`;
    if (f < 10) {
      room.insertAdjacentHTML('beforeend', ` <button class="btn small gold" id="gacha-rel">Relâcher des Pokémon</button>`);
      $('gacha-rel').onclick = () => G.PickUI.openRelease();
    }
    room.classList.toggle('hidden', f >= 10);
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
