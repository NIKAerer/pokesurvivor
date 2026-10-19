/* ============ moves.js — catálogo de movimientos ============
 *
 * kind (comportamiento, implementado en systems/combat.js):
 *   projectile  dispara `count` proyectiles al enemigo más cercano
 *   melee       golpe en arco alrededor del Pokémon
 *   beam        rayo recto que atraviesa todo lo que pilla
 *   orbit       orbes que giran alrededor mientras el movimiento está activo
 *   nova        ráfaga radial en todas las direcciones
 *   aura        círculo de daño continuo alrededor
 *   buff        potencia al propio Pokémon (acumulable, caduca)
 *   ---- desde 2026-10-10 (mismos gráficos, otra forma de jugar) ----
 *   boomerang   sale hacia el enemigo y vuelve a ti, golpeando a la ida y a la vuelta
 *   chain       golpea a uno y salta a los `count` siguientes más cercanos
 *   mine        minas en el suelo que estallan al pisarlas
 *   meteor      caen `count` meteoros sobre enemigos cercanos (avisa la sombra)
 *   turret      deja algo que dispara solo durante `dur` segundos
 *   dash        cruzas hacia el enemigo golpeando todo el camino (sin recibir daño)
 *   trail       vas dejando charcos que dañan a lo que los pisa
 *   cone        muchos disparos cortos en abanico (aliento, chorro...)
 *
 * Sólo el movimiento ACTIVO se ejecuta. Se cambia con 1-4 / Q / E.
 *
 * El icono no se guarda aquí: G.Icons lo compone (emblema del tipo +
 * insignia de la familia), ver ui/icons.js.
 *
 * Las mejoras (lvl 1 -> 5) salen de una escalera común por `kind`:
 *   mods multiplicativos -> dmg, cd, speed, radius, dur, amount, arc
 *   mods aditivos        -> count, pierce, stacks
 */
