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
    for (const d of box()) if (!G.DB.owns(d)) G.DB.grant(d, 'starter');   // le Pokédex les compte
    G.Sprites.preload(box());          // charger les sprites avant de jouer
    render();
  }

  function render() {
    const s = G.DB.save;
    const mon = G.DEX_BY[s.partner], mv = G.Moves.BY_ID[G.startMoveOf(mon.dex)];
    const t = s.tickets || { t1: 0, t10: 0 };
    $('pick-wallet').innerHTML = `<span class="coin"></span> <b>${s.coins.toLocaleString('fr')}</b>
      &nbsp; ${G.Icons.html('ticket', 16)} <b>${t.t1}</b> &nbsp; ${G.Icons.html('ticket10', 16)} <b>${t.t10}</b>`;

    // Le Pokémon choisi.
    const hero = $('pick-hero');
    hero.style.setProperty('--c', G.U.TYPE_COLOR[mon.types[0]]);
    hero.innerHTML = '';
    const hasSh = G.DB.ownsShiny(mon.dex), shiny = hasSh && !!s.partnerShiny;
    hero.appendChild(G.UI.spriteCanvas(mon.dex, 120, 96, { lively: true, scale: 2, shiny }));
    const evo = G.Team.evoLevel(mon.dex);
    hero.insertAdjacentHTML('beforeend', `<b class="pick-name">${mon.name}</b>${G.UI.typeChips(mon.types)}
      <span class="pick-move" style="--m:${G.U.TYPE_COLOR[mv.type]}">${mv.name}</span>
      ${evo ? `<small class="note">Évolue au N. ${evo}</small>` : ''}
      ${hasSh ? `<button id="pick-shiny" class="btn small ${shiny ? 'gold' : 'ghost'}">${G.Icons.html('shiny', 12)} Shiny ${shiny ? 'oui' : 'non'}</button>` : ''}`);
    if (hasSh) $('pick-shiny').onclick = () => { s.partnerShiny = !s.partnerShiny; G.DB.commit(); G.Audio.sfx('select'); render(); };

    // Tes Pokémon.
    const list = $('pick-cards');
    list.innerHTML = '';
    const mons = box();
    for (const dex of mons) {
      const b = document.createElement('button');
      b.className = 'pick-card' + (dex === s.partner ? ' on' : '');
      b.style.setProperty('--c', G.U.TYPE_COLOR[G.DEX_BY[dex].types[0]]);
      b.title = G.DEX_BY[dex].name;
      b.appendChild(G.UI.spriteCanvas(dex, 52, 46, { scale: 1, shiny: dex === s.partner && G.DB.ownsShiny(dex) && !!s.partnerShiny }));
      if (G.DB.ownsShiny(dex)) b.insertAdjacentHTML('beforeend', `<span class="pick-sh">${G.Icons.html('shiny', 10)}</span>`);
      b.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[dex].name}</small>`);
      b.onclick = () => { if (s.partner !== dex) s.partnerShiny = false; s.partner = dex; G.DB.commit(); G.Audio.sfx('select'); render(); };
      list.appendChild(b);
    }
    $('pick-count').textContent = `Tes Pokémon (${mons.length})`;
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
    // « Retour » des écrans Améliorations et Gacha : revient ici.
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = open; });
  }

  return { open, init };
})();
