/* ============ tower.js — la Tour de Combat (version de Nika) ============
 * Un mode à part, lancé depuis le menu. La partie est normale (hordes, cartes,
 * évolutions), mais à la place de la Ligue, un dresseur de la Tour te défie
 * à 1:00 puis toutes les 75 s, dans une arène (rift.js, comme la Ligue).
 * Chaque étage est plus dur que le précédent (plus de Pokémon, plus forts).
 * Une défaite à un étage termine la partie. Le meilleur étage est gardé.
 *
 * Récompenses par étage : pièces et Super Bonbons, une CT tous les 5 étages.
 * Sauvegarde : save.tower = { best, runs }.
 */
G.Tower = (() => {
  const EVERY = 75, FIRST = 60;
  const WHO = ['Topdresseur Paul', 'Montagnarde Léa', 'Scientifique Hugo', 'Karatéka Jin', 'Dresseuse Ace Clara',
    'Pokémaniac Théo', 'Kinésiste Inès', 'Ranger Malo', 'Canon Sacha', 'Ninja Kaito', 'Dompteur Rémi', 'Dame Aurélie'];
  const TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying',
    'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel'];

  let active = false, floor = 0, seed = 1, cache = null;
  const S = () => { const s = G.DB.save || {}; s.tower = s.tower || { best: 0, runs: 0 }; return s.tower; };

  function start() { active = true; floor = 0; seed = 1 + Math.floor(Math.random() * 1e6); cache = null; }
  function end() {
    if (!active) return;
    const T = S();
    T.runs++;
    T.best = Math.max(T.best, floor);
    active = false;
  }

  /** Le dresseur de l'étage suivant (même tirage tant que l'étage n'est pas passé). */
  function step() {
    const f = floor + 1;
    if (cache && cache.floor === f) return cache;
    let r = (seed * 9301 + f * 49297) % 233280;
    const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const type = TYPES[Math.floor(rnd() * TYPES.length)];
    const n = Math.min(3, 1 + Math.floor((f - 1) / 3));
    const lo = Math.min(520, 300 + f * 14), hi = lo + 160;
    const ok = p => G.SPRITE_META[p.dex] && !p.leg && p.types.includes(type);
    let pool = G.DEX.filter(p => ok(p) && p.bst >= lo && p.bst <= hi);
    if (pool.length < n) pool = G.DEX.filter(ok);
    const team = [];
    while (team.length < n && pool.length) team.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0].dex);
    cache = { kind: 'tower', floor: f, who: WHO[Math.floor(rnd() * WHO.length)], type, team, region: 'Tour' };
    return cache;
  }
  /** Force des Pokémon de l'étage (même échelle que la Ligue : 0 = Pierre). */
  const strength = () => floor * 0.9;

  function win() {
    const st = step(), f = st.floor, s = G.DB.save;
    floor = f;
    const coins = 100 + f * 60, balls = 3 + f;
    s.coins += coins;
    s.balls = (s.balls | 0) + balls;
    const ct = f % 5 === 0;
    if (ct) s.ct = (s.ct | 0) + 1;
    const T = S();
    const rec = f > T.best;
    T.best = Math.max(T.best, f);
    G.DB.commit(true);
    G.Spawner.say('Étage ' + f + ' réussi' + (rec ? ' (record !)' : '') + ' ! +' + coins + ' pièces, +' + balls + ' Super Bonbons' + (ct ? ', +1 CT' : ''), 4.2, true);
    G.Audio.sfx('legend');
    G.Game.flash('#ffe14d', 0.5);
  }

  function lost() {
    const f = step().floor;
    G.Spawner.say('Défaite à l\'étage ' + f + '. Meilleur étage : ' + Math.max(S().best, floor) + '.', 4, true);
    // La partie de la Tour s'arrête après le retour de l'arène.
    setTimeout(() => { if (active && G.Game.state !== 'ui' && G.Game.state !== 'over') G.Game.quit(); }, 2600);
  }

  return { EVERY, FIRST, start, end, step, strength, win, lost, get active() { return active; }, get floor() { return floor; }, best: () => S().best };
})();
