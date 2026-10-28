/* ============ tuto.js — tutoriel de la première partie (version de Nika) ============
 * Des bulles d'aide pendant les premières minutes, une seule fois par
 * sauvegarde (save.tuto = nombre de bulles déjà vues). Pas en coopération.
 */
G.Tuto = (() => {
  const STEPS = [
    [1, 'Bouge avec le joystick (ou les flèches) : ton Pokémon attaque tout seul !'],
    [9, 'Ramasse les cristaux d\'expérience pour monter de niveau.'],
    [24, 'À chaque niveau, choisis une carte : attaque, amélioration ou nouveau Pokémon pour ton équipe.'],
    [48, 'Ton équipe (en haut à gauche) te suit et attaque avec toi, jusqu\'à 6 Pokémon. Ils évoluent au bon niveau !'],
    [78, 'Les buissons de baies soignent. Un dresseur avec un « ! » te défie contre des récompenses.'],
    [115, 'Les boss lâchent des objets, des Super Bonbons et parfois une CT. Toutes les 5 min, un défi de Ligue t\'attend.'],
    [160, 'Après la partie : ouvre tes Poké Balls à la Boutique et monte le rang de tes Pokémon. Bonne chance !']
  ];

  function update(time, coop) {
    const s = G.DB.save;
    if (!s || coop) return;
    if (s.tuto == null && s.stats && s.stats.runs > 0) s.tuto = STEPS.length;   // anciens joueurs : déjà vu
    const i = s.tuto | 0;
    if (i >= STEPS.length || time < STEPS[i][0]) return;
    s.tuto = i + 1;
    G.Spawner.say(STEPS[i][1], 5, true);
    if (s.tuto >= STEPS.length) G.DB.commit();
  }

  return { update };
})();
