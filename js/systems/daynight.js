/* ============ daynight.js — jour et nuit réels (version de Nika) ============
 * Selon l'heure de l'appareil : la nuit (20 h - 6 h), la carte est plus sombre,
 * des Pokémon nocturnes se mêlent aux ennemis, Évoli devient Noctali (pas
 * Mentali) et Riolu n'évolue pas en Lucario (il attend le jour). Le jour, c'est
 * l'inverse pour Évoli.
 */
G.DayNight = (() => {
  const NIGHT_MONS = [41, 92, 163, 198, 200, 228, 215, 353, 355, 425, 434, 302];
  const DAY_ONLY = [196, 448], NIGHT_ONLY = [197];

  let pick = null, cache = { at: -1, defs: [] }, told = false;
  function isNight() { const h = new Date().getHours(); return h >= 20 || h < 6; }

  /** Les nocturnes de cette partie (3, tirés au début), ou rien le jour. */
  function bag(t) {
    if (!isNight()) return [];
    if (!pick) { pick = G.U.pickN(NIGHT_MONS.filter(d => G.DEX_BY[d] && G.SPRITE_META[d]), 3); G.Sprites.preload(pick); }
    // Recalculés toutes les 30 s pour suivre le palier en cours (comme les autres ennemis).
    const at = Math.floor(t / 30);
    if (cache.at !== at) cache = { at, defs: G.Enemies.swarmDefs(pick, t, 'chase').map(d => Object.assign(d, { hp: Math.round(d.hp / 0.55) })) };
    return cache.defs;
  }

  /** Évolution permise à cette heure ? */
  function evoOk(to) { return isNight() ? !DAY_ONLY.includes(to) : !NIGHT_ONLY.includes(to); }

  function update(time) {
    if (time < 1) { told = false; pick = null; cache = { at: -1, defs: [] }; return; }
    if (!told && time >= 3) {
      told = true;
      if (isNight()) G.Spawner.say('Il fait nuit : les Pokémon nocturnes sortent !', 3.4, true);
    }
  }

  function draw(ctx, w, h) {
    if (!isNight()) return;
    ctx.fillStyle = 'rgba(20, 30, 80, 0.22)';
    ctx.fillRect(0, 0, w, h);
  }

  return { isNight, bag, evoOk, update, draw };
})();
