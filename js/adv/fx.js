/* ============ fx.js — les animations d'attaque de l'Aventure (version de Nika) ============
 * Une animation par type, dessinée sur la carte entre les deux Pokémon :
 * flammes, gouttes, feuilles, éclairs, cristaux de glace, rochers, ondes psy…
 * Attaque spéciale : un projectile part du lanceur vers la cible puis explose.
 * Attaque physique : l'impact se fait directement sur la cible.
 * Attaques de statut : flèches qui montent (hausse) ou descendent (baisse),
 * anneaux de couleur (statut), étincelles vertes (soin).
 */
G.AdvFX = (() => {
  const TYPES = {
    normal:   { c: ['#ffffff', '#e8e0c8'], shape: 'star' },
    fire:     { c: ['#ff5a00', '#ffa000', '#ffe060'], shape: 'flame', up: 60 },
    water:    { c: ['#3a8ae0', '#8ad0ff', '#ffffff'], shape: 'drop', g: 260 },
    grass:    { c: ['#2f9e3a', '#7ad65a', '#c8f080'], shape: 'leaf' },
    electric: { c: ['#ffe020', '#ffffff', '#fff3a0'], shape: 'bolt' },
    ice:      { c: ['#a8ecff', '#ffffff', '#70c8f0'], shape: 'shard' },
    fighting: { c: ['#d03828', '#ffb080'], shape: 'star' },
    poison:   { c: ['#a040a0', '#d080e0', '#702870'], shape: 'bubble', up: 40 },
    ground:   { c: ['#c89848', '#8a6428', '#e0c080'], shape: 'rock', g: 300, from: 'ground' },
    flying:   { c: ['#c8d8ff', '#ffffff'], shape: 'streak' },
    psychic:  { c: ['#f85888', '#ffa0c8'], shape: 'ring' },
    bug:      { c: ['#a8b820', '#d8e870'], shape: 'sq' },
    rock:     { c: ['#a89058', '#6e5a34', '#c8b080'], shape: 'rock', g: 400, from: 'sky' },
    ghost:    { c: ['#705898', '#3a2a5a', '#b0a0e0'], shape: 'wisp', up: 30 },
    dragon:   { c: ['#7038f8', '#a080ff', '#ff70a0'], shape: 'flame', up: 50 },
    dark:     { c: ['#3a2a22', '#705848'], shape: 'slash' },
    steel:    { c: ['#d0d0e8', '#ffffff', '#9090b0'], shape: 'star' },
    fairy:    { c: ['#ff9cc0', '#ffffff', '#ffd0e0'], shape: 'star' }
  };
  let parts = [], jobs = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function part(o) { parts.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 0, max: 0.6, size: 4, rot: Math.random() * 6.28, vr: 0, a: 1 }, o)); }

  /** Une gerbe de particules du type en (x, y). */
  function burst(t, x, y, n = 18, spread = 1) {
    const T = TYPES[t] || TYPES.normal;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = rnd(40, 150) * spread;
      if (T.from === 'sky') part({ shape: T.shape, color: pick(T.c), x: x + rnd(-30, 30), y: y - rnd(70, 130), vx: rnd(-10, 10), vy: rnd(60, 160), g: T.g, size: rnd(4, 8), max: 0.55, stop: y + rnd(-6, 8), vr: rnd(-6, 6) });
      else if (T.from === 'ground') part({ shape: T.shape, color: pick(T.c), x: x + rnd(-26, 26), y: y + 6, vx: rnd(-50, 50), vy: -rnd(120, 260), g: T.g, size: rnd(3, 7), max: 0.7, vr: rnd(-6, 6) });
      else part({ shape: T.shape, color: pick(T.c), x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (T.up || 0), g: T.g || 0, size: rnd(3, 7), max: rnd(0.4, 0.75), vr: rnd(-8, 8) });
    }
    if (T.shape === 'ring' || T.shape === 'star') part({ shape: 'ringw', color: T.c[0], x, y, size: 6, grow: 110, max: 0.4 });
    if (T.shape === 'slash') for (let i = 0; i < 3; i++) part({ shape: 'cut', color: i === 1 ? '#fff' : T.c[0], x: x + (i - 1) * 9, y, size: 30, max: 0.35, rot: -0.8 });
    if (t === 'electric') for (let i = 0; i < 4; i++) part({ shape: 'zap', color: i % 2 ? '#fff' : '#ffe020', x: x + rnd(-20, 20), y: y - rnd(60, 90), tx: x + rnd(-10, 10), ty: y, size: 3, max: 0.3 });
  }

  /** Lance l'animation d'une attaque. Rend une promesse (la fin du voyage du projectile). */
  function attack(type, from, to, cls) {
    const T = TYPES[type] || TYPES.normal;
    if (cls === 2 && !T.from) {
      // Projectile : il laisse une traînée de son type.
      return new Promise(res => jobs.push({ t: 0, dur: 0.32, step(k, dt) {
        const x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 18;
        for (let i = 0; i < 3; i++) part({ shape: T.shape, color: pick(T.c), x: x + rnd(-5, 5), y: y + rnd(-5, 5), vx: rnd(-20, 20), vy: rnd(-20, 20) - (T.up || 0) * 0.3, size: rnd(3, 6), max: 0.3, vr: rnd(-8, 8) });
        if (type === 'electric' && Math.random() < dt * 30) part({ shape: 'zap', color: '#fff', x: from.x, y: from.y, tx: x, ty: y, size: 2, max: 0.08 });
      }, done() { burst(type, to.x, to.y, 22); res(); } }));
    }
    burst(type, to.x, to.y, 20);
    return Promise.resolve();
  }
  /** Hausse ou baisse de stats : flèches. */
  function stat(x, y, up) {
    for (let i = 0; i < 7; i++) part({ shape: 'arrow', color: up ? '#ff8040' : '#4080ff', x: x + rnd(-22, 22), y: y + (up ? rnd(0, 20) : rnd(-50, -30)), vy: up ? -rnd(60, 100) : rnd(60, 100), size: 6, max: 0.6, up });
  }
  const AIL = { par: '#f8d030', slp: '#a0a0c0', frz: '#98d8f8', brn: '#f08030', psn: '#a040a0', cnf: '#f85888' };
  function ail(x, y, st) {
    part({ shape: 'ringw', color: AIL[st] || '#fff', x, y, size: 4, grow: 70, max: 0.5 });
    part({ shape: 'ringw', color: AIL[st] || '#fff', x, y, size: 4, grow: 50, max: 0.7 });
    for (let i = 0; i < 10; i++) part({ shape: st === 'slp' ? 'z' : 'sq', color: AIL[st] || '#fff', x: x + rnd(-20, 20), y: y + rnd(-10, 10), vy: -rnd(20, 60), vx: rnd(-20, 20), size: 4, max: 0.8 });
  }
  function heal(x, y) {
    for (let i = 0; i < 14; i++) part({ shape: 'plus', color: i % 2 ? '#5fe08a' : '#c8ffd8', x: x + rnd(-22, 22), y: y + rnd(-10, 20), vy: -rnd(30, 70), size: 4, max: 0.8 });
  }

  function update(dt) {
    for (let i = jobs.length - 1; i >= 0; i--) {
      const j = jobs[i];
      j.t += dt;
      const k = Math.min(1, j.t / j.dur);
      j.step(k, dt);
      if (k >= 1) { jobs.splice(i, 1); j.done(); }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.stop != null && p.y > p.stop) { p.y = p.stop; p.vy = -p.vy * 0.3; p.vx *= 0.5; }
      p.rot += p.vr * dt;
      if (p.grow) p.size += p.grow * dt;
      if (p.shape === 'leaf' || p.shape === 'streak') { p.vx *= 0.97; p.vy *= 0.97; }
    }
  }

  function draw(c) {
    for (const p of parts) {
      const k = p.life / p.max;
      c.save();
      c.globalAlpha = Math.max(0, 1 - k * k);
      c.fillStyle = c.strokeStyle = p.color;
      c.translate(p.x, p.y);
      const s = p.size;
      switch (p.shape) {
        case 'flame': c.scale(1 - k * 0.5, 1 - k * 0.5); c.beginPath(); c.moveTo(0, -s * 1.6); c.quadraticCurveTo(s, 0, 0, s); c.quadraticCurveTo(-s, 0, 0, -s * 1.6); c.fill(); break;
        case 'drop': c.beginPath(); c.moveTo(0, -s * 1.3); c.quadraticCurveTo(s, s * 0.6, 0, s); c.quadraticCurveTo(-s, s * 0.6, 0, -s * 1.3); c.fill(); break;
        case 'leaf': c.rotate(p.rot); c.beginPath(); c.ellipse(0, 0, s * 1.4, s * 0.6, 0, 0, 6.283); c.fill(); break;
        case 'shard': c.rotate(p.rot); c.beginPath(); c.moveTo(0, -s * 1.5); c.lineTo(s * 0.5, 0); c.lineTo(0, s * 1.5); c.lineTo(-s * 0.5, 0); c.fill(); break;
        case 'bubble': c.lineWidth = 2; c.beginPath(); c.arc(0, 0, s, 0, 6.283); c.stroke(); c.globalAlpha *= 0.4; c.fill(); break;
        case 'rock': c.rotate(p.rot); c.fillRect(-s, -s, s * 2, s * 2); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-s, 0, s * 2, s); break;
        case 'streak': c.rotate(Math.atan2(p.vy, p.vx)); c.fillRect(-s * 2.5, -1, s * 5, 2); break;
        case 'ring': c.lineWidth = 3; c.beginPath(); c.arc(0, 0, s * (1 + k * 2), 0, 6.283); c.stroke(); break;
        case 'ringw': c.lineWidth = 3; c.beginPath(); c.arc(0, 0, s, 0, 6.283); c.stroke(); break;
        case 'wisp': c.globalAlpha *= 0.7; c.beginPath(); c.arc(0, 0, s * (1 + k), 0, 6.283); c.fill(); break;
        case 'cut': c.rotate(p.rot); c.fillRect(-s * (0.3 + k), -1.5, s * 2 * (0.3 + k), 3); break;
        case 'zap': {
          c.translate(-p.x, -p.y);
          c.lineWidth = p.size; c.beginPath(); c.moveTo(p.x, p.y);
          const n = 5;
          for (let i = 1; i <= n; i++) c.lineTo(p.x + (p.tx - p.x) * i / n + (i < n ? rnd(-8, 8) : 0), p.y + (p.ty - p.y) * i / n);
          c.stroke();
          break;
        }
        case 'bolt': c.rotate(p.rot); c.fillRect(-s, -1, s * 2, 2); c.fillRect(-1, -s, 2, s * 2); break;
        case 'star': c.rotate(p.rot); c.fillRect(-s, -s * 0.3, s * 2, s * 0.6); c.fillRect(-s * 0.3, -s, s * 0.6, s * 2); break;
        case 'arrow': c.beginPath(); if (p.up) { c.moveTo(0, -s); c.lineTo(s, 0); c.lineTo(-s, 0); } else { c.moveTo(0, s); c.lineTo(s, 0); c.lineTo(-s, 0); } c.fill(); c.fillRect(-s * 0.35, p.up ? 0 : -s, s * 0.7, s); break;
        case 'plus': c.fillRect(-s, -s * 0.35, s * 2, s * 0.7); c.fillRect(-s * 0.35, -s, s * 0.7, s * 2); break;
        case 'z': c.font = 'bold 12px sans-serif'; c.fillText('z', 0, 0); break;
        default: c.rotate(p.rot); c.fillRect(-s / 2, -s / 2, s, s);
      }
      c.restore();
    }
  }
  function clear() { parts = []; jobs = []; }

  return { attack, burst, stat, ail, heal, update, draw, clear, TYPES };
})();
