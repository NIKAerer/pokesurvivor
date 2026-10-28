/* ============ league.js — la Ligue Pokémon (version de Nika) ============
 * Le but du jeu : 8 arènes, puis le Conseil 4, puis le Maître.
 * Toutes les 5 minutes (5:00, 10:00...), tu es téléporté dans l'arène du
 * champion suivant (rift.js, arène du type du champion) contre son équipe.
 * Si tu bats toute son équipe, tu gagnes le badge et une récompense, puis tu
 * reviens sur la carte ; le défi suivant arrive 5 minutes plus tard. Si tu
 * perds (ou si le temps est écoulé), tu reviens sans badge et tu retentes au
 * prochain palier de 5 minutes.
 * Chaque défi gagné rend les parties suivantes plus difficiles (diff()).
 * Après le Maître : générique de fin, puis mode libre (plus de défi).
 *
 * Sauvegarde : save.league = { step, done }
 */
G.League = (() => {
  const STEPS = [
    { kind: 'gym', who: 'Pierre', place: 'Argenta', badge: 'Roche', type: 'rock', team: [95] },
    { kind: 'gym', who: 'Ondine', place: 'Azuria', badge: 'Cascade', type: 'water', team: [121] },
    { kind: 'gym', who: 'Major Bob', place: 'Carmin sur Mer', badge: 'Foudre', type: 'electric', team: [26] },
    { kind: 'gym', who: 'Erika', place: 'Céladopole', badge: 'Prisme', type: 'grass', team: [45] },
    { kind: 'gym', who: 'Koga', place: 'Parmanie', badge: 'Âme', type: 'poison', team: [110] },
    { kind: 'gym', who: 'Morgane', place: 'Safrania', badge: 'Marais', type: 'psychic', team: [65] },
    { kind: 'gym', who: 'Auguste', place: 'Cramois\'Île', badge: 'Volcan', type: 'fire', team: [59] },
    { kind: 'gym', who: 'Giovanni', place: 'Jadielle', badge: 'Terre', type: 'ground', team: [112] },
    { kind: 'elite', who: 'Olga', type: 'ice', team: [131, 80] },
    { kind: 'elite', who: 'Aldo', type: 'fighting', team: [68, 95] },
    { kind: 'elite', who: 'Agatha', type: 'ghost', team: [94, 169] },
    { kind: 'elite', who: 'Peter', type: 'dragon', team: [149, 142] },
    { kind: 'champ', who: 'Blue', type: 'normal', team: [6, 9, 3] }
  ];

  const EVERY = 300;
  let nextAt = EVERY;

  const S = () => {
    const s = G.DB.save;
    if (!s) return { step: 0, done: false };
    s.league = s.league || { step: 0, done: false };
    return s.league;
  };
  const step = () => S().step;
  const done = () => !!S().done;
  const current = () => (done() ? null : STEPS[step()]);

  /** Prochain palier de 5 minutes après t (au moins 60 s plus tard). */
  const after = t => Math.max(Math.ceil((t + 1) / EVERY) * EVERY, t + 60);
  /** Plus de défi juste avant la Sentencia d'Arceus (minute 30). */
  const tooLate = t => t >= G.Judgment.AT - 60;
  /** Difficulté des parties : +12 % de PV et +6 % de dégâts par défi gagné. */
  function diff() { return 1 + Math.min(step(), STEPS.length) * 0.12; }
  function dmgK() { return 1 + Math.min(step(), STEPS.length) * 0.06; }

  function title(st) {
    if (!st) return 'Mode libre';
    return st.kind === 'gym' ? 'Arène de ' + st.place + ' · ' + st.who
      : st.kind === 'elite' ? 'Conseil 4 · ' + st.who
      : 'Maître de la Ligue · ' + st.who;
  }

  function reset() { nextAt = EVERY; }
  /** Combat dans l'arène du champion en cours. */
  function fighting() { const a = G.Rift.arena; return !!(a && a.gym != null && a.phase === 'fight'); }

  /** Pour le HUD : secondes avant le défi (null s'il n'y en a plus dans cette partie). */
  function timeLeft(t) {
    if (!current() || tooLate(nextAt)) return null;
    return Math.max(0, nextAt - t);
  }

  function bossDef(dex, i, k) {
    const p = G.DEX_BY[dex];
    const n = STEPS[i].team.length;
    // Les équipes à plusieurs Pokémon : chacun un peu moins solide.
    const hp = Math.round((5200 + i * 2600) * (n > 1 ? 0.75 : 1) * (k === 0 ? 1 : 0.8));
    return {
      at: 0, dex, name: p.name, hp, spd: Math.round(G.U.clamp(50 + p.spd * 0.25, 50, 95)),
      dmg: Math.round(48 + i * 5), xp: 1500 + i * 150,
      behavior: k % 2 ? 'ranged' : 'charger',
      shotDmg: Math.round((48 + i * 5) * 0.55), shotCd: 1.0, range: 270
    };
  }

  /** Appelé par le spawner à chaque image (le spawner ne tourne pas dans une arène). */
  function update(t) {
    const st = current();
    if (!st || t < nextAt || tooLate(t) || G.Rift.inArena || G.Judgment.active) return;
    if (G.Coop.active && !G.Coop.isHost) return;
    nextAt = after(t);                               // au cas où l'arène ne s'ouvrirait pas
    G.Rift.gym(step());
  }

  /** L'équipe du champion qui arrive dans l'arène (rift.js). */
  function spawnTeam(x, y) {
    const i = step(), st = STEPS[i], ids = [];
    if (!st) return ids;
    st.team.forEach((dex, k) => {
      if (!G.DEX_BY[dex] || !G.SPRITE_META[dex]) return;
      const off = (k - (st.team.length - 1) / 2) * 70;
      const e = G.Spawner.bossAt(x + off, y, G.Game.st.time, bossDef(dex, i, k));
      if (e) { e.champion = true; ids.push(e.id); }
    });
    const verb = st.kind === 'gym' ? 'Le champion ' : st.kind === 'elite' ? 'Le Conseil 4 : ' : 'Le Maître ';
    G.Spawner.say(verb + st.who + ' te défie ! (' + st.team.map(d => G.DEX_BY[d].name).join(', ') + ')', 4.2, true);
    G.Audio.sfx('boss');
    G.Camera.kick(1.2);
    return ids;
  }

  /** Un champion est tombé (progress.js) : combien il en reste. */
  function onKill(e) {
    const a = G.Rift.arena;
    if (!e.champion || !a || a.gym == null) return;
    const left = (a.ids || []).filter(id => { const x = G.EnemyMgr.get(id); return x && x !== e && !x.dead; }).length;
    if (left > 0) G.Spawner.say('Plus que ' + left + ' Pokémon !', 2.4, true);
  }

  /** Défi perdu (tous K.O. ou temps écoulé) : on retente au prochain palier. */
  function lost() {
    const st = current();
    nextAt = after(G.Game.st.time);
    if (st) G.Spawner.say(st.who + ' t\'a battu… Nouvel essai ' + (tooLate(nextAt) ? 'à la prochaine partie' : 'dans 5 min') + '.', 3.4, true);
  }

  function win() {
    nextAt = after(G.Game.st.time);
    const L = S(), i = L.step, st = STEPS[i];
    const pl = G.Game.player;
    const coins = 300 + i * 120, tickets = 5 + i;
    G.DB.save.coins += coins;
    G.DB.save.tickets = G.DB.save.tickets || { t1: 0, t10: 0 };
    G.DB.save.tickets.t1 += tickets;
    const balls = 10 + i * 2;                      // version de Nika : Super Bonbons pour le rang
    G.DB.save.balls = (G.DB.save.balls || 0) + balls;
    L.step = i + 1;
    if (L.step >= STEPS.length) L.done = true;
    G.DB.commit(true);
    G.Progress.event('league', { step: L.step });
    const msg = st.kind === 'gym' ? 'Badge ' + st.badge + ' obtenu !'
      : st.kind === 'elite' ? st.who + ' est battu' + (st.who === 'Olga' || st.who === 'Agatha' ? 'e' : '') + ' !'
      : 'Tu es le Maître de la Ligue !';
    G.Spawner.say(msg + ' +' + coins + ' pièces, +' + tickets + ' Poké Balls, +' + balls + ' Super Bonbons', 4.5, true);
    G.Audio.sfx('legend');
    if (pl) {
      G.FX.ring(pl.x, pl.y, 10, 180, G.U.TYPE_COLOR[st.type] || '#ffd23f', 1, 7);
      G.FX.burst(pl.x, pl.y - 20, '#ffe14d', 60, 300);
    }
    G.Game.flash('#ffe14d', 0.6);
    if (L.done) setTimeout(showCredits, 2500);
  }

  // ---------------- générique de fin ----------------

  function showCredits() {
    const st = G.Game.state;
    if (['levelup', 'choice', 'evolving', 'paused'].includes(st)) { setTimeout(showCredits, 1000); return; }
    const paused = G.Game.beginChoice();           // false en fin de partie ou au menu : on l'affiche quand même
    const box = document.getElementById('credits-roll');
    const team = G.Team.members().map(m => m.dex);
    box.innerHTML = `
      <h1>Félicitations !</h1>
      <p>Tu as battu les 8 champions d'arène, le Conseil 4 et le Maître Blue.</p>
      <p class="cr-big">Tu es le nouveau Maître de la Ligue Pokémon !</p>
      <div class="cr-team" id="cr-team"></div>
      <div class="cr-badges">${STEPS.filter(s => s.kind === 'gym').map(s => `<span class="cr-badge" style="--c:${G.U.TYPE_COLOR[s.type]}" title="${s.badge}"></span>`).join('')}</div>
      <h3>PokéSurvivor · version de Nika</h3>
      <p>Imaginé et testé par Nika</p>
      <p>D'après PokéSurvivor de JPTER78</p>
      <p>Sprites : PMD SpriteCollab (CC BY-NC 4.0)</p>
      <p>Pokémon © Nintendo / Creatures / GAME FREAK</p>
      <p class="cr-big">Merci d'avoir joué !</p>
      <p>Tu peux continuer à jouer en mode libre, compléter ton Pokédex et chasser les shinies.</p>`;
    const tb = document.getElementById('cr-team');
    for (const d of team) tb.appendChild(G.UI.spriteCanvas(d, 72, 64, { scale: 2, hero: true, lively: true }));
    document.getElementById('credits-close').onclick = () => { G.UI.hide('scr-credits'); if (paused) G.Game.endChoice(); };
    G.UI.show('scr-credits');
    G.Audio.sfx('legend');
  }

  return { STEPS, fighting, step, done, current, title, diff, dmgK, reset, update, onKill, lost, spawnTeam, timeLeft, EVERY, showCredits, win,
    /** Pour les tests : le prochain défi tout de suite. */
    debugNow() { nextAt = G.Game.st.time; } };
})();
