/* ============ battle.js — combats au tour par tour sur la carte (version de Nika) ============
 * Pas d'écran à part : ton Pokémon sort devant toi, face au sauvage (ou au
 * Pokémon du dresseur), et le menu s'ouvre en bas : Attaque, Sac, Pokémon, Fuite.
 *
 * Comme dans les vrais jeux (données de moves-data.js) :
 *   - les vraies statistiques de base (PV, Attaque, Défense, Atq. Spé., Déf. Spé., Vitesse)
 *     et les formules des jeux ;
 *   - les vraies attaques de chaque Pokémon, apprises aux vrais niveaux, 4 au plus,
 *     avec leur précision, priorité, effets (statuts, stats, vol de vie, recul,
 *     coups multiples, peur, coups critiques) et leurs PP ;
 *   - les statuts : paralysie, sommeil, gel, brûlure, poison, confusion ;
 *   - la table des types (×2, ×0,5, ×0), STAB ×1,5.
 * Les Pokémon de l'Aventure : { dex, lv, xp, hp, moves: [id...], pp: [n...], st, sleep }
 */
G.AdvMon = (() => {
  const D = () => G.AdvData;
  const P = dex => G.DEX_BY[dex];
  const IV = 15;

  /** Une attaque des jeux, ou null. */
  function move(id) {
    const a = D().moves[id];
    if (!a) return null;
    return a._o || (a._o = { id: +id, name: a[0], type: a[1], cls: a[2], power: a[3], acc: a[4], prio: a[5], self: !!a[6], ail: a[7], ailCh: a[8],
      stats: a[9], statCh: a[10], drain: a[11], heal: a[12], hitMin: a[13], hitMax: a[14], flinch: a[15], crit: a[16], pp: a[17], key: a[18] });
  }
  // Attaques à dégâts fixes des jeux.
  const FIXED = { 'dragon-rage': () => 40, 'sonic-boom': () => 20, 'seismic-toss': u => u.lv, 'night-shade': u => u.lv, 'super-fang': (u, t) => Math.max(1, Math.floor(t.hp / 2)) };
  function power(id) {
    const m = move(id);
    if (!m || !m.cls) return 0;
    return m.power || (FIXED[m.key] ? 0 : 60);
  }

  const base = dex => D().stats[dex] || [50, 50, 50, 50, 50, 50];
  const K = { atk: 1, def: 2, spa: 3, spd: 4, spe: 5 };
  function maxHp(m) { return m.dex === 292 ? 1 : Math.floor((2 * base(m.dex)[0] + IV) * m.lv / 100) + m.lv + 10; }
  function stat(m, k) { return Math.floor((2 * base(m.dex)[K[k]] + IV) * m.lv / 100) + 5; }
  const xpAt = lv => lv * lv * lv;

  /** Les attaques du Pokémon par niveau : [[niveau, id], ...]. */
  function learnset(dex) { return (D().learn[dex] || [[1, 33]]).filter(([, id]) => move(id)); }
  /** Les 4 dernières attaques apprises jusqu'au niveau lv (comme un Pokémon sauvage des jeux). */
  function movesAt(dex, lv) {
    const out = [];
    for (const [l, id] of learnset(dex)) if (l <= lv && !out.includes(id)) out.push(id);
    if (!out.length) out.push(learnset(dex)[0][1]);
    return out.slice(-4);
  }
  /** Attaques apprises en arrivant pile au niveau lv. */
  function newMovesAt(dex, lv) { return learnset(dex).filter(([l]) => l === lv).map(([, id]) => id); }
  /** Les prochaines attaques du Pokémon (pas encore connues), pour le Maître des capacités. */
  function nextMoves(m, n = 3) {
    const out = [];
    for (const [l, id] of learnset(m.dex)) if (!m.moves.includes(id) && !out.includes(id) && (l > 1 || m.lv < 5)) out.push(id);
    const known = learnset(m.dex).filter(([l]) => l <= m.lv).map(([, id]) => id);
    const later = out.filter(id => !known.includes(id));
    return (later.length ? later : out).slice(0, n);
  }
  function fixPp(m) {
    m.pp = m.moves.map((id, i) => (m.pp && m.pp[i] != null ? Math.min(m.pp[i], move(id).pp || 10) : move(id).pp || 10));
  }
  function restore(m) { m.hp = maxHp(m); m.st = ''; m.sleep = 0; m.pp = m.moves.map(id => move(id).pp || 10); }
  /** Une attaque qui fait des dégâts (puissance, ou dégâts fixes comme Draco-Rage). */
  const hurts = id => { const mv = move(id); return !!mv && !!mv.cls && (mv.power > 0 || !!FIXED[mv.key]); };
  /**
   * Version de Nika : chaque Pokémon a toujours au moins une attaque qui fait des dégâts
   * (Dardargnan N. 12 n'avait que des attaques de statut). On prend la meilleure attaque à dégâts
   * apprise jusqu'à son niveau (sa forme d'avant comprise), sinon la première qu'il apprendra, sinon Charge.
   */
  function ensureDamage(m) {
    if (m.moves.some(hurts)) return false;
    const pre = Object.keys(G.EVOS || {}).filter(d => (G.EVOS[d] || []).some(([to]) => to === m.dex)).map(Number);
    const pool = [m.dex].concat(pre, pre.flatMap(p => Object.keys(G.EVOS || {}).filter(d => (G.EVOS[d] || []).some(([to]) => to === p)).map(Number)));
    let best = 0, bp = -1;
    for (const d of pool) for (const [l, id] of learnset(d)) if (l <= m.lv && hurts(id) && power(id) > bp) { best = id; bp = power(id); }
    if (!best) { const next = learnset(m.dex).find(([, id]) => hurts(id)); best = next ? next[1] : 33; }
    if (m.moves.length < 4) m.moves.push(best);
    else m.moves[m.moves.length - 1] = best;
    m.pp = null; fixPp(m);
    return true;
  }
  function make(dex, lv) {
    const m = { dex, lv, xp: xpAt(lv), hp: 0, moves: movesAt(dex, lv), st: '' };
    ensureDamage(m);
    restore(m);
    return m;
  }
  /** Les anciennes sauvegardes (attaques du Survivor) : on leur donne leurs vraies attaques. */
  function migrate(m) {
    if (!m.moves || !m.moves.length || m.moves.some(id => !move(id))) { m.moves = movesAt(m.dex, m.lv); m.pp = null; }
    if (!m.pp || m.pp.length !== m.moves.length) fixPp(m);
    ensureDamage(m);
    if (m.st == null) m.st = '';
    m.hp = Math.min(m.hp, maxHp(m));
  }
  function name(m) { return P(m.dex).name; }
  function moveName(id) { return (move(id) || {}).name || '?'; }
  const CLS = ['Statut', 'Physique', 'Spécial'];
  /** « Feu · Spécial · Puiss. 40 · Préc. 100 » */
  function moveInfo(id) {
    const mv = move(id), pw = power(id);
    return (G.U.TYPE_NAME[mv.type] || mv.type) + ' · ' + CLS[mv.cls] + (pw ? ' · Puiss. ' + pw : FIXED[mv.key] ? ' · Dégâts fixes' : '') + (mv.acc ? ' · Préc. ' + mv.acc : '');
  }

  /** Multiplicateur des jeux (×2, ×0,5, ×0). */
  function typeMul(type, types) {
    const row = G.Types.CHART[type] || {};
    let k = 1;
    for (const t of types) if (row[t] != null) k *= row[t];
    return k;
  }

  return { base, maxHp, stat, xpAt, power, move, ensureDamage, movesAt, newMovesAt, nextMoves, make, restore, migrate, fixPp, name, moveName, moveInfo, typeMul, learnset, FIXED };
})();

