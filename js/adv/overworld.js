/* ============ overworld.js — l'Aventure sur la carte de Kanto (version de Nika) ============
 * Tu es un dresseur (people.js) et tes Pokémon te suivent à la file. On se
 * promène de Bourg Palette à Argenta (kanto.js) comme dans l'animé : le Prof.
 * Chen, Régis, la Forêt de Jade et son Samouraï, puis l'arène de Pierre.
 * Hautes herbes = Pokémon sauvages ; les dresseurs t'arrêtent quand ils te
 * voient. Les combats se jouent au tour par tour sur la carte (battle.js).
 * À la fin d'un chapitre : un choix de récompense, et on enchaîne aussitôt.
 *
 * Sauvegarde : save.adv2 = { team, box, map, x, y, dir, flags, ch, balls, potions, money, heal }
 */
G.Overworld = (() => {
  const $ = id => document.getElementById(id);
  const K = () => G.Kanto;
  const M = () => G.AdvMon;
  const TS = 32;
  const SOLID = new Set(['#', 'w']);
  const SPEED = TS * 4;      // 4 cases par seconde en marchant, le double en courant
  const STARTERS = [1, 4, 7];
  // Les Pokémon proposés à la fin de chaque chapitre (ceux de l'animé à cet endroit).
  const CATCH = {
    1: [16, 19, 21, 25, 29, 32, 56, 52],
    2: [10, 13, 25, 11, 14, 123, 127, 46],
    3: [74, 95, 27, 50, 41, 66, 104, 111],
    4: [35, 41, 46, 74, 39, 54, 60, 118]
  };

  let S = null;              // la sauvegarde de l'Aventure
  let map = null, mapKey = '', bg = null, npcs = [];
  let open_ = false, raf = 0, last = 0, time = 0;
  let cv = null, ctx = null, dpr = 1, vw = 0, vh = 0, zoom = 2;
  let busy = false;          // dialogue, combat ou évènement en cours
  let cam = { x: 0, y: 0 };
  const pl = { x: 0, y: 0, dir: 'down', walkT: 0, moving: false, tile: '' };
  let trail = [], followers = [], hiddenMon = null, fxs = [], bumpT = 0;
  let stick = null;          // joystick tactile { id, x0, y0, x, y }
  const keys = new Set();

  // ---------------- sauvegarde ----------------
  function save() {
    const s = G.DB.save;
    if (!s.adv2) s.adv2 = { team: [], box: [], map: 'bourg_maison', x: 4, y: 6, dir: 'up', flags: {}, ch: 1, potions: 0, money: 500, heal: { map: 'bourg_maison', x: 7, y: 4 } };
    return s.adv2;
  }
  function commit() {
    if (!S) return;
    S.map = mapKey; S.x = Math.floor(pl.x / TS); S.y = Math.floor((pl.y - 4) / TS); S.dir = pl.dir;
    G.DB.commit();
  }
  function heal() { for (const m of S.team) M().restore(m); }

  // ---------------- la carte ----------------
  // Version de Nika : les vraies cartes de Rouge Feu (kanto-art.js) : une image du dessous,
  // une image du dessus (toits, cimes) qui passe devant les personnages, et la grille.
  let art = null, def = null, top = null;
  const at = (x, y) => (art.grid[y] || '')[x] || '#';
  function img(src) { const i = new Image(); i.src = src; return i; }

  /** La porte (warp) en (x, y) et ce qu'elle fait ici, ou null. */
  function warpAt(x, y) {
    const w = art.warps.find(w => w.x === x && w.y === y);
    if (!w) return null;
    // Les vrais intérieurs : on entre / on sort (les escaliers vers l'étage restent fermés).
    if (w.dest && G.KantoArt.maps[w.dest]) return { ...w, ev: art.inside ? 'exit' : 'enter' };
    if (art.inside) return { ...w, ev: 'stairs' };
    const k = Object.keys(def.doors || {}).find(k => w.to.includes(k));
    return k ? { ...w, ev: def.doors[k] } : { ...w, ev: 'closed' };
  }

  // ---------------- personnages ----------------
  const SKIP = new Set(['item_ball', 'cut_tree', 'var_0', 'push_boulder', 'prof_oak', 'blue', 'pokedex', 'town_map', 'old_amber']);
  // Les Pokémon posés sur la carte (le Piafabec de Jadielle, le Rondoudou du Centre…) : dessinés avec nos sprites.
  const MONS = { spearow: 21, nidoran_m: 32, jigglypuff: 39, pikachu: 25, clefairy: 35, meowth: 52 };
  const FACE = { face_left: 'left', face_right: 'right', face_up: 'up', face_down_and_up: 'down' };
  function loadNpcs() {
    const story = (K().NPCS[mapKey] || []).filter(n => !n.when || n.when(S.flags));
    const amb = art.objs.filter(o => !SKIP.has(o.gfx)).map((o, i) => {
      const t = o.trainer && K().TRAINERS[o.script];
      return { id: mapKey + '_' + i, look: G.People.has(o.gfx) ? o.gfx : 'boy', mon: MONS[o.gfx], x: o.x, y: o.y, dir: FACE[o.mv] || 'down',
        trainer: t ? { ...t, sees: Math.max(2, +o.sight || 3) } : null,
        talk: () => [['', K().TALK[o.script] || 'Bonjour ! Belle journée pour une balade avec ses Pokémon.']] };
    }).filter(n => !story.some(s2 => s2.x === n.x && s2.y === n.y));
    npcs = story.concat(amb).map(n => {
      const o = { ...n, px: n.x * TS + 16, py: n.y * TS + 30, d: n.dir, walkT: 0, moving: false, bubble: 0 };
      if (n.mon) { o.anim = new G.Sprites.Animator(n.mon, 1, false); o.anim.loop('Idle'); o.anim.dir = 0; }
      return o;
    });
  }

  // Version de Nika : on se déplace case par case, comme dans les jeux.
  const tileOf = (x = pl.x, y = pl.y) => [Math.floor(x / TS), Math.floor((y - 4) / TS)];
  const inMap = (x, y) => x >= 0 && y >= 0 && x < art.w && y < art.h;
  const npcAt = (x, y) => npcs.some(n => Math.floor(n.px / TS) === x && Math.floor((n.py - 4) / TS) === y);
  const LEDGE = { v: [0, 1], '<': [-1, 0], '>': [1, 0] };
  /** Essaie de faire un pas (ou un saut de rebord) dans la direction dir. */
  function tryStep(dir, running) {
    const [dx, dy] = DIRV[dir], [x, y] = tileOf(), nx = x + dx, ny = y + dy;
    const dur = TS / (SPEED * (running ? 2 : 1));
    if (!inMap(nx, ny)) {
      const e = connAt(nx, ny);
      if (e) run(() => leave(e)); else bumpWall();
      return;
    }
    const ch = at(nx, ny), lg = LEDGE[ch];
    if (lg) {
      // Rebord : on saute par-dessus, seulement dans son sens.
      if (lg[0] === dx && lg[1] === dy && inMap(nx + dx, ny + dy) && !SOLID.has(at(nx + dx, ny + dy)) && !npcAt(nx + dx, ny + dy)) {
        G.Audio.sfx('click');
        pl.step = { x0: pl.x, y0: pl.y, x1: (nx + dx) * TS + 16, y1: (ny + dy) * TS + 30, t: 0, dur: 0.5, jump: true };
      } else bumpWall();
      return;
    }
    if (SOLID.has(ch) || npcAt(nx, ny)) { bumpWall(); return; }
    pl.step = { x0: pl.x, y0: pl.y, x1: nx * TS + 16, y1: ny * TS + 30, t: 0, dur };
  }
  function bumpWall() {
    if (bumpT) return;
    bumpT = 0.35;
    bump();
  }
  /** La connexion vers une autre carte quand on sort par un bord, ou null. */
  function connAt(tx, ty) {
    const dir = ty < 0 ? 'up' : ty >= art.h ? 'down' : tx < 0 ? 'left' : tx >= art.w ? 'right' : null;
    if (!dir) return null;
    const c = art.conns.find(c => c.dir === dir);
    if (!c) return null;
    const to = G.KantoArt.maps[c.map];
    // Au-delà de la carte voisine (ou une carte pas encore faite) : bloqué.
    const v = (dir === 'up' || dir === 'down' ? tx : ty) - c.offset;
    if (!to) return { dir, map: c.map, todo: true };
    if (v < 0 || v >= (dir === 'up' || dir === 'down' ? to.w : to.h)) return null;
    return dir === 'up' ? { dir, map: c.map, x: v, y: to.h - 1 } : dir === 'down' ? { dir, map: c.map, x: v, y: 0 }
         : dir === 'left' ? { dir, map: c.map, x: to.w - 1, y: v } : { dir, map: c.map, x: 0, y: v };
  }

  function setMap(key, tx, ty, dir) {
    mapKey = key;
    art = G.KantoArt.maps[key];
    def = K().MAPS[key];
    if (!art._bg) { art._bg = img(art.base); art._top = img(art.top); }
    bg = art._bg; top = art._top;
    loadNpcs();
    pl.x = tx * TS + 16; pl.y = ty * TS + 30; pl.dir = dir || pl.dir; pl.step = null; pl.hop = 0;
    pl.tile = tx + ',' + ty;
    trail = [];
    for (let i = 0; i < 200; i++) trail.push({ x: pl.x, y: pl.y });
    followers.forEach(f => { f.x = pl.x; f.y = pl.y; });
    G.Audio.music(def.music);
    $('world-place').textContent = def.name;
    snapCam();
  }

  function refreshFollowers() {
    const old = followers;
    followers = S.team.map(m => {
      const was = old.find(f => f.m === m);
      if (was && was.anim.dex === m.dex) return was;
      const shiny = G.DB.ownsShiny(m.dex);
      const a = new G.Sprites.Animator(m.dex, 1, shiny);
      a.loop('Idle');
      return { m, anim: a, x: was ? was.x : pl.x, y: was ? was.y : pl.y };
    });
    G.Sprites.preload(S.team.map(m => m.dex), 6000, false);
  }
  function setFollowerHidden(m) { hiddenMon = m; }

  // ---------------- boucle ----------------
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = cv.clientWidth; vh = cv.clientHeight;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    zoom = Math.max(1.25, Math.min(2.5, Math.min(vw, vh) / (TS * 9)));
  }
  function snapCam() {
    const f = G.AdvBattle.active && G.AdvBattle.focus || { x: pl.x, y: pl.y - 16 };
    const W = art.w * TS, H = art.h * TS, hw = vw / zoom / 2, hh = vh / zoom / 2;
    cam.x = W < hw * 2 ? W / 2 : Math.max(hw, Math.min(W - hw, f.x));
    cam.y = H < hh * 2 ? H / 2 : Math.max(hh, Math.min(H - hh, f.y));
  }

  function axis() {
    if (stick) {
      const dx = stick.x - stick.x0, dy = stick.y - stick.y0, d = Math.hypot(dx, dy);
      if (d < 8) return [0, 0];
      return [dx / d, dy / d];
    }
    let x = 0, y = 0;
    if (keys.has('arrowleft') || keys.has('keya') || keys.has('keyq')) x -= 1;
    if (keys.has('arrowright') || keys.has('keyd')) x += 1;
    if (keys.has('arrowup') || keys.has('keyw') || keys.has('keyz')) y -= 1;
    if (keys.has('arrowdown') || keys.has('keys')) y += 1;
    const d = Math.hypot(x, y);
    return d ? [x / d, y / d] : [0, 0];
  }

  function frame(ts) {
    if (!open_) return;
    raf = requestAnimationFrame(frame);
    if (cv.clientWidth !== vw || cv.clientHeight !== vh) resize();
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts; time += dt;
    try { update(dt); draw(); } catch (e) { console.error('[Overworld]', e); }
  }

  function update(dt) {
    G.AdvBattle.update(dt);
    bumpT = Math.max(0, bumpT - dt);
    const [ax, ay] = busy ? [0, 0] : axis();
    const running = keys.has('shiftleft') || keys.has('shiftright') || keys.has('keyx') || (stick && Math.hypot(stick.x - stick.x0, stick.y - stick.y0) > 45);
    let left = dt;
    while (left > 0) {
      if (!pl.step) {
        if (busy || !(ax || ay)) break;
        pl.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 'left' : 'right') : (ay < 0 ? 'up' : 'down');
        tryStep(pl.dir, running);
        if (!pl.step) break;
      }
      const st = pl.step, use = Math.min(left, st.dur - st.t);
      st.t += use; left -= use;
      pl.walkT += use * (running && !st.jump ? 1.6 : 1);
      const k = st.t / st.dur;
      pl.x = st.x0 + (st.x1 - st.x0) * k; pl.y = st.y0 + (st.y1 - st.y0) * k;
      pl.hop = st.jump ? Math.sin(k * Math.PI) * 18 : 0;
      if (st.t >= st.dur) {
        pl.step = null; pl.hop = 0;
        pl.x = st.x1; pl.y = st.y1;
        afterMove();
        if (busy) break;
      }
    }
    pl.moving = !!pl.step;
    // La file des Pokémon qui suivent.
    const h = trail[0];
    if (!h || Math.hypot(h.x - pl.x, h.y - pl.y) > 2) { trail.unshift({ x: pl.x, y: pl.y }); if (trail.length > 400) trail.pop(); }
    let k = 0;
    for (const f of followers) {
      if (f.m === hiddenMon || f.m.hp <= 0) continue;
      k++;
      const p = trailAt(k * TS);
      const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
      if (d > 0.5) {
        f.x += dx * Math.min(1, dt * 12); f.y += dy * Math.min(1, dt * 12);
        if (d > 1.5) f.anim.dir = G.Sprites.dirFromAngle(Math.atan2(dy, dx));
        f.anim.loop(d > 1.5 ? 'Walk' : 'Idle');
      } else f.anim.loop('Idle');
      f.anim.update(dt);
    }
    for (const n of npcs) { if (n.bubble) n.bubble = Math.max(0, n.bubble - dt); if (n.anim) n.anim.update(dt); }
    for (let i = fxs.length - 1; i >= 0; i--) { fxs[i].t += dt; if (fxs[i].t > 0.9) fxs.splice(i, 1); }
    // Caméra douce.
    const c0 = { ...cam };
    snapCam();
    cam.x = c0.x + (cam.x - c0.x) * Math.min(1, dt * 8);
    cam.y = c0.y + (cam.y - c0.y) * Math.min(1, dt * 8);
  }
  function trailAt(dist) {
    let acc = 0;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i], d = Math.hypot(b.x - a.x, b.y - a.y);
      if (acc + d >= dist) { const k = (dist - acc) / (d || 1); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; }
      acc += d;
    }
    return trail[trail.length - 1] || pl;
  }

  function draw() {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = art.inside ? '#000' : '#183018'; c.fillRect(0, 0, vw, vh);
    c.setTransform(dpr * zoom, 0, 0, dpr * zoom, Math.round(dpr * (vw / 2 - cam.x * zoom)), Math.round(dpr * (vh / 2 - cam.y * zoom)));
    c.imageSmoothingEnabled = false;
    if (bg.complete) c.drawImage(bg, 0, 0, art.w * TS, art.h * TS);
    const list = [];
    for (const n of npcs) list.push({ y: n.py, draw: x => {
      if (n.anim) { G.Sprites.drawShadow(x, n.mon, n.px, n.py - 6, 1); n.anim.draw(x, n.px, n.py - 6); }
      else G.People.draw(x, n.look, n.px, n.py, n.d, n.walkT, n.moving);
      if (n.bubble) { x.fillStyle = '#fff'; x.fillRect(n.px - 7, n.py - 66, 14, 16); x.fillStyle = '#e03030'; x.fillRect(n.px - 2, n.py - 63, 4, 7); x.fillRect(n.px - 2, n.py - 54, 4, 3); }
    } });
    for (const f of followers) {
      if (f.m === hiddenMon || f.m.hp <= 0) continue;
      list.push({ y: f.y, draw: x => { G.Sprites.drawShadow(x, f.m.dex, f.x, f.y, 1); f.anim.draw(x, f.x, f.y); grass(x, f.x, f.y); } });
    }
    list.push({ y: pl.y + 0.1, draw: x => {
      if (pl.hop) { x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(pl.x, pl.y - 2, 11, 4, 0, 0, 6.2832); x.fill(); }
      G.People.draw(x, 'hero', pl.x, pl.y - pl.hop, pl.dir, pl.walkT, pl.moving);
      if (!pl.hop) grass(x, pl.x, pl.y);
    } });
    for (const d of G.AdvBattle.drawables()) list.push(d);
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(c);
    // Toits et cimes des arbres : devant les personnages.
    if (top.complete) c.drawImage(top, 0, 0, art.w * TS, art.h * TS);
    G.AdvBattle.drawBall(c);
    for (const f of fxs) {
      const k = f.t / 0.9;
      c.globalAlpha = 1 - k;
      c.fillStyle = f.color;
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; c.fillRect(f.x + Math.cos(a) * k * 30 - 2, f.y + Math.sin(a) * k * 30 - 2, 4, 4); }
      if (f.dmg) {
        c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
        c.fillStyle = '#000'; c.fillText(f.dmg, f.x + 1, f.y - 12 - k * 20 + 1);
        c.fillStyle = '#fff'; c.fillText(f.dmg, f.x, f.y - 12 - k * 20);
      }
      c.globalAlpha = 1;
    }
  }
  /** Les hautes herbes cachent les pieds (on redessine le bas de la case par-dessus). */
  function grass(c, x, y) {
    const [tx, ty] = tileOf(x, y);
    if (at(tx, ty) !== 'g' || !bg.complete) return;
    c.drawImage(bg, tx * 16, ty * 16 + 8, 16, 8, tx * TS, ty * TS + 16, TS, 16);
  }
  function fx(x, y, color, dmg) { fxs.push({ x, y, color, dmg, t: 0 }); }

  // ---------------- interactions ----------------
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function front() {
    const [dx, dy] = DIRV[pl.dir], [x, y] = tileOf();
    return { x: x + dx, y: y + dy };
  }
  function bump() { interact(true); }
  function interact(fromBump) {
    if (busy) return;
    const f = front();
    const [ddx, ddy] = DIRV[pl.dir];
    const at2 = (x, y) => npcs.find(n => Math.floor(n.px / TS) === x && Math.floor((n.py - 4) / TS) === y);
    let n = at2(f.x, f.y);
    // Par-dessus un comptoir (Infirmière Joëlle, vendeur) : on parle à la personne derrière.
    if (!n && at(f.x, f.y) === '#') { n = at2(f.x + ddx, f.y + ddy); if (n && !n.event) n = null; }
    if (n) { run(() => talkNpc(n)); return; }
    const w = warpAt(f.x, f.y);
    if (w) { run(() => door(w)); return; }
    const sg = art.signs.find(b => b.x === f.x && b.y === f.y);
    if (sg && (!fromBump || pl.dir === 'up')) run(() => talk([['', K().SIGNS[sg.script] || K().SIGN_DEFAULT]]));
  }
  /** Lance une suite d'évènements (bloque les mouvements pendant ce temps). */
  async function run(fn) {
    if (busy) return;
    busy = true;
    keys.clear(); stick = null;
    try { await fn(); } catch (e) { console.error('[Overworld]', e); }
    busy = false;
    hud();
    commit();
  }
  const talk = lines => G.AdvUI.talkP(lines);

  function faceTo(n) {
    const dx = pl.x - n.px, dy = pl.y - n.py;
    n.d = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  }

  async function talkNpc(n) {
    faceTo(n);
    if (n.trainer) {
      if (S.flags['tr_' + n.id]) { await talk([[n.trainer.name, n.trainer.lose]]); return; }
      await trainerFight(n);
      return;
    }
    if (n.ball) { await ball(n); return; }
    if (n.event === 'chen') { await chen(); return; }
    if (n.event === 'rival1') { await rival1(n); return; }
    if (n.event === 'mom') { await mom(); return; }
    if (n.event === 'center') { await center(); return; }
    if (n.event === 'mart') { await talk([['Vendeur', 'Bienvenue ! Que puis-je pour toi ?']]); await mart(); return; }
    if (n.event === 'pierre') { await pierre(n); return; }
    if (n.talk) await talk(n.talk(S.flags));
  }

  // Les dresseurs qui te voient viennent te parler.
  function checkSight() {
    const tx = Math.floor(pl.x / TS), ty = Math.floor((pl.y - 4) / TS);
    for (const n of npcs) {
      if (!n.trainer || S.flags['tr_' + n.id]) continue;
      const nx = Math.floor(n.px / TS), ny = Math.floor((n.py - 4) / TS);
      const [dx, dy] = DIRV[n.d];
      for (let i = 1; i <= n.trainer.sees; i++) {
        const cx = nx + dx * i, cy = ny + dy * i;
        if (at(cx, cy) === '#' || at(cx, cy) === 'w') break;
        const lat = dx ? Math.abs(ty - cy) : Math.abs(tx - cx);
        if ((dx ? tx === cx : ty === cy) && lat <= 1) { run(() => spotted(n)); return true; }
      }
    }
    return false;
  }
  async function spotted(n) {
    n.bubble = 0.9;
    G.Audio.sfx('select');
    await new Promise(r => setTimeout(r, 700));
    // Il marche jusqu'à toi.
    const tx = pl.x - DIRV[n.d][0] * TS, ty = pl.y - DIRV[n.d][1] * TS;
    await new Promise(res => {
      const step = () => {
        const dx = tx - n.px, dy = ty - n.py, d = Math.hypot(dx, dy);
        if (d < 1 || !open_) { n.px = Math.round(tx); n.py = Math.round(ty); n.moving = false; res(); return; }
        n.moving = true; n.walkT += 1 / 60;
        const v = Math.min(d, 3);
        if (Math.abs(dx) > 1) n.px += dx / d * v;
        else n.py += dy / d * v;
        requestAnimationFrame(step);
      };
      step();
    });
    faceTo(n);
    pl.dir = n.d === 'up' ? 'down' : n.d === 'down' ? 'up' : n.d === 'left' ? 'right' : 'left';
    await trainerFight(n);
  }
  async function trainerFight(n) {
    await talk([[n.trainer.name, n.trainer.meet]]);
    const res = await battle({ trainer: n.trainer }, n);
    if (res === 'win') {
      S.flags['tr_' + n.id] = 1;
      S.money += n.trainer.coins || 0;
      await talk([[n.trainer.name, n.trainer.lose], ['', 'Tu gagnes ' + (n.trainer.coins || 0) + ' pièces.']]);
    }
  }

  function canFight() { return S.team.some(m => m.hp > 0); }

  /** Un combat : places des deux Pokémon sur la carte, puis évolutions ou K.O. */
  async function battle(opts, n) {
    if (!canFight()) { await blackout(); return 'lose'; }
    // Les deux Pokémon se font face entre toi et l'adversaire, un peu sur le côté.
    const [dx, dy] = DIRV[pl.dir];
    const ox = n ? n.px : pl.x + dx * 170, oy = n ? n.py : pl.y + dy * 170;
    let ux = ox - pl.x, uy = oy - pl.y;
    const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const mx = (pl.x + ox) / 2, my = (pl.y + oy) / 2, gap = 44, side = ul < 140 ? 64 : 28;
    const sx = -uy * side, sy = Math.abs(ux) * side;
    const place = { me: { x: mx - ux * gap + sx, y: my - uy * gap + sy }, foe: { x: mx + ux * gap + sx, y: my + uy * gap + sy } };
    $('world-hud').classList.add('dim');
    const res = await G.AdvBattle.start(opts, place);
    $('world-hud').classList.remove('dim');
    G.Audio.music(def.music);
    if (res === 'lose') { await blackout(); return res; }
    await G.AdvBattle.evolutions();
    refreshFollowers();
    return res;
  }

  async function blackout() {
    await talk([['', 'Tu n\'as plus de Pokémon en forme… Tu cours au Centre Pokémon le plus proche.']]);
    heal();
    let h = S.heal || {};
    if (!G.KantoArt.maps[h.map]) h = { map: 'bourg_maison', x: 7, y: 4 };
    setMap(h.map, h.x, h.y, h.map === 'bourg_maison' ? 'right' : 'up');
    await talk([[h.map.startsWith('bourg') ? 'Maman' : 'Infirmière Joëlle', 'Tes Pokémon sont en pleine forme. Fais attention à toi !']]);
  }

  function afterMove() {
    const [tx, ty] = tileOf();
    const key = tx + ',' + ty;
    if (key === pl.tile) return;
    pl.tile = key;
    const w = warpAt(tx, ty);
    if (w) { run(() => door(w)); return; }
    if (checkSight()) return;
    if (at(tx, ty) === 'g') {
      G.AdvFX.burst('grass', pl.x, pl.y - 8, 5, 0.35);
      if (def.wild && canFight() && Math.random() < 1 / 10) {
        const [dex, a, b] = G.U.pick(def.wild);
        run(() => battle({ wild: [dex, a + Math.floor(Math.random() * (b - a + 1))] }));
      }
    }
  }

  async function leave(e) {
    // Les passages bloqués par l'histoire.
    const back = () => {};   // (on n'a pas encore bougé : le pas se fait case par case)
    if (e.todo) { back(); await talk([['', 'Cette route n\'est pas encore ouverte. La suite de l\'aventure arrive bientôt !']]); return; }
    if (mapKey === 'bourg' && !S.flags.starter) {
      back();
      await talk([['Prof. Chen', 'Hé ! Attends ! Il est dangereux de partir sans Pokémon ! Viens me voir dans mon labo, au sud.']]);
      return;
    }
    if (mapKey === 'jadielle' && e.map === 'route2' && !S.flags.ch1done) {
      back();
      await talk([['', 'Tes Pokémon sont fatigués par la route. Passe d\'abord au Centre Pokémon de Jadielle.']]);
      return;
    }
    await fade(() => setMap(e.map, e.x, e.y, e.dir));
    commit();
    if (e.map === 'argenta' && S.ch === 2) await chapterEnd();
  }
  function fade(fn) {
    const el = $('world-fade');
    el.classList.add('on');
    return new Promise(res => setTimeout(() => { fn(); el.classList.remove('on'); setTimeout(res, 200); }, 220));
  }

  /** Les entrées de la Forêt de Jade : on passe directement de la Route 2 à la forêt (et retour). */
  async function link(w) {
    const to = mapKey === 'foret' ? 'route2' : 'foret';
    const ws = G.KantoArt.maps[to].warps.filter(x => x.to === w.to);
    if (!ws.length) return;
    const t = ws[Math.floor(ws.length / 2)];
    const tm = G.KantoArt.maps[to], [dx, dy] = DIRV[pl.dir];
    const free = (x, y) => { const c = (tm.grid[y] || '')[x]; return c && c !== '#' && c !== 'w'; };
    let x = t.x, y = t.y;
    for (const [ax, ay] of [[dx, dy], [-dx, -dy], [0, 1], [0, -1], [1, 0], [-1, 0]]) if (free(t.x + ax, t.y + ay)) { x = t.x + ax; y = t.y + ay; break; }
    await fade(() => setMap(to, x, y, pl.dir));
  }

  // ---------------- l'histoire ----------------
  async function chen() {
    if (S.flags.starter) {
      await talk([['Prof. Chen', S.flags.ch1done ? 'Ton Pokédex se remplit ? Continue comme ça !' : 'Va jusqu\'à Jadielle par la Route 1, au nord. Les hautes herbes sont pleines de Pokémon sauvages !']]);
      return;
    }
    await talk([['Prof. Chen', 'Ah, te voilà ! Tu es en retard, Régis est déjà là…'],
                ['Prof. Chen', 'Il reste trois Pokémon dans les Poké Balls sur la table. Choisis bien : il sera ton premier compagnon !']]);
    const i = await G.AdvUI.choose('Choisis ton premier Pokémon', STARTERS.map(d => ({ dex: d, title: G.DEX_BY[d].name, types: G.DEX_BY[d].types })));
    await pickStarter(STARTERS[i]);
  }
  /** Une Poké Ball de la table du labo : on regarde le Pokémon et on le prend (ou pas). */
  async function ball(n) {
    if (S.flags.starter) return;
    const p = G.DEX_BY[n.ball];
    const i = await G.AdvUI.choose('Prof. Chen : tu veux ' + p.name + ' ?', [
      { dex: n.ball, title: 'Oui, je prends ' + p.name, types: p.types },
      { title: 'Non, je réfléchis', desc: '' }
    ]);
    if (i === 0) await pickStarter(n.ball);
  }
  async function pickStarter(dex) {
    S.team = [M().make(dex, 5)];
    S.flags.starter = dex;
    G.DB.grant(dex, 'adv');
    refreshFollowers();
    G.Audio.sfx('legend');
    S.potions += 2;
    await talk([['', 'Tu as choisi ' + G.DEX_BY[dex].name + ' !'],
                ['Prof. Chen', 'Prends aussi ces 2 Potions. Et à la fin de chaque étape de ton voyage, tu pourras capturer un Pokémon, lui apprendre une attaque ou entraîner ton équipe !']]);
    loadNpcs();
    // Régis prend la Poké Ball qui bat la tienne et te défie aussitôt, comme dans le jeu.
    const r = npcs.find(x => x.event === 'rival1');
    if (r) await rival1(r);
  }
  async function rival1(n) {
    if (!S.flags.starter) { await talk([['Régis', 'Pff, le Prof. Chen m\'a dit d\'attendre. Choisis vite, toi aussi !']]); return; }
    const counter = { 1: 4, 4: 7, 7: 1 }[S.flags.starter] || 4;
    await talk([['Régis', 'Alors je prends ' + G.DEX_BY[counter].name + ' ! Tiens, voyons ce que vaut le tien !']]);
    const res = await battle({ trainer: { name: 'Régis', team: [[counter, 5]], smart: true, potions: 0 } }, n);
    S.flags.rival1 = 1;
    heal();
    await talk(res === 'win'
      ? [['Régis', 'Quoi ?! J\'ai perdu… Pff, c\'était de la chance ! On se reverra !'], ['Prof. Chen', 'Bravo ! Je soigne tes Pokémon. En route pour Jadielle, au nord !']]
      : [['Régis', 'Ha ! Trop facile ! Bye bye, le nul !'], ['Prof. Chen', 'Ne t\'en fais pas, je soigne tes Pokémon. Entraîne-toi sur la Route 1 !']]);
    npcs = npcs.filter(x => x !== n);
  }
  async function mom() {
    heal();
    if (S.flags.starter) G.Audio.sfx('levelup');
    await talk([['Maman', S.flags.starter ? 'Tu as l\'air épuisé ! Repose-toi un peu… Voilà, tes Pokémon sont en forme !' : 'Le grand jour ! Le Prof. Chen t\'attend dans son labo, au sud du village.']]);
    S.heal = { map: 'bourg_maison', x: 7, y: 4 };
  }
  async function center() {
    await talk([['Infirmière Joëlle', 'Bienvenue au Centre Pokémon ! Je soigne tes Pokémon…']]);
    heal();
    S.heal = { map: mapKey, x: 7, y: 4 };
    G.Audio.sfx('levelup');
    await talk([['Infirmière Joëlle', 'Voilà ! Tes Pokémon sont en pleine forme. À bientôt !']]);
    if (mapKey === 'jadielle_centre' && S.ch === 1) { S.flags.ch1done = 1; await chapterEnd(); }
  }
  async function pierre(n) {
    if (S.flags.pierre) { await talk([['Pierre', 'Tu as mon Badge Roche. Continue ta route, tu iras loin !']]); return; }
    await talk([['Pierre', 'Je suis Pierre, le champion d\'Argenta. Ma défense est solide comme le roc !'], ['Pierre', 'Montre-moi ta détermination !']]);
    const res = await battle({ trainer: { name: 'Pierre', team: [[74, 10], [95, 12]], smart: true } }, n);
    if (res === 'win') {
      S.flags.pierre = 1; S.money += 500;
      G.Audio.sfx('legend');
      await talk([['Pierre', 'Tu m\'as battu… Tu mérites ceci : le Badge Roche !'], ['', 'Tu obtiens le Badge Roche et 500 pièces !']]);
      if (S.ch === 3) await chapterEnd();
    }
  }

  /** Entrer dans un bâtiment (sa vraie carte) ou en sortir. */
  async function enter(w) {
    const to = G.KantoArt.maps[w.dest], t = to.warps[w.id] || to.warps[0];
    await fade(() => setMap(w.dest, t.x, t.y - 1, 'up'));
  }
  async function exit(w) {
    const to = G.KantoArt.maps[w.dest];
    // La porte du dehors qui mène ici (la plus proche du numéro donné par le jeu).
    const t = to.warps[w.id] && to.warps[w.id].dest === mapKey ? to.warps[w.id] : to.warps.find(x => x.dest === mapKey) || to.warps[w.id];
    await fade(() => setMap(w.dest, t.x, t.y + 1, 'down'));
  }

  async function door(w) {
    const ev = w.ev;
    if (ev === 'enter') { await enter(w); return; }
    if (ev === 'exit') { await exit(w); return; }
    if (ev === 'stairs') { await talk([['', 'L\'étage est privé.']]); return; }
    if (ev === 'link') { await link(w); return; }
    if (ev === 'cave') { await talk([['', 'La Cave Taupiqueur est sombre et pleine de Taupiqueur… Pas maintenant !']]); return; }
    if (ev === 'house') { await talk([['Habitant', 'On dit qu\'un Pikachu dresseur traîne dans le coin… Bizarre, non ?']]); return; }
    if (ev === 'gymJadielle') { await talk([['', 'L\'arène de Jadielle est fermée. Son champion est absent…']]); return; }
    await talk([['', 'C\'est fermé.']]);
  }

  async function mart() {
    for (;;) {
      const i = await G.AdvUI.choose('Boutique · ' + S.money + ' pièces', [
        { title: '3 Potions', desc: '300 pièces · +20 PV chacune', icon: 'up', off: S.money < 300 },
        { title: 'Au revoir', desc: '' }
      ]);
      if (i === 1) return;
      if (S.money < 300) { await talk([['Vendeur', 'Tu n\'as pas assez de pièces…']]); continue; }
      S.money -= 300;
      S.potions += 3;
      G.Audio.sfx('confirm');
    }
  }

  /** Fin de chapitre : on choisit sa récompense, puis le chapitre suivant commence tout de suite. */
  async function chapterEnd() {
    const ch = S.ch;
    G.Audio.sfx('legend');
    await talk([['', 'Chapitre ' + ch + ' terminé : ' + K().CHAPTERS[ch].title + ' !']]);
    for (;;) {
      const i = await G.AdvUI.choose('Choisis ta récompense', [
        { icon: 'pball', title: 'Capturer un Pokémon', desc: 'Un Pokémon de la région parmi 3' },
        { icon: 'book', title: 'Apprendre une capacité', desc: 'Le Maître des capacités enseigne une attaque en avance' },
        { icon: 'candy', title: 'Entraîner l\'équipe', desc: '+2 niveaux pour toute l\'équipe' },
        { icon: 'gift', title: 'Le sac du voyageur', desc: '5 Potions, 2 Total Soin et 500 pièces' }
      ]);
      if (i === 0) { await capture(ch); break; }
      if (i === 1) { if (await tutor()) break; continue; }
      if (i === 2) { await train(2); break; }
      S.potions += 5; S.cures = (S.cures || 0) + 2; S.money += 500;
      G.Audio.sfx('confirm');
      await talk([['', 'Tu reçois 5 Potions, 2 Total Soin et 500 pièces !']]);
      break;
    }
    S.ch = Math.min(K().CHAPTERS.length - 1, ch + 1);
    commit();
    await intro();
  }
  /** Capturer : 3 cartes de Pokémon de la région (ceux de l'animé à cet endroit). */
  async function capture(ch) {
    const avg = Math.max(2, Math.round(S.team.reduce((a, m) => a + m.lv, 0) / Math.max(1, S.team.length)));
    const all = CATCH[ch] || CATCH[1];
    const fresh = all.filter(d => G.DEX_BY[d] && !S.team.some(m => m.dex === d) && !S.box.some(m => m.dex === d));
    const pool = (fresh.length >= 3 ? fresh : all.slice()).sort(() => Math.random() - 0.5);
    const picks = pool.slice(0, 3);
    const i = await G.AdvUI.choose('Un Pokémon veut te rejoindre ! Lequel captures-tu ?',
      picks.map(d => ({ dex: d, title: G.DEX_BY[d].name, types: G.DEX_BY[d].types, desc: 'Niveau ' + avg + ' · ' + M().movesAt(d, avg).map(M().moveName).join(', ') })));
    const dex = picks[i];
    const m = M().make(dex, avg);
    if (S.team.length < 6) S.team.push(m); else S.box.push(m);
    G.DB.grant(dex, 'adv');
    refreshFollowers();
    G.Audio.sfx('confirm');
    await talk([['', 'Et hop ! ' + G.DEX_BY[dex].name + ' est capturé' + (S.team.includes(m) ? ' et te suit !' : ' et part dans ta boîte.')]]);
  }
  /** Le Maître des capacités : une des prochaines attaques du Pokémon, apprise tout de suite. Rend true si appris. */
  async function tutor() {
    for (;;) {
      const j = await G.AdvUI.choose('Quel Pokémon apprend une capacité ?', S.team.map(m => ({ dex: m.dex, title: M().name(m), desc: 'N. ' + m.lv + ' · ' + m.moves.map(M().moveName).join(', ') }))
        .concat([{ title: 'Retour', desc: '' }]));
      if (j >= S.team.length) return false;
      const m = S.team[j], ids = M().nextMoves(m, 3);
      if (!ids.length) { await talk([['Maître des capacités', M().name(m) + ' connaît déjà toutes ses attaques !']]); continue; }
      const k = await G.AdvUI.choose('Quelle capacité pour ' + M().name(m) + ' ?', ids.map(id => ({ icon: 'move:' + id, title: M().moveName(id), desc: M().moveInfo(id) }))
        .concat([{ title: 'Retour', desc: '' }]));
      if (k >= ids.length) continue;
      if (await G.AdvBattle.learn(m, ids[k], false)) return true;
    }
  }
  /** Entraîner : des niveaux pour toute l'équipe (attaques et évolutions comprises). */
  async function train(n) {
    G.Audio.sfx('levelup');
    await talk([['', 'Ton équipe s\'entraîne dur… Tous tes Pokémon gagnent ' + n + ' niveaux !']]);
    for (const m of S.team) for (let i = 0; i < n && m.lv < 100; i++) await G.AdvBattle.levelUp(m, false, true);
    await G.AdvBattle.evolutions();
    refreshFollowers();
  }
  async function intro() {
    const c = K().CHAPTERS[S.ch];
    hud();
    const el = $('world-banner');
    el.innerHTML = `<small>Chapitre ${S.ch}</small><b>${c.title}</b>`;
    el.classList.add('on');
    await new Promise(r => setTimeout(r, 1600));
    el.classList.remove('on');
    await talk(c.intro);
    S.flags['intro' + S.ch] = 1;
  }

  // ---------------- interface ----------------
  function hud() {
    if (!S) return;
    const c = K().CHAPTERS[S.ch];
    $('world-ch').textContent = 'Chapitre ' + S.ch + ' · ' + c.title;
    $('world-goal').textContent = c.goal;
  }
  async function menu() {
    if (busy) return;
    run(async () => {
      for (;;) {
        const i = await G.AdvUI.choose('Menu · ' + S.money + ' pièces · ' + S.potions + ' Potions', [
          { icon: 'pball', title: 'Équipe', desc: S.team.length + ' Pokémon' },
          { icon: 'up', title: 'Objectif', desc: K().CHAPTERS[S.ch].goal },
          { title: 'Quitter', desc: 'Sauvegarde et retour au menu' },
          { title: 'Fermer', desc: '' }
        ]);
        if (i === 0) {
          if (!S.team.length) continue;
          const j = await G.AdvUI.choose('Touche un Pokémon pour qu\'il mène l\'équipe', S.team.map((m, k) => ({ dex: m.dex,
            title: M().name(m) + (k === 0 ? ' (tête)' : ''), desc: 'N. ' + m.lv + ' · ' + Math.ceil(m.hp) + '/' + M().maxHp(m) + ' PV' + (m.st ? ' · ' + G.AdvBattle.ST_NAME[m.st] : '') + ' · ' + m.moves.map(M().moveName).join(', ') })));
          if (j > 0) { const [m] = S.team.splice(j, 1); S.team.unshift(m); refreshFollowers(); }
        } else if (i === 1) await talk([['', K().CHAPTERS[S.ch].goal]]);
        else if (i === 2) { quit(); return; }
        else return;
      }
    });
  }

  function open() {
    if (G.Game.state !== 'ui') G.Game.toUI();
    G.UI.chrome(false);
    S = save();
    S.flags = S.flags || {};
    S.team.concat(S.box).forEach(M().migrate);
    G.UI.show('scr-world');
    open_ = true;
    resize();
    refreshFollowers();
    setMap(S.map || 'bourg', S.x == null ? 4 : S.x, S.y == null ? 5 : S.y, S.dir || 'down');
    hud();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    busy = false;
    if (!S.flags.intro1) run(intro);
  }
  function quit() {
    commit();
    open_ = false;
    cancelAnimationFrame(raf);
    G.PickUI.open();
  }

  function init() {
    cv = $('world-cv');
    ctx = cv.getContext('2d');
    $('world-menu').onclick = e => { e.stopPropagation(); menu(); };
    $('world-act').onclick = e => { e.stopPropagation(); interact(false); };
    // Joystick : on pose le doigt n'importe où sur la carte.
    cv.addEventListener('pointerdown', e => {
      if (busy) return;
      stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: performance.now() };
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* rien */ }
    });
    cv.addEventListener('pointermove', e => {
      if (!stick || e.pointerId !== stick.id) return;
      stick.x = e.clientX; stick.y = e.clientY;
      const dx = stick.x - stick.x0, dy = stick.y - stick.y0, d = Math.hypot(dx, dy);
      if (d > 60) { stick.x0 = stick.x - dx / d * 60; stick.y0 = stick.y - dy / d * 60; }
    });
    const up = e => {
      if (!stick || e.pointerId !== stick.id) return;
      // Un simple toucher = parler / interagir.
      if (performance.now() - stick.t < 250 && Math.hypot(stick.x - stick.x0, stick.y - stick.y0) < 10) interact(false);
      stick = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => { stick = null; });
    addEventListener('keydown', e => {
      if (!open_) return;
      const c = (e.code || e.key).toLowerCase();
      keys.add(c);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space'].includes(c)) e.preventDefault();
      if (busy || e.repeat) return;
      if (c === 'space' || c === 'keye' || c === 'enter') interact(false);
      if (c === 'escape') menu();
    });
    addEventListener('keyup', e => keys.delete((e.code || e.key).toLowerCase()));
    addEventListener('blur', () => { keys.clear(); stick = null; });
  }

  return { open, quit, init, save: () => S || save(), player: () => pl, setFollowerHidden, refreshFollowers, fx,
           get active() { return open_; }, get busy() { return busy; } };
})();
