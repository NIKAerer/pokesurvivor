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
  function make(dex, lv) {
    const m = { dex, lv, xp: xpAt(lv), hp: 0, moves: movesAt(dex, lv), st: '' };
    restore(m);
    return m;
  }
  /** Les anciennes sauvegardes (attaques du Survivor) : on leur donne leurs vraies attaques. */
  function migrate(m) {
    if (!m.moves || !m.moves.length || m.moves.some(id => !move(id))) { m.moves = movesAt(m.dex, m.lv); m.pp = null; }
    if (!m.pp || m.pp.length !== m.moves.length) fixPp(m);
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

  return { base, maxHp, stat, xpAt, power, move, movesAt, newMovesAt, nextMoves, make, restore, migrate, fixPp, name, moveName, moveInfo, typeMul, learnset, FIXED };
})();

G.AdvBattle = (() => {
  const M = G.AdvMon;
  const FX = () => G.AdvFX;
  const $ = id => document.getElementById(id);
  let active = false;
  let B = null;            // { wild, trainer, foes, fi, foe, me, stages, vol, aMe, aFoe, slotMe, slotFoe }
  let tweens = [];

  const ST_NAME = { par: 'PAR', slp: 'SOM', frz: 'GEL', brn: 'BRÛ', psn: 'PSN' };
  const ST_COLOR = { par: '#d8b020', slp: '#8888a8', frz: '#58b8e8', brn: '#e07030', psn: '#a040a0' };

  // ---------------- petites animations ----------------
  function tween(dur, fn) {
    return new Promise(res => tweens.push({ t: 0, dur, fn, res }));
  }
  const wait = s => tween(s, () => {});
  function update(dt) {
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
    el.innerHTML = `<div class="advb-nm"><b>${p.name}</b>${st}<span>N. ${m.lv}</span></div>
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
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'advb-btn' + (b.cls ? ' ' + b.cls : '');
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
        { html: 'Pokémon', cls: 'big', color: '#3ab060', fn: team },
        { html: 'Fuite', cls: 'big', color: '#3a7ae0', disabled: !!B.trainer, fn: () => res({ type: 'run' }) }
      ]);
      const attacks = () => menu(B.me.moves.map((id, i) => {
        const mv = M.move(id), pw = M.power(id);
        return { html: `<b>${mv.name}</b><small>${G.U.TYPE_NAME[mv.type] || mv.type} · ${pw ? 'Puiss. ' + pw : mv.cls ? 'Fixe' : 'Statut'} · PP ${B.me.pp[i]}/${mv.pp}</small>`,
          color: G.U.TYPE_COLOR[mv.type], disabled: B.me.pp[i] <= 0, fn: () => res({ type: 'move', id, i }) };
      }).concat([{ html: 'Retour', cls: 'back', fn: main }]));
      const bag = () => {
        const s = G.Overworld.save();
        menu([
          { html: `<b>Potion</b><small>× ${s.potions} · +20 PV</small>`, color: '#a050d0', disabled: s.potions <= 0 || B.me.hp >= M.maxHp(B.me), fn: () => res({ type: 'potion' }) },
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
      if (a.scale !== 1) { ctx.translate(a.x, a.y); ctx.scale(a.scale, a.scale); ctx.translate(-a.x, -a.y); }
      G.Sprites.drawShadow(ctx, a.dex, a.x + a.ox, a.y + a.oy, 1);
      a.anim.draw(ctx, a.x + a.ox, a.y + a.oy, { flash: a.flash > 0 });
      ctx.restore();
    } }));
  }

  // ---------------- règles des jeux ----------------
  const stageK = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
  const accK = s => (s >= 0 ? (3 + s) / 3 : 3 / (3 - s));
  const fresh = () => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 });
  const STAT_NAME = { atk: 'L\'Attaque', def: 'La Défense', spa: 'L\'Attaque Spéciale', spd: 'La Défense Spéciale', spe: 'La Vitesse', acc: 'La Précision', eva: 'L\'Esquive' };
  const other = side => (side === 'me' ? 'foe' : 'me');
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
    if (st === 'cnf') return true;
    if (m.st || m.hp <= 0) return false;
    const t = types(m);
    if (st === 'brn' && t.includes('fire')) return false;
    if (st === 'frz' && t.includes('ice')) return false;
    if (st === 'psn' && (t.includes('poison') || t.includes('steel'))) return false;
    if (st === 'par' && t.includes('electric')) return false;
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
    if (st === 'slp') m.sleep = 1 + Math.floor(Math.random() * 3);
    FX().ail(a.x, a.y - 22, st);
    G.Audio.sfx('select');
    cards();
    await say(label(side) + ({ par: ' est paralysé ! Il aura du mal à attaquer.', slp: ' s\'endort !', frz: ' est gelé !', brn: ' est brûlé !', psn: ' est empoisonné !' })[st], 1.2);
    return true;
  }
  async function changeStat(side, k, n) {
    const sg = B.stages[side], a = act(side);
    if ((n > 0 && sg[k] >= 6) || (n < 0 && sg[k] <= -6)) { await say(STAT_NAME[k] + ' de ' + label(side) + ' ne peut plus ' + (n > 0 ? 'monter' : 'baisser') + ' !', 1); return; }
    sg[k] = Math.max(-6, Math.min(6, sg[k] + n));
    FX().stat(a.x, a.y - 10, n > 0);
    G.Audio.sfx(n > 0 ? 'levelup' : 'select');
    await say(STAT_NAME[k] + ' de ' + label(side) + (n > 0 ? (n > 1 ? ' augmente beaucoup !' : ' augmente !') : (n < -1 ? ' baisse beaucoup !' : ' baisse !')), 1);
  }

  /** Avant d'agir : sommeil, gel, paralysie, peur, confusion. Rend false si le Pokémon ne peut pas agir. */
  async function canAct(side) {
    const m = mon(side), v = B.vol[side];
    if (m.st === 'slp') {
      if (--m.sleep > 0) { FX().ail(act(side).x, act(side).y - 30, 'slp'); await say(label(side) + ' dort profondément…', 1); return false; }
      m.st = ''; cards();
      await say(label(side) + ' se réveille !', 1);
    }
    if (m.st === 'frz') {
      if (Math.random() < 0.2) { m.st = ''; cards(); await say(label(side) + ' n\'est plus gelé !', 1); }
      else { await say(label(side) + ' est gelé ! Il ne peut pas bouger !', 1); return false; }
    }
    if (v.flinch) { v.flinch = 0; await say(label(side) + ' a peur ! Il n\'attaque pas !', 1); return false; }
    if (v.cnf) {
      if (--v.cnf <= 0) { v.cnf = 0; await say(label(side) + ' n\'est plus confus !', 1); }
      else {
        await say(label(side) + ' est confus…', 0.8);
        if (Math.random() < 1 / 3) {
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
  async function useMove(side, id) {
    const user = mon(side), tside = other(side), target = mon(tside);
    const ua = act(side), ta = act(tside);
    if (!(await canAct(side))) return;
    const struggle = !id;
    const mv = struggle ? { name: 'Lutte', type: 'normal', cls: 1, power: 50, acc: 0, stats: [], drain: -25, hitMin: 0, flinch: 0, crit: 0, key: 'struggle' } : M.move(id);
    if (!struggle) { const i = user.moves.indexOf(id); if (i >= 0 && user.pp[i] > 0) user.pp[i]--; }
    await say(label(side) + ' utilise ' + mv.name + ' !', 0.9);

    // Précision (les attaques sur soi touchent toujours).
    if (mv.acc && !mv.self) {
      const k = accK(Math.max(-6, Math.min(6, B.stages[side].acc - B.stages[tside].eva)));
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
        if (user.hp >= M.maxHp(user)) { await say('Les PV de ' + label(side) + ' sont au maximum !', 1); return; }
        FX().heal(ua.x, ua.y - 20);
        G.Audio.sfx('levelup');
        await hpTo(user, Math.min(M.maxHp(user), user.hp + Math.round(M.maxHp(user) * mv.heal / 100)));
        await say(label(side) + ' récupère des PV !', 1);
        did = true;
      }
      if (mv.stats.length) {
        if (!mv.self) await FX().attack(mv.type, pt(ua), pt(ta), 2);
        for (const [k, n] of mv.stats) await changeStat(mv.self ? side : tside, k, n);
        did = true;
      }
      if (mv.ail) {
        const tgt = mv.self ? side : tside;
        await FX().attack(mv.type, pt(ua), pt(act(tgt)), 2);
        if (!(await inflict(tgt, mv.ail))) await say('Mais cela échoue !', 1);
        did = true;
      }
      if (!did) await say('Mais rien ne se passe…', 1);
      return;
    }

    // Dégâts.
    const mul = M.typeMul(mv.type, types(target));
    const hits = mv.hitMin ? mv.hitMin + Math.floor(Math.random() * (mv.hitMax - mv.hitMin + 1)) : 1;
    let total = 0, n = 0, crits = 0;
    const phys = mv.cls === 1;
    for (; n < hits && target.hp > 0; n++) {
      await FX().attack(mv.type, pt(ua), pt(ta), mv.cls);
      let dmg;
      if (M.FIXED[mv.key]) dmg = mul ? M.FIXED[mv.key](user, target) : 0;
      else {
        const crit = Math.random() < [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2][Math.min(4, mv.crit || 0)];
        if (crit && mul) crits++;
        // Coup critique : on ignore les baisses de l'attaquant et les hausses de la cible.
        const as = B.stages[side][phys ? 'atk' : 'spa'], ds = B.stages[tside][phys ? 'def' : 'spd'];
        const atk = M.stat(user, phys ? 'atk' : 'spa') * stageK(crit ? Math.max(0, as) : as) * (phys && user.st === 'brn' ? 0.5 : 1);
        const def = M.stat(target, phys ? 'def' : 'spd') * stageK(crit ? Math.min(0, ds) : ds);
        const stab = types(user).includes(mv.type) ? 1.5 : 1;
        dmg = Math.floor(((2 * user.lv / 5 + 2) * (mv.power || 60) * atk / def) / 50 + 2);
        dmg = Math.max(mul ? 1 : 0, Math.floor(dmg * stab * mul * (crit ? 2 : 1) * (0.85 + Math.random() * 0.15)));
      }
      G.Audio.sfx(mul > 1 ? 'crit' : 'hit');
      ta.flash = 1;
      if (mul) ta.anim.play('Hurt');
      if (G.Overworld.fx && dmg) G.Overworld.fx(ta.x, ta.y - 22, G.U.TYPE_COLOR[mv.type] || '#fff', dmg);
      await tween(0.16, k => { if (n === 0) { ua.ox = dx / d * lunge * (1 - k); ua.oy = dy / d * lunge * (1 - k); } ta.ox = Math.sin(k * 25) * 5 * (1 - k); });
      ta.flash = 0; ta.ox = 0;
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
    if (mv.drain > 0 && user.hp > 0 && total) {
      FX().heal(ua.x, ua.y - 20);
      await hpTo(user, Math.min(M.maxHp(user), user.hp + Math.max(1, Math.floor(total * mv.drain / 100))));
      await say(label(tside) + ' perd de l\'énergie !', 0.9);
    } else if (mv.drain < 0 && total) {
      const r = struggle ? Math.max(1, Math.floor(M.maxHp(user) / 4)) : Math.max(1, Math.floor(total * -mv.drain / 100));
      ua.flash = 1; await wait(0.12); ua.flash = 0;
      await hpTo(user, Math.max(0, user.hp - r));
      await say(label(side) + ' subit le contrecoup !', 0.9);
    }
    // Effets secondaires.
    if (target.hp > 0 && mv.ail && Math.random() * 100 < (mv.ailCh || 100) && canAil(target, mv.ail)) await inflict(tside, mv.ail);
    if (mv.stats.length && Math.random() * 100 < (mv.statCh || 100)) {
      const who = mv.self ? side : tside;
      if (mon(who).hp > 0) for (const [k, v] of mv.stats) await changeStat(who, k, v);
    }
    if (mv.flinch && target.hp > 0 && Math.random() * 100 < mv.flinch && B.order[0] === side) B.vol[tside].flinch = 1;
  }

  /** Fin du tour : brûlure et poison. */
  async function endTurn(side) {
    const m = mon(side);
    if (!m || m.hp <= 0 || (m.st !== 'brn' && m.st !== 'psn')) return;
    const a = act(side);
    FX().ail(a.x, a.y - 22, m.st);
    a.flash = 1; await wait(0.12); a.flash = 0;
    await hpTo(m, Math.max(0, m.hp - Math.max(1, Math.floor(M.maxHp(m) / 8))));
    await say(label(side) + (m.st === 'brn' ? ' souffre de sa brûlure !' : ' souffre du poison !'), 1);
  }

  // ---------------- l'adversaire ----------------
  /** Valeur d'une attaque pour l'adversaire. */
  function scoreMove(id, user, target, us, ts) {
    const mv = M.move(id);
    if (!mv.cls) {
      let v = 0;
      if (mv.heal > 0) v = user.hp < M.maxHp(user) * 0.5 ? 70 : 0;
      if (mv.ail && canAil(target, mv.ail) && !(mv.ail === 'cnf' && B.vol[ts].cnf)) v = Math.max(v, { slp: 60, par: 50, psn: 40, brn: 40, cnf: 35, frz: 30 }[mv.ail] * (mv.acc ? mv.acc / 100 : 1));
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
    return pw * mul * stab * (mv.acc ? mv.acc / 100 : 1);
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
      if (threat >= 2 && !B.switched && Math.random() < 0.6) {
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
    B.vol.me = {};
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
    B.vol.foe = {};
    B.aFoe = actor(B.foe, B.slotFoe.x, B.slotFoe.y, B.slotMe);
    B.aFoe.face.foe = true;
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
        await tween(0.2, k => { B.aFoe.alpha = 1 - k; });
        await foeOut(a.i);
        await say(B.trainer.name + ' envoie ' + M.name(B.foe) + ' !', 1.1);
      }
      return null;
    }
    if (a.type === 'run') {
      const ok = speed('me') >= speed('foe') || Math.random() < 0.6;
      if (ok) { await say('Tu prends la fuite !', 1); return 'run'; }
      await say('Impossible de fuir !', 1);
    } else if (a.type === 'potion') {
      s.potions--;
      FX().heal(B.aMe.x, B.aMe.y - 20);
      await hpTo(B.me, Math.min(M.maxHp(B.me), B.me.hp + 20));
      await say(M.name(B.me) + ' récupère des PV !', 1);
    } else if (a.type === 'cure') {
      s.cures--;
      B.me.st = ''; B.me.sleep = 0; cards();
      FX().heal(B.aMe.x, B.aMe.y - 20);
      await say(M.name(B.me) + ' est guéri !', 1);
    } else if (a.type === 'switch') {
      await say('Reviens, ' + M.name(B.me) + ' !', 0.9);
      G.Overworld.setFollowerHidden(null);
      await tween(0.2, k => { B.aMe.alpha = 1 - k; });
      await sendOut(a.i);
      await say('Vas-y, ' + M.name(B.me) + ' !', 0.9);
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
    B = { wild: !!opts.wild, trainer: opts.trainer || null, stages: { me: fresh(), foe: fresh() }, vol: { me: {}, foe: {} }, slotMe: place.me, slotFoe: place.foe, order: [] };
    B.foes = opts.wild ? [M.make(opts.wild[0], opts.wild[1])] : opts.trainer.team.map(([d, l]) => M.make(d, l));
    B.foePotions = opts.trainer ? (opts.trainer.potions != null ? opts.trainer.potions : opts.trainer.smart ? 1 : 0) : 0;
    s.team.forEach(M.migrate);
    G.Sprites.preload(B.foes.map(f => f.dex), 6000, false);
    $('advb').classList.remove('hidden');
    $('advb-foe').innerHTML = ''; $('advb-me').innerHTML = '';
    $('advb').onclick = () => { if (tapRes) tapRes(); };
    G.Audio.music('boss');
    await foeOut(0);
    await say(B.wild ? 'Un ' + M.name(B.foe) + ' sauvage apparaît !' : B.trainer.name + ' envoie ' + M.name(B.foe) + ' !', 1.4);
    const first = s.team.findIndex(m => m.hp > 0);
    await sendOut(first);
    await say('Vas-y, ' + M.name(B.me) + ' !', 1);

    let result = null;
    while (!result) {
      const mine = await chooseAction();
      const theirs = foeAction();
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
        if (a.type === 'move') await useMove(side, a.id);
        else { result = await doAction(side, a); if (result) break; }
      }
      if (!result) for (const side of B.order) await endTurn(side);
      // K.O.
      if (!result && B.foe.hp <= 0) {
        await faint('foe');
        await gainXp();
        const next = B.foes.findIndex((f, i) => i !== B.fi && f.hp > 0);
        if (B.trainer && next >= 0) {
          await foeOut(next);
          await say(B.trainer.name + ' envoie ' + M.name(B.foe) + ' !', 1.2);
        } else result = 'win';
      }
      if (!result && B.me.hp <= 0) {
        await faint('me');
        G.Overworld.setFollowerHidden(null);
        if (s.team.some(m => m.hp > 0)) {
          const i = await chooseNext();
          await sendOut(i);
          await say('Vas-y, ' + M.name(B.me) + ' !', 0.9);
        } else result = 'lose';
      }
    }
    if (result === 'win' && B.trainer) await say(B.trainer.name + ' est battu !', 1.2);
    if (result === 'lose') await say('Tu n\'as plus de Pokémon en forme…', 1.4);
    await end();
    return result;
  }

  async function end() {
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
      const before = M.name(m), hpK = m.hp / M.maxHp(m);
      await G.AdvUI.talkP([['', 'Quoi ? ' + before + ' évolue !']]);
      G.Audio.sfx('legend');
      m.dex = to;
      m.hp = Math.round(M.maxHp(m) * hpK);
      G.Sprites.preload([to], 6000, G.DB.ownsShiny(to));
      G.DB.grant(to, 'adv');
      G.Overworld.refreshFollowers();
      await G.AdvUI.talkP([['', 'Félicitations ! ' + before + ' a évolué en ' + G.DEX_BY[to].name + ' !']]);
      // Comme dans les jeux : l'attaque que la nouvelle forme apprend à ce niveau.
      for (const id of M.newMovesAt(to, m.lv)) if (!m.moves.includes(id)) await learn(m, id, false);
    }
  }

  return { start, update, drawables, drawBall, evolutions, learn, levelUp, ST_NAME, get active() { return active; },
           get focus() { return B ? { x: (B.slotMe.x + B.slotFoe.x) / 2, y: (B.slotMe.y + B.slotFoe.y) / 2 } : null } };
})();
