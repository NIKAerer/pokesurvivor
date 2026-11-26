/* ============ auto.js — mode AFK du Survivor (version de Nika, 2026-11-26) ============
 *
 * Une amélioration à acheter (Améliorations → « Mode AFK », 4 444 pièces).
 * Une fois achetée, un bouton AFK apparaît en partie Survivor (solo) :
 *
 *   - déplacement automatique : fuit les ennemis, les tirs et les zones
 *     d'attaque annoncées, va ramasser l'XP, les pièces et les objets,
 *     contourne les murs et les liquides qui font mal ;
 *   - choix automatiques : cartes de niveau (évolution > recrue > nouvelle
 *     attaque > amélioration), objet (garde l'actuel), écrans de la Ligue ;
 *   - à la mort : pas de réanimation payante, et une nouvelle partie se
 *     relance toute seule après le résumé (on peut l'arrêter).
 *
 * Toucher le joystick ou les touches reprend la main tant qu'on les tient.
 * Pas dans la Tour de Combat ni en coopération.
 */
G.Auto = (() => {
  let on = false;
  let wait = 0;                 // délai avant un choix automatique (on voit les cartes)
  let dir = [0, 0];             // direction lissée
  let wander = Math.random() * 6.28;
  let stuck = 0, lastX = 0, lastY = 0, escape = 0, escapeA = 0;
  let overT = -1;               // compte à rebours de relance après le résumé
  let relaunch = false;

  const save = () => G.DB.save;
  function unlocked() { return !!(save() && (G.DB.upgradesOf().afk | 0) >= 1); }
  /** Le mode AFK est-il possible dans cette partie ? */
  function allowed() {
    const g = G.Game;
    return unlocked() && !!g.player && !G.Coop.active && !G.Tower.active && g.state !== 'ui' && g.state !== 'over';
  }

  function set(v) {
    const was = on;
    on = !!v && allowed();
    const s = save();
    if (s) { s.afkOn = on; G.DB.commit(); }
    if (on !== was) {
      G.Audio.sfx(on ? 'confirm' : 'back');
      G.UI.toast(on ? 'Mode AFK activé : ton Pokémon joue tout seul' : 'Mode AFK arrêté', 2200);
    }
    wait = 0.8;
  }
  function toggle() { set(!on); }

  /** Début de partie : se rallume si le joueur l'avait laissé allumé. */
  function startRun() {
    on = !!(save() && save().afkOn) && allowed();
    dir = [0, 0]; wander = Math.random() * 6.28; stuck = 0; escape = 0; wait = 1;
    overT = -1;
    relaunch = false;
    const pl = G.Game.player;
    if (pl) { lastX = pl.x; lastY = pl.y; }
  }

  // ---------------- déplacement ----------------

  function hurtsAt(pl, x, y, flies) {
    if (flies) return false;
    if (!G.World.isFree(x, y, Math.max(8, (pl.r || 12) * 0.8), true)) return true;
    if (G.World.isLiquid(x, y)) { const le = G.World.liquidEffect(pl.mon.types); if (le.dmg) return true; }
    return false;
  }

  /** Vecteur de déplacement [x, y] (longueur 0..1) pour le Pokémon du joueur. */
  function axis(pl, dt) {
    let fx = 0, fy = 0, danger = 0;
    const x = pl.x, y = pl.y;
    const low = pl.hp < pl.maxHp * 0.45;

    // 1) Ennemis : on s'écarte, d'autant plus qu'ils sont près (et les boss plus loin).
    for (const e of G.EnemyMgr.all()) {
      if (e.dead || e.friendly) continue;
      const R = e.boss ? 330 : 200;
      const dx = x - e.x, dy = y - e.y, d2 = dx * dx + dy * dy;
      if (d2 > R * R) continue;
      const d = Math.sqrt(d2) || 1;
      const k = (e.boss ? 3 : 1) * (low ? 1.6 : 1) * Math.pow(1 - d / R, 2) * 3;
      fx += dx / d * k; fy += dy / d * k;
      danger += k;
    }
    // 2) Tirs ennemis : on s'écarte de leur trajectoire.
    for (const p of G.Projectiles.all()) {
      if (p.friendly || p.orb) continue;
      const dx = x - p.x, dy = y - p.y, d2 = dx * dx + dy * dy;
      if (d2 > 170 * 170) continue;
      const d = Math.sqrt(d2) || 1;
      // Vient-il vers nous ?
      if ((p.vx * dx + p.vy * dy) <= 0) continue;
      const sp = Math.hypot(p.vx, p.vy) || 1;
      // côté de la trajectoire où l'on se trouve → on va de ce côté
      const side = Math.sign(p.vx * dy - p.vy * dx) || 1;
      const k = 2.2 * (1 - d / 170);
      fx += (-p.vy / sp) * side * k; fy += (p.vx / sp) * side * k;
      danger += k;
    }
    // 3) Zones annoncées (cercles, rayons) : on en sort.
    for (const hz of G.Hazards.all) {
      if (hz.hit) continue;
      if (!G.Hazards.inside(hz, x, y, (pl.r || 12) + 26)) continue;
      let ax, ay;
      if (hz.kind === 'zone') { ax = x - hz.x; ay = y - hz.y; }
      else {
        const ca = Math.cos(hz.angle), sa = Math.sin(hz.angle);
        const side = Math.sign(-(x - hz.x) * sa + (y - hz.y) * ca) || 1;
        ax = -sa * side; ay = ca * side;
      }
      const d = Math.hypot(ax, ay) || 1;
      fx += ax / d * 6; fy += ay / d * 6;
      danger += 6;
    }

    // 4) Objets au sol : le plus intéressant pas trop loin (XP, pièces, soin si besoin…).
    let best = null, bestS = 0;
    for (const p of G.Pickups.all()) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d > 700) continue;
      const v = p.kind === 'heal' ? (pl.hp < pl.maxHp * 0.8 ? 6 : 0.3)
        : p.kind === 'ticket' || p.kind === 'ticket10' || p.kind === 'ball' || p.kind === 'item' ? 8
        : p.kind === 'magnet' ? 5 : p.kind === 'bomb' ? (danger > 2 ? 5 : 1)
        : p.kind === 'xpBig' ? 3 : p.kind === 'coin' ? 2.5 : 1.5;
      if (!v) continue;
      // pas un objet au milieu d'une horde
      let crowd = 0;
      for (const e of G.EnemyMgr.queryCircle ? G.EnemyMgr.queryCircle(p.x, p.y, 70) : []) if (!e.dead) crowd++;
      const s = v / (40 + d) / (1 + crowd * 0.6);
      if (s > bestS) { bestS = s; best = p; }
    }
    const calm = 1 / (1 + danger * 0.8);
    if (best) {
      const dx = best.x - x, dy = best.y - y, d = Math.hypot(dx, dy) || 1;
      const k = 1.6 * (0.35 + calm);
      fx += dx / d * k; fy += dy / d * k;
    } else {
      // Rien à ramasser : balade lente pour trouver de quoi faire (et de l'XP).
      wander += (Math.random() - 0.5) * dt * 1.2;
      fx += Math.cos(wander) * 0.7 * calm; fy += Math.sin(wander) * 0.7 * calm;
    }

    // 5) Coincé contre quelque chose ? on part dans une autre direction un moment.
    if (escape > 0) {
      escape -= dt;
      fx = fx * 0.3 + Math.cos(escapeA) * 2; fy = fy * 0.3 + Math.sin(escapeA) * 2;
    }

    let len = Math.hypot(fx, fy);
    if (len < 0.05) { dir = [0, 0]; return dir; }
    let a = Math.atan2(fy, fx);

    // 6) Murs, obstacles et liquides qui font mal : on cherche l'angle libre le plus proche.
    const flies = pl.mon.types.includes('flying') || G.Sprites.hovers(pl.dex);
    const look = 38;
    if (hurtsAt(pl, x + Math.cos(a) * look, y + Math.sin(a) * look, flies)) {
      for (const da of [0.5, -0.5, 1, -1, 1.5, -1.5, 2.1, -2.1, 2.7, -2.7]) {
        const b = a + da;
        if (!hurtsAt(pl, x + Math.cos(b) * look, y + Math.sin(b) * look, flies)) { a = b; break; }
      }
    }

    // Lissage : pas de tremblote d'une image à l'autre.
    const k = Math.min(1, dt * 10);
    const tx = Math.cos(a), ty = Math.sin(a);
    dir = [dir[0] + (tx - dir[0]) * k, dir[1] + (ty - dir[1]) * k];
    len = Math.hypot(dir[0], dir[1]) || 1;
    if (len > 1) dir = [dir[0] / len, dir[1] / len];

    // Détection « bloqué » : on veut bouger mais on n'avance pas.
    const moved = Math.hypot(x - lastX, y - lastY);
    lastX = x; lastY = y;
    stuck = moved < 20 * dt ? stuck + dt : Math.max(0, stuck - dt);
    if (stuck > 0.8 && escape <= 0) { stuck = 0; escape = 1.1; escapeA = a + Math.PI * (0.6 + Math.random() * 0.8); wander = escapeA; }
    return dir;
  }

  /** Utilisé par player.js : la main du joueur passe avant l'AFK. */
  function moveFor(pl, dt) {
    const manual = G.Input.axis();
    if (!on || pl !== G.Game.player || manual[0] || manual[1]) return manual;
    return axis(pl, dt);
  }

  // ---------------- choix automatiques ----------------

  const isOpen = id => G.UI.isOpen(id);
  function click(id) { const el = document.getElementById(id); if (el && !el.disabled) el.click(); }

  /** Appelé à chaque image (game.js). real = temps réel écoulé. */
  function tick(real) {
    const g = G.Game, st = g.state;
    // Résumé de fin de partie : relance auto si l'AFK tournait.
    if (st === 'over') {
      if (relaunch && overT >= 0 && isOpen('scr-over')) {
        const before = Math.ceil(overT);
        overT -= real;
        const n = Math.max(0, Math.ceil(overT));
        if (n !== before) showCountdown(n);
        if (overT <= 0) { overT = -1; relaunchRun(); }
      }
      return;
    }
    if (!on) return;
    if (!allowed()) { on = false; return; }
    if (wait > 0) { wait -= real; return; }
    if (st === 'levelup' && isOpen('scr-levelup')) {
      if (G.RunUI.autoPick()) wait = 0.6;
      return;
    }
    if (isOpen('scr-item')) {
      const c = document.querySelector('#item-cards .card');     // garde l'objet actuel
      if (c) c.click();
      wait = 0.6;
      return;
    }
    if (isOpen('scr-credits')) { click('credits-close'); wait = 0.6; return; }
    if (st === 'revive' && isOpen('scr-revive')) {
      // Pas de réanimation payante en AFK : on garde les pièces.
      relaunch = true;
      click('btn-revive-no');
      wait = 0.6;
    }
  }

  /** game.js, fin de partie : on note s'il faut relancer. */
  function runEnded() {
    if (!on && !relaunch) return;
    relaunch = !G.Defi.active && unlocked() && !!(save() && save().afkOn);
    if (!relaunch) return;
    overT = 8;
    // Le résumé s'affiche juste après : on ajoute le compte à rebours.
    setTimeout(() => showCountdown(8), 0);
  }

  function showCountdown(n) {
    let el = document.getElementById('over-afk');
    const box = document.querySelector('#scr-over .box');
    if (!box) return;
    if (!el) {
      el = document.createElement('div');
      el.id = 'over-afk';
      el.className = 'over-afk';
      el.innerHTML = '<span></span><button class="btn small" type="button">Arrêter l\'AFK</button>';
      el.querySelector('button').onclick = () => {
        relaunch = false; overT = -1;
        if (save()) { save().afkOn = false; G.DB.commit(); }
        el.remove();
        G.Audio.sfx('back');
      };
      box.insertBefore(el, document.getElementById('btn-again'));
    }
    el.querySelector('span').textContent = 'Mode AFK : nouvelle partie dans ' + n + ' s';
  }

  function relaunchRun() {
    const el = document.getElementById('over-afk');
    if (el) el.remove();
    relaunch = false;
    click('btn-again');
    // Retour au menu, puis on relance une partie Survivor comme le bouton Jouer.
    setTimeout(() => {
      const s = save();
      if (!s || G.Game.state !== 'ui' || !s.afkOn) return;
      if (s.pickMode && s.pickMode !== 'run') return;
      // Cadeau du jour ouvert par le menu (nouveau jour pendant l'AFK) : on le récupère.
      const gift = document.getElementById('dc-take');
      if (gift) gift.click();
      G.UI.hideAll();
      G.PickUI.play();
    }, 400);
  }

  // ---------------- bouton du HUD ----------------

  /** Dessine le bouton AFK (coordonnées du HUD) ; K = échelle du HUD sur PC. */
  function drawButton(ctx, x, y, K, F, roundRect) {
    if (!unlocked() || G.Coop.active || G.Tower.active) return;
    const bw = 74, bh = 28;
    const t = performance.now() / 1000;
    roundRect(ctx, x, y, bw, bh, 9);
    ctx.fillStyle = on ? `rgba(40,150,90,${0.75 + Math.sin(t * 3) * 0.12})` : 'rgba(10,16,28,.7)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = on ? '#7dffb0' : 'rgba(244,248,255,.6)';
    ctx.stroke();
    ctx.font = F(800, 12);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4f8ff';
    ctx.fillText(on ? 'AFK : ON' : 'AFK', x + bw / 2, y + 18);
    G.Touch.addButton(x * K, y * K, bw * K, bh * K, toggle, 6);
  }

  return {
    unlocked, allowed, set, toggle, startRun, moveFor, tick, runEnded, drawButton,
    get on() { return on; }
  };
})();