G.AdvBattle = (() => {
  const M = G.AdvMon;
  const FX = () => G.AdvFX;
  const $ = id => document.getElementById(id);
  let active = false;
  let B = null;            // { wild, trainer, foes, fi, foe, me, stages, vol, aMe, aFoe, slotMe, slotFoe }
  let tweens = [];

  const ST_NAME = { par: 'PAR', slp: 'SOM', frz: 'GEL', brn: 'BRÛ', psn: 'PSN', tox: 'PSN' };
  const ST_COLOR = { par: '#d8b020', slp: '#8888a8', frz: '#58b8e8', brn: '#e07030', psn: '#a040a0', tox: '#7a2080' };

  // ---------------- petites animations ----------------
  function tween(dur, fn) {
    return new Promise(res => tweens.push({ t: 0, dur, fn, res }));
  }
  const wait = s => tween(s, () => {});
  function update(dt) {
    if (B) B.t = (B.t || 0) + dt;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const w = tweens[i];
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      w.fn(k);
      if (k >= 1) { tweens.splice(i, 1); w.res(); }
    }
    if (B) for (const a of [B.aMe, B.aFoe]) if (a && a.anim) a.anim.update(dt);
    FX().update(dt);
  }

  // ---------------- interface ----------------
  let tapRes = null;
  function say(text, hold = 1.5) {
    $('advb-menu').innerHTML = '';
    $('advb-msg').textContent = text;
    $('advb-msg').classList.add('on');
    return new Promise(res => {
      let done = false;
      const fin = () => { if (done) return; done = true; tapRes = null; res(); };
      tapRes = fin;
      wait(hold).then(fin);
    });
  }
  function card(el, m, foe) {
    const p = G.DEX_BY[m.dex], mx = M.maxHp(m), k = Math.max(0, m.hp) / mx;
    const col = k > 0.5 ? '#3ad06a' : k > 0.2 ? '#f0c030' : '#e84040';
    const xpK = foe ? 0 : (m.xp - M.xpAt(m.lv)) / Math.max(1, M.xpAt(m.lv + 1) - M.xpAt(m.lv));
    const st = m.st ? `<em class="advb-st" style="background:${ST_COLOR[m.st]}">${ST_NAME[m.st]}</em>` : '';
    const tps = p.types.map(t => `<i class="advb-type" style="background:${G.U.TYPE_COLOR[t]}">${G.U.TYPE_NAME[t] || t}</i>`).join('');
    const balls = foe && B.trainer ? `<div class="advb-balls">${B.foes.map(f => `<i class="${f.hp > 0 ? '' : 'ko'}"></i>`).join('')}</div>` : '';
    el.innerHTML = `${balls}<div class="advb-nm"><b>${p.name}</b>${st}<span>N. ${m.lv}</span></div><div class="advb-types">${tps}</div>
      <div class="advb-hp"><small>PV</small><i><b style="width:${k * 100}%;background:${col}"></b></i></div>
      ${foe ? '' : `<div class="advb-hpn">${Math.max(0, Math.ceil(m.hp))} / ${mx}</div><div class="advb-xp"><b style="width:${clamp01(xpK) * 100}%"></b></div>`}`;
  }
  const clamp01 = v => Math.max(0, Math.min(1, v));
  function cards() {
    if (!B) return;
    if (B.foe) card($('advb-foe'), B.foe, true);
    if (B.me) card($('advb-me'), B.me, false);
  }
  /** Les PV qui descendent doucement. */
  function hpTo(m, to) {
    const from = m.hp;
    return tween(0.45, k => { m.hp = from + (to - from) * k; cards(); });
  }

  function menu(buttons) {
    $('advb-msg').classList.remove('on');
    const box = $('advb-menu');
    box.innerHTML = '';
    let k = 0;
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'advb-btn' + (b.cls ? ' ' + b.cls : '');
      el.dataset.k = b.cls === 'back' ? 'Échap' : ++k;
      el.innerHTML = b.html;
      if (b.color) el.style.setProperty('--bc', b.color);
      el.disabled = !!b.disabled;
      el.onclick = e => { e.stopPropagation(); G.Audio.sfx('click'); b.fn(); };
      box.appendChild(el);
    }
  }

  /** Le joueur choisit son action. */
  function chooseAction() {
    return new Promise(res => {
      const noPp = B.me.pp.every(n => n <= 0);
      const main = () => menu([
        { html: 'Attaque', cls: 'big', color: '#e05040', fn: noPp ? () => res({ type: 'move', id: 0 }) : attacks },
        { html: 'Sac', cls: 'big', color: '#e0a020', fn: bag },
        { html: 'Pokémon', cls: 'big', color: '#3ab060', disabled: stuck('me'), fn: team },
        { html: 'Fuite', cls: 'big', color: '#3a7ae0', disabled: !!B.trainer || (stuck('me') && ab('me') !== 'run-away'), fn: () => res({ type: 'run' }) }
      ]);
      const attacks = () => menu(B.me.moves.map((id, i) => {
        const mv = M.move(id), pw = M.power(id);
        const mul = mv.cls ? M.typeMul(mv.type, types(B.foe)) : 1;
        const eff = !mv.cls ? '' : mul === 0 ? '<em class="advb-eff no">Aucun effet</em>' : mul > 1 ? '<em class="advb-eff up">Super efficace</em>' : mul < 1 ? '<em class="advb-eff down">Peu efficace</em>' : '';
        return { html: `<b>${mv.name}${eff}</b><small>${G.U.TYPE_NAME[mv.type] || mv.type} · ${pw ? 'Puiss. ' + pw : mv.cls ? 'Fixe' : 'Statut'} · PP ${B.me.pp[i]}/${mv.pp}</small>`,
          color: G.U.TYPE_COLOR[mv.type], disabled: B.me.pp[i] <= 0, fn: () => res({ type: 'move', id, i }) };
      }).concat([{ html: 'Retour', cls: 'back', fn: main }]));
      const bag = () => {
        const s = G.Overworld.save();
        menu([
          { html: `<b>Potion</b><small>× ${s.potions} · +20 PV</small>`, color: '#a050d0', disabled: s.potions <= 0 || B.me.hp >= M.maxHp(B.me), fn: () => res({ type: 'potion' }) },
          { html: `<b>Super Potion</b><small>× ${s.superpo || 0} · +50 PV</small>`, color: '#d05090', disabled: !(s.superpo > 0) || B.me.hp >= M.maxHp(B.me), fn: () => res({ type: 'superpo' }) },
          { html: `<b>Antidote</b><small>× ${s.antidote || 0} · soigne le poison</small>`, color: '#8a50c0', disabled: !(s.antidote > 0) || !(B.me.st === 'psn' || B.me.st === 'tox'), fn: () => res({ type: 'antidote' }) },
          { html: `<b>Réveil</b><small>× ${s.awake || 0} · réveille</small>`, color: '#4a90d0', disabled: !(s.awake > 0) || B.me.st !== 'slp', fn: () => res({ type: 'awake' }) },
          { html: `<b>Total Soin</b><small>× ${s.cures || 0} · soigne le statut</small>`, color: '#e0a020', disabled: !(s.cures > 0) || !B.me.st, fn: () => res({ type: 'cure' }) },
          { html: 'Retour', cls: 'back', fn: main }
        ]);
      };
      const team = () => {
        const t = G.Overworld.save().team;
        menu(t.map((m, i) => ({ html: `<b>${M.name(m)}</b><small>N. ${m.lv} · ${Math.ceil(m.hp)}/${M.maxHp(m)} PV${m.st ? ' · ' + ST_NAME[m.st] : ''}</small>`,
          disabled: m.hp <= 0 || m === B.me, color: '#3ab060', fn: () => res({ type: 'switch', i }) })).concat([{ html: 'Retour', cls: 'back', fn: main }]));
      };
      main();
    });
  }

  /** Remplacement forcé (ton Pokémon est K.O.). */
  function chooseNext() {
    return new Promise(res => {
      $('advb-msg').textContent = 'Quel Pokémon envoyer ?';
      $('advb-msg').classList.add('on');
      const t = G.Overworld.save().team;
      const box = $('advb-menu');
      box.innerHTML = '';
      t.forEach((m, i) => {
        if (m.hp <= 0) return;
        const el = document.createElement('button');
        el.className = 'advb-btn';
        el.dataset.k = box.children.length + 1;
        el.style.setProperty('--bc', '#3ab060');
        el.innerHTML = `<b>${M.name(m)}</b><small>N. ${m.lv} · ${Math.ceil(m.hp)}/${M.maxHp(m)} PV</small>`;
        el.onclick = e => { e.stopPropagation(); res(i); };
        box.appendChild(el);
      });
    });
  }

  // ---------------- acteurs sur la carte ----------------
  function actor(m, x, y, face) {
    const a = { dex: m.dex, x, y, ox: 0, oy: 0, flash: 0, alpha: 1, scale: 1, face, anim: new G.Sprites.Animator(m.dex, 1, G.DB.ownsShiny(m.dex) && !face.foe) };
    a.anim.dir = G.Sprites.dirFromAngle(Math.atan2(face.y - y, face.x - x));
    a.anim.loop('Idle');
    G.Sprites.preload([m.dex], 6000, a.anim.shiny);
    return a;
  }
  function drawables() {
    if (!B) return [];
    return [B.aFoe, B.aMe].filter(Boolean).map(a => ({ y: a.y, draw(ctx) {
      if (a.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = a.alpha;
      const sc = a.scale * 1.3;   // un peu plus grands que sur la carte : on les voit bien pendant le combat
      ctx.translate(a.x, a.y); ctx.scale(sc, sc); ctx.translate(-a.x, -a.y);
      G.Sprites.drawShadow(ctx, a.dex, a.x + a.ox, a.y + a.oy, 1);
      a.anim.draw(ctx, a.x + a.ox, a.y + a.oy, { flash: a.flash > 0 });
      ctx.restore();
    } }));
  }

  /** Le terrain de combat dessiné au sol (un vrai terrain de stade pour les champions d'arène). */
  function drawFloor(ctx) {
    if (!B || !B.slotMe) return;
    const a = B.slotMe, b = B.slotFoe, cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 - 4;
    const ang = Math.atan2(b.y - a.y, b.x - a.x), len = Math.hypot(b.x - a.x, b.y - a.y);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(ang);
    const L = B.leader;
    if (L) {
      // Terrain du champion : rectangle aux couleurs de son type, ligne et rond central.
      const col = G.U.TYPE_COLOR[L.type] || '#c03030', W = len / 2 + 56, H = 62, t = B.t || 0;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-W - 6, -H - 6, W * 2 + 12, H * 2 + 12);
      ctx.fillStyle = col; ctx.globalAlpha = 0.32; ctx.fillRect(-W, -H, W * 2, H * 2);
      ctx.globalAlpha = 0.95; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.strokeRect(-W, -H, W * 2, H * 2);
      ctx.beginPath(); ctx.moveTo(0, -H); ctx.lineTo(0, H); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.2; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.2832); ctx.fill();
      // Les deux zones des Pokémon.
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#fff';
      for (const sx of [-len / 2, len / 2]) { ctx.beginPath(); ctx.ellipse(sx, 4, 30, 14, 0, 0, 6.2832); ctx.stroke(); }
    } else {
      // Combat normal : deux petits cercles lumineux sous les Pokémon.
      ctx.globalAlpha = 0.5;
      for (const [sx, c] of [[-len / 2, '#78b0ff'], [len / 2, '#ff7a6a']]) {
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(sx, 4, 28, 11, 0, 0, 6.2832); ctx.fill();
      }
    }
    ctx.restore();
  }
  /** L'entrée en combat : bandes noires comme dans les jeux, et une vraie présentation pour les champions d'arène. */
  function intro(opts) {
    const host = $('advb').parentNode;
    let el = $('advb-intro');
    if (!el) { el = document.createElement('div'); el.id = 'advb-intro'; host.appendChild(el); }
    const L = opts.trainer && opts.trainer.leader, tr = opts.trainer;
    if (L) {
      const col = G.U.TYPE_COLOR[L.type] || '#c03030', src = G.KantoArt.people[L.look] || '';
      el.className = 'leader';
      el.style.setProperty('--tc', col);
      el.innerHTML = `<div class="ai-stripes"></div><div class="ai-card">
        <div class="ai-pic" style="background-image:url(${src})"></div>
        <div class="ai-txt"><small>${L.title}</small><b>${tr.name}</b><p>« ${L.quote} »</p>
        <span class="ai-badge">Badge ${L.badge} · type ${G.U.TYPE_NAME[L.type] || L.type}</span></div></div>`;
    } else {
      el.className = 'bars';
      el.innerHTML = `<div class="ai-bar t"></div><div class="ai-bar b"></div>${tr ? `<div class="ai-vs">${tr.name} veut se battre !</div>` : ''}`;
    }
    void el.offsetWidth;
    el.classList.add('on');
    G.Audio.sfx(L ? 'legend' : 'select');
    const dur = L ? 3200 : tr ? 1300 : 800;
    return new Promise(res => {
      let done = false;
      const fin = () => { if (done) return; done = true; el.classList.remove('on'); el.onclick = null; setTimeout(() => { el.className = ''; el.innerHTML = ''; res(); }, 250); };
      el.onclick = e => { e.stopPropagation(); fin(); };
      setTimeout(fin, dur);
    });
  }

  // ---------------- règles des jeux ----------------
  const stageK = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
  const accK = s => (s >= 0 ? (3 + s) / 3 : 3 / (3 - s));
  const fresh = () => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 });
  const STAT_NAME = { atk: 'L\'Attaque', def: 'La Défense', spa: 'L\'Attaque Spéciale', spd: 'La Défense Spéciale', spe: 'La Vitesse', acc: 'La Précision', eva: 'L\'Esquive' };
  // Les attaques spéciales des jeux : recharge, attaques en 2 tours, piège (Ligotage…).
  const RECHARGE = new Set(['hyper-beam', 'giga-impact', 'blast-burn', 'hydro-cannon', 'frenzy-plant', 'rock-wrecker', 'roar-of-time']);
  const TWO = { 'solar-beam': ' absorbe la lumière !', 'sky-attack': ' est entouré d\'une lumière intense !', 'skull-bash': ' baisse la tête !',
    'razor-wind': ' crée un tourbillon !', fly: ' s\'envole très haut !', dig: ' creuse un trou !', dive: ' plonge sous l\'eau !',
    bounce: ' bondit très haut !', 'shadow-force': ' disparaît !' };
  const SEMI = { fly: ['gust', 'twister', 'thunder', 'sky-uppercut'], bounce: ['gust', 'twister', 'thunder', 'sky-uppercut'],
    dig: ['earthquake', 'magnitude', 'fissure'], dive: ['surf', 'whirlpool'], 'shadow-force': [] };
  const BIND = new Set(['wrap', 'bind', 'fire-spin', 'clamp', 'whirlpool', 'sand-tomb', 'magma-storm']);
  const SCREEN = { reflect: ['reflect', 'Protection', 'physiques'], 'light-screen': ['light', 'Mur Lumière', 'spéciales'] };
  /** L'action imposée : se recharger après Ultralaser, ou finir une attaque en 2 tours. */
  function forced(side) {
    const v = B.vol[side];
    if (v.recharge) return { type: 'recharge' };
    if (v.charge) return { type: 'move', id: v.charge };
    return null;
  }
  const other = side => (side === 'me' ? 'foe' : 'me');
  // ---------------- talents (comme dans les jeux, 3e et 4e génération) ----------------
  /** « de Raichu », « d'Arbok ». */
  const dl = side => { const t = label(side); return /^[AEIOUYÉÈÊÎaeiouyéèê]/.test(t) ? 'd\'' + t : 'de ' + t; };
  const abOf = m => (G.Talents ? G.Talents.idOf(m.dex) : '') || '';
  /** Le talent du Pokémon au combat de ce côté (Calque peut l'avoir copié). Brise Moule ignore celui de la cible. */
  function ab(side) { const m = mon(side); if (!m) return ''; return B.vol[side].abil || abOf(m); }
  function tab(side) { return B.breaker === other(side) ? '' : ab(side); }
  const abName = id => (G.TALENT_NAMES && G.TALENT_NAMES[id]) || id;
  async function abSay(side, txt) { FX().stat(act(side).x, act(side).y - 10, true); await say(abName(ab(side)) + ' ' + dl(side) + ' : ' + txt, 1.1); }
  const AB_IMMUNE = { psn: ['immunity'], tox: ['immunity'], par: ['limber'], slp: ['insomnia', 'vital-spirit'], brn: ['water-veil'], frz: ['magma-armor'], cnf: ['own-tempo'] };
  const SOUND = new Set(['growl', 'roar', 'sing', 'supersonic', 'screech', 'snore', 'uproar', 'metal-sound', 'grass-whistle', 'hyper-voice', 'bug-buzz', 'perish-song', 'heal-bell', 'chatter']);
  const OHKO = new Set(['fissure', 'guillotine', 'horn-drill', 'sheer-cold']);
  const PINCH = { overgrow: 'grass', blaze: 'fire', torrent: 'water', swarm: 'bug' };
  /** À l'entrée en combat : Intimidation, Calque, Marque Ombre… */
  async function entry(side) {
    const o = other(side);
    if (!mon(side) || !mon(o) || mon(side).hp <= 0) return;
    if (ab(side) === 'trace' && abOf(mon(o)) && abOf(mon(o)) !== 'trace') {
      B.vol[side].abil = abOf(mon(o));
      await say('Calque ' + dl(side) + ' copie ' + abName(B.vol[side].abil) + ' !', 1.1);
    }
    if (ab(side) === 'intimidate' && mon(o).hp > 0) {
      await abSay(side, 'il intimide ' + label(o) + ' !');
      await changeStat(o, 'atk', -1, side);
    }
    if (ab(side) === 'pressure') await say(label(side) + ' exerce une Pression !', 1);
    if (ab(side) === 'mold-breaker') await say(label(side) + ' brise le moule !', 1);
  }
  /** On ne peut ni fuir ni changer (Marque Ombre, Magnépiège contre un Acier, piégé). */
  function stuck(side) {
    const o = other(side);
    if (B.vol[side].bind) return true;
    if (ab(o) === 'shadow-tag' && ab(side) !== 'shadow-tag') return true;
    if (ab(o) === 'magnet-pull' && types(mon(side)).includes('steel')) return true;
    return false;
  }
  const mon = side => (side === 'me' ? B.me : B.foe);
  const act = side => (side === 'me' ? B.aMe : B.aFoe);
  const label = side => (side === 'foe' ? (B.wild ? M.name(B.foe) + ' sauvage' : M.name(B.foe) + ' ennemi') : M.name(B.me));
  const types = m => G.DEX_BY[m.dex].types;
  function speed(side) {
    const m = mon(side);
    return M.stat(m, 'spe') * stageK(B.stages[side].spe) * (m.st === 'par' ? 0.25 : 1);
  }
  const pt = a => ({ x: a.x + a.ox, y: a.y - 22 });

  /** Peut-on lui infliger ce statut ? (immunités de type des jeux) */
  function canAil(m, st) {
    const a = B && B.me === m ? tab('me') : B && B.foe === m ? tab('foe') : abOf(m);
    if ((AB_IMMUNE[st] || []).includes(a)) return false;
    if (st === 'cnf') return true;
    if (m.st || m.hp <= 0) return false;
    const t = types(m);
    if (st === 'brn' && t.includes('fire')) return false;
    if (st === 'frz' && t.includes('ice')) return false;
    if ((st === 'psn' || st === 'tox') && (t.includes('poison') || t.includes('steel'))) return false;
    return true;
  }
  async function inflict(side, st) {
    const m = mon(side), a = act(side);
    if (st === 'cnf') {
      if (B.vol[side].cnf) { await say(label(side) + ' est déjà confus.', 1); return false; }
      B.vol[side].cnf = 2 + Math.floor(Math.random() * 4);
      FX().ail(a.x, a.y - 22, 'cnf');
      await say(label(side) + ' devient confus !', 1.1);
      return true;
    }
    if (!canAil(m, st)) return false;
    m.st = st;
    // Rouge Feu : on dort de 1 à 4 tours (le compteur baisse avant chaque action).
    if (st === 'slp') m.sleep = 2 + Math.floor(Math.random() * 4);
    if (st === 'tox') B.vol[side].tox = 1;
    FX().ail(a.x, a.y - 22, st === 'tox' ? 'psn' : st);
    G.Audio.sfx('select');
    cards();
    await say(label(side) + ({ par: ' est paralysé ! Il aura du mal à attaquer.', slp: ' s\'endort !', frz: ' est gelé !', brn: ' est brûlé !', psn: ' est empoisonné !', tox: ' est gravement empoisonné !' })[st], 1.2);
    return true;
  }
  async function changeStat(side, k, n, src) {
    const sg = B.stages[side], a = act(side), t = src && src !== side ? tab(side) : ab(side);
    // Corps Sain, Écran Fumée, Hyper Cutter, Regard Vif : l'adversaire ne baisse pas ses stats.
    if (n < 0 && src && src !== side && (t === 'clear-body' || t === 'white-smoke' || (t === 'hyper-cutter' && k === 'atk') || (t === 'keen-eye' && k === 'acc'))) {
      await say(abName(t) + ' ' + dl(side) + ' empêche la baisse !', 1); return;
    }
    if (n < 0 && src && src !== side && B.scr[side].mist) { await say('La Brume protège ' + label(side) + ' !', 1); return; }
    if (t === 'simple') n *= 2;
    if ((n > 0 && sg[k] >= 6) || (n < 0 && sg[k] <= -6)) { await say(STAT_NAME[k] + ' ' + dl(side) + ' ne peut plus ' + (n > 0 ? 'monter' : 'baisser') + ' !', 1); return; }
    sg[k] = Math.max(-6, Math.min(6, sg[k] + n));
    FX().stat(a.x, a.y - 10, n > 0);
    G.Audio.sfx(n > 0 ? 'levelup' : 'select');
    await say(STAT_NAME[k] + ' ' + dl(side) + (n > 0 ? (n > 1 ? ' augmente beaucoup !' : ' augmente !') : (n < -1 ? ' baisse beaucoup !' : ' baisse !')), 1);
  }

  /** Avant d'agir : sommeil, gel, paralysie, peur, confusion. Rend false si le Pokémon ne peut pas agir. */
  async function canAct(side, id) {
    const m = mon(side), v = B.vol[side];
    if (ab(side) === 'truant') {
      // Absentéisme : un tour sur deux, il paresse.
      v.loaf = !v.loaf;
      if (!v.loaf) { await say(label(side) + ' paresse…', 1); return false; }
    }
    if (m.st === 'slp') {
      const k = id && M.move(id).key;
      if (ab(side) === 'early-bird') m.sleep--;   // Matinal : se réveille deux fois plus vite
      if (--m.sleep > 0) {
        FX().ail(act(side).x, act(side).y - 30, 'slp');
        await say(label(side) + ' dort profondément…', 1);
        // Ronflement et Blabla Dodo marchent justement en dormant.
        return k === 'snore' || k === 'sleep-talk';
      }
      m.st = ''; cards();
      await say(label(side) + ' se réveille !', 1);
    }
    if (m.st === 'frz') {
      if (Math.random() < 0.2) { m.st = ''; cards(); await say(label(side) + ' n\'est plus gelé !', 1); }
      else { await say(label(side) + ' est gelé ! Il ne peut pas bouger !', 1); return false; }
    }
    if (v.flinch) { v.flinch = 0; await say(label(side) + ' a peur ! Il n\'attaque pas !', 1); if (ab(side) === 'steadfast') await changeStat(side, 'spe', 1); return false; }
    if (v.cnf) {
      if (--v.cnf <= 0) { v.cnf = 0; await say(label(side) + ' n\'est plus confus !', 1); }
      else {
        await say(label(side) + ' est confus…', 0.8);
        if (Math.random() < 1 / 2) {   // Rouge Feu : une chance sur deux de se blesser
          const dmg = Math.max(1, Math.floor(((2 * m.lv / 5 + 2) * 40 * M.stat(m, 'atk') / M.stat(m, 'def')) / 50 + 2));
          act(side).flash = 1; G.Audio.sfx('hit');
          await wait(0.15); act(side).flash = 0;
          await hpTo(m, Math.max(0, m.hp - dmg));
          await say('Il se blesse dans sa confusion !', 1);
          return false;
        }
      }
    }
    if (m.st === 'par' && Math.random() < 0.25) { FX().ail(act(side).x, act(side).y - 22, 'par'); await say(label(side) + ' est paralysé ! Il ne peut pas attaquer !', 1.1); return false; }
    return true;
  }

  /** Une attaque, avec toutes ses règles. id 0 = Lutte (plus de PP). */
  async function useMove(side, id, called) {
    const user = mon(side), tside = other(side), target = mon(tside);
    const ua = act(side), ta = act(tside);
    const v = B.vol[side], tv = B.vol[tside];
    const unhide = () => { if (v.semi) { v.semi = ''; ua.alpha = v.sub ? 0.6 : 1; } };
    if (!called) B.lastBoom = null;
    if (!called && !(await canAct(side, id))) { v.charge = 0; unhide(); return; }
    const struggle = !id;
    const mv = struggle ? { name: 'Lutte', type: 'normal', cls: 1, power: 50, acc: 0, stats: [], drain: -25, hitMin: 0, flinch: 0, crit: 0, key: 'struggle' } : M.move(id);
    const second = v.charge === id && !!id;   // 2e tour d'une attaque en 2 tours : pas de PP en plus
    if (!struggle && !called && !second) { const i = user.moves.indexOf(id); if (i >= 0 && user.pp[i] > 0) user.pp[i] -= ab(tside) === 'pressure' && user.pp[i] > 1 ? 2 : 1; }
    B.breaker = ab(side) === 'mold-breaker' ? side : null;
    if (mv.key !== 'protect' && mv.key !== 'detect') v.protN = 0;
    if (second) { v.charge = 0; unhide(); }
    else await say(label(side) + ' utilise ' + mv.name + ' !', 0.9);
    // 1er tour d'une attaque en 2 tours : on se prépare (et on se cache pour Vol, Tunnel, Plongée…).
    if (TWO[mv.key] && !second) {
      v.charge = id;
      await say(label(side) + TWO[mv.key], 1);
      if (SEMI[mv.key]) { v.semi = mv.key; await tween(0.2, k => { ua.alpha = 1 - k * 0.85; }); }
      if (mv.key === 'skull-bash') await changeStat(side, 'def', 1);
      return;
    }
    if (second) await say(label(side) + ' lance ' + mv.name + ' !', 0.9);
    B.lastBoom = mv.key === 'self-destruct' || mv.key === 'explosion' ? side : null;
    const fail = async () => { await say('Mais cela échoue !', 1); };
    // Les attaques spéciales des jeux.
    if ((mv.key === 'snore' || mv.key === 'sleep-talk') && user.st !== 'slp') return fail();
    if (mv.key === 'sleep-talk') {
      const ids = user.moves.filter(x => x !== id && !['sleep-talk', 'rest', 'yawn'].includes(M.move(x).key));
      if (!ids.length) return fail();
      return useMove(side, ids[Math.floor(Math.random() * ids.length)], true);
    }
    if (mv.key === 'rest') {
      if (user.hp >= M.maxHp(user)) { await say('Les PV ' + dl(side) + ' sont au maximum !', 1); return; }
      user.st = 'slp'; user.sleep = 3; B.vol[side].tox = 0;
      FX().heal(ua.x, ua.y - 20); FX().ail(ua.x, ua.y - 30, 'slp');
      G.Audio.sfx('levelup');
      cards();
      await hpTo(user, M.maxHp(user));
      await say(label(side) + ' s\'endort et récupère tous ses PV !', 1.2);
      return;
    }
    if (mv.key === 'dream-eater' && target.st !== 'slp') {
      if (mv.acc) await say(label(tside) + ' ne dort pas…', 0.9);
      return fail();
    }

    if (mv.key === 'protect' || mv.key === 'detect') {
      // Abri et Détection : de moins en moins de chances de réussir si on les enchaîne.
      if (B.order[1] === side || Math.random() >= 1 / Math.pow(2, v.protN || 0)) { v.protN = 0; return fail(); }
      v.protN = (v.protN || 0) + 1; v.protect = 1;
      FX().stat(ua.x, ua.y - 10, true); G.Audio.sfx('levelup');
      await say(label(side) + ' se protège !', 1);
      return;
    }
    if (mv.key === 'substitute') {
      const cost = Math.floor(M.maxHp(user) / 4);
      if (v.sub) { await say(label(side) + ' a déjà un clone !', 1); return; }
      if (user.hp <= cost) { await say('Trop faible pour créer un clone !', 1); return; }
      await hpTo(user, user.hp - cost);
      v.sub = cost;
      await tween(0.2, k => { ua.alpha = 1 - k * 0.4; });
      await say(label(side) + ' crée un clone !', 1);
      return;
    }
    if (mv.key === 'mist') {
      if (B.scr[side].mist) return fail();
      B.scr[side].mist = 5;
      FX().stat(ua.x, ua.y - 10, true);
      await say((side === 'me' ? 'Ton équipe' : 'L\'équipe adverse') + ' est entourée de Brume !', 1.1);
      return;
    }
    if (SCREEN[mv.key]) {
      const [k, nm, cl] = SCREEN[mv.key];
      if (B.scr[side][k]) return fail();
      B.scr[side][k] = 5;
      FX().stat(ua.x, ua.y - 10, true); G.Audio.sfx('levelup');
      await say(nm + ' augmente la résistance aux attaques ' + cl + ' !', 1.1);
      return;
    }
    if ((mv.key === 'self-destruct' || mv.key === 'explosion') && (tab(tside) === 'damp' || ab(side) === 'damp')) {
      B.lastBoom = null; await say('Moiteur empêche l\'explosion !', 1); return;
    }
    // Talents qui protègent la cible : Lévitation, Absorbe-Eau, Absorbe-Volt, Torche, Motorisé, Anti-Bruit, Garde Mystik, Fermeté.
    if (!mv.self && mv.key !== 'struggle') {
      const t = tab(tside), immune = async txt => { await say(abName(t) + ' ' + dl(tside) + ' : ' + txt, 1.1); };
      if (t === 'levitate' && mv.type === 'ground' && mv.cls) return immune('il flotte au-dessus du sol !');
      if ((t === 'water-absorb' && mv.type === 'water') || (t === 'volt-absorb' && mv.type === 'electric')) {
        if (target.hp < M.maxHp(target)) { FX().heal(ta.x, ta.y - 20); await hpTo(target, Math.min(M.maxHp(target), target.hp + Math.floor(M.maxHp(target) / 4))); }
        return immune('il absorbe l\'attaque et récupère des PV !');
      }
      if (t === 'flash-fire' && mv.type === 'fire') { tv.flash = 1; return immune('ses attaques Feu deviennent plus fortes !'); }
      if (t === 'motor-drive' && mv.type === 'electric') { await immune('il absorbe l\'électricité !'); return changeStat(tside, 'spe', 1); }
      if (t === 'soundproof' && SOUND.has(mv.key)) return immune('il n\'entend rien !');
      if (t === 'sturdy' && OHKO.has(mv.key)) return immune('il tient bon !');
      if (t === 'wonder-guard' && mv.cls && !(M.typeMul(mv.type, types(target)) > 1)) return immune('l\'attaque n\'a aucun effet !');
    }
    // La cible se protège, ou elle est cachée (Vol, Tunnel…).
    if (!mv.self && tv.protect) { await say(label(tside) + ' se protège !', 1); return; }
    if (!mv.self && tv.semi && !SEMI[tv.semi].includes(mv.key)) { await say(label(tside) + ' évite l\'attaque !', 1); return; }
    // Le clone bloque les attaques de statut.
    if (!mv.cls && !mv.self && tv.sub && (mv.ail || mv.stats.length || mv.key === 'leech-seed' || mv.key === 'yawn')) return fail();
    // Précision (les attaques sur soi touchent toujours).
    if (mv.acc && !mv.self) {
      const k = accK(Math.max(-6, Math.min(6, B.stages[side].acc - B.stages[tside].eva))) * (ab(side) === 'compound-eyes' ? 1.3 : 1) * (ab(side) === 'hustle' && mv.cls === 1 ? 0.8 : 1);
      if (Math.random() * 100 >= mv.acc * k) { await say(label(side) + ' rate son attaque !', 1); return; }
    }

    // Élan vers la cible.
    const dx = ta.x - ua.x, dy = ta.y - ua.y, d = Math.hypot(dx, dy) || 1;
    ua.anim.play('Attack');
    const lunge = mv.cls === 2 || !mv.cls ? 10 : 26;
    await tween(0.16, k => { ua.ox = dx / d * lunge * k; ua.oy = dy / d * lunge * k; });

    if (!mv.cls) {
      await tween(0.16, k => { ua.ox = dx / d * lunge * (1 - k); ua.oy = dy / d * lunge * (1 - k); });
      let did = false;
      if (mv.heal > 0) {
        if (user.hp >= M.maxHp(user)) { await say('Les PV ' + dl(side) + ' sont au maximum !', 1); return; }
        FX().heal(ua.x, ua.y - 20);
        G.Audio.sfx('levelup');
        await hpTo(user, Math.min(M.maxHp(user), user.hp + Math.round(M.maxHp(user) * mv.heal / 100)));
        await say(label(side) + ' récupère des PV !', 1);
        did = true;
      }
      if (mv.stats.length) {
        if (!mv.self) await FX().attack(mv.type, pt(ua), pt(ta), 2);
        for (const [k, n] of mv.stats) await changeStat(mv.self ? side : tside, k, n, side);
        did = true;
      }
      if (mv.key === 'leech-seed') {
        await FX().attack(mv.type, pt(ua), pt(ta), 2);
        if (types(target).includes('grass') || B.vol[tside].seed) { await say(types(target).includes('grass') ? 'Ça n\'affecte pas ' + label(tside) + '…' : label(tside) + ' est déjà infecté.', 1); return; }
        B.vol[tside].seed = 1;
        await say(label(tside) + ' est infecté !', 1);
        return;
      }
      if (mv.key === 'yawn') {
        await FX().attack(mv.type, pt(ua), pt(ta), 2);
        if (target.st || B.vol[tside].yawn) return fail();
        B.vol[tside].yawn = 2;
        await say(label(side) + ' rend ' + label(tside) + ' somnolent !', 1);
        return;
      }
      if (mv.ail) {
        const tgt = mv.self ? side : tside;
        // Cage Éclair et les autres attaques de statut Électrik ne touchent pas les Pokémon Sol.
        if (mv.type === 'electric' && !mv.self && M.typeMul('electric', types(mon(tgt))) === 0) { await say('Ça n\'affecte pas ' + label(tgt) + '…', 1.1); return; }
        await FX().attack(mv.type, pt(ua), pt(act(tgt)), 2);
        const st = mv.key === 'toxic' ? 'tox' : mv.ail;
        if (!(await inflict(tgt, st))) await say('Mais cela échoue !', 1);
        else if (tgt !== side) await sync(tgt, st);
        did = true;
      }
      if (!did) await say('Mais rien ne se passe…', 1);
      return;
    }

    // Dégâts.
    const mul = M.typeMul(mv.type, types(target));
    const hits = mv.hitMin ? mv.hitMin + Math.floor(Math.random() * (mv.hitMax - mv.hitMin + 1)) : 1;
    let total = 0, n = 0, crits = 0, hitSub = false;
    const phys = mv.cls === 1;
    for (; n < hits && target.hp > 0; n++) {
      await FX().attack(mv.type, pt(ua), pt(ta), mv.cls);
      let dmg;
      if (M.FIXED[mv.key]) dmg = mul ? M.FIXED[mv.key](user, target) : 0;
      else {
        const ta2 = tab(tside), ua2 = ab(side);
        const crit = ta2 !== 'shell-armor' && ta2 !== 'battle-armor' && Math.random() < [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2][Math.min(4, mv.crit || 0)];
        if (crit && mul) crits++;
        // Coup critique : on ignore les baisses de l'attaquant et les hausses de la cible.
        const as = B.stages[side][phys ? 'atk' : 'spa'], ds = B.stages[tside][phys ? 'def' : 'spd'];
        const guts = ua2 === 'guts' && user.st;
        const atk = M.stat(user, phys ? 'atk' : 'spa') * stageK(crit ? Math.max(0, as) : as) * (phys && user.st === 'brn' && !guts ? 0.5 : 1)
          * (phys && guts ? 1.5 : 1) * (phys && ua2 === 'hustle' ? 1.5 : 1) * (phys && (ua2 === 'pure-power' || ua2 === 'huge-power') ? 2 : 1);
        const def = M.stat(target, phys ? 'def' : 'spd') * stageK(crit ? Math.min(0, ds) : ds) * (phys && ta2 === 'marvel-scale' && target.st ? 1.5 : 1);
        const stab = types(user).includes(mv.type) ? (ua2 === 'adaptability' ? 2 : 1.5) : 1;
        let pow = mv.power || 60;
        if (ua2 === 'technician' && pow <= 60) pow *= 1.5;
        if (PINCH[ua2] === mv.type && user.hp <= M.maxHp(user) / 3) pow *= 1.5;   // Engrais, Brasier, Torrent, Essaim
        if (B.vol[side].flash && mv.type === 'fire') pow *= 1.5;
        if (ta2 === 'thick-fat' && (mv.type === 'fire' || mv.type === 'ice')) pow *= 0.5;
        dmg = Math.floor(((2 * user.lv / 5 + 2) * pow * atk / def) / 50 + 2);
        // Protection et Mur Lumière divisent les dégâts par 2 (sauf coup critique).
        const scr = !crit && (phys ? B.scr[tside].reflect : B.scr[tside].light) ? 0.5 : 1;
        dmg = Math.max(mul ? 1 : 0, Math.floor(dmg * stab * mul * scr * (crit ? 2 : 1) * (0.85 + Math.random() * 0.15)));
      }
      G.Audio.sfx(mul > 1 ? 'crit' : 'hit');
      ta.flash = 1;
      if (mul) ta.anim.play('Hurt');
      if (G.Overworld.fx && dmg) G.Overworld.fx(ta.x, ta.y - 22, G.U.TYPE_COLOR[mv.type] || '#fff', dmg);
      await tween(0.16, k => { if (n === 0) { ua.ox = dx / d * lunge * (1 - k); ua.oy = dy / d * lunge * (1 - k); } ta.ox = Math.sin(k * 25) * 5 * (1 - k); });
      ta.flash = 0; ta.ox = 0;
      if (tv.sub && mul) {
        // Le clone encaisse à la place du Pokémon.
        dmg = Math.min(dmg, tv.sub); tv.sub -= dmg; total += dmg; hitSub = true;
        if (n === 0) await say('Le clone encaisse les dégâts à la place ' + dl(tside) + ' !', 0.9);
        if (tv.sub <= 0) { tv.sub = 0; ta.alpha = 1; await say('Le clone ' + dl(tside) + ' disparaît !', 1); break; }
        continue;
      }
      dmg = Math.min(dmg, Math.ceil(target.hp));
      total += dmg;
      await hpTo(target, Math.max(0, target.hp - dmg));
      if (!mul) break;
    }
    ua.ox = ua.oy = 0;
    if (crits) await say(crits > 1 ? 'Coups critiques !' : 'Coup critique !', 0.9);
    if (mul > 1) await say('C\'est super efficace !', 1);
    else if (mul === 0) { await say('Ça n\'affecte pas ' + label(tside) + '…', 1.1); return; }
    else if (mul < 1) await say('Ce n\'est pas très efficace…', 1);
    if (hits > 1) await say('Touché ' + n + ' fois !', 0.9);
    // Le dégel par une attaque Feu.
    if (target.st === 'frz' && mv.type === 'fire' && target.hp > 0) { target.st = ''; cards(); await say(label(tside) + ' n\'est plus gelé !', 1); }

    // Vol de vie / contrecoup.
    if (mv.drain > 0 && user.hp > 0 && total && tab(tside) === 'liquid-ooze') {
      await hpTo(user, Math.max(0, user.hp - Math.max(1, Math.floor(total * mv.drain / 100))));
      await say('Suintement : ' + label(side) + ' aspire un liquide toxique !', 1);
    } else if (mv.drain > 0 && user.hp > 0 && total) {
      FX().heal(ua.x, ua.y - 20);
      await hpTo(user, Math.min(M.maxHp(user), user.hp + Math.max(1, Math.floor(total * mv.drain / 100))));
      await say(label(tside) + ' perd de l\'énergie !', 0.9);
    } else if (mv.drain < 0 && total && (struggle || ab(side) !== 'rock-head')) {
      const r = struggle ? Math.max(1, Math.floor(M.maxHp(user) / 4)) : Math.max(1, Math.floor(total * -mv.drain / 100));
      ua.flash = 1; await wait(0.12); ua.flash = 0;
      await hpTo(user, Math.max(0, user.hp - r));
      await say(label(side) + ' subit le contrecoup !', 0.9);
    }
    if (RECHARGE.has(mv.key) && user.hp > 0) v.recharge = 1;
    // Talents au contact (attaques physiques) : Statik, Point Poison, Corps Ardent, Pose Spore, Peau Dure, Boom Final.
    if (phys && total && !hitSub && user.hp > 0) {
      const t = tab(tside), CON = { static: 'par', 'poison-point': 'psn', 'flame-body': 'brn' };
      let st = CON[t];
      if (t === 'effect-spore') st = G.U.pick(['par', 'psn', 'slp']);
      if (st && Math.random() < 0.3 && canAil(user, st)) { await say(abName(t) + ' ' + dl(tside) + ' !', 0.9); await inflict(side, st); }
      if (t === 'rough-skin') { await hpTo(user, Math.max(0, user.hp - Math.max(1, Math.floor(M.maxHp(user) / 16)))); await say('Peau Dure ' + dl(tside) + ' blesse ' + label(side) + ' !', 1); }
      if (t === 'aftermath' && target.hp <= 0) { await hpTo(user, Math.max(0, user.hp - Math.max(1, Math.floor(M.maxHp(user) / 4)))); await say('Boom Final ' + dl(tside) + ' !', 1); }
    }
    if (hitSub) return;
    // Ligotage, Danse Flamme, Étreinte… : la cible est piégée de 2 à 5 tours.
    if (BIND.has(mv.key) && target.hp > 0 && !tv.bind) {
      tv.bind = { n: 2 + Math.floor(Math.random() * 4), name: mv.name };
      await say(label(tside) + ' est piégé par ' + mv.name + ' !', 1);
    }
    // Effets secondaires (Écran Poudre les bloque, Sérénité double leurs chances).
    if (tab(tside) === 'shield-dust') return;
    const sg = ab(side) === 'serene-grace' ? 2 : 1;
    if (target.hp > 0 && mv.ail && Math.random() * 100 < (mv.ailCh || 100) * sg && canAil(target, mv.ail) && !(mv.ail === 'cnf' && B.vol[tside].cnf) && (await inflict(tside, mv.ail))) await sync(tside, mv.ail);
    // Triplattaque : 20 % de brûler, paralyser ou geler.
    if (mv.key === 'tri-attack' && target.hp > 0 && Math.random() < 0.2) { const st = G.U.pick(['brn', 'par', 'frz']); if (canAil(target, st)) await inflict(tside, st); }
    if (mv.stats.length && Math.random() * 100 < (mv.statCh || 100) * sg) {
      const who = mv.self ? side : tside;
      if (mon(who).hp > 0) for (const [k, v] of mv.stats) await changeStat(who, k, v, side);
    }
    if (mv.flinch && target.hp > 0 && Math.random() * 100 < mv.flinch * sg && B.order[0] === side && tab(tside) !== 'inner-focus') B.vol[tside].flinch = 1;
  }
  /** Synchro : le statut reçu est renvoyé à l'adversaire. */
  async function sync(side, st) {
    if (ab(side) !== 'synchronize' || !['brn', 'par', 'psn', 'tox'].includes(st)) return;
    const o = other(side);
    if (!canAil(mon(o), st)) return;
    await say('Synchro ' + dl(side) + ' !', 0.9);
    await inflict(o, st);
  }

  /** Fin du tour : brûlure et poison. */
  async function endTurn(side) {
    const m = mon(side), v = B.vol[side];
    if (v) v.protect = 0;
    if (!m || m.hp <= 0) return;
    const a = act(side), hurt = async n => { a.flash = 1; await wait(0.12); a.flash = 0; await hpTo(m, Math.max(0, m.hp - n)); };
    if (m.st === 'brn' || m.st === 'psn' || m.st === 'tox') {
      FX().ail(a.x, a.y - 22, m.st === 'tox' ? 'psn' : m.st);
      // Toxik : 1/16 des PV, puis 2/16, 3/16… à chaque tour.
      const n = m.st === 'tox' ? Math.floor(M.maxHp(m) * Math.min(15, v.tox = (v.tox || 0) + 1) / 16) : Math.floor(M.maxHp(m) / 8);
      await hurt(Math.max(1, n));
      await say(label(side) + (m.st === 'brn' ? ' souffre de sa brûlure !' : ' souffre du poison !'), 1);
    }
    // Vampigraine : 1/8 des PV, rendus à l'adversaire.
    const o = mon(other(side));
    if (v.seed && m.hp > 0 && o && o.hp > 0) {
      const n = Math.min(Math.ceil(m.hp), Math.max(1, Math.floor(M.maxHp(m) / 8)));
      await hurt(n);
      FX().heal(act(other(side)).x, act(other(side)).y - 20);
      await hpTo(o, Math.min(M.maxHp(o), o.hp + n));
      await say('Vampigraine draine l\'énergie ' + dl(side) + ' !', 1);
    }
    // Piégé (Ligotage…) : 1/16 des PV à chaque tour.
    if (v.bind && m.hp > 0) {
      if (--v.bind.n <= 0) { await say(label(side) + ' est libéré de ' + v.bind.name + ' !', 1); v.bind = 0; }
      else { await hurt(Math.max(1, Math.floor(M.maxHp(m) / 16))); await say(label(side) + ' souffre de ' + v.bind.name + ' !', 1); }
    }
    if (m.hp > 0 && m.st && ab(side) === 'shed-skin' && Math.random() < 1 / 3) { m.st = ''; v.tox = 0; cards(); await abSay(side, 'il guérit de son statut !'); }
    if (m.hp > 0 && m.st === 'slp' && o && o.hp > 0 && ab(other(side)) === 'bad-dreams') { await hurt(Math.max(1, Math.floor(M.maxHp(m) / 8))); await say(label(side) + ' est tourmenté par un Mauvais Rêve !', 1); }
    if (m.hp > 0 && ab(side) === 'speed-boost' && B.stages[side].spe < 6) await changeStat(side, 'spe', 1);
    // Bâillement : il s'endort à la fin du tour suivant.
    if (v.yawn && m.hp > 0 && --v.yawn === 0 && canAil(m, 'slp')) await inflict(side, 'slp');
  }

  // ---------------- l'adversaire ----------------
  /** Valeur d'une attaque pour l'adversaire. */
  function scoreMove(id, user, target, us, ts) {
    const mv = M.move(id);
    if ((mv.key === 'snore' && user.st !== 'slp') || (mv.key === 'dream-eater' && target.st !== 'slp')) return 0;
    if (!mv.cls) {
      let v = 0;
      if (mv.heal > 0) v = user.hp < M.maxHp(user) * 0.5 ? 70 : 0;
      if (mv.ail && canAil(target, mv.ail) && !(mv.ail === 'cnf' && B.vol[ts].cnf) && !(mv.type === 'electric' && M.typeMul('electric', types(target)) === 0))
        v = Math.max(v, { slp: 60, par: 50, psn: mv.key === 'toxic' ? 50 : 40, brn: 40, cnf: 35, frz: 30 }[mv.ail] * (mv.acc ? mv.acc / 100 : 1));
      if (mv.key === 'leech-seed' && !B.vol[ts].seed && !types(target).includes('grass')) v = Math.max(v, 40);
      if (mv.key === 'yawn' && !target.st && !B.vol[ts].yawn) v = Math.max(v, 35);
      if (mv.key === 'protect' || mv.key === 'detect') v = B.vol[us].protN ? 0 : 12;
      if (mv.key === 'substitute') v = !B.vol[us].sub && user.hp > M.maxHp(user) * 0.6 ? 30 : 0;
      if (SCREEN[mv.key]) v = B.scr[us][SCREEN[mv.key][0]] ? 0 : 28;
      if (mv.key === 'mist') v = B.scr[us].mist ? 0 : 15;
      if (mv.key === 'rest') v = user.hp < M.maxHp(user) * 0.4 && !user.st ? 65 : 0;
      if ((mv.key === 'sleep-talk') && user.st !== 'slp') v = 0;
      if (mv.stats.length) {
        const [k, n] = mv.stats[0];
        if (mv.self && B.stages[us][k] < 2 && user.hp > M.maxHp(user) * 0.6) v = Math.max(v, 30);
        if (!mv.self && B.stages[ts][k] > -2) v = Math.max(v, 18);
      }
      return v;
    }
    const mul = M.typeMul(mv.type, types(target));
    const stab = types(user).includes(mv.type) ? 1.5 : 1;
    const pw = M.FIXED[mv.key] ? 45 : (mv.power || 60) * (mv.hitMin ? (mv.hitMin + mv.hitMax) / 2 : 1);
    return pw * mul * stab * (mv.acc ? mv.acc / 100 : 1) * (RECHARGE.has(mv.key) || TWO[mv.key] ? 0.6 : 1);
  }
  /** Ce que fait l'adversaire : attaque (les dresseurs visent juste), Potion ou changement (dresseurs malins). */
  function foeAction() {
    const f = B.foe, usable = f.moves.filter((id, i) => f.pp[i] > 0);
    if (!usable.length) return { type: 'move', id: 0 };
    if (B.wild) return { type: 'move', id: G.U.pick(usable) };
    const tr = B.trainer;
    if (tr.smart) {
      if (B.foePotions > 0 && f.hp < M.maxHp(f) * 0.3 && f.hp > 0 && Math.random() < 0.7) return { type: 'potion' };
      // Changer si le Pokémon en face le domine.
      const threat = Math.max(...B.me.moves.map(id => M.move(id).cls ? M.typeMul(M.move(id).type, types(f)) : 0));
      if (threat >= 2 && !B.switched && !stuck('foe') && Math.random() < 0.6) {
        let best = -1, bv = 0;
        B.foes.forEach((o, i) => {
          if (i === B.fi || o.hp <= 0) return;
          const t2 = Math.max(...B.me.moves.map(id => M.move(id).cls ? M.typeMul(M.move(id).type, types(o)) : 0));
          if (t2 < threat && o.hp / M.maxHp(o) > bv) { bv = o.hp / M.maxHp(o); best = i; }
        });
        if (best >= 0) return { type: 'switch', i: best };
      }
    }
    let best = usable[0], bv = -1;
    for (const id of usable) {
      const v = scoreMove(id, f, B.me, 'foe', 'me') * (0.8 + Math.random() * 0.4);
      if (v > bv) { bv = v; best = id; }
    }
    return { type: 'move', id: best };
  }

  async function faint(side) {
    const a = act(side), m = mon(side);
    a.anim.play('Faint', { hold: true });
    G.Audio.sfx('faint');
    await tween(0.5, k => { a.alpha = 1 - k; });
    await say(label(side) + ' est K.O. !', 1.1);
    B.vol[side] = {};
    if (B.vol[other(side)]) B.vol[other(side)].bind = 0;
    if (side === 'me') m.st = '';
  }

  /** Expérience après un K.O. adverse (le Pokémon au combat, et un tiers pour les autres). */
  async function gainXp() {
    const foe = B.foe, p = G.DEX_BY[foe.dex];
    const total = Math.floor(p.bst / 5 * foe.lv / 7 * (B.trainer ? 1.5 : 1));
    const team = G.Overworld.save().team;
    // Version de Nika : Multi Exp naturel, toujours actif : les autres Pokémon de l'équipe gagnent la moitié de l'expérience.
    const share = true;
    if (team.some(m => m !== B.me && m.hp > 0)) await say('Le reste de l\'équipe gagne ' + Math.floor(total / 2) + ' points (Multi Exp) !', 1.1);
    for (const m of team) {
      if (m.hp <= 0) continue;
      const xp = m === B.me ? total : share ? Math.floor(total / 2) : 0;
      if (xp <= 0) continue;
      m.xp += xp;
      if (m === B.me) await say(M.name(m) + ' gagne ' + xp + ' points d\'expérience !', 1.1);
      while (m.lv < 100 && m.xp >= M.xpAt(m.lv + 1)) await levelUp(m, true);
    }
    cards();
  }
  /** Un niveau de plus : PV en plus et les attaques apprises à ce niveau. */
  async function levelUp(m, inBattle, quiet) {
    const before = M.maxHp(m);
    m.lv++;
    m.xp = Math.max(m.xp, M.xpAt(m.lv));
    m.hp += M.maxHp(m) - before;
    G.Audio.sfx('levelup');
    const msg = M.name(m) + ' monte au niveau ' + m.lv + ' !';
    if (inBattle) { if (m === B.me) cards(); await say(msg, 1.1); }
    else if (!quiet) await G.AdvUI.talkP([['', msg]]);
    for (const id of M.newMovesAt(m.dex, m.lv)) if (!m.moves.includes(id)) await learn(m, id, inBattle);
  }

  /** Apprendre une attaque (au-delà de 4, on en oublie une, ou pas). */
  async function learn(m, id, inBattle) {
    const tell = (t, h) => (inBattle && B ? say(t, h) : G.AdvUI.talkP([['', t]]));
    const mv = M.move(id);
    if (m.moves.length < 4) {
      m.moves.push(id);
      m.pp.push(mv.pp || 10);
      G.Audio.sfx('confirm');
      await tell(M.name(m) + ' apprend ' + mv.name + ' !', 1.2);
      return true;
    }
    const pick = await G.AdvUI.choose(M.name(m) + ' veut apprendre ' + mv.name + ' (' + M.moveInfo(id) + '). Oublier une attaque ?',
      m.moves.map(x => ({ title: M.moveName(x), desc: M.moveInfo(x), icon: 'move:' + x }))
        .concat([{ title: 'Ne pas apprendre', desc: 'Garder ses 4 attaques' }]));
    if (pick < 4) {
      const old = m.moves[pick];
      m.moves[pick] = id;
      m.pp[pick] = mv.pp || 10;
      await tell('1, 2 et… Tadaa ! ' + M.name(m) + ' oublie ' + M.moveName(old) + ' et apprend ' + mv.name + ' !', 1.4);
      return true;
    }
    await tell(M.name(m) + ' n\'apprend pas ' + mv.name + '.', 1.1);
    return false;
  }

  function drawBall(ctx) { FX().draw(ctx); }

  async function sendOut(i) {
    const team = G.Overworld.save().team;
    B.me = team[i];
    B.stages.me = fresh();
    B.vol.me = {}; B.vol.foe.bind = 0;
    const pl = G.Overworld.player();
    B.aMe = actor(B.me, B.slotMe.x, B.slotMe.y, B.slotFoe);
    B.aMe.alpha = 0;
    await tween(0.25, k => { B.aMe.alpha = k; B.aMe.ox = (pl.x - B.slotMe.x) * (1 - k); B.aMe.oy = (pl.y - B.slotMe.y) * (1 - k); });
    cards();
    G.Overworld.setFollowerHidden(B.me);
  }
  async function foeOut(i) {
    B.fi = i;
    B.foe = B.foes[i];
    B.stages.foe = fresh();
    B.vol.foe = {}; B.vol.me.bind = 0;
    B.aFoe = actor(B.foe, B.slotFoe.x, B.slotFoe.y, B.slotMe);
    B.aFoe.face.foe = true;
    B.aFoe.anim.shiny = !!B.foe.shiny && G.Sprites.hasShiny(B.foe.dex);
    if (B.aFoe.anim.shiny) G.Sprites.preload([B.foe.dex], 6000, true);
    B.aFoe.alpha = 0;
    await tween(0.3, k => { B.aFoe.alpha = k; });
    cards();
  }

  /** Une action qui n'est pas une attaque (Potion, changement, fuite…). Rend un résultat de combat ou null. */
  async function doAction(side, a) {
    const s = G.Overworld.save();
    if (side === 'foe') {
      if (a.type === 'potion') {
        B.foePotions--;
        FX().heal(B.aFoe.x, B.aFoe.y - 20);
        await say(B.trainer.name + ' utilise une Super Potion !', 1);
        await hpTo(B.foe, Math.min(M.maxHp(B.foe), B.foe.hp + 50));
      } else if (a.type === 'switch') {
        B.switched = true;
        await say(B.trainer.name + ' rappelle ' + M.name(B.foe) + ' !', 1);
        if (ab('foe') === 'natural-cure') B.foe.st = '';
        await tween(0.2, k => { B.aFoe.alpha = 1 - k; });
        await foeOut(a.i);
        await say(B.trainer.name + ' envoie ' + M.name(B.foe) + ' !', 1.1);
        await entry('foe');
      }
      return null;
    }
    if (a.type === 'run') {
      const ok = ab('me') === 'run-away' || speed('me') >= speed('foe') || Math.random() < 0.6;
      if (ok) { await say('Tu prends la fuite !', 1); return 'run'; }
      await say('Impossible de fuir !', 1);
    } else if (a.type === 'potion') {
      s.potions--;
      FX().heal(B.aMe.x, B.aMe.y - 20);
      await hpTo(B.me, Math.min(M.maxHp(B.me), B.me.hp + 20));
      await say(M.name(B.me) + ' récupère des PV !', 1);
    } else if (a.type === 'superpo') {
      s.superpo--;
      FX().heal(B.aMe.x, B.aMe.y - 20);
      await hpTo(B.me, Math.min(M.maxHp(B.me), B.me.hp + 50));
      await say(M.name(B.me) + ' récupère des PV !', 1);
    } else if (a.type === 'cure' || a.type === 'antidote' || a.type === 'awake') {
      s[a.type === 'cure' ? 'cures' : a.type]--;
      B.me.st = ''; B.me.sleep = 0; cards();
      FX().heal(B.aMe.x, B.aMe.y - 20);
      await say(M.name(B.me) + ' est guéri !', 1);
    } else if (a.type === 'switch') {
      await say('Reviens, ' + M.name(B.me) + ' !', 0.9);
      if (ab('me') === 'natural-cure') B.me.st = '';
      G.Overworld.setFollowerHidden(null);
      await tween(0.2, k => { B.aMe.alpha = 1 - k; });
      await sendOut(a.i);
      await say('Vas-y, ' + M.name(B.me) + ' !', 0.9);
      await entry('me');
    }
    return null;
  }

  /**
   * Lance un combat. opts : { wild: [dex, lv] } ou { trainer: { name, team: [[dex, lv]], smart?, potions? } }
   * place : { me: {x, y}, foe: {x, y} } (pixels du monde). Rend 'win' | 'lose' | 'run'.
   */
  async function start(opts, place) {
    const s = G.Overworld.save();
    active = true;
    B = { wild: !!opts.wild, trainer: opts.trainer || null, leader: opts.trainer && opts.trainer.leader, stages: { me: fresh(), foe: fresh() }, vol: { me: {}, foe: {} }, scr: { me: {}, foe: {} }, slotMe: place.me, slotFoe: place.foe, order: [] };
    B.foes = opts.wild ? [M.make(opts.wild[0], opts.wild[1])] : opts.trainer.team.map(([d, l]) => M.make(d, l));
    if (opts.shiny) B.foes[0].shiny = true;
    B.foePotions = opts.trainer ? (opts.trainer.potions != null ? opts.trainer.potions : opts.trainer.smart ? 1 : 0) : 0;
    s.team.forEach(M.migrate);
    G.Sprites.preload(B.foes.map(f => f.dex), 6000, false);
    $('advb').classList.remove('hidden');
    $('advb-foe').innerHTML = ''; $('advb-me').innerHTML = '';
    $('advb').onclick = () => { if (tapRes) tapRes(); };
    G.Audio.music('boss');
    await intro(opts);
    await foeOut(0);
    await say(B.wild ? 'Un ' + M.name(B.foe) + ' sauvage apparaît !' : B.trainer.name + ' envoie ' + M.name(B.foe) + ' !', 1.4);
    if (B.foe.shiny) {
      G.Audio.sfx('legend');
      for (let i = 0; i < 4; i++) { FX().stat(B.aFoe.x + (i - 1.5) * 12, B.aFoe.y - 20 - (i % 2) * 14, true); await wait(0.12); }
      await say('Incroyable ! Il est chromatique ! Bats-le pour pouvoir le capturer.', 1.6);
    }
    const first = s.team.findIndex(m => m.hp > 0);
    await sendOut(first);
    await say('Vas-y, ' + M.name(B.me) + ' !', 1);
    await entry('foe'); await entry('me');

    let result = null;
    while (!result) {
      const mine = forced('me') || await chooseAction();
      const theirs = forced('foe') || foeAction();
      // Ordre : les actions qui ne sont pas des attaques d'abord, puis priorité, puis Vitesse.
      const prio = a => (a.type !== 'move' ? 10 : a.id ? M.move(a.id).prio : 0);
      const pm = prio(mine), pf = prio(theirs);
      const meFirst = pm !== pf ? pm > pf : speed('me') !== speed('foe') ? speed('me') > speed('foe') : Math.random() < 0.5;
      B.order = meFirst ? ['me', 'foe'] : ['foe', 'me'];
      const plan = { me: mine, foe: theirs };
      for (const side of B.order) {
        if (mon(side).hp <= 0 || mon(other(side)).hp <= 0) continue;
        const a = plan[side];
        if (side === 'foe' && plan.me.type === 'switch' && a.type === 'switch') continue;
        if (a.type === 'recharge') { B.vol[side].recharge = 0; await say(label(side) + ' doit se reposer !', 1); continue; }
        if (a.type === 'move') {
          await useMove(side, a.id);
          // Destruction et Explosion : le lanceur est K.O., même s'il rate.
          const k = a.id && M.move(a.id).key, u = mon(side);
          if ((k === 'self-destruct' || k === 'explosion') && u.hp > 0 && B.lastBoom === side) await hpTo(u, 0);
        }
        else { result = await doAction(side, a); if (result) break; }
      }
      if (!result) for (const side of B.order) await endTurn(side);
      // Protection et Mur Lumière durent 5 tours.
      if (!result) for (const side of ['me', 'foe']) for (const k of ['reflect', 'light', 'mist']) {
        if (B.scr[side][k] && --B.scr[side][k] <= 0) {
          B.scr[side][k] = 0;
          await say(({ reflect: 'La Protection', light: 'Le Mur Lumière', mist: 'La Brume' })[k] + (side === 'me' ? ' de ton équipe' : ' adverse') + ' disparaît.', 1);
        }
      }
      // K.O.
      if (!result && B.foe.hp <= 0) {
        await faint('foe');
        await gainXp();
        const next = B.foes.findIndex((f, i) => i !== B.fi && f.hp > 0);
        if (B.trainer && next >= 0) {
          await foeOut(next);
          await say(B.trainer.name + ' envoie ' + M.name(B.foe) + ' !', 1.2);
          await entry('foe');
        } else result = 'win';
      }
      if (!result && B.me.hp <= 0) {
        await faint('me');
        G.Overworld.setFollowerHidden(null);
        if (s.team.some(m => m.hp > 0)) {
          const i = await chooseNext();
          await sendOut(i);
          await say('Vas-y, ' + M.name(B.me) + ' !', 0.9);
          await entry('me');
        } else result = 'lose';
      }
    }
    if (result === 'win' && B.trainer) await say('Tu as battu ' + B.trainer.name + ' !', 1.2);
    if (result === 'win') for (const m of s.team) if (m.hp > 0 && abOf(m) === 'pickup' && Math.random() < 0.1) {
      s.potions++; await say('Ramassage : ' + M.name(m) + ' a trouvé une Potion !', 1.1);
    }
    for (const m of s.team) if (m.hp > 0 && abOf(m) === 'natural-cure') m.st = '';
    if (result === 'lose') await say('Tu n\'as plus de Pokémon en forme…', 1.4);
    await end();
    return result;
  }

  async function end() {
    for (const m of G.Overworld.save().team) if (m.st === 'tox') m.st = 'psn';   // comme dans les jeux : le poison grave redevient normal
    G.Overworld.setFollowerHidden(null);
    $('advb').classList.add('hidden');
    $('advb-msg').classList.remove('on');
    B = null; active = false; tweens = [];
    FX().clear();
  }

  /** Évolutions après un combat (le niveau d'évolution du Pokémon est atteint). */
  async function evolutions() {
    const team = G.Overworld.save().team;
    for (const m of team) {
      const e = G.EVOS[m.dex];
      if (!e) continue;
      const ok = e.filter(([, lv]) => m.lv >= lv);
      if (!ok.length) continue;
      const to = G.U.pick(ok)[0];
      if (!G.DEX_BY[to]) continue;
      const before = M.name(m), hpK = m.hp / M.maxHp(m), from = m.dex;
      await G.AdvUI.talkP([['', 'Quoi ? ' + before + ' évolue !']]);
      G.Sprites.preload([to], 6000, G.DB.ownsShiny(to));
      await G.AdvUI.evolve(from, to, G.DB.ownsShiny(from), G.DB.ownsShiny(to));
      m.dex = to;
      m.hp = Math.round(M.maxHp(m) * hpK);
      G.Sprites.preload([to], 6000, G.DB.ownsShiny(to));
      G.DB.grant(to, 'adv');
      G.Overworld.refreshFollowers();
      // Comme dans les jeux : l'attaque que la nouvelle forme apprend à ce niveau.
      for (const id of M.newMovesAt(to, m.lv)) if (!m.moves.includes(id)) await learn(m, id, false);
      M.ensureDamage(m);
    }
  }

  // Ce que fait chaque talent en Aventure (affiché dans le Pokédex).
  const AB_DESC = {
    overgrow: 'Attaques Plante ×1,5 quand il lui reste 1/3 de ses PV.', blaze: 'Attaques Feu ×1,5 quand il lui reste 1/3 de ses PV.',
    torrent: 'Attaques Eau ×1,5 quand il lui reste 1/3 de ses PV.', swarm: 'Attaques Insecte ×1,5 quand il lui reste 1/3 de ses PV.',
    intimidate: 'Baisse l\'Attaque de l\'adversaire en entrant au combat.', static: '30 % de paralyser au contact.',
    'poison-point': '30 % d\'empoisonner au contact.', 'flame-body': '30 % de brûler au contact.', 'effect-spore': '30 % de paralyser, empoisonner ou endormir au contact.',
    'rough-skin': 'Blesse l\'attaquant au contact (1/16 de ses PV).', aftermath: 'K.O. par un contact : blesse l\'attaquant (1/4 de ses PV).',
    levitate: 'Immunisé contre les attaques Sol.', 'water-absorb': 'Les attaques Eau le soignent au lieu de le blesser.',
    'volt-absorb': 'Les attaques Électrik le soignent au lieu de le blesser.', 'flash-fire': 'Immunisé contre le Feu ; ses attaques Feu deviennent plus fortes.',
    'motor-drive': 'Les attaques Électrik augmentent sa Vitesse au lieu de le blesser.', soundproof: 'Immunisé contre les attaques sonores.',
    'wonder-guard': 'Seules les attaques super efficaces le touchent.', sturdy: 'Immunisé contre les attaques K.O. en un coup.',
    'thick-fat': 'Dégâts Feu et Glace divisés par 2.', 'marvel-scale': 'Défense ×1,5 quand il a un statut.',
    guts: 'Attaque ×1,5 quand il a un statut (la brûlure ne la baisse plus).', hustle: 'Attaque ×1,5, mais ses attaques physiques sont moins précises.',
    'pure-power': 'Attaque ×2.', 'huge-power': 'Attaque ×2.', technician: 'Attaques de puissance 60 ou moins ×1,5.', adaptability: 'Bonus de type ×2 au lieu de ×1,5.',
    'compound-eyes': 'Précision ×1,3.', 'serene-grace': 'Double les chances des effets secondaires.', 'shield-dust': 'Pas d\'effets secondaires des attaques reçues.',
    'shell-armor': 'Jamais de coup critique reçu.', 'battle-armor': 'Jamais de coup critique reçu.',
    'clear-body': 'L\'adversaire ne peut pas baisser ses stats.', 'white-smoke': 'L\'adversaire ne peut pas baisser ses stats.',
    'hyper-cutter': 'L\'adversaire ne peut pas baisser son Attaque.', 'keen-eye': 'L\'adversaire ne peut pas baisser sa Précision.', simple: 'Ses changements de stats sont doublés.',
    immunity: 'Ne peut pas être empoisonné.', limber: 'Ne peut pas être paralysé.', insomnia: 'Ne peut pas s\'endormir.', 'vital-spirit': 'Ne peut pas s\'endormir.',
    'water-veil': 'Ne peut pas être brûlé.', 'magma-armor': 'Ne peut pas être gelé.', 'own-tempo': 'Ne peut pas être confus.', 'inner-focus': 'N\'a jamais peur.',
    'shed-skin': '1 chance sur 3 de guérir de son statut à chaque tour.', 'natural-cure': 'Guérit de son statut en quittant le combat.', 'early-bird': 'Se réveille deux fois plus vite.',
    synchronize: 'Renvoie la brûlure, la paralysie ou le poison à l\'adversaire.', 'rock-head': 'Pas de contrecoup.', 'liquid-ooze': 'Les attaques qui volent ses PV blessent l\'attaquant.',
    pressure: 'Les attaques de l\'adversaire coûtent 2 PP.', 'run-away': 'Peut toujours fuir un Pokémon sauvage.', pickup: 'Trouve parfois une Potion après un combat gagné.',
    damp: 'Empêche Destruction et Explosion.', trace: 'Copie le talent de l\'adversaire.', 'shadow-tag': 'L\'adversaire ne peut ni fuir ni changer.',
    'magnet-pull': 'Les Pokémon Acier ne peuvent ni fuir ni changer.', 'speed-boost': 'Sa Vitesse augmente à chaque tour.', truant: 'N\'attaque qu\'un tour sur deux.',
    steadfast: 'Sa Vitesse augmente quand il a peur.', 'mold-breaker': 'Ignore les talents de l\'adversaire.', 'bad-dreams': 'Blesse l\'adversaire endormi à chaque tour.'
  };
  function abInfo(dex) {
    const id = G.Talents && G.Talents.idOf(dex);
    if (!id) return null;
    return { name: abName(id), desc: AB_DESC[id] || 'Pas d\'effet en combat dans l\'Aventure (météo ou effet hors combat).' };
  }

  return { start, update, abInfo, drawables, drawFloor, drawBall, evolutions, learn, levelUp, ST_NAME, get active() { return active; },
           get focus() { return B ? { x: (B.slotMe.x + B.slotFoe.x) / 2, y: (B.slotMe.y + B.slotFoe.y) / 2 } : null } };
})();
