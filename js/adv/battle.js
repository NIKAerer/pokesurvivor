/* ============ battle.js — combats au tour par tour sur la carte (version de Nika) ============
 * Pas d'écran à part : ton Pokémon sort devant toi, face au sauvage (ou au
 * Pokémon du dresseur), et le menu s'ouvre en bas : Attaque, Sac, Pokémon, Fuite.
 *
 * Les Pokémon de l'Aventure : { dex, lv, xp, hp, moves: [id...] }
 *   - statistiques tirées du Pokédex du jeu (PV, attaque, vitesse, BST) avec
 *     les formules des jeux (niveau 1-100) ;
 *   - attaques : celles du répertoire du Pokémon (team.js learnset), apprises à
 *     certains niveaux (LEARN_LV), 4 au plus ;
 *   - expérience « moyenne » des jeux : il faut niveau³ points au total.
 * La vraie table des types des jeux (×2, ×0,5, ×0), STAB ×1,5, coups critiques.
 */
G.AdvMon = (() => {
  const LEARN_LV = [1, 4, 9, 14, 20, 27, 35];
  // Puissance des attaques connues (celles des jeux) ; les autres : 55.
  const POWER = {
    tackle: 40, scratch: 40, pound: 40, ember: 40, 'water-gun': 40, 'thunder-shock': 40, 'vine-whip': 45, 'quick-attack': 40,
    gust: 40, bubble: 40, 'powder-snow': 40, 'mega-drain': 40, lick: 30, 'poison-sting': 25, 'peck': 35, 'bug-bite': 60,
    bite: 60, 'wing-attack': 60, confusion: 50, 'rock-throw': 50, 'karate-chop': 50, 'mud-shot': 55, 'razor-leaf': 55,
    'metal-claw': 50, 'aerial-ace': 60, swift: 60, 'flame-wheel': 60, 'fairy-wind': 40, 'disarming-voice': 40, 'icicle-spear': 50,
    psybeam: 65, 'bubble-beam': 65, 'night-slash': 70, 'psycho-cut': 70, 'rock-tomb': 60, 'shadow-ball': 80, 'dragon-breath': 60,
    'air-slash': 75, 'rock-slide': 75, 'giga-drain': 75, 'bulldoze': 60, 'electroweb': 55, 'silver-wind': 60, 'hex': 65,
    'bullet-seed': 50, 'flash-cannon': 80, 'dark-pulse': 80, 'aura-sphere': 80, 'sludge': 65, 'dazzling-gleam': 80, 'bug-buzz': 90,
    psychic: 90, flamethrower: 90, thunderbolt: 90, 'ice-beam': 90, 'hyper-voice': 90, 'heat-wave': 95, discharge: 80,
    'hydro-pump': 110, 'leaf-storm': 110, 'hyper-beam': 120, 'meteor-mash': 90, 'fire-spin': 35, 'struggle-bug': 50,
    'night-shade': 50, 'dragon-rage': 50, 'fury-swipes': 45, 'bonemerang': 50, 'bullet-punch': 40, hail: 40
  };

  const P = dex => G.DEX_BY[dex];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /** Statistiques de base (style des jeux) tirées des données du jeu. */
  function base(dex) {
    const p = P(dex);
    return {
      hp: clamp(p.hp * 0.55, 35, 115),
      atk: clamp(p.atk * 55, 35, 125),
      def: clamp(p.bst / 6.5, 30, 115),
      spd: clamp(p.spd * 0.55, 20, 120)
    };
  }
  function maxHp(m) { return Math.floor(2 * base(m.dex).hp * m.lv / 100) + m.lv + 10; }
  function stat(m, k) { return Math.floor(2 * base(m.dex)[k] * m.lv / 100) + 5; }
  const xpAt = lv => lv * lv * lv;

  function move(id) { return G.Moves.BY_ID[id]; }
  function power(id) {
    const m = move(id);
    if (!m || m.kind === 'buff') return 0;
    if (POWER[id]) return POWER[id];
    return /^sig-/.test(id) ? 50 : 55;
  }
  /** Les attaques apprises jusqu'au niveau lv (les 4 dernières). */
  function learnset(dex) { return [...new Set(G.Team.learnset(dex))].filter(id => move(id)); }
  function movesAt(dex, lv) {
    const set = learnset(dex), out = [];
    set.forEach((id, i) => { if ((LEARN_LV[i] || 99) <= lv) out.push(id); });
    if (!out.length && set.length) out.push(set[0]);
    return out.slice(-4);
  }
  /** Attaque apprise en arrivant au niveau lv (ou null). */
  function newMoveAt(dex, lv) {
    const set = learnset(dex);
    const i = LEARN_LV.indexOf(lv);
    return i > 0 && set[i] ? set[i] : null;
  }
  function make(dex, lv) {
    const m = { dex, lv, xp: xpAt(lv), hp: 0, moves: movesAt(dex, lv) };
    m.hp = maxHp(m);
    return m;
  }
  function name(m) { return P(m.dex).name; }
  const tr = s => (G.I18n && G.I18n.t ? G.I18n.t(s) : s);
  function moveName(id) { return tr((move(id) || {}).name || id); }

  /** Multiplicateur des jeux (×2, ×0,5, ×0). */
  function typeMul(type, types) {
    const row = G.Types.CHART[type] || {};
    let k = 1;
    for (const t of types) if (row[t] != null) k *= row[t];
    return k;
  }

  return { LEARN_LV, base, maxHp, stat, xpAt, power, move, movesAt, newMoveAt, make, name, moveName, typeMul, learnset };
})();

