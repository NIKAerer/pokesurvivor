/* ============ pick-ui.js — choix rapide du Pokémon (version de Nika) ============
 * Il n'y a plus de menu : au lancement et après chaque partie, 3 starters au
 * hasard s'affichent, on en touche un et la partie commence.
 */
G.PickUI = (() => {
  const $ = G.UI.$;

  function open() {
    G.UI.chrome(false);
    G.Audio.music('village');
    G.UI.show('scr-pick');
    render();
  }

  function render() {
    const box = $('pick-cards');
    box.innerHTML = '';
    for (const s of G.U.pickN(G.STARTERS.slice(), 3)) {
      const mon = G.DEX_BY[s.dex];
      const el = document.createElement('button');
      el.className = 'pick-card';
      el.dataset.sfx = 'confirm';
      el.style.setProperty('--c', G.U.TYPE_COLOR[mon.types[0]]);
      el.appendChild(G.UI.spriteCanvas(s.dex, 96, 76, { lively: true, scale: 2 }));
      el.insertAdjacentHTML('beforeend', `<b>${mon.name}</b>${G.UI.typeChips(mon.types)}`);
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
