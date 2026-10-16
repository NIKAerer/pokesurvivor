/* ============ pick-ui.js — choix rapide du Pokémon (version de Nika) ============
 * Il n'y a plus de menu : au lancement et après chaque partie, 3 Pokémon de
 * base au hasard s'affichent (avec leurs types et leur attaque de départ), on
 * en touche un et la partie commence.
 */
G.PickUI = (() => {
  const $ = G.UI.$;

  function open() {
    G.UI.chrome(false);
    G.Audio.music('village');
    G.UI.show('scr-pick');
    render();
  }

  /** Formes de base, sans légendaires, avec sprites (ALL_BASE = false : les 14 starters). */
  const ALL_BASE = true;
  function pool() {
    if (!ALL_BASE) return G.STARTERS.map(s => s.dex);
    return G.DEX.filter(p => !G.EVO_FROM[p.dex] && !p.leg && G.SPRITE_META[p.dex]).map(p => p.dex);
  }

  function render() {
    const box = $('pick-cards');
    box.innerHTML = '';
    for (const dex of G.U.pickN(pool(), 3)) {
      const s = { dex }, mon = G.DEX_BY[dex], mv = G.Moves.BY_ID[G.startMoveOf(dex)];
      const el = document.createElement('button');
      el.className = 'pick-card';
      el.dataset.sfx = 'confirm';
      el.style.setProperty('--c', G.U.TYPE_COLOR[mon.types[0]]);
      el.appendChild(G.UI.spriteCanvas(s.dex, 96, 76, { lively: true, scale: 2 }));
      el.insertAdjacentHTML('beforeend', `<b>${mon.name}</b>${G.UI.typeChips(mon.types)}<span class="pick-move" style="--m:${G.U.TYPE_COLOR[mv.type]}">${mv.name}</span>`);
      el.onclick = () => play(s.dex);
      box.appendChild(el);
    }
  }

  function play(dex) {
    const save = G.DB.save;
    save.partner = dex;
    save.partnerShiny = false;
    G.DB.grant(dex, 'starter');
    G.DB.commit();
    G.Game.startRun();
  }

  function init() {
    $('pick-again').onclick = () => { G.Audio.sfx('select'); render(); };
  }

  return { open, init };
})();