G.AdvBattle = (() => {
  const M = G.AdvMon;
  const $ = id => document.getElementById(id);
  let active = false;
  let B = null;            // { wild, trainer, foes, fi, foe, me, mi, stages, actors, result }
  let tweens = [];

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
    el.innerHTML = `<div class="advb-nm"><b>${p.name}</b><span>N. ${m.lv}</span></div>
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
      const main = () => menu([
        { html: 'Attaque', cls: 'big', color: '#e05040', fn: attacks },
        { html: 'Sac', cls: 'big', color: '#e0a020', fn: bag },
        { html: 'Pokémon', cls: 'big', color: '#3ab060', fn: team },
        { html: B.trainer ? 'Fuite' : 'Fuite', cls: 'big', color: '#3a7ae0', disabled: !!B.trainer, fn: () => res({ type: 'run' }) }
      ]);
      const attacks = () => menu(B.me.moves.map(id => {
        const mv = M.move(id), pw = M.power(id);
        return { html: `<b>${M.moveName(id)}</b><small>${G.U.TYPE_NAME[mv.type] || mv.type} · ${pw ? 'Puiss. ' + pw : 'Statut'}</small>`,
          color: G.U.TYPE_COLOR[mv.type], fn: () => res({ type: 'move', id }) };
      }).concat([{ html: 'Retour', cls: 'back', fn: main }]));
      const bag = () => {
        const s = G.Overworld.save();
        menu([
          { html: `<b>Poké Ball</b><small>× ${s.balls}</small>`, color: '#e05040', disabled: !!B.trainer || s.balls <= 0, fn: () => res({ type: 'ball' }) },
          { html: `<b>Potion</b><small>× ${s.potions} · +20 PV</small>`, color: '#a050d0', disabled: s.potions <= 0 || B.me.hp >= M.maxHp(B.me), fn: () => res({ type: 'potion' }) },
          { html: 'Retour', cls: 'back', fn: main }
        ]);
      };
      const team = () => {
        const t = G.Overworld.save().team;
        menu(t.map((m, i) => ({ html: `<b>${M.name(m)}</b><small>N. ${m.lv} · ${Math.ceil(m.hp)}/${M.maxHp(m)} PV</small>`,
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

  // ---------------- règles ----------------
  const stageK = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
  function spd(m, side) { return M.stat(m, 'spd') * stageK(B.stages[side].spd); }

  async function useMove(side, id) {
    const user = side === 'me' ? B.me : B.foe, target = side === 'me' ? B.foe : B.me;
    const ua = side === 'me' ? B.aMe : B.aFoe, ta = side === 'me' ? B.aFoe : B.aMe;
    const mv = M.move(id), pw = M.power(id);
    await say((side === 'foe' ? (B.wild ? M.name(user) + ' sauvage' : M.name(user) + ' ennemi') : M.name(user)) + ' utilise ' + M.moveName(id) + ' !', 0.9);
    // Élan vers la cible.
    const dx = ta.x - ua.x, dy = ta.y - ua.y, d = Math.hypot(dx, dy) || 1;
    ua.anim.play('Attack');
    await tween(0.18, k => { ua.ox = dx / d * 26 * k; ua.oy = dy / d * 26 * k; });
    if (!pw) {
      await tween(0.18, k => { ua.ox = dx / d * 26 * (1 - k); ua.oy = dy / d * 26 * (1 - k); });
      const st = mv.stat === 'spd' ? 'spd' : mv.stat === 'def' || mv.stat === 'shield' ? 'def' : mv.stat === 'regen' ? 'regen' : 'atk';
      if (st === 'regen') {
        const heal = Math.round(M.maxHp(user) * 0.3);
        G.FX && G.FX.burst && G.FX.burst(ua.x, ua.y - 20, '#5fe08a', 16, 120);
        await hpTo(user, Math.min(M.maxHp(user), user.hp + heal));
        await say(M.name(user) + ' récupère des PV !', 1);
      } else {
        const sg = B.stages[side];
        if (sg[st] >= 6) { await say('Ça n\'a aucun effet…', 1); return; }
        sg[st] = Math.min(6, sg[st] + 1);
        G.Audio.sfx('select');
        await say({ atk: 'L\'Attaque', def: 'La Défense', spd: 'La Vitesse' }[st] + ' de ' + M.name(user) + ' augmente !', 1);
      }
      return;
    }
    const mul = M.typeMul(mv.type, G.DEX_BY[target.dex].types);
    const crit = Math.random() < 1 / 16;
    const atk = M.stat(user, 'atk') * stageK(B.stages[side].atk);
    const def = M.stat(target, 'def') * stageK(B.stages[side === 'me' ? 'foe' : 'me'].def);
    const stab = G.DEX_BY[user.dex].types.includes(mv.type) ? 1.5 : 1;
    let dmg = Math.floor(((2 * user.lv / 5 + 2) * pw * atk / def) / 50 + 2);
    dmg = Math.max(mul ? 1 : 0, Math.floor(dmg * stab * mul * (crit ? 1.5 : 1) * (0.85 + Math.random() * 0.15)));
    // Impact.
    G.Audio.sfx(mul > 1 ? 'crit' : 'hit');
    ta.flash = 1;
    if (mul) ta.anim.play('Hurt');
    if (G.Overworld.fx) G.Overworld.fx(ta.x, ta.y - 22, G.U.TYPE_COLOR[mv.type] || '#fff', dmg);
    await tween(0.18, k => { ua.ox = dx / d * 26 * (1 - k); ua.oy = dy / d * 26 * (1 - k); ta.ox = Math.sin(k * 25) * 5 * (1 - k); });
    ta.flash = 0; ta.ox = 0;
    await hpTo(target, Math.max(0, target.hp - dmg));
    if (crit && mul) await say('Coup critique !', 0.9);
    if (mul > 1) await say('C\'est super efficace !', 1);
    else if (mul === 0) await say('Ça n\'affecte pas ' + M.name(target) + '…', 1.1);
    else if (mul < 1) await say('Ce n\'est pas très efficace…', 1);
  }

  /** L'adversaire choisit son attaque (les dresseurs visent le meilleur coup). */
  function foeMove() {
    const ms = B.foe.moves.length ? B.foe.moves : M.movesAt(B.foe.dex, B.foe.lv);
    if (B.wild && Math.random() < 0.5) return G.U.pick(ms);
    let best = ms[0], bv = -1;
    for (const id of ms) {
      const mv = M.move(id);
      const v = (M.power(id) || 25) * M.typeMul(mv.type, G.DEX_BY[B.me.dex].types) * (G.DEX_BY[B.foe.dex].types.includes(mv.type) ? 1.5 : 1) * (0.8 + Math.random() * 0.4);
      if (v > bv) { bv = v; best = id; }
    }
    return best;
  }

  async function faint(side) {
    const a = side === 'me' ? B.aMe : B.aFoe, m = side === 'me' ? B.me : B.foe;
    a.anim.play('Faint', { hold: true });
    G.Audio.sfx('faint');
    await tween(0.5, k => { a.alpha = 1 - k; });
    await say((side === 'foe' && B.wild ? M.name(m) + ' sauvage' : M.name(m)) + ' est K.O. !', 1.1);
  }

  /** Expérience après un K.O. adverse (le Pokémon au combat, et un tiers pour les autres). */
  async function gainXp() {
    const foe = B.foe, p = G.DEX_BY[foe.dex];
    const total = Math.floor(p.bst / 5 * foe.lv / 7 * (B.trainer ? 1.5 : 1));
    const team = G.Overworld.save().team;
    for (const m of team) {
      if (m.hp <= 0) continue;
      const xp = m === B.me ? total : Math.floor(total / 3);
      if (xp <= 0) continue;
      m.xp += xp;
      if (m === B.me) await say(M.name(m) + ' gagne ' + xp + ' points d\'expérience !', 1.1);
      while (m.lv < 100 && m.xp >= M.xpAt(m.lv + 1)) {
        const before = M.maxHp(m);
        m.lv++;
        m.hp += M.maxHp(m) - before;
        G.Audio.sfx('levelup');
        if (m === B.me) cards();
        await say(M.name(m) + ' monte au niveau ' + m.lv + ' !', 1.1);
        const nm = M.newMoveAt(m.dex, m.lv);
        if (nm && !m.moves.includes(nm)) await learn(m, nm);
      }
    }
    cards();
  }

  /** Apprendre une attaque (au-delà de 4, on en oublie une, ou pas). */
  async function learn(m, id) {
    if (m.moves.length < 4) {
      m.moves.push(id);
      G.Audio.sfx('confirm');
      await say(M.name(m) + ' apprend ' + M.moveName(id) + ' !', 1.2);
      return;
    }
    const pick = await G.AdvUI.choose(M.name(m) + ' veut apprendre ' + M.moveName(id) + '. Oublier une attaque ?',
      m.moves.map(x => ({ title: M.moveName(x), desc: (G.U.TYPE_NAME[M.move(x).type] || '') + (M.power(x) ? ' · Puiss. ' + M.power(x) : ' · Statut'), icon: 'move:' + x }))
        .concat([{ title: 'Ne pas apprendre', desc: 'Garder ses 4 attaques' }]));
    if (pick < 4) {
      const old = m.moves[pick];
      m.moves[pick] = id;
      await say(M.name(m) + ' oublie ' + M.moveName(old) + ' et apprend ' + M.moveName(id) + ' !', 1.4);
    } else await say(M.name(m) + ' n\'apprend pas ' + M.moveName(id) + '.', 1.1);
  }

  async function throwBall() {
    const s = G.Overworld.save();
    s.balls--;
    const pl = G.Overworld.player(), fa = B.aFoe;
    const ball = { x: pl.x, y: pl.y - 30 };
    B.ball = ball;
    G.Audio.sfx('select');
    await tween(0.55, k => { ball.x = pl.x + (fa.x - pl.x) * k; ball.y = pl.y - 30 + (fa.y - 20 - pl.y + 30) * k - Math.sin(k * Math.PI) * 60; });
    await tween(0.25, k => { fa.scale = 1 - k; fa.alpha = 1 - k; });
    const p = G.DEX_BY[B.foe.dex], mx = M.maxHp(B.foe);
    const rate = { 1: 255, 2: 190, 3: 120, 4: 60, 5: 8 }[p.rarity] || 120;
    const a = (3 * mx - 2 * B.foe.hp) * rate / (3 * mx);
    const ok = Math.random() < Math.max(0.03, Math.min(1, a / 255));
    const shakes = ok ? 3 : Math.floor(Math.random() * 3);
    for (let i = 0; i < shakes; i++) { await tween(0.45, k => { ball.wob = Math.sin(k * Math.PI * 2) * 0.5; }); G.Audio.sfx('click'); }
    ball.wob = 0;
    if (ok) {
      G.Audio.sfx('shiny');
      await say('Et hop ! ' + p.name + ' est capturé !', 1.4);
      B.ball = null;
      const m = { dex: B.foe.dex, lv: B.foe.lv, xp: M.xpAt(B.foe.lv), hp: B.foe.hp, moves: B.foe.moves.slice() };
      if (s.team.length < 6) s.team.push(m);
      else { s.box.push(m); await say(p.name + ' est envoyé dans ta boîte.', 1.2); }
      G.DB.grant(m.dex, 'adv');
      return true;
    }
    B.ball = null;
    await tween(0.2, k => { fa.scale = k; fa.alpha = k; });
    await say(shakes ? 'Mince ! Il y était presque…' : 'Oh non ! ' + p.name + ' s\'est libéré !', 1.2);
    return false;
  }

  function drawBall(ctx) {
    const b = B && B.ball;
    if (!b) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.wob || 0);
    G.Icons.draw(ctx, 'pball', -10, -10, 20);
    ctx.restore();
  }

  async function sendOut(i) {
    const team = G.Overworld.save().team;
    B.me = team[i];
    B.stages.me = { atk: 0, def: 0, spd: 0 };
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
    B.stages.foe = { atk: 0, def: 0, spd: 0 };
    B.aFoe = actor(B.foe, B.slotFoe.x, B.slotFoe.y, B.slotMe);
    B.aFoe.face.foe = true;
    B.aFoe.alpha = 0;
    await tween(0.3, k => { B.aFoe.alpha = k; });
    cards();
  }

  /**
   * Lance un combat. opts : { wild: [dex, lv] } ou { trainer: { name, team: [[dex, lv]] } }
   * place : { me: {x, y}, foe: {x, y} } (pixels du monde). Rend 'win' | 'lose' | 'run' | 'caught'.
   */
  async function start(opts, place) {
    const s = G.Overworld.save();
    active = true;
    B = { wild: !!opts.wild, trainer: opts.trainer || null, stages: { me: {}, foe: {} }, slotMe: place.me, slotFoe: place.foe };
    B.foes = opts.wild ? [M.make(opts.wild[0], opts.wild[1])] : opts.trainer.team.map(([d, l]) => M.make(d, l));
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
      const act = await chooseAction();
      let foeActs = true, meFirst = true;
      if (act.type === 'run') {
        const ok = spd(B.me, 'me') >= spd(B.foe, 'foe') || Math.random() < 0.6;
        if (ok) { await say('Tu prends la fuite !', 1); result = 'run'; break; }
        await say('Impossible de fuir !', 1);
      } else if (act.type === 'ball') {
        if (await throwBall()) { result = 'caught'; break; }
      } else if (act.type === 'potion') {
        s.potions--;
        await hpTo(B.me, Math.min(M.maxHp(B.me), B.me.hp + 20));
        await say(M.name(B.me) + ' récupère des PV !', 1);
      } else if (act.type === 'switch') {
        await say('Reviens, ' + M.name(B.me) + ' !', 0.9);
        G.Overworld.setFollowerHidden(null);
        await tween(0.2, k => { B.aMe.alpha = 1 - k; });
        await sendOut(act.i);
        await say('Vas-y, ' + M.name(B.me) + ' !', 0.9);
      } else {
        meFirst = spd(B.me, 'me') > spd(B.foe, 'foe') || (spd(B.me, 'me') === spd(B.foe, 'foe') && Math.random() < 0.5);
        if (meFirst) { await useMove('me', act.id); foeActs = B.foe.hp > 0; }
      }
      if (B.foe.hp > 0 && foeActs) {
        await useMove('foe', foeMove());
        if (act.type === 'move' && !meFirst && B.me.hp > 0 && B.foe.hp > 0) await useMove('me', act.id);
      }
      // K.O.
      if (B.foe.hp <= 0) {
        await faint('foe');
        await gainXp();
        if (B.trainer && B.fi + 1 < B.foes.length) {
          await foeOut(B.fi + 1);
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
    }
  }

  return { start, update, drawables, drawBall, evolutions, get active() { return active; },
           get focus() { return B ? { x: (B.slotMe.x + B.slotFoe.x) / 2, y: (B.slotMe.y + B.slotFoe.y) / 2 } : null } };
})();
