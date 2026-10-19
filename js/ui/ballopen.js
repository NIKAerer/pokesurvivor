/* ============ ballopen.js — ouverture de Poké Ball du gacha (version de Nika) ============
 * Remplace la machine à sous (slots.js) : même interface { play, stop }.
 * Dessiné dans un <canvas> à résolution d'art (240×200), agrandi sans lissage.
 *
 *   la Ball tombe et rebondit → elle tremble (plus de fois si c'est rare) →
 *   elle s'ouvre dans un éclair de la couleur de la rareté → le Pokémon sort.
 *   Le type de Ball annonce la rareté : Poké (1★), Super (2★), Hyper (3★),
 *   Luxe (4★), Master (5★). Shiny : étincelles bleues en plus.
 *   La ×10 enchaîne 10 Balls plus vite.
 *
 * Un clic accélère ; « Passer » (gacha-ui) appelle stop().
 */
G.BallOpen = (() => {
  const W = 240, H = 200, CX = W / 2, GROUND = 150;
  const BALLS = {
    1: { top: '#e8473f', topL: '#ff7a6b', band: '#1b1528', name: 'Poké Ball' },
    2: { top: '#3d7bff', topL: '#7fb0ff', band: '#1b1528', stripe: '#e8473f', name: 'Super Ball' },
    3: { top: '#2a2a34', topL: '#4a4a58', band: '#1b1528', stripe: '#ffd23f', name: 'Hyper Ball' },
    4: { top: '#1b1528', topL: '#3a2f50', band: '#ffd23f', stripe: '#e8473f', name: 'Luxe Ball' },
    5: { top: '#8a3fd0', topL: '#c47bff', band: '#1b1528', dots: '#ff6fb5', name: 'Master Ball' }
  };

  let cv = null, ctx = null, st = null, raf = 0, last = 0, fast = false;

  const colOf = r => (r.shiny ? '#9ae6ff' : G.Gacha.RARITY_COLOR[r.rarity]);

  function wait(s) {
    return new Promise(res => {
      const end = performance.now() + s * 1000 * (fast ? 0.3 : 1);
      (function chk() { if (performance.now() >= end || !st) res(); else setTimeout(chk, 16); })();
    });
  }

  /** Anime les tirages. → Promise résolue à la fin. */
  async function play(canvas, results) {
    cv = canvas; ctx = cv.getContext('2d');
    cv.width = W; cv.height = H;
    fast = false;
    cv.onclick = () => { fast = true; };
    const ten = results.length === 10;
    st = { t: 0, ball: null, sparks: [], rays: 0, rayCol: '#fff', mon: null, label: '', labelCol: '#fff', count: ten ? '' : null };
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    G.Sprites.preload(results.map(r => r.dex));

    try {
      for (let i = 0; i < results.length; i++) {
        const r = results[i], big = r.rarity >= 4 || r.shiny;
        if (ten) st.count = (i + 1) + '/10';
        // 1. La Ball tombe et rebondit.
        st.mon = null; st.rays = 0; st.label = ''; st.open = 0;
        st.ball = { r: r.rarity, y: -30, vy: 0, wob: 0, glow: 0, shiny: r.shiny };
        G.Audio.sfx('ball');
        await wait(ten ? 0.45 : 0.7);
        // 2. Elle tremble : 1 fois (commun) à 3 fois (épique et plus).
        const shakes = ten ? (big ? 2 : 1) : (r.rarity >= 4 ? 3 : r.rarity >= 2 ? 2 : 1) + (r.shiny ? 1 : 0);
        for (let k = 0; k < shakes; k++) {
          st.ball.wobT = 0;
          G.Audio.sfx('shake');
          if (big) st.ball.glow = (k + 1) / shakes;
          await wait(ten ? 0.32 : 0.55);
        }
        // 3. Elle s'ouvre : éclair de la couleur de la rareté, le Pokémon sort.
        st.open = 0.001;
        st.rays = 1; st.rayCol = colOf(r);
        const a = new G.Sprites.Animator(r.dex, 1, !!r.shiny);
        a.dir = 0; a.loop('Idle');
        st.mon = { a, t: 0 };
        st.label = (r.shiny ? '✦ ' : '') + G.DEX_BY[r.dex].name;
        st.labelCol = colOf(r);
        st.stars = r.rarity;
        burst(colOf(r), big ? 60 : 24);
        if (r.shiny) burst('#9ae6ff', 40);
        G.Audio.sfx('reveal', { rarity: r.rarity });
        if (r.rarity === 5) G.Audio.sfx('legend');
        if (r.shiny) G.Audio.sfx('shiny');
        await wait(ten ? (big ? 0.9 : 0.5) : 1.4);
      }
      await wait(0.3);
    } catch (e) { if (st) throw e; }
    stop();
  }

  function stop() { cancelAnimationFrame(raf); st = null; if (cv) cv.onclick = null; }

  function burst(col, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, s = 40 + Math.random() * 110;
      st.sparks.push({ x: CX, y: GROUND - 14, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, t: 0,
                       life: 0.5 + Math.random() * 0.7, col: Math.random() < 0.55 ? col : '#ffffff' });
    }
  }

  // ---------------- dessin ----------------

  function frame(now) {
    if (!st) return;
    const dt = Math.min(0.05, (now - last) / 1000) * (fast ? 2.5 : 1);
    last = now;
    st.t += dt;
    const b = st.ball;
    if (b) {
      if (!st.open) {
        b.vy += 900 * dt; b.y += b.vy * dt;
        if (b.y >= GROUND - 14) { b.y = GROUND - 14; b.vy = Math.abs(b.vy) > 60 ? -b.vy * 0.4 : 0; }
        if (b.wobT != null) { b.wobT += dt; b.wob = b.wobT < 0.4 ? Math.sin(b.wobT * 32) * 0.35 * (1 - b.wobT / 0.4) : 0; }
      } else st.open = Math.min(1, st.open + dt * 3);
    }
    if (st.rays > 0) st.rays = Math.max(0, st.rays - dt * 0.9);
    if (st.mon) { st.mon.t += dt; st.mon.a.update(dt); }
    for (const p of st.sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; }
    st.sparks = st.sparks.filter(p => p.t < p.life);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    // Sol : une estrade ronde.
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.beginPath(); ctx.ellipse(CX, GROUND + 4, 70, 14, 0, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.stroke();

    // Rayons de lumière à l'ouverture.
    if (st.rays > 0) {
      ctx.save();
      ctx.translate(CX, GROUND - 20);
      ctx.globalAlpha = Math.min(1, st.rays * 1.4);
      const L = 80;
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6 + st.t * 0.4);
        const g = ctx.createLinearGradient(0, 0, 0, -L);
        g.addColorStop(0, st.rayCol); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.lineTo(14, -L); ctx.lineTo(-14, -L); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // Éclair blanc au tout début.
      if (st.rays > 0.75) { ctx.fillStyle = `rgba(255,255,255,${(st.rays - 0.75) * 3})`; ctx.fillRect(0, 0, W, H); }
    }

    // Le Pokémon qui sort (grandit en partant d'un point).
    if (st.mon) {
      const k = Math.min(1, st.mon.t / 0.35);
      ctx.save();
      ctx.translate(CX, GROUND);
      const sc = 2 * (0.2 + 0.8 * k);
      ctx.scale(sc, sc);
      st.mon.a.draw(ctx, 0, 0, k < 1 ? { flash: true } : {});
      ctx.restore();
    }

    // La Ball (ou ses deux moitiés qui s'écartent).
    const b = st.ball;
    if (b && (!st.open || st.open < 1)) drawBall(b, st.open || 0);

    // Étincelles.
    for (const p of st.sparks) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
    }
    ctx.globalAlpha = 1;

    // Nom, étoiles et compteur.
    ctx.textAlign = 'center';
    if (st.label) {
      ctx.font = '800 16px Pixelify, "Segoe UI", sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = '#0b1020';
      ctx.strokeText(st.label, CX, 22); ctx.fillStyle = st.labelCol; ctx.fillText(st.label, CX, 22);
      ctx.font = '800 13px Pixelify, monospace';
      const s = '★'.repeat(st.stars);
      ctx.strokeText(s, CX, 38); ctx.fillStyle = '#ffd23f'; ctx.fillText(s, CX, 38);
    } else if (b) {
      ctx.font = '700 12px Pixelify, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillText(BALLS[b.r].name + '…', CX, 22);
    }
    if (st.count) {
      ctx.font = '800 11px Pixelify, monospace'; ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText(st.count, W - 8, H - 8);
    }
  }

  function drawBall(b, open) {
    const B = BALLS[b.r] || BALLS[1], R = 20;
    ctx.save();
    ctx.translate(CX, b.y);
    ctx.rotate(b.wob || 0);
    // Halo des Balls rares qui se chargent.
    if (b.glow > 0) {
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, R * 2.6);
      const c = b.shiny ? '154,230,255' : '255,214,90';
      g.addColorStop(0, `rgba(${c},${0.55 * b.glow})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 2.6, 0, 6.2832); ctx.fill();
    }
    const lift = open * 26, spread = open * 10;
    // Bas (blanc).
    ctx.save(); ctx.translate(spread * 0.3, open * 4);
    ctx.fillStyle = '#f4efe2';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9c1ad'; ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * 0.15, Math.PI * 0.85); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Haut (couleur de la Ball), qui bascule en s'ouvrant.
    ctx.save(); ctx.translate(-spread * 0.3, -lift); ctx.rotate(-open * 0.9);
    ctx.fillStyle = B.top;
    ctx.beginPath(); ctx.arc(0, 0, R, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = B.topL; ctx.beginPath(); ctx.arc(-5, -8, 4, 0, 6.2832); ctx.fill();
    if (B.stripe) { ctx.fillStyle = B.stripe; ctx.fillRect(-R + 3, -9, 6, 4); ctx.fillRect(R - 9, -9, 6, 4); }
    if (B.dots) { ctx.fillStyle = B.dots; ctx.beginPath(); ctx.arc(-8, -7, 3, 0, 6.2832); ctx.arc(8, -7, 3, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('M', 0, -5); }
    ctx.restore();
    if (!open) {
      // Bande et bouton.
      ctx.fillStyle = B.band; ctx.fillRect(-R, -2, R * 2, 4);
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.2832); ctx.fill();
      ctx.fillStyle = b.glow > 0 && Math.sin(st.t * 18) > 0 ? '#ffe9a0' : '#f4efe2';
      ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = '#1b1528'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.2832); ctx.stroke();
    }
    ctx.restore();
  }

  return { play, stop };
})();
