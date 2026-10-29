/* ============ league.js — la Ligue Pokémon (version de Nika) ============
 * Le but du jeu : 8 arènes, puis le Conseil 4, puis le Maître, à Kanto, puis
 * à Johto, puis à Sinnoh (version de Nika, 2026-10-28).
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
  const K = 'Kanto', J = 'Johto', N = 'Sinnoh';
  const STEPS = [
    { region: K, kind: 'gym', who: 'Pierre', place: 'Argenta', badge: 'Roche', type: 'rock', team: [95] },
    { region: K, kind: 'gym', who: 'Ondine', place: 'Azuria', badge: 'Cascade', type: 'water', team: [121] },
    { region: K, kind: 'gym', who: 'Major Bob', place: 'Carmin sur Mer', badge: 'Foudre', type: 'electric', team: [26] },
    { region: K, kind: 'gym', who: 'Erika', place: 'Céladopole', badge: 'Prisme', type: 'grass', team: [45] },
    { region: K, kind: 'gym', who: 'Koga', place: 'Parmanie', badge: 'Âme', type: 'poison', team: [110] },
    { region: K, kind: 'gym', who: 'Morgane', place: 'Safrania', badge: 'Marais', type: 'psychic', team: [65] },
    { region: K, kind: 'gym', who: 'Auguste', place: 'Cramois\'Île', badge: 'Volcan', type: 'fire', team: [59] },
    { region: K, kind: 'gym', who: 'Giovanni', place: 'Jadielle', badge: 'Terre', type: 'ground', team: [112] },
    { region: K, kind: 'elite', who: 'Olga', type: 'ice', team: [131, 80] },
    { region: K, kind: 'elite', who: 'Aldo', type: 'fighting', team: [68, 95] },
    { region: K, kind: 'elite', who: 'Agatha', type: 'ghost', team: [94, 169] },
    { region: K, kind: 'elite', who: 'Peter', type: 'dragon', team: [149, 142] },
    { region: K, kind: 'champ', who: 'Régis', type: 'normal', team: [6, 9, 3] },
    // Johto (Or / Argent, HeartGold / SoulSilver)
    { region: J, kind: 'gym', who: 'Albert', place: 'Mauville', badge: 'Zéphyr', type: 'flying', team: [18] },
    { region: J, kind: 'gym', who: 'Hector', place: 'Écorcia', badge: 'Essaim', type: 'bug', team: [123] },
    { region: J, kind: 'gym', who: 'Blanche', place: 'Doublonville', badge: 'Plaine', type: 'normal', team: [241] },
    { region: J, kind: 'gym', who: 'Mortimer', place: 'Rosalia', badge: 'Brume', type: 'ghost', team: [94] },
    { region: J, kind: 'gym', who: 'Chuck', place: 'Irisia', badge: 'Choc', type: 'fighting', team: [62] },
    { region: J, kind: 'gym', who: 'Jasmine', place: 'Oliville', badge: 'Minéral', type: 'steel', team: [208] },
    { region: J, kind: 'gym', who: 'Frédo', place: 'Acajou', badge: 'Glacier', type: 'ice', team: [221] },
    { region: J, kind: 'gym', who: 'Sandra', place: 'Ébènelle', badge: 'Lever', type: 'dragon', team: [230] },
    { region: J, kind: 'elite', who: 'Clément', type: 'psychic', team: [178, 124] },
    { region: J, kind: 'elite', who: 'Koga', type: 'poison', team: [169, 89] },
    { region: J, kind: 'elite', who: 'Aldo', type: 'fighting', team: [68, 237] },
    { region: J, kind: 'elite', who: 'Marion', type: 'dark', team: [197, 229] },
    { region: J, kind: 'champ', who: 'Peter', type: 'dragon', team: [149, 130, 142] },
    // Sinnoh (Diamant / Perle / Platine)
    { region: N, kind: 'gym', who: 'Pierrick', place: 'Charbourg', badge: 'Charbon', type: 'rock', team: [409] },
    { region: N, kind: 'gym', who: 'Flo', place: 'Vestigion', badge: 'Forêt', type: 'grass', team: [407] },
    { region: N, kind: 'gym', who: 'Mélina', place: 'Voilaroc', badge: 'Pavé', type: 'fighting', team: [448] },
    { region: N, kind: 'gym', who: 'Lovis', place: 'Verchamps', badge: 'Palustre', type: 'water', team: [419] },
    { region: N, kind: 'gym', who: 'Kiméra', place: 'Unionpolis', badge: 'Relique', type: 'ghost', team: [429] },
    { region: N, kind: 'gym', who: 'Charles', place: 'Joliberges', badge: 'Mine', type: 'steel', team: [411] },
    { region: N, kind: 'gym', who: 'Gladys', place: 'Frimapic', badge: 'Glaçon', type: 'ice', team: [460] },
    { region: N, kind: 'gym', who: 'Tanguy', place: 'Rivamar', badge: 'Phare', type: 'electric', team: [466] },
    { region: N, kind: 'elite', who: 'Aaron', type: 'bug', team: [452, 214] },
    { region: N, kind: 'elite', who: 'Terry', type: 'ground', team: [450, 464] },
    { region: N, kind: 'elite', who: 'Adrien', type: 'fire', team: [392, 467] },
    { region: N, kind: 'elite', who: 'Lucio', type: 'psychic', team: [475, 65] },
    { region: N, kind: 'champ', who: 'Cynthia', type: 'dragon', team: [445, 448, 350] }
  ];
  /** Les défis d'une région, dans l'ordre. */
  const region = r => STEPS.filter(x => x.region === r);
  const REGIONS = [K, J, N];


  const EVERY = 300;
  let nextAt = EVERY;
  // Version de Nika : en Tour de Combat (tower.js), les défis viennent de la Tour.
  const T = () => !!(G.Tower && G.Tower.active);
  const every = () => (T() ? G.Tower.EVERY : EVERY);
  /** Le défi n° i (-1 = l'étage de la Tour en cours). */
  const stepAt = i => (i === -1 ? G.Tower.step() : STEPS[i]);

  const S = () => {
    const s = G.DB.save;
    if (!s) return { step: 0, done: false };
    s.league = s.league || { step: 0, done: false };
    // Les sauvegardes qui avaient fini Kanto continuent à Johto.
    if (s.league.done && s.league.step < STEPS.length) s.league.done = false;
    return s.league;
  };
  const step = () => S().step;
  const done = () => !!S().done;
  const current = () => (T() ? G.Tower.step() : done() ? null : STEPS[step()]);

  /** Prochain palier de 5 minutes après t (au moins 60 s plus tard). */
  const after = t => Math.max(Math.ceil((t + 1) / every()) * every(), t + 60);
  /** Plus de défi juste avant la Sentencia d'Arceus (minute 30). */
  const tooLate = t => t >= G.Judgment.AT - 60;
  /** Difficulté des parties : +12 % de PV et +6 % de dégâts par défi gagné à Kanto,
   *  puis moitié moins à Johto et Sinnoh (power.js suit déjà la force de l'équipe). */
  const lvl = () => { const k = Math.min(step(), STEPS.length); return Math.min(k, 13) + Math.max(0, k - 13) * 0.5; };
  function diff() { return 1 + lvl() * 0.12; }
  function dmgK() { return 1 + lvl() * 0.06; }

  function title(st) {
    if (!st) return 'Mode libre';
    if (st.kind === 'tower') return 'Tour de Combat · Étage ' + st.floor + ' · ' + st.who;
    return st.kind === 'gym' ? 'Arène de ' + st.place + ' · ' + st.who
      : st.kind === 'elite' ? 'Conseil 4 de ' + st.region + ' · ' + st.who
      : 'Maître de la Ligue de ' + st.region + ' · ' + st.who;
  }

  function reset() { nextAt = T() ? G.Tower.FIRST : EVERY; }
  /** Combat dans l'arène du champion en cours. */
  function fighting() { const a = G.Rift.arena; return !!(a && a.gym != null && a.phase === 'fight'); }

  /** Pour le HUD : secondes avant le défi (null s'il n'y en a plus dans cette partie). */
  function timeLeft(t) {
    if (!current() || tooLate(nextAt)) return null;
    return Math.max(0, nextAt - t);
  }

  function bossDef(dex, i0, k) {
    const p = G.DEX_BY[dex];
    const i = i0 === -1 ? G.Tower.strength() : i0 < 13 ? i0 : 13 + (i0 - 13) * 0.5;     // Johto et Sinnoh montent moins vite
    const n = stepAt(i0).team.length;
    // Les équipes à plusieurs Pokémon : chacun un peu moins solide.
    const hp = Math.round((5200 + i * 2600) * (n > 1 ? 0.75 : 1) * (k === 0 ? 1 : 0.8));
    return {
      at: 0, dex, name: p.name, hp, spd: Math.round(G.U.clamp(50 + p.spd * 0.25, 50, 95)),
      dmg: Math.round(48 + i * 5), xp: Math.round(1500 + i * 150),
      behavior: k % 2 ? 'ranged' : 'charger',
      shotDmg: Math.round((48 + i * 5) * 0.55), shotCd: 1.0, range: 270
    };
  }

  /** Appelé par le spawner à chaque image (le spawner ne tourne pas dans une arène). */
  function update(t) {
    if (T()) return;                                 // la Tour a ses propres salles (tower.js)
    const st = current();
    if (!st || t < nextAt || tooLate(t) || G.Rift.inArena || G.Judgment.active) return;
    if (G.Coop.active && !G.Coop.isHost) return;
    nextAt = after(t);                               // au cas où l'arène ne s'ouvrirait pas
    G.Rift.gym(T() ? -1 : step());
  }

  /** L'équipe du champion qui arrive dans l'arène (rift.js). */
  function spawnTeam(x, y) {
    const i = T() ? -1 : step(), st = stepAt(i), ids = [];
    if (!st) return ids;
    st.team.forEach((dex, k) => {
      if (!G.DEX_BY[dex] || !G.SPRITE_META[dex]) return;
      const off = (k - (st.team.length - 1) / 2) * 70;
      const e = G.Spawner.bossAt(x + off, y, G.Game.st.time, bossDef(dex, i, k));
      if (e) { e.champion = true; ids.push(e.id); }
    });
    const verb = st.kind === 'tower' ? 'Étage ' + st.floor + ' : ' : st.kind === 'gym' ? 'Le champion ' : st.kind === 'elite' ? 'Le Conseil 4 : ' : 'Le Maître ';
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
    if (T()) { G.Tower.lost(); return; }
    if (st) G.Spawner.say(st.who + ' t\'a battu… Nouvel essai ' + (tooLate(nextAt) ? 'à la prochaine partie' : 'dans 5 min') + '.', 3.4, true);
  }

  function win() {
    nextAt = after(G.Game.st.time);
    if (T()) { G.Tower.win(); return; }
    const L = S(), i = L.step, st = STEPS[i];
    const pl = G.Game.player;
    // Version de Nika (moins de tickets) : 1 par champion ou membre du Conseil, 3 pour le Maître.
    const coins = 300 + i * 120, tickets = st.kind === 'gym' || st.kind === 'elite' ? 1 : 3;
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
      : st.kind === 'elite' ? st.who + ' est battu' + (['Olga', 'Agatha', 'Marion'].includes(st.who) ? 'e' : '') + ' !'
      : 'Tu es le Maître de la Ligue de ' + st.region + ' !' + (STEPS[i + 1] ? ' Direction ' + STEPS[i + 1].region + ' !' : '');
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
      <p>Tu as battu les 24 champions d'arène, les Conseils 4 et les Maîtres de Kanto, Johto et Sinnoh.</p>
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

  return { STEPS, REGIONS, region, fighting, step, stepAt, done, current, title, diff, dmgK, reset, update, onKill, lost, spawnTeam, timeLeft, EVERY, showCredits, win,
    /** Pour les tests : le prochain défi tout de suite. */
    debugNow() { nextAt = G.Game.st.time; } };
})();
