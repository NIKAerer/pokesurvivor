/* ============ pick-ui.js — menu de Nika ============
 * Le seul menu du jeu : tes Pokémon jouables (au début Bulbizarre, Salamèche
 * et Carapuce, puis ceux du gacha), le Pokémon choisi avec ses types et son
 * attaque de départ, et les boutons Jouer, Améliorations et Gacha.
 * Les pièces et les tickets se gagnent en partie.
 */
G.PickUI = (() => {
  const $ = G.UI.$;
  const START = [1, 4, 7];

  function box() {
    const s = G.DB.save;
    if (!Array.isArray(s.box)) s.box = START.slice();
    return s.box.filter(d => G.DEX_BY[d] && G.SPRITE_META[d]);
  }

  function open() {
    G.UI.chrome(false);
    G.Audio.music('village');
    G.UI.show('scr-pick');
    const s = G.DB.save;
    if (!box().includes(s.partner)) { s.partner = box()[0]; s.partnerShiny = false; }
    if (!G.DB.ownsShiny(s.partner)) s.partnerShiny = false;
    // Un seul type de ticket : les anciens tickets ×10 valent 10 tickets.
    if (s.tickets && s.tickets.t10 > 0) { s.tickets.t1 += s.tickets.t10 * 10; s.tickets.t10 = 0; G.DB.commit(); }
    for (const d of box()) if (!G.DB.owns(d)) G.DB.grant(d, 'starter');   // le Pokédex les compte
    G.Sprites.preload(box());          // charger les sprites avant de jouer
    render();
  }

  function render() {
    const s = G.DB.save;
    const mon = G.DEX_BY[s.partner];
    const t = s.tickets || { t1: 0, t10: 0 };
    $('pick-wallet').innerHTML = `<span class="coin"></span> <b>${s.coins.toLocaleString('fr')}</b>
      &nbsp; ${G.Icons.html('ticket', 16)} <b>${t.t1}</b>`;

    // Le Pokémon choisi : grand sprite sur une estrade de la couleur de son type.
    const hero = $('pick-hero');
    const c1 = G.U.TYPE_COLOR[mon.types[0]], c2 = G.U.TYPE_COLOR[mon.types[1] || mon.types[0]];
    $('scr-pick').style.setProperty('--c', c1);
    $('scr-pick').style.setProperty('--c2', c2);
    hero.innerHTML = '';
    const hasSh = G.DB.ownsShiny(mon.dex), shiny = hasSh && !!s.partnerShiny;
    const stage = document.createElement('div');
    stage.className = 'pick-stage';
    stage.appendChild(G.UI.spriteCanvas(mon.dex, 170, 130, { lively: true, scale: 4, hero: true, shiny }));
    hero.appendChild(stage);
    hero.insertAdjacentHTML('beforeend', `<b class="pick-name">${shiny ? G.Icons.html('shiny', 14) + ' ' : ''}${mon.name}</b>
      <span class="pick-num">N° ${String(mon.dex).padStart(3, '0')}</span>${G.UI.typeChips(mon.types)}
      ${hasSh ? `<button id="pick-shiny" class="btn small ${shiny ? 'gold' : 'ghost'}">${G.Icons.html('shiny', 12)} Shiny ${shiny ? 'oui' : 'non'}</button>` : ''}`);
    if (hasSh) $('pick-shiny').onclick = () => { s.partnerShiny = !s.partnerShiny; G.DB.commit(); G.Audio.sfx('select'); render(); };

    // Sa fiche : statistiques, évolutions et attaques.
    const info = $('pick-info');
    const statBar = (lbl, v, max, txt, col) => `<div class="ps-row"><span>${lbl}</span>
      <i><b style="width:${Math.round(Math.min(1, v / max) * 100)}%;background:${col}"></b></i><em>${txt}</em></div>`;
    let html = '<h4>Statistiques</h4>' +
      statBar('PV', mon.hp, 185, mon.hp, '#5fe08a') +
      statBar('Attaque', mon.atk, 1.61, '×' + mon.atk.toFixed(2), '#ff8a5c') +
      statBar('Vitesse', mon.spd, 145, mon.spd, '#5fd4ff');
    // Chaîne d'évolution (depuis la forme de base).
    let root = mon.dex;
    while (G.EVO_FROM[root]) root = G.EVO_FROM[root];
    const chain = [[root, null]];
    for (let d = root; G.EVOS[d];) {
      const nx = G.EVOS[d].filter(x => G.DEX_BY[x[0]] && G.SPRITE_META[x[0]]);
      if (!nx.length) break;
      chain.push([nx[0][0], nx[0][1], nx.length - 1]);
      d = nx[0][0];
    }
    html += '<h4>Évolutions</h4><div class="ps-evo" id="pick-evo"></div>';
    // Les attaques qu'il peut apprendre (la première est sa signature).
    const learn = G.Team.learnset(mon.dex);
    html += `<h4>Attaques (garde 4 sur ${learn.length})</h4><div class="ps-moves">` + learn.map((id, k) => {
      const d = G.Moves.BY_ID[id];
      return `<span class="ps-mv${k ? '' : ' sig'}" style="--m:${G.U.TYPE_COLOR[d.type]}">${G.Icons.html('move:' + id, 18)}<small>${d.name}${k ? '' : ' ★'}</small></span>`;
    }).join('') + '</div>';
    info.innerHTML = html;
    const evoBox = $('pick-evo');
    chain.forEach(([d, lv, more], k) => {
      if (k) evoBox.insertAdjacentHTML('beforeend', `<span class="ps-arrow">→<small>N.${lv}${more ? ' +' + more : ''}</small></span>`);
      const el = document.createElement('span');
      el.className = 'ps-evo-mon' + (d === mon.dex ? ' on' : '');
      el.appendChild(G.UI.spriteCanvas(d, 46, 42, { scale: 2, hero: true, shiny }));
      el.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[d].name}</small>`);
      evoBox.appendChild(el);
    });
    if (chain.length === 1) evoBox.insertAdjacentHTML('beforeend', '<small class="note">N\'évolue pas</small>');

    // Tes Pokémon.
    const list = $('pick-cards');
    list.innerHTML = '';
    // Version de Nika : trier ses Pokémon.
    const D = d => G.DEX_BY[d], by = s.pickSort || 'new';
    const SORTS = {
      new: (a, b) => mons0.indexOf(b) - mons0.indexOf(a),
      dex: (a, b) => a - b,
      rare: (a, b) => D(b).rarity - D(a).rarity || a - b,
      type: (a, b) => D(a).types[0].localeCompare(D(b).types[0]) || a - b,
      name: (a, b) => D(a).name.localeCompare(D(b).name, 'fr'),
      bst: (a, b) => (D(b).bst || 0) - (D(a).bst || 0) || a - b
    };
    const mons0 = box(), mons = mons0.slice().sort(SORTS[by] || SORTS.new);
    $('pick-sort').value = by;
    $('pick-sort').onchange = e => { s.pickSort = e.target.value; G.DB.commit(); render(); };
    for (const dex of mons) {
      const b = document.createElement('button');
      b.className = 'pick-card' + (dex === s.partner ? ' on' : '');
      b.style.setProperty('--c', G.U.TYPE_COLOR[G.DEX_BY[dex].types[0]]);
      b.title = G.DEX_BY[dex].name;
      b.appendChild(G.UI.spriteCanvas(dex, 64, 54, { scale: 2, hero: true, shiny: dex === s.partner && G.DB.ownsShiny(dex) && !!s.partnerShiny }));
      if (G.DB.ownsShiny(dex)) b.insertAdjacentHTML('beforeend', `<span class="pick-sh">${G.Icons.html('shiny', 10)}</span>`);
      b.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[dex].name}</small>`);
      b.onclick = () => { if (s.partner !== dex) s.partnerShiny = false; s.partner = dex; G.DB.commit(); G.Audio.sfx('select'); render(); };
      list.appendChild(b);
    }
    $('pick-count').textContent = `Tes Pokémon (${mons.length})`;
    // La Ligue : badges gagnés et prochain défi.
    const L = G.League, cur = L.current(), stp = L.step();
    $('pick-league').innerHTML = L.STEPS.map((st, i) =>
      `<span class="lg-b ${st.kind}${i < stp ? ' on' : ''}${i === stp && !L.done() ? ' next' : ''}" style="--c:${G.U.TYPE_COLOR[st.type]}" title="${L.title(st)}"></span>`).join('')
      + `<span class="lg-txt">${cur ? 'Prochain défi : <b>' + L.title(cur) + '</b> (' + G.I18n.t(G.U.TYPE_NAME[cur.type]) + ') vers ' + G.U.mmss(L.at(stp)) : '<b>Maître de la Ligue ★</b> · mode libre'}</span>`;
    // Missions terminées dont la récompense attend.
    const pend = G.Progress.pending();
    $('pick-goals-n').textContent = pend;
    $('pick-goals-n').classList.toggle('hidden', !pend);
  }

  function play() {
    const save = G.DB.save;
    G.DB.grant(save.partner, 'starter');
    G.DB.commit();
    G.Game.startRun();
  }

  function init() {
    $('pick-play').onclick = play;
    $('pick-upg').onclick = () => G.MenuUI.openUpgrades();
    $('pick-gacha').onclick = () => G.GachaUI.open();
    $('pick-dex').onclick = () => G.MenuUI.openDex();
    $('pick-goals').onclick = () => G.GoalsUI.open('missions');
    $('pick-set').innerHTML = G.Icons.html('gear', 18);
    $('pick-set').onclick = () => G.SettingsUI.open('sound');
    // « Retour » des écrans Améliorations et Gacha : revient ici.
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = open; });
  }

  return { open, init };
})();
