/* ============ adv-ui.js — dialogues et choix de l'Aventure (version de Nika) ============
 * La grande boîte de dialogue au centre de l'écran (talk / talkP) et les
 * cartes de choix (choose) : premier Pokémon, récompenses, boutique, menu.
 * L'Aventure elle-même se joue sur la carte (js/adv/overworld.js).
 */
G.AdvUI = (() => {
  const $ = id => document.getElementById(id);

  function open() { G.Overworld.open(); }

  // ---------------- dialogues ----------------
  let talkCb = null, talkLines = [], talkI = 0;
  function talk(lines, cb) {
    talkLines = lines || []; talkI = 0; talkCb = cb;
    if (!talkLines.length) { done(); return; }
    $('adv-talk').classList.remove('hidden');
    show();
  }
  const talkP = lines => new Promise(res => talk(lines, res));
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

  // ---------------- choix ----------------
  /** options : [{ title, desc, dex?, types?, icon?, off? }] → Promise de l'index choisi. */
  function choose(title, options) {
    return new Promise(res => {
      const box = $('adv-choose');
      box.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'adv-choose-box';
      card.insertAdjacentHTML('beforeend', `<h3>${title}</h3>`);
      const row = document.createElement('div');
      row.className = 'adv-choose-row' + (options.length > 4 ? ' many' : '');
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.className = 'adv-opt' + (o.off ? ' off' : '');
        if (i < 9) b.dataset.k = i + 1;
        const p = o.dex && G.DEX_BY[o.dex];
        const mv = o.icon && o.icon.startsWith('move:') && G.AdvMon.move(o.icon.slice(5));
        b.style.setProperty('--tc', p ? G.U.TYPE_COLOR[p.types[0]] : mv ? G.U.TYPE_COLOR[mv.type] : '#e0a020');
        if (p) b.appendChild(G.UI.spriteCanvas(o.dex, 72, 60, { fit: true, shiny: G.DB.ownsShiny(o.dex) }));
        else if (mv) b.insertAdjacentHTML('beforeend', `<span class="adv-oico adv-otype">${G.U.TYPE_NAME[mv.type] || mv.type}</span>`);
        else if (o.icon) b.insertAdjacentHTML('beforeend', `<span class="adv-oico">${G.Icons.html(o.icon, 36)}</span>`);
        b.insertAdjacentHTML('beforeend', `<span class="adv-otx"><b>${o.title}</b>${o.types ? `<span>${G.UI.typeChips(o.types)}</span>` : ''}${o.desc ? `<small>${o.desc}</small>` : ''}</span>`);
        b.onclick = e => {
          e.stopPropagation();
          G.Audio.sfx('confirm');
          box.classList.add('hidden');
          box.innerHTML = '';
          res(i);
        };
        row.appendChild(b);
      });
      card.appendChild(row);
      box.appendChild(card);
      box.classList.remove('hidden');
    });
  }

  function init() {
    $('adv-talk').onclick = next;
    document.addEventListener('keydown', e => {
      if (!$('adv-talk').classList.contains('hidden')) {
        if (!['Space', 'Enter', 'KeyE'].includes(e.code)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        next();
        return;
      }
      if (e.repeat) return;
      // Au clavier : 1, 2, 3, 4… choisissent (cartes de choix, menu de combat), Échap ou Retour arrière = Retour.
      const n = /^(Digit|Numpad)([1-9])$/.exec(e.code), num = n ? +n[2] - 1 : -1;
      const hit = el => { e.preventDefault(); e.stopImmediatePropagation(); if (el && !el.disabled) el.click(); };
      const ch = $('adv-choose');
      if (!ch.classList.contains('hidden')) {
        if (num >= 0) hit(ch.querySelectorAll('.adv-opt')[num]);
        return;
      }
      const advb = $('advb');
      if (!advb || advb.classList.contains('hidden')) return;
      const intro = $('advb-intro');
      if (intro && intro.classList.contains('on') && ['Space', 'Enter', 'KeyE'].includes(e.code)) { hit(intro); return; }
      const btns = [...$('advb-menu').querySelectorAll('.advb-btn')];
      if (btns.length) {
        if (num >= 0) hit(btns.filter(b => !b.classList.contains('back'))[num]);
        else if (['Escape', 'Backspace'].includes(e.code)) hit(btns.find(b => b.classList.contains('back')));
        return;
      }
      if (['Space', 'Enter', 'KeyE'].includes(e.code)) hit(advb);
    }, true);
    G.Overworld.init();
  }

  return { open, talk, talkP, choose, init };
})();