(() => {
  const LADDERS = {
    projectile: [
      { t: '+1 proyectil',                  m: { count: 1, spread: 1.4 } },
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+1 proyectil y +1 perforación',   m: { count: 1, pierce: 1, spread: 1.2 } }
    ],
    melee: [
      { t: '+40% daño',                     m: { dmg: 1.40 } },
      { t: '+25% alcance',                  m: { radius: 1.25 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: 'Golpea en 360° y +50% daño',    m: { arc: 9, dmg: 1.50 } }
    ],
    beam: [
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: '+30% alcance y grosor',         m: { radius: 1.30, width: 1.30 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+50% daño',                     m: { dmg: 1.50 } }
    ],
    orbit: [
      { t: '+1 orbe',                       m: { count: 1 } },
      { t: '+55% daño',                     m: { dmg: 1.55 } },
      { t: '+25% radio y gira más rápido',  m: { radius: 1.25, speed: 1.35 } },
      { t: '+1 orbe y +55% daño',           m: { count: 1, dmg: 1.55 } }
    ],
    nova: [
      { t: '+3 proyectiles',                m: { count: 3 } },
      { t: '+40% daño',                     m: { dmg: 1.40 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+3 proyectiles y +1 perforación', m: { count: 3, pierce: 1 } }
    ],
    aura: [
      { t: '+30% radio',                    m: { radius: 1.30 } },
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: 'Golpea un 40% más a menudo',    m: { cd: 0.70 } },
      { t: '+30% radio y +50% daño',        m: { radius: 1.30, dmg: 1.50 } }
    ],
    boomerang: [
      { t: '+1 bumerán',                    m: { count: 1 } },
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: '+30% alcance',                  m: { radius: 1.30 } },
      { t: '+1 bumerán y +40% daño',        m: { count: 1, dmg: 1.40 } }
    ],
    chain: [
      { t: '+2 saltos',                     m: { count: 2 } },
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+2 saltos y +40% daño',         m: { count: 2, dmg: 1.40 } }
    ],
    mine: [
      { t: '+1 mina',                       m: { count: 1 } },
      { t: '+50% daño',                     m: { dmg: 1.50 } },
      { t: '+30% radio de explosión',       m: { radius: 1.30 } },
      { t: '+1 mina y -25% recarga',        m: { count: 1, cd: 0.75 } }
    ],
    meteor: [
      { t: '+1 meteoro',                    m: { count: 1 } },
      { t: '+45% daño',                     m: { dmg: 1.45 } },
      { t: '+30% radio',                    m: { radius: 1.30 } },
      { t: '+2 meteoros y -20% recarga',    m: { count: 2, cd: 0.80 } }
    ],
    turret: [
      { t: '+50% daño',                     m: { dmg: 1.50 } },
      { t: 'Dispara un 35% más rápido',     m: { rate: 0.74 } },
      { t: '+1 a la vez',                   m: { count: 1 } },
      { t: '+50% duración y +40% daño',     m: { dur: 1.50, dmg: 1.40 } }
    ],
    dash: [
      { t: '+40% daño',                     m: { dmg: 1.40 } },
      { t: '+30% distancia',                m: { radius: 1.30 } },
      { t: '-25% recarga',                  m: { cd: 0.75 } },
      { t: '+60% daño y más ancho',         m: { dmg: 1.60, width: 1.40 } }
    ],
    trail: [
      { t: '+40% daño',                     m: { dmg: 1.40 } },
      { t: '+40% duración',                 m: { dur: 1.40 } },
      { t: 'Charcos un 30% más grandes',    m: { radius: 1.30 } },
      { t: '+50% daño y +30% radio',        m: { dmg: 1.50, radius: 1.30 } }
    ],
    cone: [
      { t: '+3 disparos',                   m: { count: 3 } },
      { t: '+40% daño',                     m: { dmg: 1.40 } },
      { t: '+30% alcance',                  m: { life: 1.30 } },
      { t: '+3 disparos y +1 perforación',  m: { count: 3, pierce: 1 } }
    ],
    // Version de Nika : soins et boucliers (des « buff » avec stat heal / shield).
    heal: [
      { t: '+30% de soin',                  m: { amount: 1.30 } },
      { t: '-20% de recharge',              m: { cd: 0.80 } },
      { t: '+30% de soin',                  m: { amount: 1.30 } },
      { t: '+40% de soin et -15% de recharge', m: { amount: 1.40, cd: 0.85 } }
    ],
    shield: [
      { t: 'Bouclier +30% plus solide',     m: { amount: 1.30 } },
      { t: '-20% de recharge',              m: { cd: 0.80 } },
      { t: 'Bouclier +30% plus solide',     m: { amount: 1.30 } },
      { t: '+40% de bouclier et -15% de recharge', m: { amount: 1.40, cd: 0.85 } }
    ],
    buff: [
      { t: '+1 acumulación máxima',         m: { stacks: 1 } },
      { t: '+40% potencia',                 m: { amount: 1.40 } },
      { t: '+50% duración',                 m: { dur: 1.50 } },
      { t: '+1 acumulación y +40% potencia', m: { stacks: 1, amount: 1.40 } }
    ]
  };

  const RAW = [
    // ---------------- NORMAL (pool común a todos) ----------------
    { id: 'tackle', name: 'Placaje', type: 'normal', kind: 'melee',
      desc: 'Embiste en arco a todo lo que tengas delante.',
      cd: 0.50, dmg: 13, radius: 48, arc: 1.7, knock: 90 },

    { id: 'quick-attack', name: 'Ataque Rápido', type: 'normal', kind: 'dash',
      desc: 'Cruzas como un rayo hacia el enemigo y golpeas todo el camino.',
      cd: 0.75, dmg: 26, radius: 110, width: 34, knock: 40 },

    { id: 'swords-dance', name: 'Danza Espada', type: 'normal', kind: 'buff',
      desc: 'No hace daño: acumula ATAQUE mientras esté activo.',
      cd: 0.85, stat: 'atk', amount: 0.13, dur: 7, stacks: 5 },

    { id: 'agility', name: 'Agilidad', type: 'normal', kind: 'buff',
      desc: 'No hace daño: acumula VELOCIDAD mientras esté activo.',
      cd: 0.85, stat: 'spd', amount: 0.10, dur: 7, stacks: 5 },

    { id: 'harden', name: 'Fortaleza', type: 'normal', kind: 'buff',
      desc: 'No hace daño: acumula DEFENSA mientras esté activo.',
      cd: 0.85, stat: 'def', amount: 0.07, dur: 7, stacks: 5 },

    // ---------------- FUEGO ----------------
    { id: 'ember', name: 'Ascuas', type: 'fire', kind: 'projectile',
      desc: 'Bola de fuego al enemigo más cercano.',
      cd: 0.52, dmg: 18, speed: 310, count: 1, spread: 0.12, pierce: 0, life: 1.6, size: 7, burn: 1 },

    { id: 'flamethrower', name: 'Lanzallamas', type: 'fire', kind: 'cone',
      desc: 'Chorro de llamas en abanico corto que quema.',
      cd: 0.70, dmg: 9, count: 7, arc: 0.9, speed: 380, life: 0.42, size: 6, pierce: 1, burn: 1 },

    { id: 'fire-spin', name: 'Giro Fuego', type: 'fire', kind: 'orbit',
      desc: 'Llamas que giran a tu alrededor. Defensa constante.',
      cd: 0.30, dmg: 14, count: 3, radius: 62, speed: 2.4, size: 9, burn: 1 },

    { id: 'heat-wave', name: 'Onda Ígnea', type: 'fire', kind: 'nova',
      desc: 'Explota en llamas en todas las direcciones.',
      cd: 1.25, dmg: 12, speed: 250, count: 10, pierce: 1, life: 1.1, size: 7, burn: 1 },

    // ---------------- AGUA ----------------
    { id: 'water-gun', name: 'Pistola Agua', type: 'water', kind: 'projectile',
      desc: 'Chorro perforante. Fiable a cualquier distancia.',
      cd: 0.44, dmg: 14, speed: 350, count: 1, spread: 0.10, pierce: 1, life: 1.5, size: 6 },

    { id: 'bubble', name: 'Burbuja', type: 'water', kind: 'nova',
      desc: 'Burbujas en abanico que ralentizan a quien tocan.',
      cd: 1.00, dmg: 9, speed: 210, count: 8, pierce: 0, life: 1.3, size: 8, slow: 0.45 },

    { id: 'hydro-pump', name: 'Hidrobomba', type: 'water', kind: 'beam',
      desc: 'Cañonazo de agua lento pero devastador.',
      cd: 1.50, dmg: 37, radius: 250, width: 30 },

    { id: 'aqua-ring', name: 'Acua Aro', type: 'water', kind: 'buff',
      desc: 'No hace daño: acumula REGENERACIÓN de vida.',
      cd: 0.90, stat: 'regen', amount: 1.6, dur: 8, stacks: 4 },

    // ---------------- PLANTA ----------------
    { id: 'vine-whip', name: 'Látigo Cepa', type: 'grass', kind: 'melee',
      desc: 'Látigos de largo alcance en arco amplio.',
      cd: 0.62, dmg: 14, radius: 68, arc: 1.3, knock: 60 },

    { id: 'razor-leaf', name: 'Hoja Afilada', type: 'grass', kind: 'boomerang',
      desc: 'Dos hojas que van y vuelven cortando a la ida y a la vuelta.',
      cd: 0.90, dmg: 10, speed: 330, count: 2, spread: 0.5, radius: 210, size: 6 },

    { id: 'leaf-storm', name: 'Tormenta Floral', type: 'grass', kind: 'orbit',
      desc: 'Un ciclón de hojas gira amplio a tu alrededor.',
      cd: 0.26, dmg: 14, count: 4, radius: 74, speed: 2.6, size: 8 },

    // (Antes Gigadrenado: curaba con cada golpe y estaba roto. Mismo id para no romper partidas.)
    { id: 'giga-drain', name: 'Hierba Lazo', type: 'grass', kind: 'aura',
      desc: 'Raíces que atrapan y machacan todo lo que tienes cerca.',
      cd: 0.55, dmg: 9, radius: 76 },

    // ---------------- ELÉCTRICO ----------------
    { id: 'thunder-shock', name: 'Impactrueno', type: 'electric', kind: 'projectile',
      desc: 'Descarga rapidísima que atraviesa varios enemigos.',
      cd: 0.40, dmg: 13, speed: 480, count: 1, spread: 0.08, pierce: 2, life: 1.1, size: 5 },

    { id: 'discharge', name: 'Chispazo', type: 'electric', kind: 'aura',
      desc: 'Campo eléctrico permanente alrededor de ti.',
      cd: 0.45, dmg: 8, radius: 70 },

    { id: 'thunderbolt', name: 'Rayo', type: 'electric', kind: 'chain',
      desc: 'Un rayo que salta de un enemigo a otro.',
      cd: 0.95, dmg: 21, count: 4, radius: 140 },

    // ---------------- PSÍQUICO ----------------
    // (11-10-2026: -22/-30 % de daño y persiguen menos; llenaban el ranking.)
    { id: 'confusion', name: 'Confusión', type: 'psychic', kind: 'projectile',
      desc: 'Onda que persigue sola a su objetivo.',
      cd: 0.58, dmg: 13, speed: 280, count: 1, spread: 0.1, pierce: 0, life: 2.2, size: 8, homing: 2.0 },

    { id: 'psybeam', name: 'Psicorrayo', type: 'psychic', kind: 'beam',
      desc: 'Rayo psíquico ancho y contundente.',
      cd: 1.15, dmg: 23, radius: 215, width: 40 },

    { id: 'psychic', name: 'Psíquico', type: 'psychic', kind: 'nova',
      desc: 'Estallido mental radial que busca enemigos.',
      cd: 1.35, dmg: 9, speed: 230, count: 12, pierce: 1, life: 1.6, size: 7, homing: 1.0 },

    // ---------------- TIPOS SECUNDARIOS ----------------
    { id: 'sludge', name: 'Residuos', type: 'poison', kind: 'projectile',
      desc: 'Lodo tóxico que envenena al impactar.',
      cd: 0.60, dmg: 17, speed: 290, count: 1, spread: 0.12, pierce: 0, life: 1.5, size: 8, poison: 1 },

    { id: 'mud-shot', name: 'Disparo Lodo', type: 'ground', kind: 'nova',
      desc: 'Salpica lodo alrededor y ralentiza.',
      cd: 1.10, dmg: 11, speed: 200, count: 7, pierce: 0, life: 1.0, size: 9, slow: 0.4 },

    { id: 'gust', name: 'Tornado', type: 'flying', kind: 'orbit',
      desc: 'Remolinos de viento que te escoltan.',
      cd: 0.26, dmg: 13, count: 3, radius: 72, speed: 2.8, size: 8, knock: 40 },

    { id: 'wing-attack', name: 'Ataque Ala', type: 'flying', kind: 'melee',
      desc: 'Barrido de alas amplio que empuja.',
      cd: 0.55, dmg: 14, radius: 58, arc: 1.9, knock: 70 },

    // ---------------- NORMAL (extra) ----------------
    { id: 'body-slam', name: 'Golpe Cuerpo', type: 'normal', kind: 'melee',
      desc: 'Placaje con todo el peso: lento, corto y brutal.',
      cd: 0.95, dmg: 30, radius: 46, arc: 2.2, knock: 140 },

    { id: 'hyper-voice', name: 'Vozarrón', type: 'normal', kind: 'nova',
      desc: 'Onda sonora que sale en todas direcciones.',
      cd: 1.15, dmg: 12, speed: 260, count: 9, pierce: 1, life: 0.9, size: 7 },

    // ---------------- VENENO (extra) ----------------
    { id: 'poison-sting', name: 'Picotazo Veneno', type: 'poison', kind: 'projectile',
      desc: 'Aguijón rápido que envenena.',
      cd: 0.34, dmg: 8, speed: 420, count: 1, spread: 0.08, pierce: 0, life: 1.0, size: 4, poison: 1 },

    { id: 'toxic', name: 'Tóxico', type: 'poison', kind: 'trail',
      desc: 'Vas dejando charcos de veneno que intoxican a quien los pisa.',
      cd: 0.3, dmg: 8, radius: 26, dur: 3, poison: 1 },

    // ---------------- TIERRA (extra) ----------------
    { id: 'bulldoze', name: 'Terratemblor', type: 'ground', kind: 'aura',
      desc: 'Sacude el suelo: daña y frena a lo cercano.',
      cd: 0.7, dmg: 11, radius: 80, slow: 0.35 },

    // ---------------- BICHO ----------------
    { id: 'bug-bite', name: 'Picadura', type: 'bug', kind: 'melee',
      desc: 'Mordisco rápido en arco corto.',
      cd: 0.42, dmg: 11, radius: 44, arc: 1.6, knock: 40 },

    { id: 'string-shot', name: 'Disparo Demora', type: 'bug', kind: 'mine',
      desc: 'Deja telarañas en el suelo que atrapan y frenan mucho al que las pisa.',
      cd: 1.1, dmg: 14, count: 2, radius: 56, dur: 7, slow: 0.6 },

    { id: 'bug-buzz', name: 'Zumbido', type: 'bug', kind: 'aura',
      desc: 'Vibración constante que machaca lo cercano.',
      cd: 0.45, dmg: 8, radius: 66 },

    // ---------------- ROCA ----------------
    { id: 'rock-throw', name: 'Lanzarrocas', type: 'rock', kind: 'projectile',
      desc: 'Pedrusco pesado que empuja al enemigo.',
      cd: 0.7, dmg: 24, speed: 260, count: 1, spread: 0.12, pierce: 0, life: 1.4, size: 9, knock: 90 },

    { id: 'rock-slide', name: 'Avalancha', type: 'rock', kind: 'meteor',
      desc: 'Caen rocas del cielo sobre los enemigos cercanos.',
      cd: 1.3, dmg: 21, count: 3, radius: 46, knock: 50 },     // (12-10-2026: era 26; mataba el doble que la media)

    // ---------------- HIELO ----------------
    { id: 'ice-beam', name: 'Rayo Hielo', type: 'ice', kind: 'beam',
      desc: 'Rayo helado que congela casi del todo.',
      cd: 1.1, dmg: 25, radius: 220, width: 30, slow: 0.7 },

    { id: 'powder-snow', name: 'Nieve Polvo', type: 'ice', kind: 'aura',
      desc: 'Ventisca a tu alrededor que ralentiza.',
      cd: 0.55, dmg: 8, radius: 76, slow: 0.45 },

    // ---------------- LUCHA ----------------
    { id: 'karate-chop', name: 'Golpe Kárate', type: 'fighting', kind: 'melee',
      desc: 'Golpe seco y potente al frente.',
      cd: 0.5, dmg: 18, radius: 50, arc: 1.2, knock: 110 },

    { id: 'aura-sphere', name: 'Esfera Aural', type: 'fighting', kind: 'projectile',
      desc: 'Esfera de energía que nunca falla.',
      cd: 0.62, dmg: 17, speed: 300, count: 1, spread: 0.1, pierce: 0, life: 2.0, size: 8, homing: 4 },

    // ---------------- FANTASMA ----------------
    { id: 'lick', name: 'Lengüetazo', type: 'ghost', kind: 'melee',
      desc: 'Lametazo espectral que paraliza un poco.',
      cd: 0.48, dmg: 12, radius: 48, arc: 1.8, slow: 0.4 },

    { id: 'shadow-ball', name: 'Bola Sombra', type: 'ghost', kind: 'projectile',
      desc: 'Esfera oscura que atraviesa a varios.',
      cd: 0.66, dmg: 19, speed: 280, count: 1, spread: 0.1, pierce: 2, life: 1.6, size: 9 },

    // ---------------- DRAGÓN ----------------
    { id: 'dragon-rage', name: 'Furia Dragón', type: 'dragon', kind: 'beam',
      desc: 'Llamarada dracónica en línea recta.',
      cd: 1.0, dmg: 30, radius: 230, width: 34 },

    { id: 'dragon-dance', name: 'Danza Dragón', type: 'dragon', kind: 'buff',
      desc: 'No hace daño: acumula ATAQUE más rápido que Danza Espada.',
      cd: 0.7, stat: 'atk', amount: 0.11, dur: 7, stacks: 5 },

    // ---------------- HADA ----------------
    { id: 'fairy-wind', name: 'Viento Feérico', type: 'fairy', kind: 'nova',
      desc: 'Brisa mágica en todas direcciones.',
      cd: 1.0, dmg: 11, speed: 230, count: 10, pierce: 0, life: 1.2, size: 7 },

    { id: 'dazzling-gleam', name: 'Brillo Mágico', type: 'fairy', kind: 'aura',
      desc: 'Destello a tu alrededor.',
      cd: 0.5, dmg: 9, radius: 72 },

    // ---------------- ACERO ----------------
    { id: 'metal-claw', name: 'Garra Metal', type: 'steel', kind: 'melee',
      desc: 'Zarpazo de acero en arco.',
      cd: 0.5, dmg: 15, radius: 50, arc: 1.6, knock: 60 },

    { id: 'flash-cannon', name: 'Foco Resplandor', type: 'steel', kind: 'beam',
      desc: 'Rayo de luz metálica que perfora.',
      cd: 1.05, dmg: 29, radius: 220, width: 30 },

    // ---------------- SINIESTRO ----------------
    { id: 'bite', name: 'Mordisco', type: 'dark', kind: 'melee',
      desc: 'Dentellada rápida que hace retroceder.',
      cd: 0.45, dmg: 14, radius: 46, arc: 1.5, knock: 70 },

    { id: 'dark-pulse', name: 'Pulso Umbrío', type: 'dark', kind: 'nova',
      desc: 'Onda de energía oscura en todas direcciones.',
      cd: 1.15, dmg: 12, speed: 240, count: 10, pierce: 1, life: 1.1, size: 8 },

    { id: 'night-shade', name: 'Tinieblas', type: 'ghost', kind: 'aura',
      desc: 'Una sombra te rodea y consume lo cercano.',
      cd: 0.5, dmg: 9, radius: 72 },

    // ---------------- NUEVOS (2026-10-10): mismas formas, otras mecánicas ----------------
    { id: 'bonemerang', name: 'Huesomerang', type: 'ground', kind: 'boomerang',
      desc: 'Un hueso que va y vuelve golpeando fuerte.',
      cd: 0.95, dmg: 16, speed: 300, count: 1, radius: 230, size: 8, knock: 40 },

    { id: 'psycho-cut', name: 'Psicocorte', type: 'psychic', kind: 'boomerang',
      desc: 'Cuchillas psíquicas que vuelven a ti.',
      cd: 0.8, dmg: 9, speed: 360, count: 2, spread: 0.6, radius: 200, size: 7 },

    { id: 'spikes', name: 'Púas', type: 'ground', kind: 'mine',
      desc: 'Siembra púas que estallan al pisarlas.',
      cd: 1.2, dmg: 18, count: 2, radius: 60, dur: 8 },

    { id: 'toxic-spikes', name: 'Púas Tóxicas', type: 'poison', kind: 'mine',
      desc: 'Púas venenosas que envenenan mucho al estallar.',
      cd: 1.1, dmg: 11, count: 2, radius: 56, dur: 8, poison: 2 },

    { id: 'hail', name: 'Granizo', type: 'ice', kind: 'meteor',
      desc: 'Bolas de hielo caen sobre los enemigos y los frenan.',
      cd: 1.2, dmg: 18, count: 4, radius: 40, slow: 0.4 },

    { id: 'meteor-mash', name: 'Puño Meteoro', type: 'steel', kind: 'meteor',
      desc: 'Dos meteoros de acero que aplastan donde caen.',
      cd: 1.4, dmg: 28, count: 2, radius: 54, knock: 80 },

    { id: 'will-o-wisp', name: 'Fuego Fatuo', type: 'fire', kind: 'turret',
      desc: 'Deja una llama flotante que dispara sola y quema.',
      cd: 3.5, dmg: 15, rate: 0.55, dur: 6, count: 1, range: 300, speed: 300, size: 7, burn: 1 },

    { id: 'substitute', name: 'Sustituto', type: 'normal', kind: 'turret',
      desc: 'Un muñeco que se queda disparando por ti.',
      cd: 4.0, dmg: 14, rate: 0.4, dur: 6, count: 1, range: 280, speed: 320, size: 6 },

    { id: 'aerial-ace', name: 'Golpe Aéreo', type: 'flying', kind: 'dash',
      desc: 'Te lanzas en picado y cortas todo lo que cruzas.',
      cd: 0.75, dmg: 23, radius: 120, width: 40, knock: 60 },

    // (Version de Nika : c'est une charge, plus un rastro.)
    { id: 'flame-wheel', name: 'Rueda Fuego', type: 'fire', kind: 'dash',
      desc: 'Tu fonces enveloppé de flammes et brûles tout sur ton passage.',
      cd: 0.85, dmg: 24, radius: 115, width: 36, knock: 40, burn: 1 },

    { id: 'bubble-beam', name: 'Rayo Burbuja', type: 'water', kind: 'cone',
      desc: 'Chorro de burbujas en abanico corto que frena.',
      cd: 0.65, dmg: 8, count: 7, arc: 1.0, speed: 340, life: 0.45, size: 6, slow: 0.3 },

    { id: 'hex', name: 'Infortunio', type: 'ghost', kind: 'chain',
      desc: 'Maldición que salta entre enemigos. Mucho más daño si están quemados, envenenados o frenados.',
      cd: 0.9, dmg: 17, count: 4, radius: 150, hex: 1.7 },

    // ---------------- Version de Nika : attaques de rôle (2026-10-19) ----------------
    // Soigneurs : soignent la barre de PV de l'équipe (amount = part des PV max).
    { id: 'wish', name: 'Vœu', type: 'normal', kind: 'buff', stat: 'heal', ladder: 'heal',
      desc: 'Ne fait pas de dégâts : soigne l\'équipe régulièrement.',
      cd: 7, amount: 0.07 },
    { id: 'soft-boiled', name: 'E-Coque', type: 'normal', kind: 'buff', stat: 'heal', ladder: 'heal',
      desc: 'Ne fait pas de dégâts : un gros soin de temps en temps.',
      cd: 11, amount: 0.13 },
    { id: 'heal-bell', name: 'Glas de Soin', type: 'normal', kind: 'buff', stat: 'heal', ladder: 'heal',
      desc: 'Ne fait pas de dégâts : de petits soins très fréquents.',
      cd: 3.5, amount: 0.035 },
    { id: 'synthesis', name: 'Synthèse', type: 'grass', kind: 'buff', stat: 'heal', ladder: 'heal',
      desc: 'Ne fait pas de dégâts : soigne l\'équipe grâce au soleil.',
      cd: 7, amount: 0.075 },
    { id: 'heal-pulse', name: 'Vibra Soin', type: 'psychic', kind: 'buff', stat: 'heal', ladder: 'heal',
      desc: 'Ne fait pas de dégâts : une onde qui soigne l\'équipe.',
      cd: 6, amount: 0.06 },
    { id: 'heal-order', name: 'Appel Soins', type: 'bug', kind: 'buff', stat: 'heal', ladder: 'heal',
      desc: 'Ne fait pas de dégâts : des abeilles viennent soigner l\'équipe.',
      cd: 6.5, amount: 0.065 },
    { id: 'roost', name: 'Atterrissage', type: 'flying', kind: 'buff', stat: 'heal', ladder: 'heal',
      desc: 'Ne fait pas de dégâts : se pose et soigne l\'équipe.',
      cd: 8, amount: 0.085 },
    { id: 'floral-healing', name: 'Soin Floral', type: 'fairy', kind: 'buff', stat: 'heal', ladder: 'heal',
      desc: 'Ne fait pas de dégâts : un parfum de fleurs qui soigne l\'équipe.',
      cd: 7, amount: 0.075 },

    // Tanks : boucliers (absorbent les coups), défense et contrôle.
    { id: 'protect', name: 'Abri', type: 'normal', kind: 'buff', stat: 'shield', ladder: 'shield',
      desc: 'Ne fait pas de dégâts : un bouclier qui absorbe les coups.',
      cd: 9, amount: 0.15, dur: 6 },
    { id: 'withdraw', name: 'Repli', type: 'water', kind: 'buff', stat: 'shield', ladder: 'shield',
      desc: 'Ne fait pas de dégâts : rentre dans sa carapace, bouclier.',
      cd: 8, amount: 0.14, dur: 6 },
    { id: 'reflect', name: 'Protection', type: 'psychic', kind: 'buff', stat: 'shield', ladder: 'shield',
      desc: 'Ne fait pas de dégâts : un mur de lumière qui absorbe les coups.',
      cd: 9, amount: 0.16, dur: 6 },
    { id: 'iron-defense', name: 'Mur de Fer', type: 'steel', kind: 'buff',
      desc: 'Ne fait pas de dégâts : accumule beaucoup de DÉFENSE.',
      cd: 0.9, stat: 'def', amount: 0.09, dur: 7, stacks: 5 },
    { id: 'acid-armor', name: 'Acidarmure', type: 'poison', kind: 'buff',
      desc: 'Ne fait pas de dégâts : accumule de la DÉFENSE.',
      cd: 0.85, stat: 'def', amount: 0.08, dur: 7, stacks: 5 },
    { id: 'roar', name: 'Hurlement', type: 'normal', kind: 'nova', role: 'tank',
      desc: 'Un cri qui repousse loin tout ce qui t\'entoure.',
      cd: 2.4, dmg: 6, speed: 300, count: 14, pierce: 3, life: 0.6, size: 9, knock: 240 },
    { id: 'rock-tomb', name: 'Tomberoche', type: 'rock', kind: 'mine', cat: 'P',
      desc: 'Des rochers piégés qui écrasent et bloquent presque l\'ennemi.',
      cd: 1.2, dmg: 17, count: 2, radius: 58, dur: 7, slow: 0.55, knock: 40 },

    // Mêlée
    { id: 'bulk-up', name: 'Gonflette', type: 'fighting', kind: 'buff',
      desc: 'Ne fait pas de dégâts : accumule ATTAQUE et un peu de défense.',
      cd: 0.85, stat: 'atk', amount: 0.12, dur: 7, stacks: 5, alsoDef: 0.03 },

    // Supports vitesse : accélèrent l'équipe ou ralentissent les ennemis.
    { id: 'tailwind', name: 'Vent Arrière', type: 'flying', kind: 'buff',
      desc: 'Ne fait pas de dégâts : accumule beaucoup de VITESSE.',
      cd: 0.85, stat: 'spd', amount: 0.13, dur: 7, stacks: 4 },
    { id: 'rock-polish', name: 'Poliroche', type: 'rock', kind: 'buff',
      desc: 'Ne fait pas de dégâts : accumule de la VITESSE.',
      cd: 0.85, stat: 'spd', amount: 0.11, dur: 7, stacks: 5 },
    { id: 'electroweb', name: 'Toile Élek', type: 'electric', kind: 'nova', role: 'vit',
      desc: 'Un filet électrique dans toutes les directions qui ralentit beaucoup.',
      cd: 1.3, dmg: 8, speed: 230, count: 8, pierce: 1, life: 1.0, size: 8, slow: 0.55 },
    { id: 'cotton-spore', name: 'Spore Coton', type: 'grass', kind: 'mine', role: 'vit',
      desc: 'Du coton collant au sol qui ralentit énormément.',
      cd: 1.2, dmg: 7, count: 3, radius: 62, dur: 8, slow: 0.7 },
    { id: 'scary-face', name: 'Grimace', type: 'normal', kind: 'aura', role: 'vit',
      desc: 'Une grimace qui fige de peur tout ce qui est proche.',
      cd: 0.8, dmg: 3, radius: 115, slow: 0.5 },

    // DPS : tirs rapides.
    { id: 'swift', name: 'Étoile Filante', type: 'normal', kind: 'projectile',
      desc: 'Deux étoiles rapides qui ne ratent jamais leur cible.',
      cd: 0.5, dmg: 11, speed: 340, count: 2, spread: 0.2, pierce: 0, life: 1.4, size: 6, homing: 3 },
    { id: 'bullet-seed', name: 'Balle Graine', type: 'grass', kind: 'projectile', cat: 'P',
      desc: 'Une rafale de graines tirées à toute vitesse.',
      cd: 0.36, dmg: 8, speed: 400, count: 3, spread: 0.16, pierce: 0, life: 0.9, size: 5 },
    { id: 'icicle-spear', name: 'Stalagtite', type: 'ice', kind: 'projectile', cat: 'P',
      desc: 'Pics de glace rapides qui ralentissent.',
      cd: 0.42, dmg: 9, speed: 420, count: 2, spread: 0.14, pierce: 0, life: 1.0, size: 5, slow: 0.2 },
    { id: 'dragon-breath', name: 'Draco-Souffle', type: 'dragon', kind: 'cone',
      desc: 'Un souffle de dragon en éventail court.',
      cd: 0.7, dmg: 9, count: 6, arc: 0.8, speed: 360, life: 0.45, size: 6, pierce: 1, slow: 0.2 },
    { id: 'night-slash', name: 'Tranche-Nuit', type: 'dark', kind: 'boomerang',
      desc: 'Deux lames d\'ombre qui vont et reviennent.',
      cd: 0.85, dmg: 13, speed: 340, count: 2, spread: 0.5, radius: 210, size: 7 },

    { id: 'struggle-bug', name: 'Survinsecte', type: 'bug', kind: 'cone',
      desc: 'Une nuée d\'insectes en éventail court.',
      cd: 0.62, dmg: 8, count: 7, arc: 1.0, speed: 340, life: 0.45, size: 6, pierce: 1 },
    { id: 'disarming-voice', name: 'Voix Enjôleuse', type: 'fairy', kind: 'projectile',
      desc: 'Des notes féeriques qui suivent leur cible.',
      cd: 0.5, dmg: 12, speed: 300, count: 2, spread: 0.3, pierce: 0, life: 1.6, size: 7, homing: 2.5 },
    { id: 'bullet-punch', name: 'Pisto-Poing', type: 'steel', kind: 'projectile', cat: 'P',
      desc: 'Des coups de poing d\'acier projetés à toute vitesse.',
      cd: 0.34, dmg: 10, speed: 460, count: 1, spread: 0.08, pierce: 1, life: 0.9, size: 6, knock: 30 },
    { id: 'air-slash', name: 'Lame d\'Air', type: 'flying', kind: 'projectile',
      desc: 'Des lames de vent qui traversent plusieurs ennemis.',
      cd: 0.55, dmg: 14, speed: 380, count: 1, spread: 0.1, pierce: 2, life: 1.2, size: 7 },

    { id: 'fury-swipes', name: 'Combo-Griffe', type: 'normal', kind: 'cone', cat: 'P',
      desc: 'Une volée de coups de griffes en éventail.',
      cd: 0.55, dmg: 9, count: 5, arc: 0.7, speed: 320, life: 0.35, size: 6, pierce: 1 },
    { id: 'echoed-voice', name: 'Écho', type: 'normal', kind: 'projectile',
      desc: 'Une onde sonore rapide qui traverse plusieurs ennemis.',
      cd: 0.45, dmg: 10, speed: 380, count: 1, spread: 0.1, pierce: 2, life: 1.1, size: 7 },
    { id: 'growl', name: 'Rugissement', type: 'normal', kind: 'nova', role: 'vit',
      desc: 'Un rugissement tout autour qui ralentit beaucoup.',
      cd: 1.4, dmg: 3, speed: 260, count: 12, pierce: 4, life: 0.7, size: 9, slow: 0.5 },

    // Mage
    { id: 'mega-drain', name: 'Méga-Sangsue', type: 'grass', kind: 'chain',
      desc: 'Aspire l\'énergie de plusieurs ennemis et soigne un peu l\'équipe.',
      cd: 1.0, dmg: 16, count: 3, radius: 140, leech: 0.03 },
    { id: 'silver-wind', name: 'Vent Argenté', type: 'bug', kind: 'nova',
      desc: 'Un vent d\'écailles argentées dans toutes les directions.',
      cd: 1.2, dmg: 11, speed: 240, count: 9, pierce: 1, life: 1.0, size: 7 },
    { id: 'hyper-beam', name: 'Ultralaser', type: 'normal', kind: 'beam',
      desc: 'Un rayon énorme et lent, dévastateur.',
      cd: 1.8, dmg: 44, radius: 260, width: 38 }
  ];

  // Cuerpo a cuerpo (12-10-2026): +20 % de daño y +25 % de alcance y de arco
  // (y -25 % de daño recibido mientras sea tu ataque activo, en player.js).
  // Pegaban bien, pero había que arriesgar mucho más que con los de distancia.
  for (const m of RAW) {
    if (m.kind !== 'melee') continue;
    m.dmg = Math.round(m.dmg * 1.2);
    m.radius = Math.round(m.radius * 1.25);
    if (m.arc) m.arc = Math.min(3, +(m.arc * 1.25).toFixed(2));
  }

  // Version de Nika : les auras sont des attaques de tank, lentes et lourdes,
  // qui ralentissent (contrôle) : recharge ×1,4, dégâts ×1,35, ralentit un peu.
  for (const m of RAW) {
    if (m.kind !== 'aura' || m.role) continue;
    m.cd = +(m.cd * 1.4).toFixed(2);
    m.dmg = Math.round(m.dmg * 1.35);
    if (!m.slow) m.slow = 0.25;
  }

  /*
   * Version de Nika : rôle et catégorie de chaque attaque.
   * Rôle (tank, melee, mage, dps, soin, vit) : d'après sa forme (kind), sauf
   * exception (`role`). Sert à choisir les 4 attaques de rôle d'un Pokémon.
   * Catégorie : P (physique, utilise l'Attaque) ou S (spéciale, l'Attaque Spé).
   */
  const KIND_ROLE = { melee: 'melee', dash: 'melee', projectile: 'dps', boomerang: 'dps', cone: 'dps',
                      beam: 'mage', meteor: 'mage', chain: 'mage', nova: 'mage',
                      aura: 'tank', orbit: 'tank', mine: 'tank', turret: 'soin', trail: 'tank' };
  const BUFF_ROLE = { atk: 'melee', spd: 'vit', def: 'tank', regen: 'soin', heal: 'soin', shield: 'tank' };
  const ROLE_FIX = { 'bubble': 'vit', 'string-shot': 'vit', 'mud-shot': 'vit', 'substitute': 'soin' };
  const PHYS = ['rock-throw', 'poison-sting', 'rock-slide', 'meteor-mash', 'spikes', 'bonemerang'];
  function roleOfDef(m) { return m.role || ROLE_FIX[m.id] || (m.kind === 'buff' ? BUFF_ROLE[m.stat] : KIND_ROLE[m.kind]); }
  function catOfDef(m) { return m.cat || (PHYS.includes(m.id) || ['melee', 'dash', 'boomerang'].includes(m.kind) ? 'P' : 'S'); }
  for (const m of RAW) { m.role = roleOfDef(m); m.cat = catOfDef(m); }

  // Pool de movimientos por tipo. El pool `normal` lo tienen todos.
  const POOL = {};
  for (const m of RAW) (POOL[m.type] = POOL[m.type] || []).push(m.id);

  const BY_ID = {};
  for (const m of RAW) {
    m.ups = LADDERS[m.ladder || m.kind];
    m.maxLvl = m.ups.length + 1;
    BY_ID[m.id] = m;
  }

  /** Movimientos que este Pokémon puede aprender (sus tipos + normal). */
  function poolFor(mon) {
    const ids = new Set(POOL.normal);
    for (const t of mon.types) for (const id of (POOL[t] || [])) ids.add(id);
    return [...ids];
  }

  /**
   * Instancia de movimiento en una run: los números base de `def` con todas
   * las mejoras de la escalera hasta `lvl` ya aplicadas.
   */
  function instance(id, lvl = 1) {
    const def = BY_ID[id];
    const s = Object.assign({}, def, { id, def, lvl, t: 0 });
    delete s.ups;
    for (let i = 0; i < lvl - 1; i++) applyMods(s, def.ups[i].m);
    return s;
  }

  const MULT = ['dmg', 'cd', 'speed', 'radius', 'dur', 'amount', 'arc', 'width', 'spread', 'life', 'size', 'rate'];
  const ADD = ['count', 'pierce', 'stacks'];

  function applyMods(s, m) {
    for (const k in m) {
      if (MULT.includes(k) && s[k] != null) s[k] *= m[k];
      else if (ADD.includes(k)) s[k] = (s[k] || 0) + m[k];
      else s[k] = m[k];
    }
  }

  /** Sube de nivel una instancia ya creada. */
  function levelUp(s) {
    if (s.lvl >= s.def.maxLvl) return false;
    applyMods(s, s.def.ups[s.lvl - 1].m);
    s.lvl++;
    return true;
  }

  /** Texto de la próxima mejora, para la carta de subida de nivel. */
  function nextUpText(s) {
    return s.lvl >= s.def.maxLvl ? null : s.def.ups[s.lvl - 1].t;
  }

  /** Movimiento inicial según el tipo principal (si el Pokémon no trae uno). */
  const START = {
    fire: 'ember', water: 'water-gun', grass: 'vine-whip', electric: 'thunder-shock',
    psychic: 'confusion', poison: 'sludge', ground: 'mud-shot', flying: 'gust',
    bug: 'bug-bite', rock: 'rock-throw', ice: 'ice-beam', fighting: 'karate-chop',
    ghost: 'shadow-ball', dragon: 'dragon-rage', fairy: 'fairy-wind', steel: 'metal-claw',
    dark: 'bite', normal: 'tackle'
  };
  function startFor(mon) {
    if (mon.start && BY_ID[mon.start]) return mon.start;
    for (const t of mon.types) if (START[t]) return START[t];
    return 'tackle';
  }

  // ---------------- evolución de movimientos ----------------
  /*
   * Un movimiento al NIVEL MÁXIMO evoluciona si en esa run has cogido alguna
   * vez la mejora de su condición (`needs`, un id de LevelUp.STATS). Sale una
   * carta dorada. Los potenciadores (buff) no evolucionan.
   */
  const NEED_NAME = { hp: 'Vigor', atk: 'Potencia', spd: 'Carrera', cd: 'Reflejos', def: 'Coraza',
                      rgn: 'Síntesis', mag: 'Imán', xp: 'Aprendizaje' };
  const EVO = {
    'tackle': ['Derribo', 'hp'],             'quick-attack': ['Velocidad Extrema', 'spd'],
    'body-slam': ['Gigaimpacto', 'atk'],     'hyper-voice': ['Alboroto', 'cd'],
    'ember': ['Llamarada', 'atk'],           'flamethrower': ['Sofoco', 'cd'],
    'fire-spin': ['Fuego Sagrado', 'rgn'],   'heat-wave': ['Erupción', 'hp'],
    'water-gun': ['Escaldar', 'atk'],        'bubble': ['Surf', 'spd'],
    'hydro-pump': ['Hidrocañón', 'atk'],     'vine-whip': ['Latigazo', 'atk'],
    'razor-leaf': ['Lluevehojas', 'cd'],     'leaf-storm': ['Danza Pétalo', 'rgn'],
    'giga-drain': ['Planta Feroz', 'hp'],    'thunder-shock': ['Trueno', 'atk'],
    'discharge': ['Campo Eléctrico', 'def'], 'thunderbolt': ['Electrocañón', 'cd'],
    'confusion': ['Psicocarga', 'cd'],       'psybeam': ['Premonición', 'atk'],
    'psychic': ['Vasta Fuerza', 'mag'],      'sludge': ['Bomba Lodo', 'atk'],
    'poison-sting': ['Puya Nociva', 'spd'],  'toxic': ['Gas Venenoso', 'rgn'],
    'mud-shot': ['Tierra Viva', 'atk'],      'bulldoze': ['Terremoto', 'atk'],
    'gust': ['Vendaval', 'spd'],             'wing-attack': ['Pájaro Osado', 'atk'],
    'bug-bite': ['Tijera X', 'atk'],         'string-shot': ['Red Viscosa', 'cd'],
    'bug-buzz': ['Enjambre', 'rgn'],         'rock-throw': ['Roca Afilada', 'atk'],
    'rock-slide': ['Trampa Rocas', 'cd'],    'ice-beam': ['Ventisca', 'atk'],
    'powder-snow': ['Viento Hielo', 'spd'],  'karate-chop': ['A Bocajarro', 'atk'],
    'aura-sphere': ['Onda Certera', 'cd'],   'lick': ['Puño Sombra', 'atk'],
    'shadow-ball': ['Golpe Fantasma', 'cd'], 'dragon-rage': ['Cometa Draco', 'atk'],
    'fairy-wind': ['Fuerza Lunar', 'atk'],   'dazzling-gleam': ['Campo de Niebla', 'rgn'],
    'metal-claw': ['Cabeza de Hierro', 'atk'], 'flash-cannon': ['Rayo Metálico', 'def'],
    'bite': ['Triturar', 'atk'],             'dark-pulse': ['Alarido', 'spd'],
    'night-shade': ['Pesadilla', 'rgn'],
    'bonemerang': ['Ataque Óseo', 'atk'],    'psycho-cut': ['Psicocolmillo', 'cd'],
    'spikes': ['Fisura', 'atk'],             'toxic-spikes': ['Lanza Mugre', 'rgn'],
    'hail': ['Alud', 'cd'],                  'meteor-mash': ['Bomba Imán', 'atk'],
    'will-o-wisp': ['Infierno', 'cd'],       'substitute': ['Doble Equipo', 'def'],
    'aerial-ace': ['Acróbata', 'spd'],       'flame-wheel': ['Envite Ígneo', 'spd'],
    'bubble-beam': ['Acua Cola', 'atk'],     'hex': ['Poltergeist', 'mag']
  };
  // Lo que gana al evolucionar, según cómo funcione.
  const EVO_MODS = {
    projectile: { t: '×1,8 daño, +2 proyectiles, +2 perforación y más grandes', m: { dmg: 1.8, count: 2, pierce: 2, size: 1.3, spread: 1.1 } },
    melee:      { t: '×1,9 daño, más alcance y golpea en 360°', m: { dmg: 1.9, radius: 1.3, arc: 9 } },
    beam:       { t: '×1,8 daño, rayo un 50% más grueso y más largo', m: { dmg: 1.8, width: 1.5, radius: 1.2, cd: 0.85 } },
    orbit:      { t: '+2 orbes, ×1,7 daño y más radio', m: { count: 2, dmg: 1.7, radius: 1.15 } },
    nova:       { t: '+6 proyectiles, ×1,6 daño y +1 perforación', m: { count: 6, dmg: 1.6, pierce: 1 } },
    aura:       { t: '×1,8 daño y un 35% más de radio', m: { dmg: 1.8, radius: 1.35 } },
    boomerang:  { t: '×1,8 daño, +1 bumerán y más alcance', m: { dmg: 1.8, count: 1, radius: 1.2, size: 1.2 } },
    chain:      { t: '×1,7 daño y +3 saltos', m: { dmg: 1.7, count: 3, radius: 1.2 } },
    mine:       { t: '×1,8 daño, +2 minas y explosión más grande', m: { dmg: 1.8, count: 2, radius: 1.25 } },
    meteor:     { t: '×1,7 daño, +2 meteoros y más radio', m: { dmg: 1.7, count: 2, radius: 1.2 } },
    turret:     { t: '×1,8 daño, +1 a la vez y dispara más rápido', m: { dmg: 1.8, count: 1, rate: 0.8 } },
    dash:       { t: '×1,9 daño, más distancia y menos recarga', m: { dmg: 1.9, radius: 1.25, cd: 0.8 } },
    trail:      { t: '×1,8 daño, charcos más grandes y duraderos', m: { dmg: 1.8, radius: 1.25, dur: 1.3 } },
    cone:       { t: '×1,7 daño, +4 disparos y +1 perforación', m: { dmg: 1.7, count: 4, pierce: 1 } }
  };

  /** ¿Puede evolucionar ya? → { name, needs, needName, text, ready } o null */
  function evoInfo(m, statsTaken) {
    const e = EVO[m.id];
    if (!e || m.evolved || m.lvl < m.def.maxLvl || !EVO_MODS[m.kind]) return null;
    const [name, needs] = e;
    return { name, needs, needName: NEED_NAME[needs], text: EVO_MODS[m.kind].t,
             ready: !!(statsTaken && statsTaken[needs]) };
  }

  /** Evoluciona una instancia (cambia nombre y potencia; sigue siendo del mismo tipo). */
  function evolve(m) {
    const e = EVO[m.id];
    if (!e || m.evolved) return false;
    applyMods(m, EVO_MODS[m.kind].m);
    m.baseName = m.name;
    m.name = e[0];
    m.evolved = true;
    return true;
  }

  G.Moves = { ALL: RAW, BY_ID, POOL, poolFor, instance, levelUp, nextUpText, startFor,
              EVO, NEED_NAME, evoInfo, evolve, LADDERS, roleOfDef, catOfDef };
})();
