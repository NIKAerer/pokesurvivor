/* ============ types-ui.js — table des types (version de Nika) ============
 * Menu → Types : choisis le type d'une attaque, on liste les types et les
 * Pokémon sauvages (gen 1-4) contre lesquels elle est forte ou faible, avec
 * les multiplicateurs du jeu (×1,6 / ×0,6 / ×0,3, voir data/types.js).
 * Pause : la couverture de ton équipe (types de ses attaques).
 */
G.TypesUI = (() => {
  const $ = G.UI.$;
  const TYPES = Object.keys(G.Types.CHART);
  let atk = null;

  const chip = t => `<span class="chip type-chip" style="background:${G.U.TYPE_COLOR[t]}">${G.U.TYPE_NAME[t]}</span>`;
  const fmt = m => '×' + (Math.round(m * 100) / 100).toString().replace('.', ',');

  function open() {
    if (!atk) {
      const mon = G.DEX_BY[G.DB.save.partner];
      atk = mon ? mon.types[0] : 'normal';
    }
    G.UI.show('scr-types', true);
    render();
  }

  function render() {
    const pick = $('types-pick');
    pick.innerHTML = TYPES.map(t =>
      `<button class="chip type-chip ${t === atk ? 'on' : ''}" data-t="${t}" style="background:${G.U.TYPE_COLOR[t]}">${G.U.TYPE_NAME[t]}</button>`).join('');
    pick.querySelectorAll('[data-t]').forEach(b => { b.onclick = () => { atk = b.dataset.t; G.Audio.sfx('select'); render(); }; });

    // Contre chaque type seul.
    const by = { strong: [], weak: [], none: [] };
    for (const t of TYPES) {
      const m = G.Types.mult(atk, [t]);
      if (m > 1.05) by.strong.push(t); else if (m < 0.35) by.none.push(t); else if (m < 0.95) by.weak.push(t);
    }
    // Contre chaque Pokémon (ses deux types comptent).
    const groups = [
      { k: 'super', title: 'Très efficace', test: m => m > 1.05, col: '#5fe08a' },
      { k: 'norm', title: 'Normal', test: m => m >= 0.95 && m <= 1.05, col: '#9fb1c9' },
      { k: 'weak', title: 'Pas très efficace', test: m => m < 0.95, col: '#ff8a96' }
    ];
    const mons = G.DEX.filter(p => G.SPRITE_META[p.dex]);
    const html = groups.map(g => {
      const list = mons.map(p => ({ p, m: G.Types.mult(atk, p.types) })).filter(x => g.test(x.m)).sort((a, b) => b.m - a.m || a.p.dex - b.p.dex);
      if (!list.length) return '';
      return `<details class="panel types-group" ${g.k === 'super' ? 'open' : ''}>
        <summary><b style="color:${g.col}">${g.title}</b> · ${list.length} Pokémon</summary>
        <div class="types-mons">${list.map(x =>
          `<span class="tmon" title="${x.p.types.map(t => G.U.TYPE_NAME[t]).join(' / ')}"><i style="background:${G.U.TYPE_COLOR[x.p.types[0]]}"></i>${x.p.name} <small>${fmt(x.m)}</small></span>`).join('')}</div>
      </details>`;
    }).join('');

    $('types-out').innerHTML = `
      <div class="panel types-sum">
        <div><b>${chip(atk)} est fort contre (×1,6)</b><div class="chips">${by.strong.map(chip).join('') || '—'}</div></div>
        <div><b>peu efficace contre (×0,6)</b><div class="chips">${by.weak.map(chip).join('') || '—'}</div></div>
        <div><b>presque rien contre (×0,3)</b><div class="chips">${by.none.map(chip).join('') || '—'}</div></div>
      </div>${html}`;
  }

  /** Pause : chaque membre de l'équipe, son niveau, ses attaques et leurs types forts. */
  function pauseTeam(box) {
    const team = G.Team.members();
    if (!team.length) { box.innerHTML = ''; return; }
    const cover = new Set();
    for (const m of team) for (const mv of m.moves) for (const t of TYPES) if (G.Types.mult(mv.type, [t]) > 1.05) cover.add(t);
    const miss = TYPES.filter(t => !cover.has(t));
    box.innerHTML = `<h3 style="margin:6px 0">Ton équipe (${team.length}/6)</h3>` + team.map(m => `
      <div class="pt-row"><span class="pt-spr" data-dex="${m.dex}"></span>
        <div><b>${m.mon.name}</b> <small>N. ${m.level}${G.Team.evoLevel(m.dex) ? ' · évolue au N. ' + G.Team.evoLevel(m.dex) : ''}</small>
        <div class="chips">${m.moves.map(mv => `<span class="chip type-chip" style="background:${G.U.TYPE_COLOR[mv.type]}">${mv.name} ${mv.lvl}</span>`).join('')}</div></div>
      </div>`).join('') +
      `<p class="note" style="text-align:left">Tes attaques sont très efficaces contre : ${[...cover].map(chip).join(' ') || '—'}</p>` +
      (miss.length ? `<p class="note" style="text-align:left">Aucune attaque forte contre : ${miss.map(chip).join(' ')}</p>` : '');
    box.querySelectorAll('.pt-spr').forEach(el => el.appendChild(G.UI.spriteCanvas(+el.dataset.dex, 40, 40, { scale: 1 })));
  }

  return { open, render, pauseTeam };
})();
