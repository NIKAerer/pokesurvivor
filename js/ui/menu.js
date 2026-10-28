/* ============ menu.js — menú principal, colección y mejoras ============ */
G.MenuUI = (() => {
  const $ = G.UI.$;
  const GEN_NAMES = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  let dexFilter = 'all', dexGen = 1, dexSel = null;

  function init() {
    const ICON = { play: 'ball', dex: 'book', upgrades: 'up', gacha: 'ball4', types: 'star', goals: 'medal3', friends: 'friends', rank: 'trophy', settings: 'gear' };
    document.querySelectorAll('#scr-menu [data-go]').forEach(b => {
      b.insertAdjacentHTML('afterbegin', `<span class="mi-ico">${G.Icons.html(ICON[b.dataset.go], 26)}</span>`);
      b.dataset.sfx = b.dataset.go === 'play' ? 'confirm' : 'click';
      b.onclick = () => {
        const go = b.dataset.go;
        if (go === 'play') { if (G.Social.room) G.LobbyUI.open(); else G.Flow.play(); }
        else if (go === 'dex') openDex();
        else if (go === 'upgrades') openUpgrades();
        else if (go === 'gacha') G.GachaUI.open();
        else if (go === 'types') G.TypesUI.open();
        else if (go === 'goals') G.GoalsUI.open();
        else if (go === 'friends') G.FriendsUI.open();
        else if (go === 'rank') G.RankingUI.open();
        else if (go === 'settings') G.SettingsUI.open();
      };
    });
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = open; });
    G.Social.on(() => { if (G.UI.isOpen('scr-menu')) socialLine(); });
    $('btn-logout').onclick = () => {
      if (G.DB.guest && !confirm('Eres invitado: se perderá todo el progreso. ¿Salir?')) return;
      G.Audio.music(null);
      G.DB.logout().then(() => G.Flow.toLogin());
    };
  }

  // ---------------- menú principal ----------------

  function open() {
    const s = G.DB.save;
    const mon = G.DEX_BY[s.partner];
    const shiny = !!s.partnerShiny && G.DB.ownsShiny(mon.dex);
    G.UI.chrome(true);
    G.UI.show('scr-menu');
    G.UI.sprite($('menu-partner'), mon.dex, { lively: true, scale: 4, hero: true, shiny });
    $('menu-partner').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    $('menu-partner').classList.toggle('shiny', shiny);
    $('menu-partner-name').innerHTML = mon.name + (shiny ? ' ' + G.Icons.html('shiny', 24) : '');
    $('menu-partner-info').innerHTML = G.UI.typeChips(mon.types) + ' ' + G.UI.stars(mon.rarity);
    // Normal / shiny a mano, aquí mismo (en el móvil no se encontraba en la ficha).
    const seg = $('menu-shiny');
    seg.classList.toggle('hidden', !G.DB.ownsShiny(mon.dex));
    seg.lastChild.innerHTML = G.Icons.html('shiny', 12) + ' Shiny';
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', (b.dataset.v === '1') === shiny);
      b.onclick = () => {
        if ((b.dataset.v === '1') === shiny) return;
        s.partnerShiny = b.dataset.v === '1';
        G.DB.commit();
        G.Audio.sfx('confirm');
        open();
      };
    });

    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    const shinies = Object.keys(s.shiny || {}).length;
    $('menu-dex-count').textContent = `${owned} / ${G.DEX.length}` + (shinies ? ` · ${shinies} shiny` : '');

    const st = s.stats;
    $('menu-stats').innerHTML =
      `Runs <b style="color:#fff">${st.runs}</b> · Mejor tiempo <b style="color:#fff">${G.U.mmss(st.bestTime)}</b><br>` +
      `Mejor nivel <b style="color:#fff">${st.bestLevel}</b> · Derrotados <b style="color:#fff">${st.totalKills.toLocaleString('es')}</b>` +
      (G.DB.guest ? '<br><span style="color:#ffb0b8">Modo invitado: no se guarda</span>' : '');

    socialLine();
    // Premios de misiones por recoger.
    G.Progress.checkAch();
    const pend = G.Progress.pending();
    $('menu-goals-sub').textContent = pend ? pend + (pend === 1 ? ' premio por recoger' : ' premios por recoger') : 'Misiones, logros y perfil';
    $('menu-goals-sub').classList.toggle('gold', pend > 0);
    // Con cuenta en la nube: amigos en línea, invitaciones y (una vez) el apodo.
    if (G.DB.online && !G.Social.started) {
      G.Social.start().then(r => {
        if (r === 'need-nick' && !G.NickUI.skipped && G.UI.isOpen('scr-menu')) G.NickUI.open();
        socialLine();
      });
    }
    G.InvitePop.refresh();
  }

  /** Texto bajo "Amigos" y "Jugar": quién está en línea, solicitudes, sala. */
  function socialLine() {
    const room = G.Social.room;
    const play = document.querySelector('#scr-menu [data-go=play] small');
    if (play) play.textContent = room ? 'Volver a tu sala (' + room.members.length + '/' + G.Social.MAX_PLAYERS + ')' : 'Entra en la mazmorra';
    const fr = G.Social.friends;
    const on = fr.filter(f => f.status === 'ok' && f.online).length;
    const req = fr.filter(f => f.status === 'in').length;
    const parts = [];
    if (on) parts.push(on + ' en línea');
    if (req) parts.push(req + (req === 1 ? ' solicitud' : ' solicitudes'));
    $('menu-friends-sub').textContent = parts.length ? parts.join(' · ') : 'Juega en grupo, hasta 4';
    $('menu-friends-sub').classList.toggle('gold', req > 0);
  }

  // ---------------- colección ----------------

  // Version de Nika : récompenses de complétion par génération (25, 50, 75, 100 %).
  const DEX_GOALS = [
    { p: 25, coins: 300, t1: 2, balls: 0 },
    { p: 50, coins: 600, t1: 4, balls: 5 },
    { p: 75, coins: 1000, t1: 6, balls: 10 },
    { p: 100, coins: 2000, t1: 10, balls: 20 }
  ];
  function genProgress(g) {
    const s = G.DB.save, all = G.DEX.filter(p => p.gen === g);
    const have = all.filter(p => s.owned[p.dex]).length;
    return { have, total: all.length, pct: all.length ? have / all.length * 100 : 0 };
  }
  /** Paliers atteints mais pas encore réclamés (toutes générations). */
  function dexPending() {
    const s = G.DB.save;
    if (!s) return 0;
    const got = s.dexRewards || {};
    let n = 0;
    for (const g of [...new Set(G.DEX.map(p => p.gen))]) {
      const { pct } = genProgress(g);
      for (const r of DEX_GOALS) if (pct >= r.p && !got[g + '-' + r.p]) n++;
    }
    return n;
  }
  function renderDexGoals() {
    const s = G.DB.save;
    s.dexRewards = s.dexRewards || {};
    let box = $('dex-goals');
    if (!box) { box = document.createElement('div'); box.id = 'dex-goals'; $('dex-gens').after(box); }
    const { have, total, pct } = genProgress(dexGen);
    box.innerHTML = `<div class="dg-bar"><i style="width:${pct}%"></i><span>${GEN_NAMES[dexGen - 1]} · ${have}/${total} (${Math.floor(pct)} %)</span></div>`
      + '<div class="dg-row">' + DEX_GOALS.map(r => {
        const key = dexGen + '-' + r.p, done = s.dexRewards[key], ok = pct >= r.p;
        const what = r.coins + ' pièces · ' + r.t1 + ' Poké Balls' + (r.balls ? ' · ' + r.balls + ' Super Bonbons' : '');
        return `<button class="dg-goal${done ? ' done' : ok ? ' ready' : ''}" data-k="${key}" ${ok && !done ? '' : 'disabled'} title="${what}">
          <b>${r.p} %</b><small>${done ? 'Reçu' : ok ? 'Réclamer !' : what}</small></button>`;
      }).join('') + '</div>';
    box.querySelectorAll('.dg-goal.ready').forEach(b => b.onclick = () => {
      const r = DEX_GOALS.find(x => dexGen + '-' + x.p === b.dataset.k);
      s.dexRewards[b.dataset.k] = Date.now();
      G.Progress.grant({ coins: r.coins, t1: r.t1 });
      if (r.balls) s.balls = (s.balls || 0) + r.balls;
      G.DB.commit(true);
      G.Audio.sfx('legend');
      G.UI.toast('Pokédex ' + GEN_NAMES[dexGen - 1] + ' ' + r.p + ' % : +' + r.coins + ' pièces, +' + r.t1 + ' Poké Balls' + (r.balls ? ', +' + r.balls + ' Super Bonbons' : ''));
      renderDexGoals();
    });
  }

  function openDex() {
    G.UI.show('scr-dex', true);
    const s = G.DB.save;
    if (dexSel == null) dexSel = s.partner;
    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    $('dex-total').textContent = `${owned} / ${G.DEX.length}`;

    // Pestañas de generación, con cuántos tienes de cada una.
    const tabs = $('dex-gens');
    tabs.innerHTML = '';
    GEN_NAMES.forEach((name, i) => {
      const g = i + 1;
      const total = G.DEX.filter(p => p.gen === g).length;
      if (!total) return;                   // version de Nika : gens 1-4
      const have = G.DEX.filter(p => p.gen === g && s.owned[p.dex]).length;
      const b = document.createElement('button');
      b.className = 'gen-tab' + (g === dexGen ? ' on' : '');
      b.innerHTML = `<b>${name}</b><small>${have}/${total}</small>`;
      b.onclick = () => { dexGen = g; openDex(); };
      tabs.appendChild(b);
    });

    const F = [['all', 'Todos'], ['own', 'Tengo'], ['miss', 'Me faltan'], ['shiny', 'Shiny'],
               ['5', 5], ['4', 4], ['3', 3], ['2', 2], ['1', 1]];
    const fb = $('dex-filters');
    fb.innerHTML = '';
    for (const [k, label] of F) {
      const c = document.createElement('button');
      c.className = 'chip' + (k === dexFilter ? ' on' : '');
      c.innerHTML = k === 'shiny' ? G.Icons.html('shiny', 12) + ' Shiny'
                  : typeof label === 'number' ? G.Icons.rarity(label, 12) + ' ' + G.Gacha.RARITY_NAME[label] : label;
      c.onclick = () => { dexFilter = k; openDex(); };
      fb.appendChild(c);
    }
    renderDexGoals();
    renderGrid();
    showDetail(dexSel);
  }

  function renderGrid() {
    const s = G.DB.save;
    const grid = $('dex-grid');
    grid.innerHTML = '';
    for (const p of G.DEX) {
      if (p.gen !== dexGen) continue;                // version de Nika : l'onglet choisit la génération
      const own = !!s.owned[p.dex], sh = !!(s.shiny && s.shiny[p.dex]);
      if (dexFilter === 'own' && !own) continue;
      if (dexFilter === 'miss' && own) continue;
      if (dexFilter === 'shiny' && !sh) continue;
      if (/^\d$/.test(dexFilter) && p.rarity !== +dexFilter) continue;

      const cell = document.createElement('div');
      cell.className = 'cell' + (own ? '' : ' locked') + (p.dex === dexSel ? ' on' : '');
      cell.insertAdjacentHTML('beforeend', `<span class="no">${String(p.dex).padStart(3, '0')}</span>`);
      if (p.dex === s.partner) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Compañero">${G.Icons.html('crown', 14)}</span>`);
      else if (sh) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Tienes su shiny">${G.Icons.html('shiny', 12)}</span>`);
      const useShiny = sh && p.dex === s.partner && s.partnerShiny;
      cell.appendChild(G.UI.spriteCanvas(p.dex, 92, 80, { scale: 2, silhouette: !own, shadow: own, shiny: useShiny }));
      cell.insertAdjacentHTML('beforeend', `<b>${own ? p.name : '???'}</b>${G.UI.stars(p.rarity, 9)}`);
      cell.onclick = () => {
        dexSel = p.dex;
        grid.querySelectorAll('.cell').forEach(c => c.classList.remove('on'));
        cell.classList.add('on');
        showDetail(p.dex);
      };
      grid.appendChild(cell);
    }
    if (!grid.children.length) grid.innerHTML = '<p class="sub" style="grid-column:1/-1">Ninguno con este filtro.</p>';
  }

  // Variante que se está viendo en la ficha (normal o shiny).
  let viewShiny = false;

  function showDetail(dex) {
    const s = G.DB.save;
    const p = G.DEX_BY[dex];
    const own = !!s.owned[dex];
    const hasSh = G.DB.ownsShiny(dex);
    const isPartner = dex === s.partner;
    if (!hasSh) viewShiny = false;
    else if (isPartner && dex !== showDetail.last) viewShiny = !!s.partnerShiny;
    showDetail.last = dex;

    const max = { hp: 183, atk: 1.55, spd: 137 };
    const bar = (label, v, m, txt) =>
      `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, v / m * 100)}%"></i></div><span>${txt}</span></div>`;
    const usingThis = isPartner && (!hasSh || !!s.partnerShiny === viewShiny);

    const box = $('dex-detail');
    box.innerHTML = `
      <canvas id="dex-big" class="stage" width="220" height="190"></canvas>
      ${hasSh ? `<div class="seg">
          <button class="${viewShiny ? '' : 'on'}" data-v="0">Normal</button>
          <button class="${viewShiny ? 'on' : ''}" data-v="1">${G.Icons.html('shiny', 12)} Shiny</button></div>` : ''}
      <div class="center">
        <div style="color:var(--muted);font-size:13px">Nº ${String(p.dex).padStart(3, '0')} · ${GEN_NAMES[p.gen - 1]}</div>
        <h3>${own ? p.name : '???'}</h3>
        <div style="color:${G.Gacha.RARITY_COLOR[p.rarity]}">${G.UI.stars(p.rarity, 24)} ${G.Gacha.RARITY_NAME[p.rarity]}</div>
        <div style="margin:6px 0">${own ? G.UI.typeChips(p.types) : ''}</div>
      </div>
      ${own ? `
        ${bar('Vida', p.hp, max.hp, p.hp)}
        ${bar('Ataque', p.atk, max.atk, '×' + p.atk.toFixed(2))}
        ${bar('Velocidad', p.spd, max.spd, p.spd)}
        <p style="font-size:14px;margin:10px 0 4px">Empieza con <b class="gold">${G.Moves.BY_ID[G.startMoveOf(dex)].name}</b></p>
        <p class="move-icons" title="Movimientos que puede aprender">
          ${G.Team.learnset(dex).map(id => `<span title="${G.Moves.BY_ID[id].name}">${G.Icons.html('move:' + id, 16)}</span>`).join('')}</p>
        ${!(s.box || []).includes(dex)
          ? `<p class="note center">${G.EVO_FROM[dex] ? 'Se joue en faisant évoluer ' + G.DEX_BY[G.Team.family(dex)].name + ' en partie.' : 'Obtiens-le à la Boutique pour pouvoir jouer avec.'}</p>`
          : usingThis
          ? '<button class="btn grow" disabled style="width:100%">Es tu compañero</button>'
          : `<button id="dex-pick" class="btn gold" data-sfx="confirm" style="width:100%">Elegir de compañero${viewShiny ? ' (shiny)' : ''}</button>`}
      ` : `<p class="center" style="color:var(--muted)">Aún no lo tienes.<br>Consíguelo en el banner de <b class="gold">${GEN_NAMES[p.gen - 1]}</b>
            o derrotándolo cuando salga shiny.</p>`}
    `;
    $('dex-big').style.setProperty('--stage-c', !own ? '#5b83d6' : viewShiny ? '#9ae6ff' : G.U.TYPE_COLOR[p.types[0]]);
    $('dex-big').classList.toggle('shiny', own && viewShiny);
    G.UI.sprite($('dex-big'), dex, { lively: own, spin: own, silhouette: !own, scale: 3, hero: true, shiny: own && viewShiny });
    box.querySelectorAll('.seg button').forEach(b => {
      b.onclick = () => { viewShiny = b.dataset.v === '1'; showDetail(dex); };
    });
    const pick = $('dex-pick');
    if (pick) pick.onclick = () => {
      s.partner = dex;
      s.partnerShiny = hasSh && viewShiny;
      G.DB.commit();
      G.UI.toast(p.name + (s.partnerShiny ? ' shiny' : '') + ' es ahora tu compañero');
      G.PickUI.open();                     // version de Nika : retour au menu, prêt à jouer
    };
  }

  // ---------------- mejoras ----------------
  // Version de Nika (2026-10-28) : écran refait au style « Couleur du type ».
  // Retirés : Répertoire (la 1re attaque se choisit sur 3 cartes, il ne servait plus ;
  // remboursé), Veto et Raccourcis des capacités (inutiles avec 4 attaques fixes au doigt).
  const fmt = n => (Math.round(n * 10) / 10).toLocaleString('fr');
  const UPG_FX = {
    hp: v => `+${v * 8} PV`, atk: v => `+${v * 4} % dégâts`, crit: v => `+${v * 3} % critiques`,
    cd: v => `-${v * 3} % recharge`, def: v => `-${v * 2} % dégâts subis`, regen: v => `+${fmt(v * 0.2)} PV/s`,
    spd: v => `+${v * 3} % vitesse`, magnet: v => `+${v * 12} % portée`, xp: v => `+${v * 5} % XP`,
    coins: v => `+${v * 8} % pièces`, reroll: v => `${v} changement${v > 1 ? 's' : ''} de cartes`
  };
  const UPG_NAME = { hp: 'Vitalité', atk: 'Force', crit: 'Coup critique', cd: 'Réflexes', def: 'Carapace', regen: 'Synthèse',
    spd: 'Foulée', magnet: 'Aimant', xp: 'Sagesse', coins: 'Fortune', reroll: 'Changement de cartes' };
  const UPG_GROUPS = [
    ['Attaque', 'fist', ['atk', 'crit', 'cd']],
    ['Défense', 'shield', ['hp', 'def', 'regen']],
    ['Aventure', 'boot', ['spd', 'magnet', 'xp', 'coins', 'reroll']]
  ];

  function openUpgrades() {
    G.UI.show('scr-upgrades', true);
    const lv = G.DB.upgradesOf();
    // Répertoire retiré : on rend les pièces une fois.
    if (lv.moves > 0) {
      const back = G.Upgrades.cost('moves', 0);
      G.DB.save.coins += back; lv.moves = 0; G.DB.commit(true);
      G.UI.toast(`Répertoire retiré : ${back} pièces remboursées`, 4000);
    }
    renderUpgrades();
  }

  function renderUpgrades() {
    const s = G.DB.save;
    const levels = G.DB.upgradesOf();
    G.PickUI.theme($('scr-upgrades'));
    const ids = UPG_GROUPS.flatMap(g => g[2]);
    const got = ids.reduce((a, id) => a + Math.min(levels[id] || 0, G.Upgrades.BY[id].max), 0);
    const all = ids.reduce((a, id) => a + G.Upgrades.BY[id].max, 0);
    const mon = G.DEX_BY[s.partner];
    const shiny = !!s.partnerShiny && G.DB.ownsShiny(s.partner);
    const sum = $('upg-sum');
    sum.innerHTML = `<div class="ts-stage"><canvas width="120" height="110"></canvas></div>
      <div class="us-txt"><b>Niveau d'équipe ${got} / ${all}</b>
      <div class="ts-bar"><i style="width:${Math.round(100 * got / all)}%"></i></div>
      <small>Les améliorations comptent pour toute ton équipe et tous tes Pokémon, à chaque partie.</small></div>`;
    G.UI.sprite(sum.querySelector('canvas'), mon.dex, { lively: true, scale: 2, hero: true, shiny });

    const box = $('upg-list');
    box.innerHTML = '';
    for (const [title, ico, list] of UPG_GROUPS) {
      const g = document.createElement('div');
      g.className = 'ts-group';
      g.innerHTML = `<h3>${G.Icons.html(ico, 18)} ${title}</h3><div class="ts-cards"></div>`;
      const wrap = g.querySelector('.ts-cards');
      for (const id of list) {
        const u = G.Upgrades.BY[id];
        const lvl = Math.min(levels[id] || 0, u.max);
        const maxed = lvl >= u.max;
        const cost = maxed ? 0 : G.Upgrades.cost(id, lvl);
        const el = document.createElement('div');
        el.className = 'ts-card up-card' + (maxed ? ' max' : '');
        el.innerHTML = `
          <div class="up-ic">${G.Icons.html(u.icon, 30)}</div>
          <div class="up-txt">
            <div class="up-name"><b>${UPG_NAME[id]}</b><small>Niv. ${lvl}/${u.max}</small></div>
            <div class="up-fx">${lvl ? UPG_FX[id](lvl) : 'Rien pour l\'instant'}${maxed ? '' : ` <span class="up-next">→ ${UPG_FX[id](lvl + 1)}</span>`}</div>
            <div class="up-pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
          </div>
          <button class="ts-btn" data-sfx="none" ${maxed || s.coins < cost ? 'disabled' : ''}>${maxed ? 'MAX' : `<span class="coin"></span>${cost.toLocaleString('fr')}`}</button>`;
        el.querySelector('button').onclick = () => {
          // Se vuelve a leer todo al pulsar (la partida puede haber cambiado desde que se dibujó).
          const sv = G.DB.save, lv = G.DB.upgradesOf(), now = lv[id] || 0;
          if (now >= u.max) { renderUpgrades(); return; }
          const price = G.Upgrades.cost(id, now);
          if (sv.coins < price) { renderUpgrades(); return; }
          sv.coins -= price;
          lv[id] = now + 1;
          G.DB.commit(true);
          G.Audio.sfx('buy');
          G.UI.refreshCoins();
          G.UI.toast(`${UPG_NAME[id]} : niveau ${now + 1}`);
          renderUpgrades();
        };
        wrap.appendChild(el);
      }
      box.appendChild(g);
    }
  }

  return { init, open, GEN_NAMES, openUpgrades, openDex, dexPending };
})();
