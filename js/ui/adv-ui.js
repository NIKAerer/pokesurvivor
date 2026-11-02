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

  /** L'évolution, comme dans les jeux : le Pokémon devient lumière, clignote entre ses deux formes, puis la nouvelle apparaît. */
  function evolve(from, to, shinyFrom, shinyTo) {
    return new Promise(res => {
      const el = document.createElement('div');
      el.id = 'adv-evo';
      const name = d => G.DEX_BY[d].name;
      el.innerHTML = `<div class="ae-rays"></div><div class="ae-stage"></div><p class="ae-txt">Quoi ? ${name(from)} évolue !</p>`;
      const stage = el.querySelector('.ae-stage');
      const a = G.UI.spriteCanvas(from, 150, 150, { fit: true, shiny: shinyFrom }), b = G.UI.spriteCanvas(to, 150, 150, { fit: true, shiny: shinyTo });
      a.className = 'ae-mon'; b.className = 'ae-mon ae-new';
      stage.append(a, b);
      document.body.appendChild(el);
      G.Audio.sfx('legend');
      requestAnimationFrame(() => el.classList.add('on'));
      // Clignotements de plus en plus rapides entre les deux silhouettes blanches.
      let t = 0, show = 0, done = false;
      const steps = [];
      for (let d = 420; d > 50; d *= 0.82) steps.push(d);
      setTimeout(() => el.classList.add('glow'), 500);
      const tick = i => {
        if (i >= steps.length) return reveal();
        show ^= 1;
        a.style.opacity = show ? 0 : 1; b.style.opacity = show ? 1 : 0;
        setTimeout(() => tick(i + 1), steps[i]);
      };
      setTimeout(() => tick(0), 900);
      const reveal = () => {
        a.style.opacity = 0; b.style.opacity = 1;
        el.classList.add('flash');
        G.Audio.sfx('levelup');
        setTimeout(() => {
          el.classList.remove('glow'); el.classList.add('done');
          el.querySelector('.ae-txt').textContent = 'Félicitations ! ' + name(from) + ' a évolué en ' + name(to) + ' !';
          for (let i = 0; i < 14; i++) {
            const sp = document.createElement('i');
            sp.className = 'ae-spark';
            sp.style.setProperty('--a', (i / 14 * 360) + 'deg');
            sp.style.animationDelay = (Math.random() * 0.3) + 's';
            stage.appendChild(sp);
          }
          const fin = () => { if (done) return; done = true; removeEventListener('keydown', key, true); el.classList.remove('on'); setTimeout(() => { el.remove(); res(); }, 250); };
          const key = e => { if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); fin(); } };
          addEventListener('keydown', key, true);
          el.onclick = fin;
          setTimeout(fin, 3500);
        }, 350);
      };
    });
  }

  /** Le Pokédex d'un Pokémon de l'Aventure : types, statistiques, évolutions (avec les niveaux) et attaques par niveau. */
  function dex(m) {
    return new Promise(res => {
      const M = G.AdvMon, p = G.DEX_BY[m.dex], shiny = G.DB.ownsShiny(m.dex);
      const el = document.createElement('div');
      el.id = 'adv-dex';
      const b = M.base(m.dex);
      const bar = (n, v) => `<div class="ad-st"><span>${n}</span><i><b style="width:${Math.min(100, v / 1.6)}%"></b></i><em>${v}</em></div>`;
      // La famille depuis la forme de base, avec les niveaux d'évolution de l'Aventure.
      const pre = {};
      for (const [a, l] of Object.entries(G.EVOS || {})) for (const [to] of l) if (!pre[to]) pre[to] = +a;
      let root = m.dex;
      for (let i = 0; i < 4 && pre[root]; i++) root = pre[root];
      const step = d => `<span class="ad-evo-mon${d === m.dex ? ' on' : ''}" data-d="${d}"></span>`;
      const rows = [];
      const walk = (d, path) => {
        const nx = (G.EVOS[d] || []).filter(e => G.DEX_BY[e[0]]);
        if (!nx.length) { rows.push(path); return; }
        for (const [to, lv] of nx) walk(to, path.concat([[to, lv]]));
      };
      walk(root, [[root, 0]]);
      const evoHtml = rows.length === 1 && rows[0].length === 1 ? '<p class="ad-none">N\'évolue pas.</p>'
        : `<div class="ad-evo">${step(root)}<div class="ad-branch">${rows.map(r => `<div class="ad-evo">${r.slice(1).map(([d, lv]) => `<span class="ad-arrow">→<small>N. ${lv}</small></span>` + step(d)).join('')}</div>`).join('')}</div></div>`;
      const nx = (G.EVOS[m.dex] || []).filter(e => G.DEX_BY[e[0]]);
      const next = nx.length ? 'Évolue au N. ' + Math.min(...nx.map(e => e[1])) + (nx.length > 1 ? ' (' + nx.length + ' évolutions possibles, au hasard)' : ' en ' + G.DEX_BY[nx[0][0]].name) : 'N\'évolue pas';
      const learn = M.learnset(m.dex), ab = G.AdvBattle.abInfo(m.dex);
      const mv = learn.map(([lv, id]) => { const o = M.move(id), pw = M.power(id);
        return `<div class="ad-mv${m.moves.includes(id) ? ' on' : ''}${lv > m.lv ? ' later' : ''}" style="--c:${G.U.TYPE_COLOR[o.type]}"><span>N. ${lv || 1}</span><b>${o.name}</b><small>${G.U.TYPE_NAME[o.type] || o.type} · ${pw ? 'Puiss. ' + pw : o.cls ? 'Fixe' : 'Statut'}</small></div>`; }).join('');
      el.innerHTML = `<div class="ad-box"><button class="ad-x" aria-label="Fermer">Fermer</button>
        <div class="ad-head"><div class="ad-pic"></div><div><small>N° ${String(m.dex).padStart(3, '0')}</small><h3>${p.name}${m.nick ? ' · ' + m.nick : ''}</h3>
          <div>${G.UI.typeChips(p.types)}</div><p class="ad-lv">Niveau ${m.lv} · ${next}</p></div></div>
        ${ab ? `<h4>Talent</h4><p class="ad-ab"><b>${ab.name}</b> · ${ab.desc}</p>` : ''}
        <h4>Statistiques de base</h4>${bar('PV', b[0])}${bar('Attaque', b[1])}${bar('Défense', b[2])}${bar('Att. Spé', b[3])}${bar('Déf. Spé', b[4])}${bar('Vitesse', b[5])}
        <h4>Évolutions</h4>${evoHtml}
        <h4>Attaques par niveau</h4><div class="ad-mvs">${mv}</div><small class="ad-note">En couleur : attaques qu'il connaît.</small></div>`;
      el.querySelector('.ad-pic').appendChild(G.UI.spriteCanvas(m.dex, 96, 96, { fit: true, shiny }));
      el.querySelectorAll('.ad-evo-mon').forEach(x => { const d = +x.dataset.d;
        x.appendChild(G.UI.spriteCanvas(d, 52, 48, { fit: true, shiny: G.DB.ownsShiny(d) }));
        x.insertAdjacentHTML('beforeend', `<small>${G.DEX_BY[d].name}</small>`); });
      document.body.appendChild(el);
      G.Audio.sfx('select');
      const fin = () => { removeEventListener('keydown', key, true); el.remove(); res(); };
      const key = e => { if (['Space', 'Enter', 'Escape', 'Backspace', 'KeyE'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); fin(); } };
      addEventListener('keydown', key, true);
      el.querySelector('.ad-x').onclick = e => { e.stopPropagation(); fin(); };
      el.onclick = e => { if (e.target === el) fin(); };
    });
  }

  return { open, talk, talkP, choose, init, evolve, dex };
})();
