/* ============ run-ui.js — cartas de nivel, pausa y fin de run ============ */
G.RunUI = (() => {
  const $ = G.UI.$;
  let offers = null, offerCb = null, coopMode = false;

  /** @param coop  en grupo: tras elegir, se queda esperando a los demás */
  function showLevelUp(level, list, cb, coop = false) {
    offerCb = cb; coopMode = coop;
    $('lvl-num').textContent = level;
    // Version de Nika : le Pokémon (sous sa forme actuelle, donc évoluée) en tête des cartes.
    const me = G.Game.player, who = $('lvl-who');
    who.innerHTML = '';
    if (me && me.dex) {
      who.appendChild(G.UI.spriteCanvas(me.dex, 64, 56, { scale: 2, hero: true, lively: true, shiny: me.shiny }));
      const nm = document.createElement('small'); nm.textContent = me.mon ? me.mon.name : ''; who.appendChild(nm);
    }
    $('lvl-wait').textContent = '';
    $('lvl-wait').classList.toggle('hidden', !coop);
    $('cards').classList.remove('done');
    renderCards(list);
    $('lvl-reroll').onclick = reroll;
    G.UI.show('scr-levelup');
  }

  /**
   * Cambiar las cartas: 1 vez gratis por partida y 1 más por cada jefe
   * derrotado (en grupo cuentan los jefes del equipo; cada uno tiene los suyos).
   */
  function rerollsLeft() {
    const p = G.Game.player;
    // 1 gratis + los comprados en Mejoras (antes, 1 más por cada jefe).
    return p ? Math.max(0, 1 + (p.rerollBonus || 0) - (p.rerolls || 0)) : 0;
  }

  function reroll() {
    if (!offers || rerollsLeft() <= 0) return;
    const p = G.Game.player;
    p.rerolls = (p.rerolls || 0) + 1;
    G.Audio.sfx('select');
    renderCards(G.LevelUp.offer(p));
  }

  function renderCards(list) {
    offers = list; forgetting = null;
    const left = rerollsLeft();
    $('lvl-rr-n').textContent = left;
    $('lvl-reroll').classList.toggle('hidden', left <= 0);
    const box = $('cards');
    box.innerHTML = '';
    list.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      const tag = c.type === 'new'
        ? `<span class="tag-chip" style="background:${c.color}">${c.forget ? 'À la place d\'une autre' : 'Nuevo'} · ${c.tag}</span>`
        : c.type === 'up' || c.type === 'evo' || c.type === 'mon'
          ? `<span class="tag-chip" style="background:${c.color}">${c.tag}</span>`
          : `<span class="tag-chip" style="background:${c.color === '#ffd23f' ? '#ffd23f' : '#9fb1c9'}">${c.tag}</span>`;
      if (c.type === 'evo') el.classList.add('evo');
      el.innerHTML =
        `<div class="ico" style="background:${c.color}33">${G.Icons.html(c.icon, 56)}</div>
         <div class="txt"><div class="nm">${c.title} ${tag}</div>${c.types ? `<div class="lv-types">${G.UI.typeChips(c.types)}</div>
           <div class="lv-evo">${c.evo ? 'Évolue au N. ' + c.evo : 'N\'évolue pas'}</div>` : ''}<div class="ds">${c.desc}</div></div>
         <div class="key">${i + 1}</div>`;
      // Version de Nika : nouveau Pokémon -> son sprite ; carte pour un allié -> son petit portrait.
      if (c.dex || c.who) {
        const ico = el.querySelector('.ico');
        if (c.dex) ico.innerHTML = '';
        const cv = G.UI.spriteCanvas(c.dex || c.who, c.dex ? 132 : 40, c.dex ? 112 : 40, c.dex ? { scale: 4, hero: true, lively: true } : { scale: 2, hero: true });
        if (!c.dex) cv.className = 'who';
        ico.appendChild(cv);
      }
      if (c.type === 'mon') el.classList.add('mon');
      el.dataset.sfx = 'none';             // el juego pone su propio sonido al elegir
      el.onclick = () => pick(i);
      box.appendChild(el);
    });
  }

  // Version de Nika : apprendre une 5e attaque → choisir laquelle oublier.
  let forgetting = null;            // { card, moves }
  function askForget(c) {
    const pl = c.target, list = offers;
    const moves = pl.moves.slice();
    forgetting = { card: c, moves };
    $('lvl-reroll').classList.add('hidden');
    const box = $('cards');
    box.innerHTML = `<p class="forget-head">${pl.mon.name} veut apprendre <b>${c.title}</b>, mais connaît déjà 4 attaques. Laquelle oublier ?</p>`;
    moves.forEach((m, k) => {
      const el = document.createElement('div');
      const sig = !!(m.def && m.def.sig);
      el.className = 'card forget' + (sig ? ' off' : '');
      el.innerHTML = `<div class="ico" style="background:${G.U.TYPE_COLOR[m.type]}33">${G.Icons.html('move:' + m.id, 52)}</div>
        <div class="txt"><div class="nm">${m.name} <span class="tag-chip" style="background:${G.U.TYPE_COLOR[m.type]}">Nv.${m.lvl}</span></div>
        <div class="ds">${sig ? 'Attaque signature : elle ne s\'oublie pas' : 'Oublier cette attaque'}</div></div>
        <div class="key">${k + 1}</div>`;
      el.dataset.sfx = 'none';
      if (!sig) el.onclick = () => pickForget(k);
      box.appendChild(el);
    });
    const no = document.createElement('div');
    no.className = 'card forget no';
    no.innerHTML = `<div class="txt"><div class="nm">Ne pas apprendre ${c.title}</div><div class="ds">Retour aux choix</div></div>`;
    no.onclick = () => { forgetting = null; G.Audio.sfx('back'); renderCards(list); };
    box.appendChild(no);
    G.Audio.sfx('select');
  }
  function pickForget(k) {
    const f = forgetting, m = f && f.moves[k];
    if (!m || (m.def && m.def.sig)) return;
    forgetting = null;
    f.card.forgetId = m.id;
    pick(offers.indexOf(f.card));
  }

  function pick(i) {
    if (forgetting) { pickForget(i); return; }
    if (!offers || !offers[i]) return;
    if (offers[i].forget && !offers[i].forgetId) { askForget(offers[i]); return; }
    const c = offers[i], cb = offerCb;
    offers = null; offerCb = null;
    $('lvl-reroll').classList.add('hidden');
    if (coopMode) {
      // Se queda la carta elegida a la vista mientras eligen los demás.
      $('cards').querySelectorAll('.card').forEach((el, j) => el.classList.toggle('picked', j === i));
      $('cards').classList.add('done');
    } else G.UI.hide('scr-levelup');
    cb(c);
  }

  /** Cooperativo: quién falta por elegir. */
  function setWaiting(names) {
    const me = G.Social.me ? G.Social.me.name : '';
    const others = names.filter(n => n !== me);
    const list = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : a[0];
    $('lvl-wait').textContent = !names.length ? ''
      : !others.length ? 'Elige tu carta'
      : names.includes(me) ? 'Faltan por elegir: ' + list([...others, 'tú'])
      : 'Esperando a ' + list(others) + '…';
  }

  function closeLevelUp() {
    offers = null; offerCb = null; forgetting = null;
    $('cards').classList.remove('done');
    G.UI.hide('scr-levelup');
  }

  /**
   * Mensaje de apoyo (Ko-fi) al acabar: tras un récord o cada 10 partidas,
   * nunca en la primera y como mucho una vez al día. Se cierra con la X.
   */
  function askSupport(r) {
    if (!G.Funding || !G.Funding.url) return false;
    const runs = (G.DB.save && G.DB.save.stats && G.DB.save.stats.runs) || 0;
    if (runs < 2 || !(r.record || runs % 10 === 0)) return false;
    const today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem('ps.ask') === today) return false; localStorage.setItem('ps.ask', today); } catch (e) { return false; }
    return true;
  }

  function showOver(r, onBack) {
    $('over-title').textContent = r.dead ? 'Has caído…' : 'Run terminada';
    // Version de Nika : seulement la partie (pas de pièces, tickets ni dons).
    const team = G.Team.members();
    $('over-stats').innerHTML = `
      <div><span>Tiempo</span><b>${G.U.mmss(r.time)}</b></div>
      <div><span>Nivel</span><b>${r.level}</b></div>
      <div><span>Derrotados</span><b>${r.kills}</b></div>
      <div><span>Jefes</span><b>${r.bosses}</b></div>
      <div><span>Pièces gagnées</span><b class="gold"><span class="coin"></span> ${r.coins}</b></div>
      <div><span>Poké Balls</span><b>${G.Icons.html('ticket', 14)} ${(r.t1 || 0) + (r.t10 || 0) * 10}</b></div>
      ${r.record ? '<div style="grid-column:1/-1;text-align:center" class="gold">Nouveau record de temps !</div>' : ''}
      <div style="grid-column:1/-1"><span>Ton équipe</span><div class="over-team" id="over-team"></div></div>`;
    const ot = $('over-team');
    for (const m of team) {
      const w = document.createElement('div');
      w.appendChild(G.UI.spriteCanvas(m.dex, 56, 52, { scale: 1 }));
      w.insertAdjacentHTML('beforeend', `<small>${m.mon.name} N.${m.level}</small>`);
      ot.appendChild(w);
    }
    const ask = $('over-ask');
    if (ask) ask.querySelector('.x').onclick = () => ask.remove();
    $('btn-again').onclick = onBack;
    if (r.caught && r.caught.length) {
      const row = $('over-caught');
      for (const c of r.caught) {
        const w = document.createElement('div');
        w.appendChild(G.UI.spriteCanvas(c.dex, 90, 72, { shiny: true, lively: true, scale: 2 }));
        w.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[c.dex].name}${c.isNew ? ' · ¡nuevo!' : ''}</small>`);
        row.appendChild(w);
      }
    }
    G.UI.show('scr-over');
  }

  /** Has encontrado un objeto llevando ya otro: ¿con cuál te quedas? */
  function showItemChoice(cur, next, cb) {
    const box = $('item-cards');
    box.innerHTML = '';
    [[cur, 'Quedarme con'], [next, 'Cambiar a']].forEach(([id, verb], i) => {
      const it = G.Items.BY[id];
      const el = document.createElement('div');
      el.className = 'card' + (i === 1 ? ' evo' : '');
      el.innerHTML = `<div class="ico">${G.Icons.html(id, 36)}</div>
        <div class="txt"><div class="nm">${verb} ${it.name}</div><div class="ds">${it.desc}</div></div>
        <div class="key">${i + 1}</div>`;
      el.onclick = () => { G.UI.hide('scr-item'); cb(id); };
      box.appendChild(el);
    });
    G.UI.show('scr-item');
  }

  function showPause(coop = false) {
    G.UI.soundControls($('pause-sound'));
    G.TypesUI.pauseTeam($('pause-team'));
    $('pause-coop').classList.toggle('hidden', !coop);
    $('btn-quit').textContent = coop ? 'Salir de la partida' : 'Abandonar run';
    G.UI.show('scr-pause');
  }

  function wirePause(onResume, onQuit) {
    $('btn-resume').onclick = onResume;
    $('btn-quit').onclick = onQuit;
  }

  return { showLevelUp, reroll, showItemChoice, pick, setWaiting, closeLevelUp, showOver, wirePause, showPause };
})();
