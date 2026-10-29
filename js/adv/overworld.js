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
  const SOLID = new Set(['T', '~', 'F', 'r', 'S', 'H', 'L', 'C', 'M', 'G', 'D']);
  const SPEED = TS * 4.5;
  const STARTERS = [1, 4, 7];

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
    if (!s.adv2) s.adv2 = { team: [], box: [], map: 'bourg', x: 4, y: 5, dir: 'down', flags: {}, ch: 1, balls: 0, potions: 0, money: 500, heal: { map: 'bourg', x: 4, y: 5 } };
    return s.adv2;
  }
  function commit() {
    if (!S) return;
    S.map = mapKey; S.x = Math.floor(pl.x / TS); S.y = Math.floor((pl.y - 4) / TS); S.dir = pl.dir;
    G.DB.commit();
  }
  function heal() { for (const m of S.team) m.hp = M().maxHp(m); }

  // ---------------- tuiles ----------------
  const at = (x, y) => (map.rows[y] || '')[x] || 'T';
  function rnd(x, y, k = 0) { const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); }

  function grass(c, x, y, px, py, dark) {
    c.fillStyle = dark ? '#3f9a48' : '#62bf58';
    c.fillRect(px, py, TS, TS);
    c.fillStyle = dark ? '#357f3c' : '#52a94b';
    for (let i = 0; i < 5; i++) c.fillRect(px + Math.floor(rnd(x, y, i) * 28), py + Math.floor(rnd(x, y, i + 9) * 28), 2, 4);
  }
  function tile(c, ch, x, y) {
    const px = x * TS, py = y * TS;
    if (ch === '=') {
      c.fillStyle = '#e2c98e'; c.fillRect(px, py, TS, TS);
      c.fillStyle = '#c9ad72';
      for (let i = 0; i < 4; i++) c.fillRect(px + Math.floor(rnd(x, y, i) * 28), py + Math.floor(rnd(x, y, i + 5) * 28), 3, 2);
      return;
    }
    if (ch === '~') {
      c.fillStyle = '#3a8ae0'; c.fillRect(px, py, TS, TS);
      c.fillStyle = '#7ab8f4';
      for (let i = 0; i < 2; i++) { const yy = py + 8 + i * 14 + Math.floor(rnd(x, y, i) * 4); c.fillRect(px + 4 + Math.floor(rnd(x, y, i + 3) * 10), yy, 10, 2); }
      return;
    }
    grass(c, x, y, px, py, false);
    if (ch === ',') {
      for (let i = 0; i < 3; i++) {
        const fx = px + 4 + Math.floor(rnd(x, y, i) * 22), fy = py + 4 + Math.floor(rnd(x, y, i + 4) * 22);
        c.fillStyle = i % 2 ? '#ffffff' : '#f05a7a'; c.fillRect(fx, fy, 4, 4);
        c.fillStyle = '#f8e040'; c.fillRect(fx + 1, fy + 1, 2, 2);
      }
    } else if (ch === 'g') {
      c.fillStyle = '#2f8a3c'; c.fillRect(px, py + 6, TS, TS - 6);
      c.fillStyle = '#4fb04a';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        const bx = px + i * 8, by = py + 6 + j * 13;
        c.fillRect(bx + 1, by + 4, 2, 8); c.fillRect(bx + 3, by, 2, 12); c.fillRect(bx + 5, by + 3, 2, 9);
      }
    } else if (ch === 'T') {
      c.fillStyle = '#6a4a2a'; c.fillRect(px + 12, py + 20, 8, 12);
      c.fillStyle = '#1f6a34'; c.beginPath(); c.arc(px + 16, py + 14, 15, 0, 6.2832); c.fill();
      c.fillStyle = '#2f8a44'; c.beginPath(); c.arc(px + 13, py + 11, 9, 0, 6.2832); c.fill();
      c.fillStyle = '#4aa858'; c.fillRect(px + 9, py + 6, 5, 3);
    } else if (ch === 'F') {
      c.fillStyle = '#a8784a'; c.fillRect(px, py + 12, TS, 4); c.fillRect(px, py + 22, TS, 4);
      c.fillStyle = '#7a5230'; c.fillRect(px + 2, py + 6, 5, 24); c.fillRect(px + 25, py + 6, 5, 24);
    } else if (ch === 'r') {
      c.fillStyle = '#7a7a86'; c.beginPath(); c.ellipse(px + 16, py + 19, 14, 11, 0, 0, 6.2832); c.fill();
      c.fillStyle = '#a0a0ac'; c.beginPath(); c.ellipse(px + 12, py + 15, 7, 5, 0, 0, 6.2832); c.fill();
    } else if (ch === 'S') {
      c.fillStyle = '#6a4a2a'; c.fillRect(px + 14, py + 18, 4, 12);
      c.fillStyle = '#b8864a'; c.fillRect(px + 5, py + 6, 22, 14);
      c.fillStyle = '#8a5e30'; c.fillRect(px + 8, py + 10, 16, 2); c.fillRect(px + 8, py + 14, 12, 2);
    }
  }

  const BUILD = {
    H: { roof: '#d0483a', dark: '#a03028', wall: '#f4e6c8' },
    L: { roof: '#8a96a8', dark: '#66728a', wall: '#f4f4f0' },
    C: { roof: '#e0484a', dark: '#b03034', wall: '#fff4f4' },
    M: { roof: '#3a6ad0', dark: '#2a4ea8', wall: '#f0f4ff' },
    G: { roof: '#8a6a4a', dark: '#6a4e34', wall: '#d8c8a8' }
  };
  function buildings(c) {
    const W = map.rows[0].length, H = map.rows.length, seen = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = at(x, y);
      if (!BUILD[ch] || seen.has(x + ',' + y)) continue;
      // Le rectangle du bâtiment (ses portes D comprises).
      let x1 = x, y1 = y;
      while (BUILD[at(x1 + 1, y)] === BUILD[ch] || at(x1 + 1, y) === 'D') x1++;
      while (at(x, y1 + 1) === ch || at(x, y1 + 1) === 'D') y1++;
      const doors = [];
      for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) { seen.add(xx + ',' + yy); if (at(xx, yy) === 'D') doors.push([xx, yy]); }
      const b = BUILD[ch], px = x * TS, py = y * TS, w = (x1 - x + 1) * TS, h = (y1 - y + 1) * TS;
      const roofH = Math.round(h * 0.55);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(px + 4, py + 6, w, h);
      c.fillStyle = b.wall; c.fillRect(px + 2, py + roofH - 4, w - 4, h - roofH + 4);
      c.fillStyle = b.roof; c.fillRect(px, py, w, roofH);
      c.fillStyle = b.dark;
      for (let i = 6; i < roofH; i += 8) c.fillRect(px, py + i, w, 2);
      c.fillRect(px - 2, py + roofH - 4, w + 4, 5);
      // Fenêtres.
      c.fillStyle = '#7ac0f0';
      for (let wx = px + 12; wx + 14 < px + w - 8; wx += 34) {
        if (doors.some(([dx]) => Math.abs(dx * TS + 16 - (wx + 7)) < 20)) continue;
        c.fillRect(wx, py + roofH + 6, 14, 10);
        c.fillStyle = '#ffffff'; c.fillRect(wx + 2, py + roofH + 8, 3, 3); c.fillStyle = '#7ac0f0';
      }
      for (const [dx, dy] of doors) {
        c.fillStyle = '#5a3a20'; c.fillRect(dx * TS + 8, dy * TS + 8, 16, 24);
        c.fillStyle = '#f0c040'; c.fillRect(dx * TS + 19, dy * TS + 20, 2, 2);
      }
      // Enseigne : Poké Ball (Centre), M (Boutique), badge (Arène).
      const cx = px + w / 2, sy = py + roofH - 18;
      if (ch === 'C' || ch === 'G' || ch === 'M') {
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cx, sy, 9, 0, 6.2832); c.fill();
        c.fillStyle = ch === 'C' ? '#e0484a' : ch === 'M' ? '#3a6ad0' : '#8a6a4a';
        c.beginPath(); c.arc(cx, sy, 9, Math.PI, 0); c.fill();
        c.fillStyle = '#222'; c.fillRect(cx - 9, sy - 1, 18, 2);
        c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, sy, 3, 0, 6.2832); c.fill();
      }
    }
  }

  function bake() {
    const W = map.rows[0].length, H = map.rows.length;
    bg = document.createElement('canvas');
    bg.width = W * TS; bg.height = H * TS;
    const c = bg.getContext('2d');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = at(x, y);
      tile(c, BUILD[ch] || ch === 'D' ? '.' : ch, x, y);
    }
    buildings(c);
  }

  // ---------------- personnages ----------------
  function loadNpcs() {
    npcs = (K().NPCS[mapKey] || []).filter(n => !n.when || n.when(S.flags)).map(n => ({
      ...n, px: n.x * TS + 16, py: n.y * TS + 28, d: n.dir, walkT: 0, moving: false, bubble: 0
    }));
  }
  function npcAt(tx, ty) { return npcs.find(n => Math.floor(n.px / TS) === tx && Math.floor((n.py - 4) / TS) === ty); }

  function solidAt(wx, wy) {
    const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
    if (ty < 0 || ty >= map.rows.length || tx < 0 || tx >= map.rows[0].length) return !exitAt(tx, ty);
    if (SOLID.has(at(tx, ty))) return true;
    return npcs.some(n => Math.abs(n.px - wx) < 14 && wy > n.py - 14 && wy < n.py + 2);
  }
  function blocked(x, y) {
    return solidAt(x - 9, y - 1) || solidAt(x + 9, y - 1) || solidAt(x - 9, y - 9) || solidAt(x + 9, y - 9);
  }
  function exitAt(tx, ty) {
    const W = map.rows[0].length, H = map.rows.length;
    const edge = ty < 0 ? 'n' : ty >= H ? 's' : tx < 0 ? 'w' : tx >= W ? 'e' : null;
    if (!edge) return null;
    const v = edge === 'n' || edge === 's' ? tx : ty;
    return (map.exits || []).find(e => e.edge === edge && v >= e.from && v <= e.to) || null;
  }

  function setMap(key, tx, ty, dir) {
    mapKey = key;
    map = K().MAPS[key];
    bake();
    loadNpcs();
    pl.x = tx * TS + 16; pl.y = ty * TS + 28; pl.dir = dir || pl.dir;
    pl.tile = tx + ',' + ty;
    trail = [];
    for (let i = 0; i < 200; i++) trail.push({ x: pl.x, y: pl.y });
    followers.forEach(f => { f.x = pl.x; f.y = pl.y; });
    G.Audio.music(map.music === 'route' ? 'forest' : map.music);
    $('world-place').textContent = map.name;
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
    const W = map.rows[0].length * TS, H = map.rows.length * TS, hw = vw / zoom / 2, hh = vh / zoom / 2;
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
    pl.moving = !!(ax || ay);
    if (pl.moving) {
      pl.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 'left' : 'right') : (ay < 0 ? 'up' : 'down');
      pl.walkT += dt;
      const nx = pl.x + ax * SPEED * dt, ny = pl.y + ay * SPEED * dt;
      let moved = false;
      if (!blocked(nx, pl.y)) { pl.x = nx; moved = true; }
      if (!blocked(pl.x, ny)) { pl.y = ny; moved = true; }
      if (!moved && !bumpT) { bumpT = 0.35; bump(); }
      afterMove();
    }
    // La file des Pokémon qui suivent.
    const h = trail[0];
    if (!h || Math.hypot(h.x - pl.x, h.y - pl.y) > 2) { trail.unshift({ x: pl.x, y: pl.y }); if (trail.length > 400) trail.pop(); }
    let k = 0;
    for (const f of followers) {
      if (f.m === hiddenMon || f.m.hp <= 0) continue;
      k++;
      const p = trailAt(k * 40);
      const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
      if (d > 0.5) {
        f.x += dx * Math.min(1, dt * 12); f.y += dy * Math.min(1, dt * 12);
        if (d > 1.5) f.anim.dir = G.Sprites.dirFromAngle(Math.atan2(dy, dx));
        f.anim.loop(d > 1.5 ? 'Walk' : 'Idle');
      } else f.anim.loop('Idle');
      f.anim.update(dt);
    }
    for (const n of npcs) if (n.bubble) n.bubble = Math.max(0, n.bubble - dt);
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
    c.fillStyle = '#1f6a34'; c.fillRect(0, 0, vw, vh);
    c.setTransform(dpr * zoom, 0, 0, dpr * zoom, Math.round(dpr * (vw / 2 - cam.x * zoom)), Math.round(dpr * (vh / 2 - cam.y * zoom)));
    c.imageSmoothingEnabled = false;
    c.drawImage(bg, 0, 0);
    // Eau qui scintille.
    const list = [];
    for (const n of npcs) list.push({ y: n.py, draw: x => {
      G.People.draw(x, n.look, n.px, n.py, n.d, n.walkT, n.moving);
      if (n.bubble) { x.fillStyle = '#fff'; x.fillRect(n.px - 7, n.py - 66, 14, 16); x.fillStyle = '#e03030'; x.fillRect(n.px - 2, n.py - 63, 4, 7); x.fillRect(n.px - 2, n.py - 54, 4, 3); }
    } });
    for (const f of followers) {
      if (f.m === hiddenMon || f.m.hp <= 0) continue;
      list.push({ y: f.y, draw: x => { G.Sprites.drawShadow(x, f.m.dex, f.x, f.y, 1); f.anim.draw(x, f.x, f.y); } });
    }
    list.push({ y: pl.y + 0.1, draw: x => G.People.draw(x, 'hero', pl.x, pl.y, pl.dir, pl.walkT, pl.moving) });
    for (const d of G.AdvBattle.drawables()) list.push(d);
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(c);
    // Les herbes hautes cachent le bas des jambes.
    const tx = Math.floor(pl.x / TS), ty = Math.floor((pl.y - 4) / TS);
    if (at(tx, ty) === 'g') { c.fillStyle = '#2f8a3c'; c.fillRect(pl.x - 14, pl.y - 8, 28, 9); c.fillStyle = '#4fb04a'; for (let i = -12; i < 12; i += 5) c.fillRect(pl.x + i, pl.y - 11, 2, 9); }
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
  function fx(x, y, color, dmg) { fxs.push({ x, y, color, dmg, t: 0 }); }

  // ---------------- interactions ----------------
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function front() {
    const [dx, dy] = DIRV[pl.dir];
    return { x: Math.floor((pl.x + dx * 24) / TS), y: Math.floor((pl.y - 5 + dy * 26) / TS) };
  }
  function bump() { interact(true); }
  function interact(fromBump) {
    if (busy) return;
    const f = front();
    const n = npcs.find(n => Math.hypot(n.px - (pl.x + DIRV[pl.dir][0] * 28), n.py - (pl.y + DIRV[pl.dir][1] * 28)) < 22);
    if (n) { run(() => talkNpc(n)); return; }
    const ch = at(f.x, f.y);
    if (ch === 'D' && (map.doors || {})[f.x + ',' + f.y]) { if (pl.dir === 'up') run(() => door(map.doors[f.x + ',' + f.y], f)); return; }
    if (ch === 'S' && (map.signs || {})[f.x + ',' + f.y] && !fromBump) { run(() => talk([['', map.signs[f.x + ',' + f.y]]])); return; }
    if (ch === 'S' && fromBump && pl.dir === 'up') run(() => talk([['', map.signs[f.x + ',' + f.y]]]));
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
    if (n.event === 'chen') { await chen(); return; }
    if (n.event === 'rival1') { await rival1(n); return; }
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
        if (SOLID.has(at(cx, cy))) break;
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
    const tx = pl.x - DIRV[n.d][0] * 30, ty = pl.y - DIRV[n.d][1] * 30;
    await new Promise(res => {
      const step = () => {
        const dx = tx - n.px, dy = ty - n.py, d = Math.hypot(dx, dy);
        if (d < 4 || !open_) { n.moving = false; res(); return; }
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
    G.Audio.music(map.music === 'route' ? 'forest' : map.music);
    if (res === 'lose') { await blackout(); return res; }
    await G.AdvBattle.evolutions();
    refreshFollowers();
    return res;
  }

  async function blackout() {
    await talk([['', 'Tu n\'as plus de Pokémon en forme… Tu cours au Centre Pokémon le plus proche.']]);
    heal();
    const h = S.heal || { map: 'bourg', x: 4, y: 5 };
    setMap(h.map, h.x, h.y, 'down');
    await talk([[h.map === 'bourg' ? 'Maman' : 'Infirmière Joëlle', 'Tes Pokémon sont en pleine forme. Fais attention à toi !']]);
  }

  function afterMove() {
    const tx = Math.floor(pl.x / TS), ty = Math.floor((pl.y - 4) / TS);
    // Sortie de la carte.
    if (pl.y - 4 < 0 || pl.y > map.rows.length * TS || pl.x < 0 || pl.x > map.rows[0].length * TS) {
      const e = exitAt(pl.x < 0 ? -1 : pl.x > map.rows[0].length * TS ? map.rows[0].length : tx, pl.y - 4 < 0 ? -1 : pl.y > map.rows.length * TS ? map.rows.length : ty);
      if (e) { run(() => leave(e)); return; }
    }
    const key = tx + ',' + ty;
    if (key === pl.tile) return;
    pl.tile = key;
    if (checkSight()) return;
    if (at(tx, ty) === 'g' && map.wild && canFight() && Math.random() < 1 / 9) {
      const [dex, a, b] = G.U.pick(map.wild);
      run(() => battle({ wild: [dex, a + Math.floor(Math.random() * (b - a + 1))] }));
    }
  }

  async function leave(e) {
    // Les passages bloqués par l'histoire.
    if (mapKey === 'bourg' && !S.flags.starter) {
      pl.y += 24;
      await talk([['Prof. Chen', 'Hé ! Attends ! Il est dangereux de partir sans Pokémon ! Viens me voir devant mon labo, au sud.']]);
      return;
    }
    if (mapKey === 'jadielle' && e.map === 'foret' && !S.flags.ch1done) {
      pl.y += 24;
      await talk([['', 'Tes Pokémon sont fatigués par la route. Passe d\'abord au Centre Pokémon de Jadielle.']]);
      return;
    }
    const dir = { n: 'up', s: 'down', w: 'left', e: 'right' }[e.edge];
    await fade(() => setMap(e.map, e.x, e.y, dir));
    commit();
    if (e.map === 'argenta' && S.ch === 2) await chapterEnd();
  }
  function fade(fn) {
    const el = $('world-fade');
    el.classList.add('on');
    return new Promise(res => setTimeout(() => { fn(); el.classList.remove('on'); setTimeout(res, 200); }, 220));
  }

  // ---------------- l'histoire ----------------
  async function chen() {
    if (S.flags.starter) {
      await talk([['Prof. Chen', S.flags.ch1done ? 'Ton Pokédex se remplit ? Continue comme ça !' : 'Va jusqu\'à Jadielle par la Route 1, au nord. Les hautes herbes sont pleines de Pokémon sauvages !']]);
      return;
    }
    await talk([['Prof. Chen', 'Ah, te voilà ! Tu es en retard, les autres sont déjà partis…'],
                ['Prof. Chen', 'Il me reste trois Pokémon. Choisis bien : il sera ton premier compagnon !']]);
    const i = await G.AdvUI.choose('Choisis ton premier Pokémon', STARTERS.map(d => ({ dex: d, title: G.DEX_BY[d].name, types: G.DEX_BY[d].types })));
    const dex = STARTERS[i];
    S.team = [M().make(dex, 5)];
    S.flags.starter = dex;
    G.DB.grant(dex, 'adv');
    refreshFollowers();
    G.Audio.sfx('legend');
    S.balls += 5; S.potions += 2;
    await talk([['', 'Tu as choisi ' + G.DEX_BY[dex].name + ' !'],
                ['Prof. Chen', 'Prends aussi ces 5 Poké Balls et 2 Potions. Lance une Poké Ball sur un Pokémon sauvage affaibli pour le capturer !']]);
    loadNpcs();
  }
  async function rival1(n) {
    const counter = { 1: 4, 4: 7, 7: 1 }[S.flags.starter] || 4;
    await talk([['Régis', 'Tiens, tiens… Le retardataire ! Moi j\'ai déjà mon Pokémon. Voyons ce que vaut le tien !']]);
    const res = await battle({ trainer: { name: 'Régis', team: [[counter, 5]] } }, n);
    S.flags.rival1 = 1;
    heal();
    await talk(res === 'win'
      ? [['Régis', 'Quoi ?! J\'ai perdu… Pff, c\'était de la chance ! On se reverra !'], ['Prof. Chen', 'Bravo ! Je soigne tes Pokémon. En route pour Jadielle, au nord !']]
      : [['Régis', 'Ha ! Trop facile ! Bye bye, le nul !'], ['Prof. Chen', 'Ne t\'en fais pas, je soigne tes Pokémon. Entraîne-toi sur la Route 1 !']]);
    npcs = npcs.filter(x => x !== n);
  }

  async function door(ev, f) {
    const back = { map: mapKey, x: f.x, y: f.y + 1 };
    if (ev === 'home') {
      heal();
      await talk([['Maman', S.flags.starter ? 'Tu as l\'air épuisé ! Repose-toi un peu… Voilà, tes Pokémon sont en forme !' : 'Le Prof. Chen t\'attend devant son labo !']]);
      return;
    }
    if (ev === 'rivalHome') { await talk([['Sœur de Régis', S.flags.starter ? 'Régis est déjà parti à l\'aventure. Il dit qu\'il deviendra le meilleur !' : 'Régis est parti voir le Prof. Chen.']]); return; }
    if (ev === 'lab') { await talk([['Assistant', 'Le Prof. Chen est dehors, juste devant la porte.']]); return; }
    if (ev === 'house') { await talk([['Habitant', 'On dit qu\'un Pikachu dresseur traîne dans le coin… Bizarre, non ?']]); return; }
    if (ev === 'gymJadielle') { await talk([['', 'L\'arène de Jadielle est fermée. Son champion est absent…']]); return; }
    if (ev === 'mart') { await mart(); return; }
    if (ev === 'center') {
      await talk([['Infirmière Joëlle', 'Bienvenue au Centre Pokémon ! Je soigne tes Pokémon…']]);
      heal();
      S.heal = back;
      G.Audio.sfx('levelup');
      await talk([['Infirmière Joëlle', 'Voilà ! Tes Pokémon sont en pleine forme. À bientôt !']]);
      if (mapKey === 'jadielle' && S.ch === 1) { S.flags.ch1done = 1; await chapterEnd(); }
      return;
    }
    if (ev === 'gymArgenta') {
      if (S.flags.pierre) { await talk([['Pierre', 'Tu as mon Badge Roche. Continue ta route, tu iras loin !']]); return; }
      await talk([['Pierre', 'Je suis Pierre, le champion d\'Argenta. Ma défense est solide comme le roc !'], ['Pierre', 'Montre-moi ta détermination !']]);
      const res = await battle({ trainer: { name: 'Pierre', team: [[74, 10], [95, 12]] } }, { px: pl.x, py: pl.y - 150, d: 'down' });
      if (res === 'win') {
        S.flags.pierre = 1; S.money += 500;
        G.Audio.sfx('legend');
        await talk([['Pierre', 'Tu m\'as battu… Tu mérites ceci : le Badge Roche !'], ['', 'Tu obtiens le Badge Roche et 500 pièces !']]);
        if (S.ch === 3) await chapterEnd();
      }
    }
  }

  async function mart() {
    for (;;) {
      const i = await G.AdvUI.choose('Boutique · ' + S.money + ' pièces', [
        { title: '5 Poké Balls', desc: '300 pièces', icon: 'pball', off: S.money < 300 },
        { title: '3 Potions', desc: '300 pièces', icon: 'up', off: S.money < 300 },
        { title: 'Au revoir', desc: '' }
      ]);
      if (i === 2) return;
      if (S.money < 300) { await talk([['Vendeur', 'Tu n\'as pas assez de pièces…']]); continue; }
      S.money -= 300;
      if (i === 0) S.balls += 5; else S.potions += 3;
      G.Audio.sfx('confirm');
    }
  }

  /** Fin de chapitre : une récompense, puis le chapitre suivant commence tout de suite. */
  async function chapterEnd() {
    const ch = S.ch;
    G.Audio.sfx('legend');
    await talk([['', 'Chapitre ' + ch + ' terminé : ' + K().CHAPTERS[ch].title + ' !']]);
    const avg = Math.max(2, Math.round(S.team.reduce((a, m) => a + m.lv, 0) / Math.max(1, S.team.length)));
    const pool = [...new Set([].concat(...Object.values(K().MAPS).map(m => (m.wild || []).map(w => w[0]))))];
    const catchDex = G.U.pick(pool.filter(d => !S.team.some(m => m.dex === d)).length ? pool.filter(d => !S.team.some(m => m.dex === d)) : pool);
    const lead = S.team[0];
    const nm = M().learnset(lead.dex).find(id => !lead.moves.includes(id));
    const opts = [
      { dex: catchDex, title: 'Capturer ' + G.DEX_BY[catchDex].name, desc: 'Il rejoint ton équipe au niveau ' + avg },
      nm ? { icon: 'move:' + nm, title: 'Apprendre ' + M().moveName(nm), desc: 'Pour ' + M().name(lead) } : null,
      { icon: 'up', title: 'Entraînement', desc: 'Toute l\'équipe gagne 1 niveau' }
    ].filter(Boolean);
    const i = await G.AdvUI.choose('Choisis ta récompense', opts);
    const r = opts[i];
    if (r.dex) {
      const m = M().make(r.dex, avg);
      if (S.team.length < 6) S.team.push(m); else S.box.push(m);
      G.DB.grant(r.dex, 'adv');
      refreshFollowers();
    } else if (r.icon && r.icon.startsWith('move:')) {
      if (lead.moves.length < 4) lead.moves.push(nm);
      else {
        const j = await G.AdvUI.choose('Quelle attaque oublier ?', lead.moves.map(x => ({ icon: 'move:' + x, title: M().moveName(x), desc: '' })));
        lead.moves[j] = nm;
      }
    } else {
      for (const m of S.team) { const b = M().maxHp(m); m.lv++; m.xp = Math.max(m.xp, M().xpAt(m.lv)); m.hp += M().maxHp(m) - b; const n2 = M().newMoveAt(m.dex, m.lv); if (n2 && m.moves.length < 4 && !m.moves.includes(n2)) m.moves.push(n2); }
      await G.AdvBattle.evolutions();
    }
    G.Audio.sfx('confirm');
    S.ch = Math.min(K().CHAPTERS.length - 1, ch + 1);
    commit();
    await intro();
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
        const i = await G.AdvUI.choose('Menu · ' + S.money + ' pièces · ' + S.balls + ' Poké Balls · ' + S.potions + ' Potions', [
          { icon: 'pball', title: 'Équipe', desc: S.team.length + ' Pokémon' },
          { icon: 'up', title: 'Objectif', desc: K().CHAPTERS[S.ch].goal },
          { title: 'Quitter', desc: 'Sauvegarde et retour au menu' },
          { title: 'Fermer', desc: '' }
        ]);
        if (i === 0) {
          if (!S.team.length) continue;
          const j = await G.AdvUI.choose('Touche un Pokémon pour qu\'il mène l\'équipe', S.team.map((m, k) => ({ dex: m.dex,
            title: M().name(m) + (k === 0 ? ' (tête)' : ''), desc: 'N. ' + m.lv + ' · ' + Math.ceil(m.hp) + '/' + M().maxHp(m) + ' PV · ' + m.moves.map(M().moveName).join(', ') })));
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
