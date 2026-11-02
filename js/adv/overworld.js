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
  const SPEED = TS * 4.5;    // en courant : ×1,7
  // Version de Nika : on démarre petit, comme Sacha dans l'animé : Roucool, Rattata ou Pikachu.
  const STARTERS = [16, 19, 25];
  const card = d => ({ dex: d, title: G.DEX_BY[d].name, types: G.DEX_BY[d].types });
  // Les Pokémon qui vivent logiquement autour des lieux de chaque chapitre (jeux et animé).
  const HABITAT = {
    // Bourg Palette, Route 1, Jadielle et la Route 22 : prairies, étangs, villes.
    1: [16, 19, 21, 29, 32, 43, 69, 54, 60, 52, 58, 56, 118, 129],
    // Route 2 et la Forêt de Jade : insectes, plantes, Pikachu.
    2: [10, 13, 11, 14, 25, 46, 48, 43, 69, 102, 114, 123, 127, 16, 17],
    // Argenta, Route 3 et le Musée : roches, grottes, fossiles.
    3: [74, 95, 27, 50, 35, 39, 41, 23, 104, 138, 140, 142, 56, 21],
    // Route 3 et le Mont Sélénite : grottes, Mélofée, fossiles.
    4: [35, 39, 41, 74, 46, 27, 21, 56, 32, 29, 138, 140, 95, 23],
    // Azuria, le Pont Pépite et la Route 25 : eau, Psy, et les Pokémon de l'animé (Bulbizarre du village caché, Salamèche abandonnée).
    5: [54, 60, 118, 120, 116, 72, 79, 63, 43, 69, 10, 13, 1, 4, 129, 98],
    // Routes 5 et 6 et Carmin sur Mer : l'Escouade Carapuce, la mer, l'électricité.
    6: [7, 52, 56, 66, 81, 100, 86, 90, 98, 72, 16, 17, 43, 69, 39, 25],
    // L'Océane : la mer, les Pokémon des passagers et des marins.
    7: [72, 90, 98, 116, 118, 120, 129, 86, 52, 58, 37, 66, 56, 79, 40, 108],
    // Routes 9 et 10, la Grotte : roches, Onix, Électrik de la Centrale.
    8: [74, 66, 95, 41, 56, 21, 23, 100, 81, 19, 96, 104, 111, 27],
    // Lavanville et la Tour Pokémon : les spectres, Osselait l'orphelin, Spectrum le farceur.
    9: [92, 93, 104, 96, 63, 39, 35, 79, 52, 58, 37, 132]
  };

  let S = null;              // la sauvegarde de l'Aventure
  let map = null, mapKey = '', bg = null, npcs = [];
  let open_ = false, raf = 0, last = 0, time = 0;
  let cv = null, ctx = null, dpr = 1, vw = 0, vh = 0, zoom = 2;
  let busy = false;          // dialogue, combat ou évènement en cours
  let cam = { x: 0, y: 0 };
  const pl = { x: 0, y: 0, dir: 'down', walkT: 0, moving: false, tile: '' };
  let trail = [], followers = [], hiddenMon = null, fxs = [], bumpT = 0, stuckT = 0, fly = null, calm = 0;
  let stick = null;          // joystick tactile { id, x0, y0, x, y }
  const keys = new Set();

  // ---------------- sauvegarde ----------------
  function save() {
    const s = G.DB.save;
    if (!s.adv2) s.adv2 = { team: [], box: [], map: 'bourg_maison', x: 4, y: 6, dir: 'up', flags: {}, ch: 1, potions: 0, money: 500, heal: { map: 'bourg_maison', x: 8, y: 5 } };
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
    // Les vraies cartes : on entre, on sort, on descend dans la grotte (les étages privés restent fermés).
    if (w.dest && G.KantoArt.maps[w.dest]) return { ...w, ev: 'go' };
    if (art.inside) return { ...w, ev: 'stairs' };
    const k = Object.keys(def.doors || {}).find(k => w.to.includes(k));
    return k ? { ...w, ev: def.doors[k] } : { ...w, ev: 'closed' };
  }

  // ---------------- personnages ----------------
  const SKIP = new Set(['item_ball', 'cut_tree', 'var_0', 'push_boulder', 'prof_oak', 'blue', 'pokedex', 'town_map', 'old_amber', 'fossil', 'bill', 'clefairy', 'mr_fuji', 'rock_smash_rock']);
  const INVISIBLE = new Set(['', 'clipboard']);   // journaux et cahiers posés sur les tables : on peut les lire
  // Les Pokémon posés sur la carte (le Piafabec de Jadielle, le Rondoudou du Centre…) : dessinés avec nos sprites.
  const MONS = { spearow: 21, nidoran_m: 32, jigglypuff: 39, pikachu: 25, clefairy: 35, meowth: 52, pidgey: 16, machop: 66, seel: 86, slowbro: 80,
                 cubone: 104, psyduck: 54, nidorino: 33, wigglytuff: 40, machoke: 67 };
  /** Un dresseur du jeu sans équipe écrite : des Pokémon du coin, toujours les mêmes pour lui. */
  function genTrainer(o) {
    let h = 7;
    for (const ch of o.script || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 8) / 16777216; };
    const ch = def.ch || S.ch;
    const pool = o.gfx === 'rocket_m' ? [19, 41, 23, 109] : def.pool || (art.wild.length ? art.wild.map(w => w[0]) : HABITAT[ch] || [16, 19]);
    const top = art.wild.length ? Math.max(...art.wild.map(w => w[2])) : [0, 6, 9, 11, 12, 16, 20, 22, 24, 26][ch] || 26;
    const n = 1 + Math.floor(rnd() * 3), team = [];
    for (let i = 0; i < n; i++) team.push([pool[Math.floor(rnd() * pool.length)], Math.max(2, top - (n - 1) + Math.floor(rnd() * 2))]);
    const who = (K().CLASSES[o.gfx] || 'Dresseur') + ' ' + String(o.script || '').replace(/^.*_EventScript_/, '').replace(/\d+$/, '');
    const MEET = ['Nos regards se sont croisés : combat !', 'Hé, toi ! Montre-moi tes Pokémon !', 'Je m\'entraîne ici depuis des jours. À toi de voir !', 'Tu n\'iras pas plus loin sans me battre !'];
    const LOSE = ['Bien joué…', 'J\'ai encore beaucoup à apprendre.', 'Tes Pokémon sont vraiment forts !', 'La prochaine fois, je gagnerai !'];
    const spooky = o.gfx === 'channeler';
    return { name: who, team, coins: 20 * top * n, meet: spooky ? 'Va-t\'en… VA-T\'EN… Les esprits ne veulent pas de toi ici !' : MEET[Math.floor(rnd() * 4)],
             lose: spooky ? 'Hein ? Où suis-je ? … J\'étais possédée !' : LOSE[Math.floor(rnd() * 4)] };
  }
  const FACE = { face_left: 'left', face_right: 'right', face_up: 'up', face_down_and_up: 'down' };
  function loadNpcs() {
    const story = (K().NPCS[mapKey] || []).filter(n => !n.when || n.when(S.flags));
    // Le petit arbre de la Route 9 : il bloque le passage jusqu'à ce qu'on ait Coupe.
    const cut = mapKey === 'route9' && !S.flags.cut_route9;
    const amb = art.objs.filter(o => o.gfx === 'cut_tree' ? cut : !SKIP.has(o.gfx)).map((o, i) => {
      const t = o.trainer && (K().TRAINERS[o.script] || genTrainer(o));
      return { id: mapKey + '_' + i, look: G.People.has(o.gfx) ? o.gfx : 'boy', mon: MONS[o.gfx], x: o.x, y: o.y, dir: FACE[o.mv] || 'down',
        inv: INVISIBLE.has(o.gfx), event: o.gfx === 'nurse' ? 'center' : o.gfx === 'clerk' ? 'mart' : o.gfx === 'cut_tree' ? 'cut' : undefined,
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
  /** dx, dy : sens du mouvement (les rebords ne se passent que dans un sens). */
  function solidAt(wx, wy, dx, dy) {
    const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
    if (!inMap(tx, ty)) return !connAt(tx, ty);
    const ch = at(tx, ty), lg = LEDGE[ch];
    if (SOLID.has(ch)) return true;
    if (lg && !(lg[0] === Math.sign(dx) && lg[1] === Math.sign(dy) && (dx || dy))) return true;
    // Un rebord qui retombe dans un mur, un arbre ou l'eau : on ne saute pas.
    if (lg && !landOk(tx + lg[0], ty + lg[1])) return true;
    return npcs.some(n => Math.abs(n.px - wx) < 14 && wy > n.py - 14 && wy < n.py + 2);
  }
  function blocked(x, y, dx = 0, dy = 0) {
    return solidAt(x - 9, y - 1, dx, dy) || solidAt(x + 9, y - 1, dx, dy) || solidAt(x - 9, y - 9, dx, dy) || solidAt(x + 9, y - 9, dx, dy);
  }
  const landOk = (x, y) => !inMap(x, y) ? !!connAt(x, y) : !SOLID.has(at(x, y)) && !LEDGE[at(x, y)] && !npcAt(x, y);
  /** Touche un mur, un arbre, l'eau ou un personnage (pas les rebords) : coincé si c'est vrai là où on est. */
  function hard(x, y) {
    const c = (wx, wy) => { const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
      return inMap(tx, ty) && SOLID.has(at(tx, ty)) || npcs.some(n => Math.abs(n.px - wx) < 14 && wy > n.py - 14 && wy < n.py + 2); };
    return c(x - 9, y - 1) || c(x + 9, y - 1) || c(x - 9, y - 9) || c(x + 9, y - 9);
  }
  /** Un rebord sous les pieds : petit saut par-dessus, jusqu'à la case d'après (au milieu de la case). */
  function ledgeJump() {
    const [x, y] = tileOf(), lg = LEDGE[at(x, y)];
    if (!lg) return false;
    const nx = x + lg[0], ny = y + lg[1];
    pl.jump = { x0: pl.x, y0: pl.y, x1: nx * TS + 16, y1: ny * TS + 30, t: 0 };
    G.Audio.sfx('click');
    return true;
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

  /** La case libre la plus proche (jamais coincé dans un meuble, un mur ou un personnage). */
  function freeNear(tx, ty) {
    const ok = (x, y) => inMap(x, y) && !SOLID.has(at(x, y)) && !LEDGE[at(x, y)] && !npcAt(x, y);
    for (let r = 0; r < 6; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(tx + dx, ty + dy)) return [tx + dx, ty + dy];
    return [tx, ty];
  }
  function setMap(key, tx, ty, dir) {
    mapKey = key;
    art = G.KantoArt.maps[key];
    def = K().MAPS[key];
    if (!art._bg) { art._bg = img(art.base); art._top = img(art.top); }
    if (key === 'carmin_arene' && S.flags.surgeDoor) openBarrier();
    bg = art._bg; top = art._top;
    loadNpcs();
    [tx, ty] = freeNear(tx, ty);
    pl.x = tx * TS + 16; pl.y = ty * TS + 30; pl.dir = dir || pl.dir; pl.jump = null; pl.hop = 0;
    pl.tile = tx + ',' + ty;
    trail = [];
    for (let i = 0; i < 200; i++) trail.push({ x: pl.x, y: pl.y });
    followers.forEach(f => { f.x = pl.x; f.y = pl.y; });
    G.Audio.music(def.music);
    $('world-place').textContent = def.name;
    seen(key);
    calm = 6;
    snapCam();
  }

  /** La barrière électrique de l'arène de Carmin (ouverte par les deux interrupteurs des poubelles). */
  function openBarrier() {
    for (const y of [6, 7]) { const r = art.grid[y]; art.grid[y] = r.slice(0, 4) + '...' + r.slice(7); }
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
    pl.moving = false;
    if (pl.jump) {
      // Saut de rebord.
      const j = pl.jump;
      j.t = Math.min(1, j.t + dt / 0.45);
      pl.x = j.x0 + (j.x1 - j.x0) * j.t; pl.y = j.y0 + (j.y1 - j.y0) * j.t;
      pl.hop = Math.sin(j.t * Math.PI) * 18;
      pl.moving = true; pl.walkT += dt;
      if (j.t >= 1) { pl.jump = null; pl.hop = 0; afterMove(); }
    } else if (ax || ay) {
      pl.moving = true;
      pl.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 'left' : 'right') : (ay < 0 ? 'up' : 'down');
      const v = SPEED * (running ? 1.7 : 1);
      pl.walkT += dt * (running ? 1.6 : 1);
      const step = v * dt, nx = pl.x + ax * step, ny = pl.y + ay * step;
      let moved = false;
      if (hard(pl.x, pl.y)) {
        // Coincé dans un décor (ça ne devrait pas arriver) : on repart de la case libre la plus proche.
        stuckT += dt;
        if (stuckT > 0.25) { const [tx, ty] = freeNear(...tileOf()); pl.x = tx * TS + 16; pl.y = ty * TS + 30; stuckT = 0; }
      } else stuckT = 0;
      if (ax && !blocked(nx, pl.y, ax, 0)) { pl.x = nx; moved = true; }
      else if (ax && Math.abs(ax) >= Math.abs(ay)) moved = slide(0, Math.sign(ax), step) || moved;
      if (ay && !blocked(pl.x, ny, 0, ay)) { pl.y = ny; moved = true; }
      else if (ay && Math.abs(ay) > Math.abs(ax)) moved = slide(1, Math.sign(ay), step) || moved;
      // Une seule direction : on se recale doucement au milieu du couloir (pour passer entre deux arbres).
      if (moved && Math.abs(ax) < 0.3) align(0, step * 0.6);
      if (moved && Math.abs(ay) < 0.3) align(1, step * 0.6);
      if (!moved) bumpWall();
      afterMove();
    }
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
    if (fly) { fly.t += dt; fly.anim.update(dt); if (fly.t >= fly.dur && fly.res) { const r = fly.res; fly.res = null; r(); } }
    for (const n of npcs) { if (n.bubble) n.bubble = Math.max(0, n.bubble - dt); if (n.anim) n.anim.update(dt); }
    for (let i = fxs.length - 1; i >= 0; i--) { fxs[i].t += dt; if (fxs[i].t > 0.9) fxs.splice(i, 1); }
    // Caméra douce.
    const c0 = { ...cam };
    snapCam();
    cam.x = c0.x + (cam.x - c0.x) * Math.min(1, dt * 8);
    cam.y = c0.y + (cam.y - c0.y) * Math.min(1, dt * 8);
  }
  /** Bloqué contre un coin : on glisse vers le couloir libre le plus proche (comme dans les jeux). axe 0 = on va en x. */
  function slide(axisI, sg, step) {
    const [tx, ty] = tileOf();
    const cands = axisI === 0 ? [ty, ty - 1, ty + 1].map(r => r * TS + 30) : [tx, tx - 1, tx + 1].map(c => c * TS + 16);
    const cur = axisI === 0 ? pl.y : pl.x;
    for (const c of cands.sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur))) {
      const d = c - cur;
      if (Math.abs(d) > 22) continue;
      const ok = axisI === 0 ? !blocked(pl.x + sg * step, c, sg, 0) : !blocked(c, pl.y + sg * step, 0, sg);
      if (!ok) continue;
      if (Math.abs(d) < 0.5) return false;
      const m = Math.sign(d) * Math.min(Math.abs(d), step);
      if (axisI === 0) { if (blocked(pl.x, pl.y + m, 0, Math.sign(m))) return false; pl.y += m; }
      else { if (blocked(pl.x + m, pl.y, Math.sign(m), 0)) return false; pl.x += m; }
      return true;
    }
    return false;
  }
  /** Recale doucement au milieu de la case dans l'autre sens que la marche. */
  function align(axisI, step) {
    const [tx, ty] = tileOf();
    if (axisI === 0) { const d = tx * TS + 16 - pl.x, m = Math.sign(d) * Math.min(Math.abs(d), step); if (m && !blocked(pl.x + m, pl.y, Math.sign(m), 0)) pl.x += m; }
    else { const d = ty * TS + 30 - pl.y, m = Math.sign(d) * Math.min(Math.abs(d), step); if (m && !blocked(pl.x, pl.y + m, 0, Math.sign(m))) pl.y += m; }
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
    const door = mapKey === 'carmin_arene' && S.flags.surgeDoor;   // barrière électrique éteinte : on la recouvre de sol
    if (door && bg.complete) c.drawImage(bg, 4 * 16, 8 * 16, 48, 32, 4 * TS, 6 * TS, 3 * TS, 2 * TS);
    G.AdvBattle.drawFloor(c);
    const list = [];
    for (const n of npcs) if (!n.inv) list.push({ y: n.py, draw: x => {
      if (n.anim && n.ghost) { x.globalAlpha = 0.45 + Math.sin(time * 3) * 0.15; n.anim.draw(x, n.px, n.py - 6 - Math.sin(time * 2) * 4); x.globalAlpha = 1; }
      else if (n.anim) { G.Sprites.drawShadow(x, n.mon, n.px, n.py - 6, 1); n.anim.draw(x, n.px, n.py - 6); }
      else G.People.draw(x, n.look, n.px, n.py, n.d, n.walkT, n.moving);
      if (n.bubble) { x.fillStyle = '#fff'; x.fillRect(n.px - 7, n.py - 66, 14, 16); x.fillStyle = '#e03030'; x.fillRect(n.px - 2, n.py - 63, 4, 7); x.fillRect(n.px - 2, n.py - 54, 4, 3); }
    } });
    for (const f of followers) {
      if (f.m === hiddenMon || f.m.hp <= 0 || fly) continue;
      list.push({ y: f.y, draw: x => { G.Sprites.drawShadow(x, f.m.dex, f.x, f.y, 1); f.anim.draw(x, f.x, f.y); grass(x, f.x, f.y); } });
    }
    if (!fly || fly.ground) list.push({ y: pl.y + 0.1, draw: x => {
      if (pl.hop) { x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(pl.x, pl.y - 2, 11, 4, 0, 0, 6.2832); x.fill(); }
      G.People.draw(x, 'hero', pl.x, pl.y - pl.hop, pl.dir, pl.walkT, pl.moving);
      if (!pl.hop) grass(x, pl.x, pl.y);
    } });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(c);
    // Toits et cimes des arbres : devant les personnages.
    if (top.complete) {
      c.save();
      if (door) { c.beginPath(); c.rect(0, 0, art.w * TS, art.h * TS); c.rect(4 * TS, 6 * TS, 3 * TS, 2 * TS); c.clip('evenodd'); }
      c.drawImage(top, 0, 0, art.w * TS, art.h * TS);
      c.restore();
    }
    if (fly) drawFly(c);
    // Pendant un combat : le décor s'assombrit autour, et les Pokémon passent devant tout (arbres, toits).
    const foc = G.AdvBattle.active && G.AdvBattle.focus;
    if (foc) {
      c.save();
      const r = TS * 5.5, gr = c.createRadialGradient(foc.x, foc.y, r * 0.45, foc.x, foc.y, r * 1.6);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.6)');
      c.fillStyle = gr; c.fillRect(cam.x - vw / zoom, cam.y - vh / zoom, vw / zoom * 2, vh / zoom * 2);
      c.restore();
      for (const d of G.AdvBattle.drawables().sort((a, b) => a.y - b.y)) d.draw(c);
    }
    if (def.dark && !G.AdvBattle.active) {
      // La Grotte sans Flash : on ne voit qu'autour de soi.
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sx = vw / 2 + (pl.x - cam.x) * zoom, sy = vh / 2 + (pl.y - 20 - cam.y) * zoom, r = TS * 3.2 * zoom;
      const gr = c.createRadialGradient(sx, sy, r * 0.35, sx, sy, r);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.93)');
      c.fillStyle = gr; c.fillRect(0, 0, vw, vh);
      c.restore();
    }
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
  /** Vol : le Pokémon arrive, on monte sur son dos, il s'envole (ou il se pose et repart). */
  function drawFly(c) {
    const f = fly, k = Math.min(1, f.t / f.dur), ease = u => u * u * (3 - 2 * u);
    let bx = pl.x, bh = 18, alpha = 1, ride = true;
    f.ground = false;
    if (f.kind === 'up') {
      if (k < 0.4) { const u = ease(k / 0.4); bx = pl.x - 200 * (1 - u); bh = 18 + 240 * (1 - u); ride = false; f.ground = true; }
      else if (k < 0.55) { const u = (k - 0.4) / 0.15; bh = 18 + Math.sin(u * Math.PI) * 6; ride = u > 0.5; f.ground = !ride; }
      else { const u = (k - 0.55) / 0.45; bh = 18 + u * u * 340; bx = pl.x + u * u * 40; }
    } else {
      if (k < 0.6) { const u = ease(k / 0.6); bh = 18 + 320 * (1 - u); }
      else if (k < 0.7) { ride = false; f.ground = true; }
      else { const u = (k - 0.7) / 0.3; bx = pl.x + 220 * u * u; bh = 18 + 260 * u * u; alpha = 1 - u * 0.6; ride = false; f.ground = true; }
    }
    // Le sens du vol pour le sprite.
    const vx = bx - (f.px == null ? bx : f.px), vy = -(bh - (f.ph == null ? bh : f.ph));
    if (Math.hypot(vx, vy) > 0.3) f.anim.dir = G.Sprites.dirFromAngle(Math.atan2(vy * 0.3 + 0.001, vx));
    else if (ride) f.anim.dir = G.Sprites.dirFromAngle(Math.PI / 2);
    f.px = bx; f.ph = bh;
    const sh = Math.max(0.25, 1 - bh / 360);
    c.globalAlpha = 0.8 * alpha;
    G.Sprites.drawShadow(c, f.dex, bx, pl.y, 2.2 * sh);
    c.globalAlpha = alpha;
    f.anim.draw(c, bx, pl.y - bh);
    if (ride) G.People.draw(c, 'hero', bx, pl.y - bh - 16, 'down', 0, false);
    c.globalAlpha = 1;
    // Le vent quand on prend de la hauteur.
    if (bh > 60) {
      c.strokeStyle = 'rgba(255,255,255,' + Math.min(0.7, (bh - 60) / 200) + ')';
      c.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const x = bx - 60 + ((i * 37 + f.t * 400) % 140) - 10, y = pl.y - bh - 40 + ((i * 53) % 90);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 26); c.stroke();
      }
    }
  }
  function flyAnim(kind, dur) { return new Promise(res => { fly.kind = kind; fly.t = 0; fly.dur = dur; fly.px = fly.ph = null; fly.res = res; }); }
  /** Les Centres Pokémon où Vol peut nous poser (une fois qu'on y est passé). */
  const FLY = [
    { town: 'bourg', name: 'Bourg Palette', door: 'bourg_maison', desc: 'La maison' },
    { town: 'jadielle', name: 'Jadielle', door: 'jadielle_centre' },
    { town: 'argenta', name: 'Argenta', door: 'argenta_centre' },
    { town: 'route4', name: 'Route 4', door: 'route4_centre', desc: 'Centre Pokémon du Mont Sélénite' },
    { town: 'azuria', name: 'Azuria', door: 'azuria_centre' },
    { town: 'carmin', name: 'Carmin-sur-Mer', door: 'carmin_centre' },
    { town: 'route10', name: 'Route 10', door: 'route10_centre', desc: 'Centre Pokémon de la Centrale' },
    { town: 'lavanville', name: 'Lavanville', door: 'lavanville_centre' }
  ];
  function seen(key) {
    const f = FLY.find(f => f.town === key || f.door === key);
    if (f) (S.fly = S.fly || {})[f.town] = 1;
  }
  const flier = () => S.team.find(m => m.hp > 0 && G.DEX_BY[m.dex].types.includes('flying'));
  async function flyMenu() {
    const m = flier();
    if (!m) { await talk([['', 'Il te faut un Pokémon de type Vol en forme dans ton équipe pour voler.']]); return; }
    if (art.inside || art.cave) { await talk([['', 'Impossible de voler ici ! Sors d\'abord à l\'air libre.']]); return; }
    const list = FLY.filter(f => S.fly && S.fly[f.town] && G.KantoArt.maps[f.town] && K().MAPS[f.town]);
    const i = await G.AdvUI.choose(M().name(m) + ' peut t\'emmener à…', list.map(f => ({ icon: f.town === 'bourg' ? 'home' : 'heart', title: f.name,
      desc: f.town === mapKey ? 'Tu es ici' : f.desc || 'Centre Pokémon' })).concat([{ title: 'Annuler', desc: '' }]));
    if (i >= list.length || list[i].town === mapKey) return;
    await flyTo(m, list[i]);
  }
  async function flyTo(m, f) {
    const to = G.KantoArt.maps[f.town], w = to.warps.find(w => w.dest === f.door) || to.warps[0];
    fly = { dex: m.dex, anim: new G.Sprites.Animator(m.dex, 2.2, G.DB.ownsShiny(m.dex)), t: 0, dur: 1 };
    fly.anim.loop('Walk', 1.6);
    G.Sprites.preload([m.dex], 3000, false);
    try {
      G.Audio.sfx('select');
      await talk([['', M().name(m) + ', Vol !']]);
      await flyAnim('up', 2.2);
      await fade(() => setMap(f.town, w.x, w.y + 1, 'down'));
      G.Audio.sfx('confirm');
      await flyAnim('down', 2.2);
    } finally { fly = null; }
    commit();
    await talk([['', 'Bienvenue à ' + f.name + ' !']]);
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
    let n = npcs.find(n => Math.hypot(n.px - (pl.x + ddx * 28), n.py - (pl.y + ddy * 28)) < 22) || at2(f.x, f.y);
    // Par-dessus un comptoir (Infirmière Joëlle, vendeur) : on parle à la personne derrière.
    if (!n && at(f.x, f.y) === '#') { n = at2(f.x + ddx, f.y + ddy); if (n && !n.event) n = null; }
    if (n) { run(() => talkNpc(n)); return; }
    // Le PC du Centre Pokémon (même place dans tous les Centres de Rouge Feu).
    if (/_centre$/.test(mapKey) && f.x === 11 && f.y === 1 && (!fromBump || pl.dir === 'up')) { run(pc); return; }
    const w = warpAt(f.x, f.y);
    if (w) { run(() => door(w)); return; }
    const sg = art.signs.find(b => b.x === f.x && b.y === f.y);
    if (sg && /TrashCan/.test(sg.script)) { if (!fromBump) run(() => trash(sg)); return; }
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
    if (n.event === 'magikarp') { await magikarp(); return; }
    if (n.event === 'rocket') { await rocket(); return; }
    if (n.event === 'fossil') { await fossil(); return; }
    if (n.event === 'regis2') { await regis2(); return; }
    if (n.event === 'ondine') { await ondine(n); return; }
    if (n.event === 'leo') { await leo(); return; }
    if (n.event === 'surge') { await surge(n); return; }
    if (n.event === 'regis3') { await regis3(); return; }
    if (n.event === 'rocket2') { await rocket2(); return; }
    if (n.event === 'captain') { await captain(); return; }
    if (n.event === 'cut') { await cutTree(); return; }
    if (n.event === 'regis4') { await regis4(); return; }
    if (n.event === 'ghost') { await ghost(); return; }
    if (n.event === 'fuji') { await fuji(); return; }
    if (n.event === 'fujiHome') { await talk([['M. Fuji', 'Merci encore, jeune dresseur. Les Pokémon de cette maison sont heureux grâce à toi.']]); return; }
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
  /** Un personnage de l'histoire te remarque (point d'exclamation), puis l'évènement commence. */
  async function spottedBy(n) {
    n.bubble = 0.9;
    G.Audio.sfx('select');
    await new Promise(r => setTimeout(r, 700));
    const dx = n.px - pl.x, dy = n.py - pl.y;
    pl.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    faceTo(n);
    await talkNpc(n);
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
    // Jamais dans un arbre, un mur, l'eau ou sous un toit : chaque Pokémon se pose sur une case libre et dégagée.
    place.me = spot(place.me, null, n);
    place.foe = spot(place.foe, place.me, n);
    $('world-hud').classList.add('dim');
    // Les Pokémon croisés pendant le chapitre (proposés à la capture en fin de chapitre).
    const met = opts.wild ? [opts.wild[0]] : opts.trainer.team.map(t => t[0]);
    const seen = (S.seen = S.seen || {})[S.ch] = S.seen[S.ch] || [];
    for (const d of met) if (!seen.includes(d)) seen.push(d);
    const res = await G.AdvBattle.start(opts, place);
    $('world-hud').classList.remove('dim');
    G.Audio.music(def.music);
    if (res === 'lose') { await blackout(); return res; }
    await G.AdvBattle.evolutions();
    refreshFollowers();
    return res;
  }

  /** Les cases cachées par la couche du dessus (cimes des arbres, toits) : calculé une fois par carte. */
  function covered(tx, ty) {
    if (!art._cover) {
      if (!top.complete || !top.naturalWidth) return false;
      art._cover = new Uint8Array(art.w * art.h);
      try {
        const c = document.createElement('canvas');
        c.width = art.w * 16; c.height = art.h * 16;
        const x = c.getContext('2d');
        x.drawImage(top, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        for (let y = 0; y < art.h; y++) for (let xx = 0; xx < art.w; xx++) {
          let n = 0;
          for (let py = 0; py < 16; py += 2) for (let px = 0; px < 16; px += 2) if (d[((y * 16 + py) * c.width + xx * 16 + px) * 4 + 3] > 40) n++;
          art._cover[y * art.w + xx] = n > 12 ? 1 : 0;
        }
      } catch (e) { /* rien */ }
    }
    return !!art._cover[ty * art.w + tx];
  }
  /** La meilleure case libre près de (x, y) pour un Pokémon en combat (pixels du monde, pieds). */
  function spot(p, avoid, n) {
    const [px, py] = tileOf(p.x, p.y), [mx, my] = tileOf();
    const av = avoid ? tileOf(avoid.x, avoid.y) : null, nt = n ? tileOf(n.px, n.py) : null;
    let best = null, bs = 1e9;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = px + dx, y = py + dy;
      if (!inMap(x, y)) continue;
      const ch = at(x, y);
      if (SOLID.has(ch) || LEDGE[ch] || npcAt(x, y) || Math.max(Math.abs(x - mx), Math.abs(y - my)) <= 1) continue;
      if (nt && x === nt[0] && y === nt[1]) continue;
      if (av && Math.abs(x - av[0]) + Math.abs(y - av[1]) < 2) continue;
      // Pas collé à un mur juste au-dessus (la tête dans le décor).
      const wallUp = SOLID.has(at(x, y - 1)) ? 0.6 : 0;
      const sc = Math.hypot(dx, dy) + (ch === 'g' ? 1.2 : 0) + (covered(x, y) ? 6 : 0) + wallUp;
      if (sc < bs) { bs = sc; best = [x, y]; }
    }
    return best ? { x: best[0] * TS + 16, y: best[1] * TS + 30 } : p;
  }

  async function blackout() {
    await talk([['', 'Tu n\'as plus de Pokémon en forme… Tu cours au Centre Pokémon le plus proche.']]);
    heal();
    let h = S.heal || {};
    if (!G.KantoArt.maps[h.map] || !K().MAPS[h.map]) h = { map: 'bourg_maison', x: 8, y: 5 };
    setMap(h.map, h.x, h.y, 'up');
    await talk([[h.map.startsWith('bourg') ? 'Maman' : 'Infirmière Joëlle', 'Tes Pokémon sont en pleine forme. Fais attention à toi !']]);
  }

  /** Bouton Débloquer du menu : on se retrouve au dernier Centre Pokémon (ou à la maison), sans rien perdre. */
  async function rescue() {
    let h = S.heal || {};
    if (!G.KantoArt.maps[h.map] || !K().MAPS[h.map]) h = { map: 'bourg_maison', x: 8, y: 5 };
    await fade(() => setMap(h.map, h.x, h.y, 'up'));
    commit();
    await talk([['', 'Ouf ! Te voilà de retour au ' + (h.map.startsWith('bourg') ? 'chaud à la maison.' : 'Centre Pokémon.')]]);
  }
  function afterMove() {
    // Sortie de la carte par un bord.
    if (pl.y - 4 < 0 || pl.y > art.h * TS || pl.x < 0 || pl.x > art.w * TS) {
      const [cx, cy] = tileOf();
      const e = connAt(pl.x < 0 ? -1 : pl.x > art.w * TS ? art.w : cx, pl.y - 4 < 0 ? -1 : pl.y > art.h * TS ? art.h : cy);
      if (e) { run(() => leave(e)); return; }
    }
    const [tx, ty] = tileOf();
    const key = tx + ',' + ty;
    if (key === pl.tile) return;
    pl.tile = key;
    if (!pl.jump && ledgeJump()) return;
    const w = warpAt(tx, ty);
    if (w) { run(() => door(w)); return; }
    const z = (K().ZONES[mapKey] || []).find(z => tx >= z.x0 && tx <= z.x1 && ty >= z.y0 && ty <= z.y1 && z.when(S.flags));
    if (z) { const n = npcs.find(n => n.event === z.ev); if (n) { run(() => spottedBy(n)); return; } }
    if (checkSight()) return;
    // Pokémon sauvages : dans les hautes herbes, et partout dans les grottes.
    const wild = def.wild || (art.wild.length ? art.wild : null);
    const grassy = at(tx, ty) === 'g';
    if (grassy) G.AdvFX.burst('grass', pl.x, pl.y - 8, 5, 0.35);
    // Après un combat ou en arrivant sur une carte : quelques pas tranquilles. Dans les grottes, bien plus rare que dans les herbes.
    if (calm > 0) calm--;
    else if (wild && canFight() && (grassy ? Math.random() < 1 / 10 : (art.cave || art.inside) && Math.random() < 1 / 45)) {
      calm = 8;
      const [dex, a, b] = G.U.pick(wild);
      run(() => battle({ wild: [dex, a + Math.floor(Math.random() * (b - a + 1))] }));
    }
  }

  async function leave(e) {
    // Les passages bloqués par l'histoire.
    const back = () => { pl.x -= DIRV[e.dir][0] * 24; pl.y -= DIRV[e.dir][1] * 24; };
    if (e.todo) { back(); await talk([['', K().CLOSED[e.map] || 'Cette route n\'est pas encore ouverte. La suite de l\'aventure arrive bientôt !']]); return; }
    if (mapKey === 'argenta' && e.map === 'route3' && !S.flags.pierre) {
      back();
      await talk([['Gamin', 'Hé ! Tu n\'as pas encore le Badge Roche ? Pierre veut voir tous les dresseurs avant qu\'ils partent vers le Mont Sélénite !']]);
      return;
    }
    if (mapKey === 'azuria' && e.map === 'route5' && !S.flags.ondine) {
      back();
      await talk([['', 'Avant de partir vers le sud, va d\'abord défier Ondine à l\'arène d\'Azuria !']]);
      return;
    }
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
    if (e.map === 'azuria' && S.ch === 4) await chapterEnd();
    if (e.map === 'lavanville' && S.ch === 8) await chapterEnd();
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
                ['Prof. Chen', 'Il me reste trois Pokémon sur la table : Roucool, Rattata et Pikachu. Choisis bien : il sera ton premier compagnon !']]);
    const i = await G.AdvUI.choose('Choisis ton premier Pokémon', STARTERS.map(card));
    await pickStarter(STARTERS[i]);
  }
  /** Une Poké Ball de la table du labo : on regarde le Pokémon et on le prend (ou pas). */
  async function ball(n) {
    if (S.flags.starter) return;
    const i = await G.AdvUI.choose('Prof. Chen : tu veux ' + G.DEX_BY[n.ball].name + ' ?', [card(n.ball), { title: 'Je réfléchis', desc: '' }]);
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
    // Régis a pris Évoli, comme Gary dans l'animé.
    const counter = 133;
    await talk([['Régis', 'Moi j\'ai un ' + G.DEX_BY[counter].name + ', le plus rare du labo ! Voyons ce que vaut le tien !']]);
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
    S.heal = { map: 'bourg_maison', x: 8, y: 5 };
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
    const res = await battle({ trainer: { name: 'Pierre', team: [[74, 10], [95, 12]], smart: true,
      leader: { look: 'brock', type: 'rock', badge: 'Roche', title: 'Champion de l\'arène d\'Argenta', quote: 'Ma défense est solide comme le roc !' } } }, n);
    if (res === 'win') {
      S.flags.pierre = 1; S.money += 500;
      G.Audio.sfx('legend');
      await talk([['Pierre', 'Tu m\'as battu… Tu mérites ceci : le Badge Roche !'], ['', 'Tu obtiens le Badge Roche et 500 pièces !']]);
      if (S.ch === 3) await chapterEnd();
    }
  }

  // ---------------- chapitres 4 à 6 ----------------
  /** Donne un Pokémon (équipe, sinon boîte). */
  function give(dex, lv) {
    const m = M().make(dex, lv);
    if (S.team.length < 6) S.team.push(m); else S.box.push(m);
    G.DB.grant(dex, 'adv');
    refreshFollowers();
    return S.team.includes(m);
  }
  /** Le vendeur de Magicarpe du Centre Pokémon, comme James dans l'animé. */
  async function magikarp() {
    if (S.flags.magikarp) { await talk([['Vendeur', 'Pas de remboursement ! Un Magicarpe, ça se mérite.']]); return; }
    await talk([['Vendeur', 'Psst ! Un Magicarpe tout neuf pour seulement 500 pièces ! Il pond des centaines d\'œufs, tu vas devenir riche !'],
                ['Vendeur', 'Un garçon aux cheveux bleus en a acheté un ce matin. Il avait l\'air ravi !']]);
    const i = await G.AdvUI.choose('Acheter un Magicarpe ? (' + S.money + ' pièces)', [card(129), { title: 'Non merci', desc: '' }]);
    if (i !== 0) { await talk([['Vendeur', 'Tu le regretteras ! Il deviendra peut-être un Léviator…']]); return; }
    if (S.money < 500) { await talk([['Vendeur', 'Pas assez de pièces ? Reviens plus tard !']]); return; }
    S.money -= 500;
    S.flags.magikarp = 1;
    const inTeam = give(129, 8);
    G.Audio.sfx('confirm');
    await talk([['', 'Tu achètes un Magicarpe' + (inTeam ? ' !' : ' (il part dans ta boîte) !')], ['Vendeur', 'Pas de remboursement ! Hé hé…']]);
  }
  /** Jessie, James et Miaouss au fond du Mont Sélénite. */
  async function rocket() {
    if (S.flags.rocket1) return;
    const jessie = npcs.find(n => n.id === 'jessie');
    await talk([['Jessie', 'Nous sommes de retour !'], ['James', 'Pour vous jouer un mauvais tour !'],
                ['Jessie', 'Afin de préserver le monde de la dévastation !'], ['James', 'Afin de rallier tous les peuples à notre nation !'],
                ['Jessie', 'Jessie !'], ['James', 'James !'], ['Jessie', 'La Team Rocket plus rapide que la lumière !'],
                ['James', 'Rendez-vous tous, ou ce sera la guerre !'], ['Miaouss', 'Miaouss, oui la guerre !'],
                ['Jessie', 'Ces fossiles et la Pierre Lune sont à nous ! Abo, à l\'attaque !']]);
    const res = await battle({ trainer: { name: 'Jessie et James', team: [[23, 13], [109, 13], [52, 14]], smart: true, potions: 1 } }, jessie);
    if (res !== 'win') return;
    S.flags.rocket1 = 1;
    S.money += 600;
    await talk([['James', 'Encore battus par un gamin…'], ['Miaouss', 'C\'est pas juste !'],
                ['Jessie, James et Miaouss', 'La Team Rocket s\'envole vers d\'autres cieux !'], ['', 'Ils disparaissent dans un éclair. Tu ramasses 600 pièces qu\'ils ont laissées tomber.']]);
    loadNpcs();
  }
  /** Le scientifique Miguel : un fossile au choix. */
  async function fossil() {
    if (!S.flags.rocket1) { await talk([['Miguel', 'Au secours ! La Team Rocket veut voler les fossiles que j\'ai trouvés !']]); return; }
    if (S.flags.fossil) { await talk([['Miguel', 'Prends soin de ton ' + G.DEX_BY[S.flags.fossil].name + '. C\'est un Pokémon d\'il y a des millions d\'années !']]); return; }
    await talk([['Miguel', 'Merci de m\'avoir sauvé de la Team Rocket ! J\'ai trouvé deux fossiles. Prends-en un !']]);
    const i = await G.AdvUI.choose('Quel fossile choisis-tu ?', [
      { dex: 138, title: 'Nautile (Amonita)', types: G.DEX_BY[138].types },
      { dex: 140, title: 'Dôme (Kabuto)', types: G.DEX_BY[140].types }]);
    const dex = i === 0 ? 138 : 140;
    S.flags.fossil = dex;
    const inTeam = give(dex, 12);
    G.Audio.sfx('legend');
    await talk([['', 'Le fossile se met à briller sous la Pierre Lune…'],
                ['', G.DEX_BY[dex].name + ' revient à la vie' + (inTeam ? ' et te suit !' : ' et part dans ta boîte !')]]);
  }
  /** Régis et ses pom-pom girls à l'entrée du Pont Pépite. */
  async function regis2() {
    const n = npcs.find(x => x.id === 'regis2');
    await talk([['Pom-pom girls', 'Ré-gis ! Ré-gis ! C\'est le meilleur, c\'est le plus fort !'],
                ['Régis', 'Tiens, le nul ! Tu as réussi à traverser le Mont Sélénite ? Moi, j\'ai déjà attrapé plein de Pokémon. Regarde !']]);
    const res = await battle({ trainer: { name: 'Régis', team: [[17, 17], [63, 16], [133, 18]], smart: true, potions: 1 } }, n);
    if (res !== 'win') return;
    S.flags.regis2 = 1;
    S.money += 600;
    await talk([['Régis', 'Pff… C\'était juste un échauffement ! Allez les filles, on y va !'], ['Pom-pom girls', 'Ré-gis ! Ré-gis !'],
                ['Régis', 'Au fait, Léo, au bout du Pont Pépite, a des Pokémon super rares. À la revoyure, le nul !'], ['', 'Tu gagnes 600 pièces.']]);
    loadNpcs();
  }
  async function ondine(n) {
    if (S.flags.ondine) { await talk([['Ondine', 'Bravo pour le Badge Cascade ! … Et n\'oublie pas que quelqu\'un me doit toujours un vélo.']]); return; }
    await talk([['Ondine', 'Je suis Ondine, la championne d\'Azuria ! Ma stratégie : l\'attaque totale avec les Pokémon Eau !'],
                ['', 'Une Poké Ball s\'ouvre toute seule… Psykokwak en sort, l\'air perdu.'], ['Psykokwak', 'Psy… ?'],
                ['Ondine', 'Psykokwak ! Retourne dans ta Ball, ce n\'est pas ton tour ! … Stari, en avant !']]);
    const res = await battle({ trainer: { name: 'Ondine', team: [[120, 18], [121, 21]], smart: true,
      leader: { look: 'misty', type: 'water', badge: 'Cascade', title: 'Championne de l\'arène d\'Azuria', quote: 'Ma stratégie : l\'attaque totale avec les Pokémon Eau !' } } }, n);
    if (res !== 'win') return;
    S.flags.ondine = 1; S.money += 800;
    G.Audio.sfx('legend');
    await talk([['Ondine', 'Waouh, tu es fort ! Voici le Badge Cascade, tu l\'as mérité.'], ['', 'Tu obtiens le Badge Cascade et 800 pièces !']]);
    if (S.ch === 5) await chapterEnd();
  }
  /** Léo, coincé dans le corps d'un Mélofée. */
  async function leo() {
    await talk([['Mélofée', 'Hé ! Ne me regarde pas comme ça ! Je ne suis pas un Pokémon, je suis Léo !'],
                ['Léo', 'Mon téléporteur a raté et je me suis mélangé avec un Mélofée ! Lance le programme sur l\'ordinateur, s\'il te plaît !'],
                ['', 'Tu appuies sur le gros bouton… Bzzzt ! Un éclair remplit la pièce !']]);
    S.flags.leo = 1;
    loadNpcs();
    G.Audio.sfx('legend');
    S.cures = (S.cures || 0) + 2;
    await talk([['Léo', 'Ouf, merci ! Me revoilà ! J\'aurais pu rester coincé avec une queue en spirale…'],
                ['Léo', 'Tiens, prends ces 2 Total Soin. Et ce billet pour l\'Océane, le grand bateau de Carmin sur Mer. Moi je n\'aime pas trop la mer !'],
                ['', 'Tu reçois 2 Total Soin et le Passe Océane.']]);
  }
  async function ssanne() {
    await talk([['Marin', S.flags.leo ? 'Un Passe Océane ! Bienvenue… Ah, la grande fête des dresseurs n\'a pas encore commencé. Reviens au prochain chapitre !'
                                     : 'Ton billet, s\'il te plaît ! Pas de billet, pas de bateau. Léo, sur la Route 25, en a peut-être un…']]);
  }
  /** Les poubelles de l'arène de Carmin : deux interrupteurs cachés, l'un à côté de l'autre. */
  let trashSecond = null;
  async function trash(sg) {
    if (S.flags.surgeDoor) { await talk([['', 'Rien que des déchets…']]); return; }
    const cans = art.signs.filter(b => /TrashCan/.test(b.script) && b.y < 16);
    if (S.flags.trashA == null || !cans[S.flags.trashA]) S.flags.trashA = Math.floor(Math.random() * cans.length);
    const a = cans[S.flags.trashA];
    const hint = target => {
      const dx = target.x - sg.x, dy = target.y - sg.y;
      return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'à gauche' : 'à droite') : (dy < 0 ? 'vers le haut' : 'vers le bas');
    };
    if (!trashSecond) {
      if (sg !== a) { await talk([['', 'Rien que des déchets… Tu entends un petit « bzzt » ' + hint(a) + '.']]); return; }
      const near = cans.filter(b => Math.abs(b.x - a.x) + Math.abs(b.y - a.y) === 2);
      trashSecond = near[Math.floor(Math.random() * near.length)];
      G.Audio.sfx('select');
      await talk([['', 'Un interrupteur sous les déchets ! La première serrure électrique s\'ouvre. Le deuxième interrupteur est juste à côté…']]);
      return;
    }
    if (sg === trashSecond) {
      S.flags.surgeDoor = 1; trashSecond = null;
      openBarrier();
      G.Audio.sfx('legend');
      await talk([['', 'Le deuxième interrupteur ! La barrière électrique s\'éteint. Le Major Bob t\'attend !']]);
      return;
    }
    if (sg === a) { await talk([['', 'C\'est l\'interrupteur que tu as déjà trouvé. Le deuxième est dans une poubelle voisine.']]); return; }
    S.flags.trashA = Math.floor(Math.random() * cans.length); trashSecond = null;
    await talk([['', 'Rien… Bzzzt ! Les serrures se referment ! Les interrupteurs ont changé de place.']]);
  }
  async function surge(n) {
    if (S.flags.surge) { await talk([['Major Bob', 'Hé, petit ! Ton équipe m\'a électrisé. Continue comme ça, soldat !']]); return; }
    const pika = S.team.some(m => m.dex === 25);
    await talk([['Major Bob', 'Hé, petit ! Bienvenue dans mon arène ! Mes Pokémon Électrik m\'ont sauvé la vie pendant la guerre !'],
                ['Major Bob', pika ? 'Un Pikachu ? Ha ha ha ! Tu devrais le faire évoluer, petit, sinon il n\'a aucune chance contre mon Raichu !'
                                   : 'Voyons si ton équipe supporte la décharge ! Raichu est mon meilleur soldat !']]);
    const res = await battle({ trainer: { name: 'Major Bob', team: [[100, 21], [25, 18], [26, 24]], smart: true,
      leader: { look: 'lt_surge', type: 'electric', badge: 'Foudre', title: 'Champion de l\'arène de Carmin', quote: 'Mes Pokémon Électrik m\'ont sauvé la vie à la guerre !' } } }, n);
    if (res !== 'win') return;
    S.flags.surge = 1; S.money += 1000;
    G.Audio.sfx('legend');
    await talk([['Major Bob', pika ? 'Battu par un Pikachu… Sa vitesse, petit ! Je n\'y avais pas pensé. Voici le Badge Foudre !' : 'Ouah ! Tu es un vrai soldat, petit ! Voici le Badge Foudre !'],
                ['', 'Tu obtiens le Badge Foudre et 1000 pièces !']]);
    if (S.ch === 6) await chapterEnd();
  }

  // ---------------- chapitres 7 à 9 ----------------
  /** Régis sur l'Océane, devant la cabine du capitaine. */
  async function regis3() {
    const n = npcs.find(x => x.id === 'regis3');
    await talk([['Régis', 'Hé, le nul ! Toi aussi tu es invité à la fête ? On ne laisse vraiment monter n\'importe qui…'],
                ['Régis', 'Le capitaine a le mal de mer. Moi je l\'ai déjà vu, il m\'a même montré sa technique secrète. Voyons si tu as progressé !']]);
    const res = await battle({ trainer: { name: 'Régis', team: [[17, 22], [63, 20], [58, 21], [133, 23]], smart: true, potions: 1 } }, n);
    if (res !== 'win') return;
    S.flags.regis3 = 1; S.money += 900;
    await talk([['Régis', 'Pff ! Tu as eu de la chance. Bon, je file, la fête m\'ennuie. À la revoyure, le nul !'], ['', 'Tu gagnes 900 pièces.']]);
    loadNpcs();
  }
  /** Jessie et James déguisés en serveurs sur le pont de l'Océane. */
  async function rocket2() {
    if (S.flags.rocket2) return;
    const jessie = npcs.find(n => n.id === 'jessie2');
    await talk([['Serveuse', 'Bienvenue à la fête ! Donnez-nous vos Pokémon, on va… euh… les laver !'],
                ['Serveur', 'Jessie, il nous a reconnus !'], ['Jessie', 'Nous sommes de retour !'], ['James', 'Pour vous jouer un mauvais tour !'],
                ['Jessie et James', 'La Team Rocket plus rapide que la lumière !'], ['Miaouss', 'Rendez-vous tous, ou ce sera la guerre !'],
                ['James', 'Tous les Pokémon des passagers seront à nous !']]);
    const res = await battle({ trainer: { name: 'Jessie et James', team: [[23, 21], [109, 21], [52, 22]], smart: true, potions: 1 } }, jessie);
    if (res !== 'win') return;
    S.flags.rocket2 = 1; S.money += 800;
    await talk([['Miaouss', 'On aurait dû rester à la cuisine…'], ['Jessie, James et Miaouss', 'La Team Rocket s\'envole vers d\'autres cieux !'],
                ['', 'Ils sautent par-dessus bord ! Les passagers t\'applaudissent et te donnent 800 pièces.']]);
    loadNpcs();
  }
  /** Le capitaine qui a le mal de mer, puis le naufrage de l'Océane. */
  async function captain() {
    if (!S.flags.rocket2) { await talk([['Capitaine', 'Ooh… J\'ai le mal de mer… Et j\'entends du grabuge sur le pont supérieur. Quelqu\'un peut aller voir ?']]); return; }
    if (S.flags.coupe) { await talk([['Capitaine', 'Merci encore, petit. Utilise bien Coupe !']]); return; }
    await talk([['Capitaine', 'Ooh… Le mal de mer… Un capitaine qui a le mal de mer, tu te rends compte ?'],
                ['', 'Tu lui frottes le dos…'], ['Capitaine', 'Ah ! Ça va mieux, merci ! Pour te remercier, je t\'apprends la technique Coupe. Tes Pokémon pourront couper les petits arbres !'],
                ['', 'Tu obtiens la CS Coupe !']]);
    S.flags.coupe = 1;
    G.Audio.sfx('legend');
    await shipwreck();
  }
  async function shipwreck() {
    await talk([['', 'BOUM ! Une énorme vague frappe l\'Océane !'], ['Capitaine', 'Une tempête ! Le bateau se renverse ! Tout le monde dehors !'],
                ['', 'Tout tourne… L\'eau entre partout…']]);
    // Comme le Magicarpe de James dans l'animé : le naufrage le fait évoluer en Léviator !
    const karp = S.team.concat(S.box).find(m => m.dex === 129);
    await fade(() => setMap('carmin', 23, 32, 'down'));
    S.flags.naufrage = 1;
    commit();
    await talk([['', 'Tu te réveilles sur le quai de Carmin sur Mer. L\'Océane a disparu au large…']]);
    if (karp) {
      const n = M().make(130, Math.max(20, karp.lv));
      Object.assign(karp, n);
      G.DB.grant(130, 'adv');
      refreshFollowers();
      G.Audio.sfx('legend');
      await talk([['', 'Ton Magicarpe a nagé jusqu\'au rivage en te tirant hors de l\'eau… et il brille ! Il a évolué en Léviator !'],
                  ['Ondine', 'Un Léviator ! Ton Magicarpe à 500 pièces t\'a sauvé la vie !']]);
    }
    if (S.ch === 7) await chapterEnd();
  }
  async function cutTree() {
    if (!S.flags.coupe) { await talk([['', 'Un petit arbre bloque le passage. Il faudrait la technique Coupe…']]); return; }
    const m = S.team.find(m => m.hp > 0) || S.team[0];
    await talk([['', (m ? M().name(m) : 'Ton Pokémon') + ' utilise Coupe ! L\'arbre est coupé.']]);
    S.flags.cut_route9 = 1;
    G.Audio.sfx('select');
    loadNpcs();
  }
  /** Régis au 2e étage de la Tour Pokémon. */
  async function regis4() {
    const n = npcs.find(x => x.id === 'regis4');
    await talk([['Régis', 'Tiens, le nul. Je suis venu dire au revoir à un vieux Pokémon… Ne pose pas de questions.'],
                ['Régis', 'Tes Pokémon sont encore vivants, toi ? Voyons ça !']]);
    const res = await battle({ trainer: { name: 'Régis', team: [[18, 25], [64, 23], [58, 24], [133, 26]], smart: true, potions: 2 } }, n);
    if (res !== 'win') return;
    S.flags.regis4 = 1; S.money += 1000;
    await talk([['Régis', 'Encore perdu… Je dois m\'entraîner plus dur. La Team Rocket est en haut, fais attention. À la revoyure !'], ['', 'Tu gagnes 1000 pièces.']]);
    loadNpcs();
  }
  /** Le fantôme de la maman Ossatueur, au 6e étage. */
  async function ghost() {
    const n = npcs.find(x => x.id === 'ghost');
    G.Audio.sfx('select');
    await talk([['Fantôme', 'Va-t\'en… VA-T\'EN…'], ['', 'Une silhouette blanche flotte devant l\'escalier. Impossible de voir de quel Pokémon il s\'agit !'],
                ['', 'Soudain, un Spectrum farceur surgit du mur et fait une grimace au fantôme… La silhouette se dévoile : c\'est un Ossatueur !']]);
    const res = await battle({ wild: [105, 28] }, n);
    if (res === 'lose') return;
    S.flags.ossatueur = 1;
    await talk([['', 'Le fantôme d\'Ossatueur s\'apaise… C\'était la maman de l\'Osselait de Lavanville. Elle monte doucement vers le ciel.'],
                ['', 'Le Spectrum te fait un clin d\'œil et disparaît en rigolant.']]);
    loadNpcs();
  }
  /** M. Fuji, prisonnier de la Team Rocket au sommet de la Tour. */
  async function fuji() {
    const grunts = Object.keys(S.flags).filter(k => k.startsWith('tr_tour7_')).length;
    if (grunts < 3) { await talk([['M. Fuji', 'Jeune dresseur… La Team Rocket me retient ici. Attention à eux !']]); return; }
    S.flags.fuji = 1;
    G.Audio.sfx('legend');
    await talk([['M. Fuji', 'Tu m\'as sauvé ! La Team Rocket voulait vendre les Pokémon de la Tour… Merci du fond du cœur.'],
                ['M. Fuji', 'Je recueille les Pokémon abandonnés dans ma maison de Lavanville. Le petit Osselait aussi, maintenant qu\'il est seul…'],
                ['M. Fuji', 'Prends ceci : 3 Total Soin et 1000 pièces. Les Pokémon de la Tour reposent en paix grâce à toi.'],
                ['', 'Tu reçois 3 Total Soin et 1000 pièces.']]);
    S.cures = (S.cures || 0) + 3; S.money += 1000;
    loadNpcs();
    if (S.ch === 9) await chapterEnd();
  }

  /** Passer une porte, une échelle ou l'entrée d'une grotte : on arrive sur la vraie carte, à la porte qui y mène. */
  async function go(w) {
    if (w.dest === 'ssanne' && mapKey === 'carmin') {
      if (S.flags.naufrage) { await talk([['Marin', 'L\'Océane ? Elle a pris la mer… enfin, ce qu\'il en reste !']]); return; }
      if (!S.flags.leo) { await ssanne(); return; }
      if (!S.flags.surge) { await talk([['Marin', 'La fête des dresseurs commence ce soir. Va d\'abord défier le Major Bob, petit !']]); return; }
      if (!S.flags.ssanne) { S.flags.ssanne = 1; await talk([['Marin', 'Un Passe Océane ! Bienvenue à bord, la fête des dresseurs va commencer !']]); }
    }
    const to = G.KantoArt.maps[w.dest];
    // La porte d'arrivée (celle donnée par le jeu, sinon une qui ramène ici).
    let t = to.warps[w.id];
    if (!t || t.dest !== mapKey) t = to.warps.find(x => x.dest === mapKey) || t || to.warps[0];
    let x = t.x, y = t.y, dir = pl.dir;
    const free = yy => { const ch = (to.grid[yy] || '')[x]; return ch && ch !== '#' && ch !== 'w'; };
    if (to.inside && !art.inside) { if (free(t.y - 1)) { y = t.y - 1; dir = 'up'; } else { y = t.y + 1; dir = 'down'; } }       // on entre : un pas dans la pièce
    else if (!to.inside && art.inside) { if (free(t.y + 1)) { y = t.y + 1; dir = 'down'; } else { y = t.y - 1; dir = 'up'; } }  // on sort : un pas devant la porte
    else if (!free(y)) { y += free(y + 1) ? 1 : -1; }
    await fade(() => setMap(w.dest, x, y, dir));
    commit();
    const gym = GYMS[w.dest];
    if (gym) {
      // Entrée dans une arène : la bannière du champion.
      const el = $('world-banner');
      el.innerHTML = `<small>${def.name}</small><b>${gym}</b>`;
      el.classList.add('on');
      G.Audio.sfx('select');
      setTimeout(() => el.classList.remove('on'), 1800);
    }
  }
  const GYMS = { argenta_arene: 'Champion : Pierre', azuria_arene: 'Championne : Ondine', carmin_arene: 'Champion : Major Bob' };

  async function door(w) {
    const ev = w.ev;
    if (ev === 'go') { await go(w); return; }
    if (K().DOORS[ev]) { await talk([['', K().DOORS[ev]]]); return; }
    if (ev === 'ssanne') { await ssanne(); return; }
    if (ev === 'stairs') { await talk([['', 'L\'étage est privé.']]); return; }
    if (ev === 'link') { await link(w); return; }
    if (ev === 'cave') { await talk([['', 'La Cave Taupiqueur est sombre et pleine de Taupiqueur… Pas maintenant !']]); return; }
    if (ev === 'house') { await talk([['Habitant', 'On dit qu\'un Pikachu dresseur traîne dans le coin… Bizarre, non ?']]); return; }
    if (ev === 'gymJadielle') { await talk([['', 'L\'arène de Jadielle est fermée. Son champion est absent…']]); return; }
    await talk([['', 'C\'est fermé.']]);
  }

  /** Les Pokémon de la boutique : 3 Pokémon du coin, les mêmes pour ce chapitre et cette boutique, et chers. */
  function martMons() {
    const key = mapKey + ':' + S.ch;
    if (!S.shop || S.shop.key !== key) {
      let h = 17;
      for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const rnd = () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 8) / 16777216; };
      const pool = [...new Set([].concat(HABITAT[S.ch] || [], HABITAT[S.ch - 1] || [], HABITAT[S.ch - 2] || []))].filter(d => G.DEX_BY[d] && !G.DEX_BY[d].leg);
      const list = [];
      while (pool.length && list.length < 6) list.push(...pool.splice(Math.floor(rnd() * pool.length), 1));
      S.shop = { key, list, sold: [] };
    }
    // Jamais un Pokémon d'une famille déjà dans l'équipe ou la boîte.
    const fams = new Set(S.team.concat(S.box).map(m => family(m.dex)));
    return S.shop.list.filter(d => !S.shop.sold.includes(d) && !fams.has(family(d))).slice(0, 3);
  }
  async function buyMon() {
    const lv = Math.max(2, Math.round(S.team.reduce((a, m) => a + m.lv, 0) / Math.max(1, S.team.length)));
    // Version de Nika : de 12 500 à 25 000 pièces selon la force du Pokémon (total de ses stats de base).
    const price = d => Math.round(2.5 * (5000 + 5000 * Math.max(0, Math.min(1, ((G.DEX_BY[d].bst || 300) - 250) / 300))) / 500) * 500;
    for (;;) {
      const list = martMons();
      if (!list.length) { await talk([['Vendeur', 'Je n\'ai plus de Pokémon à vendre pour l\'instant. Repasse plus tard dans l\'aventure !']]); return; }
      const i = await G.AdvUI.choose('Pokémon à vendre · tu as ' + S.money + ' pièces', list.map(d => ({ dex: d, title: G.DEX_BY[d].name, types: G.DEX_BY[d].types,
        desc: price(d) + ' pièces · N. ' + lv + ' · ' + M().movesAt(d, lv).map(M().moveName).join(', '), off: S.money < price(d) })).concat([{ title: 'Retour', desc: '' }]));
      if (i >= list.length) return;
      const d = list[i], cost = price(d);
      if (S.money < cost) { await talk([['Vendeur', 'Il te faut ' + cost + ' pièces pour ' + G.DEX_BY[d].name + '. Reviens quand tu les auras !']]); continue; }
      S.money -= cost;
      S.shop.sold.push(d);
      const m = M().make(d, lv);
      if (S.team.length < 6) S.team.push(m); else S.box.push(m);
      G.DB.grant(d, 'adv');
      refreshFollowers();
      G.Audio.sfx('confirm');
      await talk([['Vendeur', 'Merci ! Prends bien soin de ' + G.DEX_BY[d].name + '.'], ['', G.DEX_BY[d].name + (S.team.includes(m) ? ' rejoint ton équipe !' : ' part dans ta boîte (équipe pleine).')]]);
      commit();
    }
  }
  async function mart() {
    for (;;) {
      const i = await G.AdvUI.choose('Boutique · ' + S.money + ' pièces', [
        { title: '3 Potions', desc: '300 pièces · +20 PV chacune', icon: 'up', off: S.money < 300 },
        { title: 'Pokémon', desc: 'Des Pokémon du coin, mais chers', icon: 'pball' },
        { title: 'Au revoir', desc: '' }
      ]);
      if (i === 2) return;
      if (i === 1) { await buyMon(); continue; }
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
  /** « évolue au N. 16 » (le plus petit niveau d'évolution), ou rien. */
  function evoTxt(m) {
    const l = (G.EVOS[m.dex] || []).filter(e => G.DEX_BY[e[0]]).map(e => e[1]);
    return l.length ? ' (évolue au N. ' + Math.min(...l) + ')' : '';
  }
  /** Le PC du Centre : la boîte pour ranger, reprendre ou relâcher ses Pokémon. */
  async function pc() {
    G.Audio.sfx('select');
    await talk([['', 'Tu allumes le PC. Connexion au système de stockage de Léo…']]);
    const card = (m, k) => ({ dex: m.dex, title: M().name(m) + (k === 0 && S.team.includes(m) ? ' (tête)' : ''),
      desc: 'N. ' + m.lv + evoTxt(m) + ' · ' + Math.ceil(m.hp) + '/' + M().maxHp(m) + ' PV · ' + m.moves.map(M().moveName).join(', ') });
    for (;;) {
      const i = await G.AdvUI.choose('PC de Léo · équipe ' + S.team.length + '/6 · boîte ' + S.box.length, [
        { icon: 'pcbox', title: 'Retirer', desc: 'Prendre un Pokémon de la boîte dans l\'équipe', off: !S.box.length },
        { icon: 'pball', title: 'Déposer', desc: 'Ranger un Pokémon de l\'équipe dans la boîte', off: S.team.length < 2 },
        { icon: 'friends', title: 'Échanger', desc: 'Un de l\'équipe contre un de la boîte', off: !S.box.length },
        { icon: 'heart', title: 'Relâcher', desc: 'Rendre un Pokémon de la boîte à la nature', off: !S.box.length },
        { title: 'Éteindre', desc: '' }]);
      if (i === 4) break;
      if (i !== 1 && !S.box.length) { await talk([['', 'La boîte est vide. Les Pokémon capturés quand l\'équipe est pleine arrivent ici.']]); continue; }
      if (i === 0) {
        if (S.team.length >= 6) { await talk([['', 'Ton équipe est pleine (6 Pokémon). Dépose ou échange un Pokémon d\'abord.']]); continue; }
        const j = await G.AdvUI.choose('Quel Pokémon retirer ?', S.box.map(card).concat([{ title: 'Retour', desc: '' }]));
        if (j >= S.box.length) continue;
        const [m] = S.box.splice(j, 1); S.team.push(m);
        await talk([['', M().name(m) + ' rejoint ton équipe !']]);
      } else if (i === 1) {
        if (S.team.length < 2) { await talk([['', 'Il te faut au moins un Pokémon avec toi !']]); continue; }
        const j = await G.AdvUI.choose('Quel Pokémon déposer ?', S.team.map(card).concat([{ title: 'Retour', desc: '' }]));
        if (j >= S.team.length) continue;
        const [m] = S.team.splice(j, 1); S.box.push(m);
        await talk([['', M().name(m) + ' est rangé dans la boîte.']]);
      } else if (i === 2) {
        const j = await G.AdvUI.choose('Qui part dans la boîte ?', S.team.map(card).concat([{ title: 'Retour', desc: '' }]));
        if (j >= S.team.length) continue;
        const k = await G.AdvUI.choose('Qui le remplace ?', S.box.map(card).concat([{ title: 'Retour', desc: '' }]));
        if (k >= S.box.length) continue;
        const a = S.team[j]; S.team[j] = S.box[k]; S.box[k] = a;
        await talk([['', M().name(S.team[j]) + ' rejoint ton équipe, ' + M().name(a) + ' va dans la boîte.']]);
      } else if (i === 3) {
        const j = await G.AdvUI.choose('Quel Pokémon relâcher ?', S.box.map(card).concat([{ title: 'Retour', desc: '' }]));
        if (j >= S.box.length) continue;
        const m = S.box[j];
        const y = await G.AdvUI.choose('Relâcher ' + M().name(m) + ' ? Tu ne le reverras plus.', [{ title: 'Oui, relâcher', desc: '' }, { title: 'Non', desc: '' }]);
        if (y !== 0) continue;
        S.box.splice(j, 1);
        await talk([['', 'Au revoir, ' + M().name(m) + ' !']]);
      }
      refreshFollowers();
      commit();
    }
    hud();
  }
  /** La forme de base de la famille (Roucool pour Roucoups et Roucarnage). */
  let PRE = null;
  function family(d) {
    if (!PRE) { PRE = {}; for (const [a, l] of Object.entries(G.EVOS || {})) for (const [to] of l) if (!PRE[to]) PRE[to] = +a; }
    for (let i = 0; i < 4 && PRE[d]; i++) d = PRE[d];
    return d;
  }
  /** Capturer : 3 cartes de Pokémon de la région (ceux de l'animé à cet endroit). */
  async function capture(ch) {
    const avg = Math.max(2, Math.round(S.team.reduce((a, m) => a + m.lv, 0) / Math.max(1, S.team.length)));
    // Version de Nika : des Pokémon cohérents avec le coin (ceux qui y vivent dans les jeux et l'animé),
    // et au moins un de ceux croisés pendant le chapitre (sauvages ou Pokémon des dresseurs).
    // Version de Nika : jamais de doublon, ni le même Pokémon ni un de sa famille (Roucool si on a Roucoups).
    const fams = new Set(S.team.concat(S.box).map(m => family(m.dex)));
    const ok = d => G.DEX_BY[d] && !G.DEX_BY[d].leg && !fams.has(family(d));
    const shuffle = a => [...new Set(a)].filter(ok).sort(() => Math.random() - 0.5);
    const met0 = (S.seen && S.seen[ch]) || [];
    const shown = new Set();
    // 3 Pokémon : un croisé pendant le chapitre, les autres du coin (on évite de remontrer ceux déjà proposés).
    const draw = () => {
      const fresh = a => { const f = a.filter(d => !shown.has(d)); return f.length ? f : a; };
      const met = fresh(shuffle(met0));
      let picks = met.slice(0, 1);
      for (let c = ch; picks.length < 3 && c >= 1; c--) picks = picks.concat(fresh(shuffle(HABITAT[c] || [])).filter(d => !picks.some(q => family(q) === family(d)))).slice(0, 3);
      for (let c = ch; picks.length < 3 && c >= 1; c--) picks = picks.concat(shuffle(HABITAT[c] || []).filter(d => !picks.some(q => family(q) === family(d)))).slice(0, 3);
      // Tout le coin est déjà dans l'équipe : d'autres Pokémon de Kanto.
      if (picks.length < 3) picks = picks.concat(shuffle(Array.from({ length: 151 }, (_, k) => k + 1).filter(d => family(d) === d && !picks.some(q => family(q) === d)))).slice(0, 3);
      picks.forEach(d => shown.add(d));
      return picks;
    };
    // Version de Nika : une seule relance par fin de chapitre, payée en pièces.
    let picks = draw(), rolls = 0, i;
    for (;;) {
      const cost = 300;
      i = await G.AdvUI.choose('Un Pokémon veut te rejoindre ! Lequel captures-tu ?',
        picks.map(d => ({ dex: d, title: G.DEX_BY[d].name, types: G.DEX_BY[d].types, desc: 'Niveau ' + avg + ' · ' + M().movesAt(d, avg).map(M().moveName).join(', ') }))
          .concat(rolls ? [] : [{ icon: 'up', title: 'Relancer (une fois)', desc: cost + ' pièces · tu as ' + S.money + ' pièces', off: cost > S.money }]));
      if (i < picks.length) break;
      if (cost > S.money) { await talk([['', 'Tu n\'as pas assez de pièces pour relancer.']]); continue; }
      S.money -= cost; rolls++;
      G.Audio.sfx('select');
      picks = draw();
    }
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
          { icon: 'flying', title: 'Vol', desc: flier() ? M().name(flier()) + ' t\'emmène à un Centre Pokémon' : 'Il faut un Pokémon de type Vol' },
          { icon: 'home', title: 'Débloquer', desc: 'Coincé ? Retour au dernier Centre Pokémon' },
          { title: 'Quitter', desc: 'Sauvegarde et retour au menu' },
          { title: 'Fermer', desc: '' }
        ]);
        if (i === 0) {
          if (!S.team.length) continue;
          const j = await G.AdvUI.choose('Ton équipe · touche un Pokémon', S.team.map((m, k) => ({ dex: m.dex,
            title: M().name(m) + (k === 0 ? ' (tête)' : ''), desc: 'N. ' + m.lv + evoTxt(m) + ' · ' + Math.ceil(m.hp) + '/' + M().maxHp(m) + ' PV' + (m.st ? ' · ' + G.AdvBattle.ST_NAME[m.st] : '') + ' · ' + m.moves.map(M().moveName).join(', ') })).concat([{ title: 'Retour', desc: '' }]));
          if (j < 0 || j >= S.team.length) continue;
          const m = S.team[j];
          const a = await G.AdvUI.choose(M().name(m) + ' · N. ' + m.lv, [{ icon: 'book', title: 'Pokédex', desc: 'Stats, évolutions et attaques' }]
            .concat(j > 0 ? [{ icon: 'crown', title: 'Mettre en tête', desc: 'Il ouvre la marche et combat en premier' }] : [])
            .concat([{ title: 'Retour', desc: '' }]));
          if (a === 0) await G.AdvUI.dex(m);
          else if (a === 1 && j > 0) { S.team.splice(j, 1); S.team.unshift(m); refreshFollowers(); }
        } else if (i === 1) await talk([['', K().CHAPTERS[S.ch].goal]]);
        else if (i === 2) { await flyMenu(); return; }
        else if (i === 3) {
          const y = await G.AdvUI.choose('Retourner au dernier Centre Pokémon visité ?', [{ icon: 'home', title: 'Oui, j\'y retourne', desc: '' }, { title: 'Non', desc: '' }]);
          if (y === 0) { await rescue(); return; }
        }
        else if (i === 4) { quit(); return; }
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
    // Vol : les villes déjà traversées dans les parties d'avant.
    S.fly = S.fly || {};
    [[1, 'bourg'], [2, 'jadielle'], [3, 'argenta'], [5, 'route4'], [5, 'azuria'], [7, 'carmin'], [9, 'route10'], [9, 'lavanville']].forEach(([c, t]) => { if (S.ch >= c) S.fly[t] = 1; });
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
