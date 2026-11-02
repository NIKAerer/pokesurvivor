/*
 * defi.js — le Défi du jour (version de Nika, 2026-11-02).
 * Chaque jour, une partie Survivor imposée : le même Pokémon et le même objectif pour toute la journée
 * (même s'il n'est pas dans ta boîte). Réussi une fois par jour : pièces + Poké Balls.
 *   save.defi = { day: 'AAAA-MM-JJ', done: 1 }
 */
G.Defi = (() => {
  const GOALS = [
    { k: 'time', v: 300, txt: 'Survis 5 minutes' },
    { k: 'time', v: 420, txt: 'Survis 7 minutes' },
    { k: 'time', v: 600, txt: 'Survis 10 minutes' },
    { k: 'level', v: 15, txt: 'Atteins le niveau 15' },
    { k: 'level', v: 22, txt: 'Atteins le niveau 22' },
    { k: 'boss', v: 2, txt: 'Bats 2 boss' }
  ];
  let active = null;          // le défi de la partie en cours

  const day = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; }

  /** Le défi d'aujourd'hui : Pokémon (formes de base, pas de légendaires), objectif et récompense. */
  function today() {
    const d = day(), h = hash('defi' + d);
    const pool = G.DEX.filter(p => G.SPRITE_META[p.dex] && !G.EVO_FROM[p.dex] && p.rarity <= 4).sort((a, b) => a.dex - b.dex);
    const mon = pool[h % pool.length];
    const goal = GOALS[(h >>> 8) % GOALS.length];
    const hard = goal.k === 'boss' || (goal.k === 'time' ? goal.v >= 600 : goal.v >= 22);
    return { day: d, dex: mon.dex, goal, coins: hard ? 600 : 400, t1: hard ? 3 : 2 };
  }
  function done() { const s = G.DB.save; return !!(s && s.defi && s.defi.day === day() && s.defi.done); }

  /** Lance la partie du défi (le Pokémon imposé, sans toucher à ton partenaire). */
  function start() {
    active = Object.assign(today(), { ok: false });
    G.Game.startRun(null, { dex: active.dex });
    const txt = active.goal.txt.toLowerCase();
    setTimeout(() => G.UI.toast('Défi du jour : ' + txt + ' !', 3000), 600);
  }
  /** Appelé pendant la partie : l'objectif est-il atteint ? */
  function check(pl, time) {
    if (!active || active.ok || !pl) return;
    const g = active.goal;
    const met = g.k === 'time' ? time >= g.v : g.k === 'level' ? pl.level >= g.v : (pl.bosses || 0) >= g.v;
    if (!met) return;
    active.ok = true;
    G.Audio.sfx('legend');
    if (done()) { G.UI.toast('Défi du jour réussi ! (récompense déjà reçue aujourd\'hui)', 3000); return; }
    const s = G.DB.save;
    s.defi = { day: active.day, done: 1 };
    s.coins = (s.coins | 0) + active.coins;
    s.tickets = s.tickets || { t1: 0, t10: 0 };
    s.tickets.t1 += active.t1;
    G.DB.commit(true);
    G.UI.toast('Défi du jour réussi ! +' + active.coins + ' pièces, +' + active.t1 + ' Poké Balls', 3500);
  }
  /** Fin de partie : le défi s'arrête. Renvoie une ligne pour le résumé, ou ''. */
  function end() {
    if (!active) return '';
    const line = active.ok ? 'Défi du jour réussi !' : 'Défi du jour raté';
    active = null;
    return line;
  }

  return { today, done, start, check, end, get active() { return active; } };
})();
