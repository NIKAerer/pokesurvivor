/* ============ adv-ui.js — écran de l'Aventure (version de Nika) ============
 * Choix du premier Pokémon (Bulbizarre, Salamèche, Carapuce), l'équipe de
 * l'Aventure (toucher un Pokémon le met en tête), et la carte des chapitres de
 * Kanto. Aussi la boîte de dialogue des chapitres (talk) et le bilan (result).
 */
G.AdvUI = (() => {
  const $ = id => document.getElementById(id);
  const A = () => G.Adventure;

  function open() {
    if (G.Game.state !== 'ui') G.Game.toUI();
    G.UI.chrome(false);
    G.Audio.music('village');
    G.UI.show('scr-adv');
    render();
  }

  function render() {
    const st = A().state(), box = $('adv-body');
    box.innerHTML = '';
    if (!st.team.length) { starters(box); return; }

    // L'équipe : les 6 premiers partent, les autres attendent en réserve.
    const team = document.createElement('div');
    team.className = 'ts-card adv-team';
    team.innerHTML = `<h3>Ton équipe</h3><p class="note">Touche un Pokémon pour qu'il mène l'équipe. Les ${A().TRAVEL} premiers partent à l'aventure.</p>`;
    const row = document.createElement('div');
    row.className = 'adv-mons';
    st.team.forEach((m, i) => {
      const p = G.DEX_BY[m.dex];
      if (!p) return;
      const b = document.createElement('button');
      b.className = 'adv-mon' + (i === 0 ? ' lead' : '') + (i >= A().TRAVEL ? ' rest' : '');
      b.appendChild(G.UI.spriteCanvas(m.dex, 56, 48, { fit: true, shiny: G.DB.ownsShiny(m.dex) }));
      b.insertAdjacentHTML('beforeend', `<b>${p.name}</b><small>N. ${m.lv}${i === 0 ? ' · tête' : i >= A().TRAVEL ? ' · réserve' : ''}</small>`);
      b.onclick = () => { if (i) { A().setLeader(i); G.Audio.sfx('select'); render(); } };
      row.appendChild(b);
    });
    team.appendChild(row);
    box.appendChild(team);

    // Les chapitres de Kanto.
    const map = document.createElement('div');
    map.className = 'ts-card adv-map';
    map.innerHTML = `<h3>Kanto · ${Math.min(st.done, A().CH.length)} / ${A().CH.length} chapitres</h3>`;
    const list = document.createElement('div');
    list.className = 'adv-chs';
    A().CH.forEach((c, i) => {
      const done = i < st.done, next = i === st.done, locked = i > st.done;
      const b = document.createElement('button');
      b.className = 'adv-ch' + (done ? ' done' : '') + (next ? ' next' : '');
      b.disabled = locked;
      b.style.setProperty('--tc', G.U.TYPE_COLOR[c.type] || '#888');
      b.innerHTML = `<span class="adv-n">${i + 1}</span><span class="adv-t"><b>${c.place}</b><small>${locked ? '???' : c.who}</small></span>`
        + `<span class="adv-s">${done ? G.Icons.html('medal1', 18) : next ? 'Jouer' : ''}</span>`;
      b.onclick = () => play(i);
      list.appendChild(b);
    });
    map.appendChild(list);
    box.appendChild(map);
  }

  function starters(box) {
    const c = document.createElement('div');
    c.className = 'ts-card adv-start';
    c.innerHTML = `<h3>Bourg Palette</h3><p>Le Professeur Chen t'attend. Il lui reste trois Pokémon : lequel sera ton premier compagnon ?</p>`;
    const row = document.createElement('div');
    row.className = 'adv-starters';
    for (const dex of A().STARTERS) {
      const p = G.DEX_BY[dex];
      const b = document.createElement('button');
      b.className = 'adv-starter';
      b.style.setProperty('--tc', G.U.TYPE_COLOR[p.types[0]]);
      b.appendChild(G.UI.spriteCanvas(dex, 120, 100, { scale: 3, hero: true, lively: true, shiny: G.DB.ownsShiny(dex) }));
      b.insertAdjacentHTML('beforeend', `<b>${p.name}</b><span>${G.UI.typeChips(p.types)}</span>`);
      b.onclick = () => {
        A().pickStarter(dex);
        G.DB.grant(dex, 'adv');
        G.Audio.sfx('confirm');
        render();
      };
      row.appendChild(b);
    }
    c.appendChild(row);
    box.appendChild(c);
  }

  function play(i) {
    if (i > A().state().done) return;
    G.Audio.sfx('confirm');
    G.Sprites.preload(A().state().team.slice(0, A().TRAVEL).map(m => m.dex));
    A().start(i);
    G.Game.startRun();
  }

  // ---------------- dialogues ----------------
  let talkCb = null, talkLines = [], talkI = 0;
  function talk(lines, cb) {
    talkLines = lines || []; talkI = 0; talkCb = cb;
    if (!talkLines.length) { done(); return; }
    $('adv-talk').classList.remove('hidden');
    show();
  }
  function show() {
    const [who, txt] = talkLines[talkI];
    $('adv-talk-who').textContent = who || '';
    $('adv-talk-who').classList.toggle('hidden', !who);
    $('adv-talk-txt').textContent = txt;
  }
  function next() {
    G.Audio.sfx('click');
    if (++talkI < talkLines.length) { show(); return; }
    done();
  }
  function done() {
    $('adv-talk').classList.add('hidden');
    const cb = talkCb; talkCb = null;
    if (cb) cb();
  }

  /** Bilan d'un chapitre, puis retour à la carte. */
  function result(res) {
    open();
    if (!res) return;
    const c = A().CH[res.ch];
    const got = res.caught.map(d => G.DEX_BY[d].name).join(', ');
    const lines = res.won
      ? [['', 'Chapitre ' + (res.ch + 1) + ' réussi : ' + c.place + ' ! +' + res.coins + ' pièces.' + (got ? ' Capturés : ' + got + '.' : '')]]
      : res.dead
        ? [['', 'Ton équipe est K.O.… Elle garde son expérience' + (got ? ' et ses captures (' + got + ')' : '') + '. Réessaie !']]
        : got ? [['', 'Chapitre interrompu. Tes captures sont gardées : ' + got + '.']] : [];
    talk(lines, () => render());
  }

  function init() {
    $('adv-talk').onclick = next;
    document.addEventListener('keydown', e => {
      if ($('adv-talk').classList.contains('hidden') || !['Space', 'Enter', 'KeyE'].includes(e.code)) return;
      e.preventDefault();
      next();
    });
  }

  return { open, render, talk, result, init };
})();
