/* ============ pick-ui.js — menu de Nika ============
 * Le seul menu du jeu : tes Pokémon jouables (au début Bulbizarre, Salamèche
 * et Carapuce, puis ceux du gacha), le Pokémon choisi avec ses types et son
 * attaque de départ, et les boutons Jouer, Améliorations et Gacha.
 * Les pièces et les tickets se gagnent en partie.
 */
G.PickUI = (() => {
  const $ = G.UI.$;
  // Version de Nika : au début on choisit UN starter parmi ceux des 4 régions.
  const STARTERS = [1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393];

  function box() {
    const s = G.DB.save;
    if (!Array.isArray(s.box)) s.box = [];
    return s.box.filter(d => G.DEX_BY[d] && G.SPRITE_META[d]);
  }

  /** Premier lancement : choisir son starter (puis le reste vient du gacha). */
  function chooseStarter() {
    let el = document.getElementById('starter-pick');
    if (!el) { el = document.createElement('div'); el.id = 'starter-pick'; document.body.appendChild(el); }
    el.innerHTML = `<div class="sp-box"><h2>Choisis ton starter</h2>
      <p class="sub">Les autres Pokémon s'obtiennent à la Boutique (tu as 5 Poké Balls à ouvrir pour commencer).</p>
      <div class="sp-grid"></div></div>`;
    const grid = el.querySelector('.sp-grid');
    for (const d of STARTERS.filter(x => G.DEX_BY[x] && G.SPRITE_META[x])) {
      const mon = G.DEX_BY[d];
      const b = document.createElement('button');
      b.className = 'pick-card';
      b.style.setProperty('--c', G.U.TYPE_COLOR[mon.types[0]]);
      b.appendChild(G.UI.spriteCanvas(d, 64, 54, { fit: true, lively: true }));
      b.insertAdjacentHTML('beforeend', `<small>${mon.name}</small>`);
      b.onclick = () => {
        const s = G.DB.save;
        s.box = [d]; s.partner = d; s.partnerShiny = false;
        G.DB.grant(d, 'starter');
        G.DB.commit(true);
        G.Audio.sfx('confirm');
        el.remove();
        open();
      };
      grid.appendChild(b);
    }
    G.Sprites.preload(STARTERS);
  }

  function open() {
    G.UI.chrome(false);
    G.Audio.music('village');
    G.UI.show('scr-pick');
    const s = G.DB.save;
    if (!box().length) { chooseStarter(); return; }
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
    $('pick-wallet').innerHTML = `<span class="pw" title="Pièces"><span class="coin"></span><b>${s.coins.toLocaleString('fr')}</b></span>
      <span class="pw" title="Poké Balls à ouvrir (Boutique)">${G.Icons.html('ticket', 16)}<b>${t.t1}</b></span>
      <span class="pw" title="Super Bonbons (rang)">${G.Icons.html('pball', 16)}<b>${G.Rank.balls()}</b></span>`;

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
      <span class="pick-num">N° ${String(mon.dex).padStart(3, '0')}</span>${G.UI.typeChips(mon.types)}${G.Roles.chip(mon.dex)}
      ${hasSh ? `<button id="pick-shiny" class="btn small ${shiny ? 'gold' : 'ghost'}">${G.Icons.html('shiny', 12)} Shiny ${shiny ? 'oui' : 'non'}</button>` : ''}`);
    // Version de Nika : le rang du Pokémon (monte avec des Super Bonbons).
    {
      const rk = G.Rank.of(mon.dex), max = rk >= G.Rank.MAX, c = G.Rank.cost(rk);
      const stars = Array.from({ length: G.Rank.MAX }, (_, i) => `<i class="${i < rk ? 'on' : ''}"></i>`).join('');
      hero.insertAdjacentHTML('beforeend', `<div class="pick-rank"><span title="+5 % PV et dégâts par rang">Rang ${rk}/${G.Rank.MAX} · +${Math.round(rk * G.Rank.BONUS * 100)} %</span>
        <div class="rk-pips">${stars}</div>
        ${max ? '<b class="rk-max">Rang max !</b>' : `<button id="pick-rankup" class="btn small ${G.Rank.balls() >= c ? 'gold' : 'ghost'}" ${G.Rank.balls() >= c ? '' : 'disabled'}>Monter · ${G.Icons.html('pball', 14)} ${c}</button>`}</div>`);
      if (!max) $('pick-rankup').onclick = () => { if (G.Rank.up(mon.dex)) { G.Audio.sfx('buy'); render(); } };
    }
    if (hasSh) $('pick-shiny').onclick = () => { s.partnerShiny = !s.partnerShiny; G.DB.commit(); G.Audio.sfx('select'); render(); };

    // Sa fiche : statistiques, évolutions et attaques.
    const info = $('pick-info');
    const statBar = (lbl, v, max, txt, col) => `<div class="ps-row"><span>${lbl}</span>
      <i><b style="width:${Math.round(Math.min(1, v / max) * 100)}%;background:${col}"></b></i><em>${txt}</em></div>`;
    // Version de Nika (refonte du menu) : la fiche en 3 onglets au lieu d'une longue liste.
    const TABS = [['fiche', 'Fiche'], ['moves', 'Attaques'], ['evo', 'Évolutions']];
    const tab = TABS.some(x => x[0] === s.pickTab) ? s.pickTab : 'fiche';
    let html = `<div class="ps-tabs">${TABS.map(([k, n]) => `<button class="ps-tab${k === tab ? ' on' : ''}" data-t="${k}">${n}</button>`).join('')}</div>`
      + `<div class="ps-pane" data-p="fiche"><h4>Rôle</h4><p class="ps-role">${G.Roles.chip(mon.dex)} Bonus d'équipe : ${G.Roles.info(mon.dex).team} (compte double pour ton chef).</p>`
      + (G.Talents.name(mon.dex) ? `<h4>Talent</h4><p class="ps-role">${G.Talents.chip(mon.dex)} ${G.Talents.desc(mon.dex)}</p>` : '')
      + `<h4>Statistiques</h4>` +
      statBar('PV', mon.hp, 185, mon.hp, '#5fe08a') +
      statBar('Vitesse', mon.spd, 145, mon.spd, '#5fd4ff');
    // Version de Nika : les vraies stats (physique / spécial).
    const bs = G.Roles.stats(mon.dex);
    if (bs) html += statBar('Attaque', bs[1], 160, bs[1], '#ff8a5c') + statBar('Défense', bs[2], 180, bs[2], '#e0b060')
      + statBar('Att. Spé', bs[3], 160, bs[3], '#c99bff') + statBar('Déf. Spé', bs[4], 180, bs[4], '#7fc8ff');
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
    html += '</div><div class="ps-pane" data-p="evo"><h4>Évolutions</h4><div class="ps-evo" id="pick-evo"></div></div>';
    // Les attaques qu'il peut apprendre (la première est sa signature).
    const learn = G.Team.learnset(mon.dex);
    const myRole = G.Roles.moveRole(mon.dex);
    html += `<div class="ps-pane" data-p="moves"><h4>Attaques (garde 4 sur ${learn.length})</h4><div class="ps-moves">` + learn.map((id, k) => {
      const d = G.Moves.BY_ID[id];
      const tip = (G.Roles.MOVE_ROLE[d.role] || '') + (d.kind !== 'buff' ? ' · ' + G.Roles.CAT_NAME[d.cat] : '');
      return `<span class="ps-mv${k ? '' : ' sig'}${d.role === myRole ? ' role' : ''}" title="${tip}" style="--m:${G.U.TYPE_COLOR[d.type]}">${G.Icons.html('move:' + id, 18)}<small>${d.name}${k ? '' : ' ★'}</small>${d.kind !== 'buff' ? `<i class="cat ${d.cat}">${d.cat === 'P' ? 'Phy' : 'Spé'}</i>` : ''}</span>`;
    }).join('') + '</div><small class="note">Bordure colorée : attaque de son rôle. ★ : attaque signature.</small></div>';
    info.innerHTML = html;
    const showTab = k => {
      info.querySelectorAll('.ps-tab').forEach(b => b.classList.toggle('on', b.dataset.t === k));
      info.querySelectorAll('.ps-pane').forEach(p => p.classList.toggle('on', p.dataset.p === k));
    };
    showTab(tab);
    info.querySelectorAll('.ps-tab').forEach(b => b.onclick = () => { s.pickTab = b.dataset.t; G.Audio.sfx('select'); showTab(b.dataset.t); });
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
      bst: (a, b) => (D(b).bst || 0) - (D(a).bst || 0) || a - b,
      rank: (a, b) => G.Rank.of(b) - G.Rank.of(a) || a - b,
      role: (a, b) => ROLE_ORDER.indexOf(G.Roles.of(a)) - ROLE_ORDER.indexOf(G.Roles.of(b)) || a - b
    };
    const ROLE_ORDER = Object.keys(G.Roles.INFO);
    const mons0 = box(), mons = mons0.slice().sort(SORTS[by] || SORTS.new);
    $('pick-sort').value = by;
    $('pick-sort').onchange = e => { s.pickSort = e.target.value; G.DB.commit(); render(); };
    // Version de Nika : un Pokémon de départ au hasard (tiré à chaque partie).
    const rnd = document.createElement('button');
    rnd.className = 'pick-card pick-rnd' + (s.partnerRandom ? ' on' : '');
    rnd.title = 'Aléatoire : un de tes Pokémon au hasard à chaque partie';
    rnd.innerHTML = '<b class="pick-q">?</b><small>Aléatoire</small>';
    rnd.onclick = () => { s.partnerRandom = !s.partnerRandom; G.DB.commit(); G.Audio.sfx('select'); render(); };
    list.appendChild(rnd);
    for (const dex of mons) {
      const b = document.createElement('button');
      b.className = 'pick-card' + (dex === s.partner && !s.partnerRandom ? ' on' : '');
      b.style.setProperty('--c', G.U.TYPE_COLOR[G.DEX_BY[dex].types[0]]);
      b.title = G.DEX_BY[dex].name;
      b.appendChild(G.UI.spriteCanvas(dex, 64, 54, { fit: true, shiny: dex === s.partner && G.DB.ownsShiny(dex) && !!s.partnerShiny }));
      if (G.DB.ownsShiny(dex)) b.insertAdjacentHTML('beforeend', `<span class="pick-sh">${G.Icons.html('shiny', 10)}</span>`);
      b.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[dex].name}</small>`);
      if (G.Rank.of(dex)) b.insertAdjacentHTML('beforeend', `<span class="pick-rk">${G.Rank.of(dex)}</span>`);
      b.insertAdjacentHTML('beforeend', `<span class="pick-role" title="${G.Roles.info(dex).name}">${G.Icons.html(G.Roles.info(dex).ico, 12)}</span>`);
      b.onclick = () => { if (s.partner !== dex) s.partnerShiny = false; s.partner = dex; s.partnerRandom = false; G.DB.commit(); G.Audio.sfx('select'); render(); };
      list.appendChild(b);
    }
    $('pick-count').textContent = `Tes Pokémon (${mons.length})`;
    // La Ligue : badges gagnés et prochain défi.
    const L = G.League, cur = L.current(), stp = L.step();
    // Version de Nika : seulement la région en cours (13 défis chacune).
    const reg = cur ? cur.region : L.REGIONS[L.REGIONS.length - 1], off = L.STEPS.findIndex(x => x.region === reg);
    $('pick-league').innerHTML = `<span class="lg-reg">${reg}</span>` + L.region(reg).map((st, k) => [st, off + k]).map(([st, i]) =>
      `<span class="lg-b ${st.kind}${i < stp ? ' on' : ''}${i === stp && !L.done() ? ' next' : ''}" style="--c:${G.U.TYPE_COLOR[st.type]}" title="${L.title(st)}"></span>`).join('')
      + `<span class="lg-txt">${cur ? 'Prochain défi : <b>' + L.title(cur) + '</b> (' + G.I18n.t(G.U.TYPE_NAME[cur.type]) + ') dès ' + G.U.mmss(L.EVERY) + ', puis toutes les 5 min' : '<b>Maître de Kanto, Johto et Sinnoh ★</b> · mode libre'}</span>`;
    // Missions terminées dont la récompense attend.
    const pend = G.Progress.pending();
    $('pick-goals-n').textContent = pend;
    $('pick-goals-n').classList.toggle('hidden', !pend);
    // Le bouton Jouer montre qui part au combat (« ? » en aléatoire).
    const pb = $('pick-play');
    pb.innerHTML = '';
    if (s.partnerRandom) pb.insertAdjacentHTML('beforeend', '<b class="pick-q pp-q">?</b>');
    else pb.appendChild(G.UI.spriteCanvas(mon.dex, 40, 34, { fit: true, shiny }));
    pb.insertAdjacentHTML('beforeend', '<span>Jouer</span>');
    const dp = G.MenuUI.dexPending();
    $('pick-dex-n').textContent = dp;
    $('pick-dex-n').classList.toggle('hidden', !dp);
  }

  function play() {
    const save = G.DB.save;
    if (save.partnerRandom) {
      const mons = box();
      if (mons.length) { save.partner = G.U.pick(mons); save.partnerShiny = false; }
    }
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
    // Icônes des boutons du bas (refonte du menu).
    for (const [id, ico] of [['pick-upg', 'up'], ['pick-gacha', 'ticket'], ['pick-dex', 'book'], ['pick-goals', 'trophy']]) {
      const b = $(id);
      if (!b.querySelector('.pa-ico')) b.insertAdjacentHTML('afterbegin', `<span class="pa-ico">${G.Icons.html(ico, 18)}</span>`);
    }
    $('pick-set').onclick = () => G.SettingsUI.open('sound');
    // « Retour » des écrans Améliorations et Gacha : revient ici.
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = open; });
  }

  return { open, init };
})();
