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
    view = 'home';
    relMode = false; relSel.clear();
    render();
    G.DailyUI.maybeShow(render);       // version de Nika : cadeau du jour
  }

  /** Version de Nika : le carnet du Pokémon (rareté, depuis quand, ses records). */
  function carnet(mon) {
    const s = G.DB.save, c = (s.carnet || {})[mon.dex], own = (s.owned || {})[mon.dex];
    const since = own && own.at ? new Date(own.at).toLocaleDateString('fr') : null;
    const cell = (k, v) => `<span><small>${k}</small><b>${v}</b></span>`;
    return `<h4>Carnet</h4><div class="ps-carnet">`
      + cell('Rareté', `<span style="color:${G.Gacha.RARITY_COLOR[mon.rarity]}">${G.UI.stars(mon.rarity, 10)}</span>`)
      + cell('Bonbons', `${G.Icons.html('candy', 12)} ${G.Box.candy(mon.dex)}`)
      + (since ? cell('Avec toi depuis', since) : '')
      + cell('Parties', c ? c.runs + (c.lead ? ` (${c.lead} en chef)` : '') : 0)
      + cell('Meilleur temps', c ? G.U.mmss(c.time) : '–')
      + cell('Niveau max', c ? c.lv : '–')
      + cell('Record de dégâts', c ? c.dmg.toLocaleString('fr') : '–')
      + `</div>`;
  }

  /** Version de Nika : toucher son Pokémon au menu. La 1re caresse du jour donne 1 Bonbon. */
  const PET_TXT = ['{n} est tout content !', '{n} se frotte contre toi.', '{n} a hâte de partir à l\'aventure !',
    '{n} fait un petit saut de joie !', '{n} te regarde avec confiance.', '{n} pousse un petit cri joyeux !'];
  let petN = 0, petDex = 0;
  // Relâcher plusieurs Pokémon d'un coup depuis l'onglet Boîte.
  let relMode = false;
  const relSel = new Set();
  function pet(mon, stage) {
    const s = G.DB.save, d = new Date(), day = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    if (!s.pet || s.pet.day !== day) s.pet = { day, done: [] };
    petN = petDex === mon.dex ? petN + 1 : 1; petDex = mon.dex;
    stage.classList.remove('pet'); void stage.offsetWidth; stage.classList.add('pet');
    for (let i = 0; i < 3; i++) {
      const h = document.createElement('span');
      h.className = 'pet-heart';
      h.style.left = (35 + Math.random() * 30) + '%';
      h.style.animationDelay = (i * 0.12) + 's';
      h.innerHTML = G.Icons.html('heart', 16);
      stage.appendChild(h);
      setTimeout(() => h.remove(), 1400);
    }
    G.Audio.sfx('select');
    let txt = (petN >= 6 ? '{n} adore les câlins !' : G.U.pick(PET_TXT)).replace('{n}', mon.name);
    if (!s.pet.done.includes(mon.dex)) {
      s.pet.done.push(mon.dex);
      G.Box.addCandy(mon.dex, 1);
      G.DB.commit();
      txt += ' +1 Bonbon';
      setTimeout(render, 900);
    }
    G.UI.toast(txt, 1800);
  }

  /** Pièces, Poké Balls et Super Bonbons (menu, Boutique, Améliorations). */
  function wallet() {
    const s = G.DB.save, t = s.tickets || { t1: 0, t10: 0 };
    return `<span class="pw" title="Pièces"><span class="coin"></span><b>${s.coins.toLocaleString('fr')}</b></span>
      <span class="pw" title="Poké Balls à ouvrir (Boutique)">${G.Icons.html('ticket', 16)}<b>${t.t1}</b></span>
      <span class="pw" title="Super Bonbons (rang)">${G.Icons.html('pball', 16)}<b>${G.Rank.balls()}</b></span>`;
  }

  /** Version de Nika (« Couleur du type ») : l'écran prend la couleur du type du partenaire. */
  function theme(el) {
    const mon = G.DEX_BY[G.DB.save.partner] || G.DEX_BY[1];
    const c1 = G.U.TYPE_COLOR[mon.types[0]], c2 = G.U.TYPE_COLOR[mon.types[1] || mon.types[0]];
    el.style.setProperty('--c', c1);
    el.style.setProperty('--c2', c2);
    // Fond clair (Électrik, Glace...) : le texte posé dessus passe en foncé.
    const rgb = (c1.match(/[0-9a-f]{2}/gi) || []).map(h => parseInt(h, 16));
    el.classList.toggle('light', rgb.length === 3 && (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) > 175);
    const w = el.querySelector('.ts-wallet');
    if (w) w.innerHTML = wallet();
  }

  function render() {
    const s = G.DB.save;
    const mon = G.DEX_BY[s.partner];
    const t = s.tickets || { t1: 0, t10: 0 };
    $('pick-wallet').innerHTML = wallet();

    // Version de Nika (menu « Couleur du type ») : le fond prend la couleur du type.
    theme($('scr-pick'));
    const hasSh = G.DB.ownsShiny(mon.dex), shiny = hasSh && !!s.partnerShiny;
    const av = $('hub-av');
    av.innerHTML = '';
    av.appendChild(G.UI.spriteCanvas(mon.dex, 34, 30, { fit: true, shiny }));
    const rk = G.Rank.of(mon.dex);
    // Accueil : le partenaire en grand (on le caresse en le touchant).
    const hero = $('pick-hero');
    hero.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'pick-stage';
    stage.appendChild(G.UI.spriteCanvas(mon.dex, 200, 160, { lively: true, scale: 4, hero: true, shiny }));
    hero.appendChild(stage);
    stage.onclick = () => pet(mon, stage);
    hero.insertAdjacentHTML('beforeend', `<b class="pick-name">${shiny ? G.Icons.html('shiny', 16) + ' ' : ''}${mon.name}</b>
      <div class="hub-chips">${mon.types.map(t => `<span class="hc-type" style="--t:${G.U.TYPE_COLOR[t]}">${G.I18n.t(G.U.TYPE_NAME[t])}</span>`).join('')}
      <span class="hc-dark">Rang ${rk} · +${Math.round(rk * G.Rank.BONUS * 100)} %</span>
      <span class="hc-dark">${G.Icons.html('candy', 12)} ${G.Box.candy(mon.dex)}</span></div>`);

    // Équipe : rang, Bonbons, shiny, relâcher (Bonbons de l'espèce d'abord, puis Super Bonbons).
    const rb = $('pick-rankbox');
    rb.innerHTML = '';
    const mini = document.createElement('div');
    mini.className = 'pick-stage hub-mini';
    mini.appendChild(G.UI.spriteCanvas(mon.dex, 120, 100, { lively: true, scale: 3, hero: true, shiny }));
    mini.onclick = () => pet(mon, mini);
    rb.appendChild(mini);
    rb.insertAdjacentHTML('beforeend', `<b class="pick-name">${shiny ? G.Icons.html('shiny', 14) + ' ' : ''}${mon.name}</b>
      <span class="pick-num">N° ${String(mon.dex).padStart(3, '0')}</span>${G.UI.typeChips(mon.types)}${G.Roles.chip(mon.dex)}
      ${hasSh ? `<button id="pick-shiny" class="btn small ${shiny ? 'gold' : 'ghost'}">${G.Icons.html('shiny', 12)} Shiny ${shiny ? 'oui' : 'non'}</button>` : ''}`);
    {
      const max = rk >= G.Rank.MAX, p = G.Rank.pay(mon.dex), ok = G.Rank.canUp(mon.dex);
      const stars = Array.from({ length: G.Rank.MAX }, (_, i) => `<i class="${i < rk ? 'on' : ''}"></i>`).join('');
      const price = [p.candy ? `${G.Icons.html('candy', 14)} ${p.candy}` : '', p.balls ? `${G.Icons.html('pball', 14)} ${p.balls}` : ''].filter(Boolean).join(' + ');
      rb.insertAdjacentHTML('beforeend', `<div class="pick-rank"><span title="+5 % PV et dégâts par rang">Rang ${rk}/${G.Rank.MAX} · +${Math.round(rk * G.Rank.BONUS * 100)} %</span>
        <div class="rk-pips">${stars}</div>
        <span class="pick-candy" title="Bonbons ${mon.name} (doublons de la Boutique)">${G.Icons.html('candy', 14)} ${G.Box.candy(mon.dex)} Bonbons</span>
        ${max ? '<b class="rk-max">Rang max !</b>' : `<button id="pick-rankup" class="btn small ${ok ? 'gold' : 'ghost'}" ${ok ? '' : 'disabled'}>Monter · ${price}</button>`}</div>
        <button id="hub-upg2" class="btn small">${G.Icons.html('up', 14)} Améliorations</button>`);
      if (!max) $('pick-rankup').onclick = () => { if (G.Rank.up(mon.dex)) { G.Audio.sfx('buy'); render(); } };
      $('hub-upg2').onclick = () => G.MenuUI.openUpgrades();
      // Relâcher : libère une place de la boîte.
      if (box().length > 1) {
        rb.insertAdjacentHTML('beforeend', `<button id="pick-release" class="btn small ghost pick-release">Relâcher</button>`);
        $('pick-release').onclick = () => {
          if (!confirm('Relâcher ' + mon.name + ' ? Il quitte ta boîte (ses Bonbons et son rang restent si tu le retrouves).')) return;
          const n = G.Box.release(mon.dex);
          if (n) { G.Audio.sfx('select'); G.UI.toast(mon.name + ' est relâché. +' + n + ' Super Bonbons'); render(); }
        };
      }
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
      + carnet(mon)
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
      return `<span class="ps-mv${k ? '' : ' sig'}${d.role === myRole ? ' role' : ''}" data-k="${k}" title="${tip}" style="--m:${G.U.TYPE_COLOR[d.type]}">${G.Icons.html('move:' + id, 18)}<small>${d.name}${k ? '' : ' ★'}</small>${d.kind !== 'buff' ? `<i class="cat ${d.cat}">${d.cat === 'P' ? 'Phy' : 'Spé'}</i>` : ''}</span>`;
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
    if (!relMode) list.appendChild(rnd);
    for (const d of [...relSel]) if (!mons.includes(d)) relSel.delete(d);
    for (const dex of mons) {
      const b = document.createElement('button');
      b.className = 'pick-card' + (relMode ? (relSel.has(dex) ? ' rel' : '') : dex === s.partner && !s.partnerRandom ? ' on' : '');
      b.style.setProperty('--c', G.U.TYPE_COLOR[G.DEX_BY[dex].types[0]]);
      b.title = G.DEX_BY[dex].name;
      b.appendChild(G.UI.spriteCanvas(dex, 64, 54, { fit: true, shiny: dex === s.partner && G.DB.ownsShiny(dex) && !!s.partnerShiny }));
      if (G.DB.ownsShiny(dex)) b.insertAdjacentHTML('beforeend', `<span class="pick-sh">${G.Icons.html('shiny', 10)}</span>`);
      b.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[dex].name}</small>`);
      if (G.Rank.of(dex)) b.insertAdjacentHTML('beforeend', `<span class="pick-rk">${G.Rank.of(dex)}</span>`);
      b.insertAdjacentHTML('beforeend', `<span class="pick-role" title="${G.Roles.info(dex).name}">${G.Icons.html(G.Roles.info(dex).ico, 12)}</span>`);
      if (relMode && relSel.has(dex)) b.insertAdjacentHTML('beforeend', `<span class="pick-relx">${G.Box.gain(dex)}</span>`);
      b.onclick = relMode
        ? () => {
          if (relSel.has(dex)) relSel.delete(dex);
          else if (relSel.size < mons.length - 1) relSel.add(dex);
          else { G.UI.toast('Garde au moins un Pokémon.'); return; }
          G.Audio.sfx('select'); render();
        }
        : () => {
          // Version de Nika : toucher un Pokémon de la boîte le prend comme partenaire et ouvre sa fiche.
          if (s.partner !== dex) s.partnerShiny = false;
          s.partner = dex; s.partnerRandom = false; G.DB.commit(); G.Audio.sfx('select');
          view = 'team'; fromBox = true; showView(); render();
        };
      list.appendChild(b);
    }
    // Version de Nika : boîte limitée, on l'agrandit avec des pièces.
    const cap = G.Box.cap();
    $('pick-count').innerHTML = `Tes Pokémon <b class="${G.Box.full() ? 'warn' : ''}">${mons.length}/${cap}</b>`
      + ` <button id="pick-expand" class="btn small ${G.Box.canExpand() ? 'gold' : 'ghost'}" ${G.Box.canExpand() ? '' : 'disabled'} title="Agrandir la boîte">+${G.Box.STEP} places · <span class="coin"></span> ${G.Box.price()}</button>`;
    $('pick-expand').onclick = () => { if (G.Box.expand()) { G.Audio.sfx('buy'); render(); } };
    $('pick-count').insertAdjacentHTML('beforeend', ` <button id="pick-relmode" class="btn small ${relMode ? 'gold' : 'ghost'}">${relMode ? 'Terminé' : 'Relâcher'}</button>`);
    $('pick-relmode').onclick = () => { relMode = !relMode; relSel.clear(); G.Audio.sfx('select'); render(); };
    const bar = $('pick-relbar');
    bar.classList.toggle('hidden', !relMode);
    if (relMode) {
      const sel = [...relSel], gain = sel.reduce((a, d) => a + G.Box.gain(d), 0);
      bar.innerHTML = sel.length
        ? `<span>${sel.length} choisi${sel.length > 1 ? 's' : ''} · +${gain} Super Bonbons</span><button id="pick-reldo" class="btn small gold">Relâcher ${sel.length}</button>`
        : `<span>Touche les Pokémon à relâcher (ils rendent des Super Bonbons, leurs Bonbons et leur rang restent).</span>`;
      if (sel.length) $('pick-reldo').onclick = () => {
        const n = G.Box.releaseMany(sel);
        if (!n) return;
        relSel.clear(); relMode = false;
        G.Audio.sfx('buy');
        G.UI.toast(sel.length + ' Pokémon relâché' + (sel.length > 1 ? 's' : '') + ' · +' + n + ' Super Bonbons');
        render();
      };
    }
    quick(mons0);

    // La Ligue : en haut (région en cours) et en entier dans l'onglet Ligue.
    const L = G.League, cur = L.current(), stp = L.step();
    const reg = cur ? cur.region : L.REGIONS[L.REGIONS.length - 1], off = L.STEPS.findIndex(x => x.region === reg);
    const regSteps = L.region(reg), got = Math.max(0, Math.min(regSteps.length, stp - off));
    $('pick-league').innerHTML = `<div class="hl-row"><span>Ligue ${reg === 'Kanto' ? 'de' : 'de'} ${reg} · ${got} / ${regSteps.length}</span>`
      + `<span class="hl-next">${cur ? L.title(cur) + ' à ' + G.U.mmss(L.EVERY) : 'Maître ★'}</span></div>`
      + `<i class="hl-bar"><b style="width:${Math.round(got / regSteps.length * 100)}%"></b></i>`;
    $('hub-leaguefull').innerHTML = `<h3>Ligue Pokémon</h3><p class="note">${cur ? 'Prochain défi : <b>' + L.title(cur) + '</b> (' + G.I18n.t(G.U.TYPE_NAME[cur.type]) + ') dès ' + G.U.mmss(L.EVERY) + ' en partie, puis toutes les 5 min.' : '<b>Maître de Kanto, Johto et Sinnoh ★</b> · mode libre'}</p>`
      + L.REGIONS.map(rg => { const o = L.STEPS.findIndex(x => x.region === rg);
        return `<h4>${rg}</h4><div class="hl-badges">` + L.region(rg).map((st, k) => { const i2 = o + k;
          return `<span class="hl-b ${st.kind}${i2 < stp ? ' on' : ''}${i2 === stp && !L.done() ? ' next' : ''}" style="--t:${G.U.TYPE_COLOR[st.type]}"><i></i><small>${L.title(st)}</small></span>`; }).join('') + '</div>'; }).join('')
      + `<h4>Tour de Combat</h4><p class="note">Meilleur étage : <b>${G.Tower.best() || 0}</b>. Une salle par étage : vide-la, choisis une carte, passe la porte. Tu attaques seulement à l'arrêt, avec ton partenaire seul. Un dresseur tous les 5 étages, une défaite arrête la partie.</p>`;

    // Les tuiles de l'accueil (badges rouges = quelque chose t'attend).
    const sub = (id, txt) => { $(id).querySelector('small').innerHTML = txt; };
    const badge = (id, n) => { $(id).textContent = n; $(id).classList.toggle('hidden', !n); };
    const gift = G.DailyUI.ready();
    sub('pick-gift', gift ? 'Prêt !' : 'Demain');
    $('pick-gift-n').classList.toggle('hidden', !gift);
    const pend = G.Progress.pending();
    sub('pick-goals', pend ? pend + ' à récupérer' : 'En cours');
    badge('pick-goals-n', pend);
    const dexAll = G.DEX.filter(p => G.SPRITE_META[p.dex]).length, dexOwn = G.DEX.filter(p => G.SPRITE_META[p.dex] && (s.owned || {})[p.dex]).length;
    sub('pick-dex', dexOwn + ' / ' + dexAll);
    badge('pick-dex-n', G.MenuUI.dexPending());
    sub('pick-gacha', t.t1 ? t.t1 + ' à ouvrir' : 'Poké Balls');
    badge('pick-shop-n', t.t1);
    sub('pick-upg', mon.name);
    sub('pick-tower', 'Record ' + (G.Tower.best() || 0));
    $('pick-tower').classList.toggle('on', s.pickMode === 'tower');

    // Mode et bouton Jouer (il montre qui part au combat, « ? » en aléatoire).
    const tower = s.pickMode === 'tower';
    $('hub-mode').innerHTML = `<small>Mode</small><b>${tower ? 'Tour' : 'Survivor'}</b>`;
    const pb = $('pick-play');
    pb.innerHTML = '';
    if (s.partnerRandom) pb.insertAdjacentHTML('beforeend', '<b class="pick-q pp-q">?</b>');
    else pb.appendChild(G.UI.spriteCanvas(mon.dex, 40, 34, { fit: true, shiny }));
    pb.insertAdjacentHTML('beforeend', `<span>JOUER</span><em>${tower ? 'Tour de Combat' : 'Survivor'}</em>`);
    showView();
  }

  /** Version de Nika : la boîte en accès rapide sur l'accueil (le partenaire d'abord). */
  function quick(mons0) {
    const s = G.DB.save, q = $('pick-quick');
    q.innerHTML = '';
    const list = [s.partner].concat(mons0.slice().reverse().filter(d => d !== s.partner)).slice(0, 8);
    for (const dex of list) {
      const b = document.createElement('button');
      b.className = 'qk' + (dex === s.partner && !s.partnerRandom ? ' on' : '');
      b.appendChild(G.UI.spriteCanvas(dex, 56, 46, { fit: true, shiny: dex === s.partner && G.DB.ownsShiny(dex) && !!s.partnerShiny }));
      b.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[dex].name}</small>`);
      b.onclick = () => { if (s.partner !== dex) s.partnerShiny = false; s.partner = dex; s.partnerRandom = false; G.DB.commit(); G.Audio.sfx('select'); render(); };
      q.appendChild(b);
    }
    for (let i = list.length, f = G.Box.free(); i < 8 && f > 0; i++, f--) q.insertAdjacentHTML('beforeend', '<span class="qk empty">+</span>');
    const all = document.createElement('button');
    all.className = 'qk qk-all';
    all.innerHTML = `<b>Boîte</b><small>${mons0.length}/${G.Box.cap()}</small>`;
    all.onclick = () => go('box');
    q.appendChild(all);
    $('hub-boxn').textContent = mons0.length + ' / ' + G.Box.cap();
  }

  // Onglets du bas : Accueil, Équipe, Boîte, Ligue (Boutique ouvre son écran).
  let view = 'home', fromBox = false;     // fromBox : la fiche a été ouverte depuis la Boîte (« Retour » y revient)
  function go(v) {
    if (v === 'shop') { G.GachaUI.open(); return; }
    if (v === 'dex') { G.MenuUI.openDex(); return; }
    fromBox = false;
    view = v;
    G.Audio.sfx('select');
    showView();
  }
  function showView() {
    document.querySelectorAll('#scr-pick .hub-view').forEach(el => el.classList.toggle('on', el.dataset.v === view));
    document.querySelectorAll('#hub-tabs button').forEach(el => el.classList.toggle('on', el.dataset.v === (view === 'team' ? 'box' : view)));
    $('scr-pick').dataset.view = view;
  }

  function play() {
    const save = G.DB.save;
    if (save.pickMode === 'tower') G.Tower.start();     // version de Nika : la Tour de Combat (tower.js)
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
    const mode = m => { const s = G.DB.save; s.pickMode = m; G.DB.commit(); G.Audio.sfx('select'); render(); };
    $('hub-mode').onclick = () => mode(G.DB.save.pickMode === 'tower' ? 'run' : 'tower');
    $('pick-tower').onclick = () => mode(G.DB.save.pickMode === 'tower' ? 'run' : 'tower');
    $('pick-upg').onclick = () => G.MenuUI.openUpgrades();
    $('pick-gacha').onclick = () => G.GachaUI.open();
    $('pick-dex').onclick = () => G.MenuUI.openDex();
    $('pick-goals').onclick = () => G.GoalsUI.open('missions');
    $('pick-gift').onclick = () => {
      if (!G.DailyUI.maybeShow(render)) G.UI.toast('Reviens demain pour le prochain cadeau !');
    };
    $('pick-set').innerHTML = G.Icons.html('gear', 20);
    $('pick-set').onclick = () => G.SettingsUI.open('sound');
    // Icônes des tuiles et des onglets.
    for (const [id, ico] of [['pick-gift', 'gift'], ['pick-goals', 'trophy'], ['pick-dex', 'book'], ['pick-gacha', 'ticket'], ['pick-upg', 'up'], ['pick-tower', 'crown']]) {
      $(id).querySelector('.ht-ico').innerHTML = G.Icons.html(ico, 34);
    }
    // Version de Nika : plus d'onglet Équipe (la fiche s'ouvre en touchant un Pokémon de la Boîte), le Pokédex à sa place.
    const TAB_ICO = { dex: 'book', box: 'pcbox', home: 'home', shop: 'ticket', league: 'medal1' };
    document.querySelectorAll('#hub-tabs button').forEach(b => {
      b.querySelector('.ht-ico').innerHTML = G.Icons.html(TAB_ICO[b.dataset.v], 26);
      b.onclick = () => go(b.dataset.v);
    });
    // Équipe, Boîte, Ligue : un bouton « Retour » vers l'Accueil, comme sur les autres écrans.
    const VIEW_NAME = { team: 'Fiche', box: 'Boîte', league: 'Ligue' };
    document.querySelectorAll('#scr-pick .hub-view:not([data-v="home"])').forEach(v => {
      v.insertAdjacentHTML('afterbegin', `<div class="hub-backrow"><button class="ts-back" data-sfx="back" aria-label="Retour"><span class="ts-arrow"></span><span>Retour</span></button><h2>${VIEW_NAME[v.dataset.v] || ''}</h2></div>`);
      v.querySelector('.ts-back').onclick = () => { view = v.dataset.v === 'team' && fromBox ? 'box' : 'home'; fromBox = false; showView(); };
    });
    // « Retour » des écrans Améliorations et Gacha : revient ici.
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = open; });
  }

  /** Ouvre la Boîte directement en mode « Relâcher » (depuis la Boutique quand elle est pleine). */
  function openRelease() { open(); relMode = true; relSel.clear(); view = 'box'; showView(); render(); }

  return { open, openRelease, init, theme, wallet };
})();
