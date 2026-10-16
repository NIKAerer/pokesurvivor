/* ============ levelup.js — las tres cartas de subida de nivel ============
 * Tipos de carta:
 *   new   aprender un movimiento nuevo (sólo si quedan huecos de los 4; un vínculo libera huecos)
 *   up    mejorar un movimiento que ya tienes
 *   stat  mejora permanente de la run
 */
G.LevelUp = (() => {

  const STATS = [
    { id: 'hp',   icon: 'heart', title: 'Vigor',        desc: '+20 de vida máxima (y la recupera).',
      apply: pl => pl.addMaxHp(20) },
    { id: 'atk',  icon: 'fist', title: 'Potencia',     desc: '+10% de daño con todos los movimientos.',
      apply: pl => pl.atkMul *= 1.10, max: 40 },
    { id: 'spd',  icon: 'boot', title: 'Carrera',      desc: '+7% de velocidad de movimiento.',
      apply: pl => pl.spdMul *= 1.07, max: 8 },
    { id: 'cd',   icon: 'clock', title: 'Reflejos',     desc: '-8% de recarga en todos los movimientos.',
      apply: pl => pl.cdMul *= 0.92, max: 10 },
    { id: 'def',  icon: 'shield', title: 'Coraza',       desc: '+6% de reducción de daño recibido.',
      apply: pl => pl.dmgReduce = Math.min(0.7, pl.dmgReduce + 0.06), max: 12 },
    { id: 'rgn',  icon: 'sprout', title: 'Síntesis',     desc: '+0.9 de vida regenerada por segundo.',
      apply: pl => pl.regenFlat += 0.9 },
    { id: 'mag',  icon: 'magnet', title: 'Imán',         desc: '+30% de radio de recogida de experiencia.',
      apply: pl => pl.magnet *= 1.30, max: 6 },
    { id: 'xp',   icon: 'book', title: 'Aprendizaje',  desc: '+12% de experiencia ganada.',
      apply: pl => pl.xpMul *= 1.12, max: 8 },
    { id: 'heal', icon: 'berry', title: 'Baya Zidra',   desc: 'Recupera el 45% de tu vida ahora mismo.',
      apply: pl => pl.heal(pl.maxHp * 0.45) }
  ];

  /**
   * Version de Nika : les cartes de mouvement visent l'un des Pokémon de
   * l'équipe (nouveau mouvement, amélioration, évolution de mouvement), et
   * certaines proposent un nouveau Pokémon tant que l'équipe n'est pas à 6.
   */
  function memberCards(pl, out, waiting, team) {
    const who = team > 1 ? pl.mon.name + ' · ' : '';
    const wk = pl.ally ? 0.8 : 1;          // un peu moins pour chaque allié : le total reste équilibré

    // --- movimientos nuevos ---
    if (pl.slots.length < pl.maxMoves) {
      // Con 2 potenciadores ya no se ofrecen más: los buff no hacen daño y
      // llenar los 4 huecos con ellos deja la run sin salida.
      const buffs = pl.moves.filter(m => m.kind === 'buff').length;
      // Version de Nika : seulement ses 4 attaques apprenables.
      const pool = G.Team.learnset(pl.dex).filter(id =>
        !pl.hasMove(id) && !(pl.banned && pl.banned.has(id)) && !(buffs >= 2 && G.Moves.BY_ID[id].kind === 'buff'));
      for (const id of G.U.pickN(pool, pl.ally ? 3 : 6)) {
        const d = G.Moves.BY_ID[id];
        out.push({
          w: 10 * wk, type: 'new', key: 'new:' + pl.dex + ':' + id, who: team > 1 ? pl.dex : null,
          icon: 'move:' + id, color: G.U.TYPE_COLOR[d.type],
          tag: who + G.U.TYPE_NAME[d.type],
          title: d.name, desc: d.desc,
          apply: () => pl.addMove(id)
        });
      }
    }

    // --- evoluciones: movimiento al máximo + su condición cumplida ---
    for (const m of pl.moves) {
      const ev = G.Moves.evoInfo(m, pl.ally ? pl.leader.statsTaken : pl.statsTaken);
      if (!ev) continue;
      if (!ev.ready) { waiting[ev.needs] = waiting[ev.needs] || m; continue; }
      out.push({
        w: 40, type: 'evo', key: 'evo:' + pl.dex + ':' + m.id, who: team > 1 ? pl.dex : null,
        icon: 'move:' + m.id, color: '#ffd23f', tag: who + 'EVOLUCIÓN',
        title: m.name + ' → ' + ev.name, desc: ev.text,
        apply: () => {
          G.Moves.evolve(m);
          G.FX.ring(pl.x, pl.y, 8, 120, '#ffd23f', 0.8, 6);
          G.FX.burst(pl.x, pl.y - pl.bodyH * 0.5, '#ffe14d', 40, 240);
          G.Audio.sfx('legend');
          G.Progress.event('evolve', { move: m.id });
        }
      });
    }

    // --- mejoras de movimientos que ya tienes ---
    for (const m of pl.moves) {
      const txt = G.Moves.nextUpText(m);
      if (!txt) continue;
      out.push({
        w: 8 * wk, type: 'up', key: 'up:' + pl.dex + ':' + m.id, who: team > 1 ? pl.dex : null,
        icon: 'move:' + m.id, color: G.U.TYPE_COLOR[m.type],
        tag: who + 'Nv.' + m.lvl + ' > ' + (m.lvl + 1),
        title: m.name, desc: txt,
        apply: () => G.Moves.levelUp(m)
      });
    }
  }

  /** Construye el conjunto de cartas candidatas, con pesos. */
  function candidates(pl) {
    const out = [];
    const waiting = {};                   // stat -> movimiento que la espera para evolucionar
    const members = G.Team.leader === pl ? G.Team.members() : [pl];
    for (const mem of members) memberCards(mem, out, waiting, members.length);

    // --- nouveau Pokémon dans l'équipe (jusqu'à 6) ---
    if (G.Team.leader === pl && !G.Team.full()) {
      for (const mon of G.Team.recruitOffers(2)) {
        out.push({
          w: 9, type: 'mon', key: 'mon:' + mon.dex, dex: mon.dex,
          icon: 'heart', color: G.U.TYPE_COLOR[mon.types[0]],
          tag: 'Équipe ' + (members.length + 1) + '/6',
          title: mon.name, desc: 'Rejoint ton équipe au niveau 1 et attaque avec toi. ' + mon.types.map(t => G.U.TYPE_NAME[t]).join(' / ') + '.',
          apply: () => G.Team.recruit(mon.dex)
        });
      }
    }

    // --- stats ---
    // Las que desbloquean una evolución salen siempre y con aviso.
    // Cada mejora tiene un tope de veces (`max`): en partidas muy largas se
    // acumulaban sin fin (velocidad, recarga y experiencia por las nubes) y el
    // juego acababa colgándose. Las que piden una evolución salen siempre.
    const room = s => !s.max || (pl.statsTaken[s.id] || 0) < s.max;
    const pickStats = G.U.pickN(STATS.filter(s => !waiting[s.id] && room(s)), 5).concat(STATS.filter(s => waiting[s.id]));
    for (const s of pickStats) {
      const evoFor = waiting[s.id];
      out.push({
        w: evoFor ? 14 : pl.slots.length < pl.maxMoves ? 4 : 7,
        type: 'stat', key: 'stat:' + s.id,
        icon: s.icon, color: evoFor ? '#ffd23f' : '#8fa3c4', tag: evoFor ? 'Evoluciona ' + evoFor.name : 'Mejora',
        title: s.title, desc: s.desc,
        apply: p => { s.apply(p); p.statsTaken[s.id] = (p.statsTaken[s.id] || 0) + 1; }
      });
    }

    return out;
  }

  /** Devuelve 3 cartas distintas, elegidas por peso. */
  function offer(pl, n = 3) {
    const pool = candidates(pl);
    const picked = [];
    const used = new Set();
    // Si hay una evolución lista, su carta dorada sale siempre.
    const evo = pool.findIndex(c => c.type === 'evo');
    if (evo >= 0) { const c = pool.splice(evo, 1)[0]; used.add(c.key); picked.push(c); }

    while (picked.length < n && pool.length) {
      const total = pool.reduce((a, c) => a + c.w, 0);
      let r = Math.random() * total, idx = 0;
      for (let i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { idx = i; break; } }
      const c = pool.splice(idx, 1)[0];
      if (used.has(c.key)) continue;
      used.add(c.key);
      picked.push(c);
    }
    return picked;
  }

  return { offer, STATS };
})();
