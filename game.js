"use strict";
// ---------- Données ----------
const D = {};
for (const e of DEX) {
  D[e[0]] = { id:e[0], name:e[1], types:e[2], from:e[3], evoLvl:e[4], stage:e[5], hp:e[6], atk:e[7], def:e[8], spe:e[9], bst:e[10], leg:!!e[11], baby:!!e[12], r:e[13], kids:[] };
}
for (const id in D) { const s = D[id]; if (s.from) D[s.from].kids.push(s.id); }
const ALL = Object.values(D);
const rootOf = id => { let s = D[id]; while (s.from) s = D[s.from]; return s.id; };
const ROOTS = ALL.filter(s => !s.from && !s.leg);
const LEGENDS = ALL.filter(s => s.leg);

const TYPE_COL = { normal:"#a8a77a", feu:"#ee8130", eau:"#6390f0", electrik:"#e5c22a", plante:"#6bbf3f", glace:"#7ed4d0", combat:"#c22e28", poison:"#a33ea1", sol:"#d6b35a", vol:"#a98ff3", psy:"#f95587", insecte:"#a6b91a", roche:"#b6a136", spectre:"#735797", dragon:"#6f35fc", tenebres:"#705746", acier:"#9fa0bd", fee:"#d685ad" };
const TYPE_FR = { normal:"Normal", feu:"Feu", eau:"Eau", electrik:"Électrik", plante:"Plante", glace:"Glace", combat:"Combat", poison:"Poison", sol:"Sol", vol:"Vol", psy:"Psy", insecte:"Insecte", roche:"Roche", spectre:"Spectre", dragon:"Dragon", tenebres:"Ténèbres", acier:"Acier", fee:"Fée" };
// Table des types (attaque -> défense). Les immunités valent 0.25 pour ne jamais bloquer une attaque.
const CHART = {
  normal:{roche:.5,acier:.5,spectre:.25},
  feu:{feu:.5,eau:.5,plante:2,glace:2,insecte:2,roche:.5,dragon:.5,acier:2},
  eau:{feu:2,eau:.5,plante:.5,sol:2,roche:2,dragon:.5},
  electrik:{eau:2,electrik:.5,plante:.5,sol:.25,vol:2,dragon:.5},
  plante:{feu:.5,eau:2,plante:.5,poison:.5,sol:2,vol:.5,insecte:.5,roche:2,dragon:.5,acier:.5},
  glace:{feu:.5,eau:.5,plante:2,glace:.5,sol:2,vol:2,dragon:2,acier:.5},
  combat:{normal:2,glace:2,poison:.5,vol:.5,psy:.5,insecte:.5,roche:2,spectre:.25,tenebres:2,acier:2,fee:.5},
  poison:{plante:2,poison:.5,sol:.5,roche:.5,spectre:.5,acier:.25,fee:2},
  sol:{feu:2,electrik:2,plante:.5,poison:2,vol:.25,insecte:.5,roche:2,acier:2},
  vol:{electrik:.5,plante:2,combat:2,insecte:2,roche:.5,acier:.5},
  psy:{combat:2,poison:2,psy:.5,tenebres:.25,acier:.5},
  insecte:{feu:.5,plante:2,combat:.5,poison:.5,vol:.5,psy:2,spectre:.5,tenebres:2,acier:.5,fee:.5},
  roche:{feu:2,glace:2,combat:.5,sol:.5,vol:2,insecte:2,acier:.5},
  spectre:{normal:.25,psy:2,spectre:2,tenebres:.5},
  dragon:{dragon:2,acier:.5,fee:.25},
  tenebres:{combat:.5,psy:2,spectre:2,tenebres:.5,fee:.5},
  acier:{feu:.5,eau:.5,electrik:.5,glace:2,roche:2,acier:.5,fee:2},
  fee:{feu:.5,combat:2,poison:.5,dragon:2,tenebres:2,acier:.5},
};
const eff = (atk, defTypes) => defTypes.reduce((m, t) => m * (CHART[atk][t] ?? 1), 1);

// Une attaque par type, qui change de nom et grandit avec la puissance du Pokémon (palier 1 à 3).
const MOVES = {
  normal:  { kind:"melee",  cd:1.1, pow:1.0, names:["Charge","Bélier","Ultralaser"] },
  feu:     { kind:"fire",   cd:1.3, pow:1.1, names:["Flammèche","Lance-Flammes","Déflagration"] },
  eau:     { kind:"jet",    cd:1.0, pow:0.9, names:["Pistolet à O","Vibraqua","Hydrocanon"] },
  plante:  { kind:"orbit",  cd:4.0, pow:0.7, names:["Tranch'Herbe","Feuille Magik","Tempête Verte"] },
  electrik:{ kind:"chain",  cd:1.4, pow:0.9, names:["Éclair","Tonnerre","Fatal-Foudre"] },
  glace:   { kind:"spread", cd:1.5, pow:0.6, names:["Poudreuse","Laser Glace","Blizzard"] },
  combat:  { kind:"punch",  cd:0.9, pow:1.5, names:["Poing-Karaté","Casse-Brique","Close Combat"] },
  poison:  { kind:"puddle", cd:2.2, pow:0.45,names:["Dard-Venin","Bomb-Beurk","Détricanon"] },
  sol:     { kind:"ring",   cd:2.4, pow:1.2, names:["Piétisol","Telluriforce","Séisme"] },
  vol:     { kind:"boomer", cd:1.6, pow:0.9, names:["Tornade","Aéropique","Rapace"] },
  psy:     { kind:"aura",   cd:1.8, pow:1.0, names:["Choc Mental","Rafale Psy","Psyko"] },
  insecte: { kind:"sting",  cd:0.45,pow:0.45,names:["Dard-Nuée","Plaie-Croix","Bourdon"] },
  roche:   { kind:"rocks",  cd:1.8, pow:1.3, names:["Jet-Pierres","Éboulement","Lame de Roc"] },
  spectre: { kind:"homing", cd:1.4, pow:1.0, names:["Ombre Portée","Ball'Ombre","Revenant"] },
  dragon:  { kind:"beam",   cd:2.0, pow:1.6, names:["Draco-Rage","Draco-Souffle","Draco-Météore"] },
  tenebres:{ kind:"bite",   cd:0.8, pow:1.2, names:["Morsure","Mâchouille","Vibrobscur"] },
  acier:   { kind:"steel",  cd:5.0, pow:0.8, names:["Griffe Acier","Tête de Fer","Luminocanon"] },
  fee:     { kind:"heart",  cd:1.3, pow:0.9, names:["Voix Enjôleuse","Éclat Magique","Pouvoir Lunaire"] },
};
const tierOf = s => s.bst < 340 ? 1 : s.bst < 470 ? 2 : 3;
const moveOf = m => { const s = D[m.sp]; const t = s.types[0]; return { type:t, ...MOVES[t], tier:tierOf(s), name:MOVES[t].names[tierOf(s)-1] }; };

// ---------- Sprites ----------
const atlas = new Image();
atlas.src = ATLAS_SRC;
function drawMini(cv, id, size) {
  const r = D[id].r, c = cv.getContext("2d");
  cv.width = size; cv.height = size;
  c.imageSmoothingEnabled = false;
  const k = Math.min(size / r[2], size / r[3]);
  const draw = () => { c.clearRect(0,0,size,size); c.drawImage(atlas, r[0], r[1], r[2], r[3], (size - r[2]*k)/2, (size - r[3]*k)/2, r[2]*k, r[3]*k); };
  atlas.complete ? draw() : atlas.addEventListener("load", draw, { once:true });
  return cv;
}
const mini = (id, size) => drawMini(document.createElement("canvas"), id, size);
const typeChips = types => `<div class="types">${types.map(t => `<span class="type" style="background:${TYPE_COL[t]}">${TYPE_FR[t]}</span>`).join("")}</div>`;

// ---------- Utilitaires ----------
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => (a.x-b.x)**2 + (a.y-b.y)**2;
function weighted(items, wf) {
  let tot = 0; const ws = items.map(i => { const w = wf(i); tot += w; return w; });
  let r = Math.random() * tot;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length-1];
}
// Fait évoluer une espèce autant que le niveau le permet (branche au hasard, ex. Évoli).
function evolveTo(id, lvl) {
  let s = D[id];
  for (;;) {
    const ok = s.kids.map(k => D[k]).filter(k => lvl >= k.evoLvl);
    if (!ok.length) return s.id;
    s = pick(ok);
  }
}
const fmtTime = t => `${String(Math.floor(t/60)).padStart(2,"0")}:${String(Math.floor(t%60)).padStart(2,"0")}`;
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// ---------- Courbes ----------
const pokeNeed = l => Math.floor(6 + l * 2.6);         // XP pour passer un niveau Pokémon
const trainerNeed = l => Math.floor(5 + l * 3.2 + l*l*0.08); // XP pour une carte

// ---------- État ----------
const cv = $("game"), ctx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1, ZOOM = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  ZOOM = clamp(Math.min(W, H) / 720, 0.62, 1.15);
}
addEventListener("resize", resize); resize();

let G = null; // partie en cours
const STARTERS = [1,4,7,25,152,155,158,252,255,258,387,390,393];

function newGame(starterId) {
  const s = D[starterId];
  G = {
    t:0, kills:0, paused:false, over:false, pendingLevels:0,
    trainer:{ lvl:1, xp:0 },
    player:{ x:0, y:0, vx:0, vy:0, hp:0, maxHp:0, inv:0, speed:150, regen:0.6, magnet:70, row:0, flip:1, at:0, moving:false },
    team:[], enemies:[], shots:[], gems:[], fx:[], nums:[], zones:[], trail:[],
    spawnAcc:0, nextBoss:240, berries:[],
  };
  addMember(starterId, 5);
  const p = G.player; p.maxHp = 70 + s.hp; p.hp = p.maxHp;
  for (let i = 0; i < 60; i++) G.trail.push({ x:0, y:0 });
  $("startScreen").hidden = true; $("hud").hidden = false; $("team").hidden = false; $("overScreen").hidden = true;
  renderTeam();
}
function addMember(id, lvl) {
  const m = { sp:id, lvl, xp:0, cd:rand(0.2, 0.8), dmgMul:1, rateMul:1, x:G.player.x, y:G.player.y, flash:0, row:0, flip:1, at:Math.random(), moving:false };
  G.team.push(m);
  return m;
}

// ---------- Entrées ----------
const keys = {};
addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === "Escape" || e.key.toLowerCase() === "p") togglePause();
  if (!$("levelScreen").hidden && ["1","2","3"].includes(e.key)) { const b = $("cards").children[+e.key-1]; b && b.click(); }
});
addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
const joy = { on:false, id:null, sx:0, sy:0, x:0, y:0 };
cv.addEventListener("pointerdown", e => { joy.on = true; joy.id = e.pointerId; joy.sx = joy.x = e.clientX; joy.sy = joy.y = e.clientY; cv.setPointerCapture(e.pointerId); });
cv.addEventListener("pointermove", e => { if (joy.on && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
const joyEnd = e => { if (e.pointerId === joy.id) joy.on = false; };
cv.addEventListener("pointerup", joyEnd); cv.addEventListener("pointercancel", joyEnd);
function inputDir() {
  let x = 0, y = 0;
  if (keys.arrowleft || keys.a || keys.q) x -= 1;
  if (keys.arrowright || keys.d) x += 1;
  if (keys.arrowup || keys.w || keys.z) y -= 1;
  if (keys.arrowdown || keys.s) y += 1;
  if (joy.on) { const dx = joy.x - joy.sx, dy = joy.y - joy.sy, l = Math.hypot(dx, dy); if (l > 8) { const k = Math.min(1, l / 50); x = dx / l * k; y = dy / l * k; } }
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  return { x, y };
}

// ---------- Grille spatiale ----------
const CELL = 64; let grid = new Map();
function buildGrid() {
  grid = new Map();
  for (const e of G.enemies) { const k = ((e.x/CELL)|0) + "," + ((e.y/CELL)|0); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(e); }
}
function near(x, y, r, fn) {
  const x0 = Math.floor((x-r)/CELL), x1 = Math.floor((x+r)/CELL), y0 = Math.floor((y-r)/CELL), y1 = Math.floor((y+r)/CELL);
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const a = grid.get(i+","+j); if (a) for (const e of a) if (!e.dead) fn(e); }
}
function nearest(x, y, maxR, skip) {
  let best = null, bd = maxR*maxR;
  for (const e of G.enemies) { if (e.dead || (skip && skip.has(e))) continue; const d = (e.x-x)**2 + (e.y-y)**2; if (d < bd) { bd = d; best = e; } }
  return best;
}

// ---------- Ennemis ----------
const enemyLevel = () => Math.floor(2 + G.t / 60 * 3.2);
function spawnEnemy(boss) {
  const lvl = enemyLevel();
  const id = boss ? pick(LEGENDS).id : evolveTo(pick(ROOTS).id, lvl + Math.floor(rand(-3, 3)));
  const s = D[id];
  const a = Math.random() * Math.PI * 2, R = Math.hypot(W, H) / ZOOM / 2 + 60;
  const hp = (8 + s.hp * 0.22) * (1 + lvl * 0.16) * (boss ? 40 : 1) * (1 + G.t / 900);
  G.enemies.push({ sp:id, x:G.player.x + Math.cos(a)*R, y:G.player.y + Math.sin(a)*R, hp, max:hp, lvl, boss:!!boss,
    speed: (boss ? 55 : 38 + Math.min(s.spe, 130) * 0.28) * rand(0.9, 1.1), dmg: (4 + lvl * 0.55) * (boss ? 2.5 : 1),
    kx:0, ky:0, slow:0, hit:0, row:0, flip:1, at:Math.random(), moving:true, scale: boss ? 1.8 : 0.9 + Math.min(s.bst, 600) / 2400 });
  if (boss) banner(`Un <em>${s.name}</em> sauvage apparaît !`);
}
function damage(e, raw, type, src) {
  if (e.dead) return;
  const m = eff(type, D[e.sp].types);
  const dmg = raw * m * rand(0.9, 1.1);
  e.hp -= dmg; e.hit = 0.12;
  if (G.nums.length < 70) G.nums.push({ x:e.x + rand(-6,6), y:e.y - 20, v:Math.round(dmg), m, life:0.7 });
  if (src && src.heal) G.player.hp = Math.min(G.player.maxHp, G.player.hp + 0.4);
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  e.dead = true; G.kills++;
  const v = e.boss ? 60 + e.lvl * 4 : 1 + Math.floor(e.lvl / 6);
  G.gems.push({ x:e.x, y:e.y, v, big:e.boss || v >= 5 });
  if (Math.random() < (e.boss ? 1 : 0.012)) G.berries.push({ x:e.x + 10, y:e.y });
  if (e.boss) { G.pendingLevels++; banner(`<em>${D[e.sp].name}</em> est K.O. ! Carte bonus.`); }
}
function knock(e, fx, fy, f) { const l = Math.hypot(fx, fy) || 1; e.kx += fx / l * f * (e.boss ? 0.15 : 1); e.ky += fy / l * f * (e.boss ? 0.15 : 1); }

// ---------- Attaques ----------
function power(m, mv) {
  const s = D[m.sp];
  return (3 + s.atk * 0.09) * (1 + m.lvl * 0.07) * mv.pow * (0.75 + mv.tier * 0.35) * m.dmgMul;
}
function fire(m) {
  const mv = moveOf(m), s = D[m.sp], dmg = power(m, mv), T = mv.tier, type = mv.type;
  const tgt = nearest(m.x, m.y, 340);
  const aimAt = (e, sp) => { const dx = e.x - m.x, dy = e.y - m.y, l = Math.hypot(dx, dy) || 1; return [dx/l*sp, dy/l*sp]; };
  switch (mv.kind) {
    case "melee": case "punch": case "bite": {
      const t = mv.kind === "bite" ? nearest(m.x, m.y, 170) : nearest(m.x, m.y, mv.kind === "punch" ? 95 : 110);
      if (!t) return false;
      const R = (mv.kind === "punch" ? 46 : 56) + T * 12;
      const cx = mv.kind === "bite" ? t.x : m.x + (t.x - m.x) * 0.6, cy = mv.kind === "bite" ? t.y : m.y + (t.y - m.y) * 0.6;
      near(cx, cy, R, e => { if ((e.x-cx)**2 + (e.y-cy)**2 < R*R) { const crit = mv.kind === "bite" && Math.random() < 0.25 ? 2 : 1; damage(e, dmg * crit, type); knock(e, e.x - m.x, e.y - m.y, mv.kind === "punch" ? 260 : 120); } });
      G.fx.push({ k:"slash", x:cx, y:cy, r:R, c:TYPE_COL[type], life:0.18, max:0.18 });
      return true;
    }
    case "fire": case "jet": case "homing": case "heart": {
      if (!tgt) return false;
      const n = mv.kind === "homing" || mv.kind === "heart" ? T : 1 + (T === 3 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const sp = mv.kind === "jet" ? 560 : mv.kind === "fire" ? 380 : 300;
        let [vx, vy] = aimAt(tgt, sp); const a = (i - (n-1)/2) * 0.25, c = Math.cos(a), si = Math.sin(a);
        [vx, vy] = [vx*c - vy*si, vx*si + vy*c];
        G.shots.push({ k:mv.kind, x:m.x, y:m.y, vx, vy, r: mv.kind === "fire" ? 8 + T*2 : mv.kind === "jet" ? 6 + T : 7 + T, dmg, type, life:1.6,
          pierce: mv.kind === "jet" ? 1 + T*2 : 1, boom: mv.kind === "fire" ? 34 + T*14 : 0, homing: mv.kind === "homing" || mv.kind === "heart", heal: mv.kind === "heart", hits:new Set() });
      }
      return true;
    }
    case "spread": case "sting": {
      if (!tgt) return false;
      const n = mv.kind === "spread" ? 3 + (T-1)*2 : T;
      const base = Math.atan2(tgt.y - m.y, tgt.x - m.x);
      for (let i = 0; i < n; i++) {
        const a = base + (n === 1 ? 0 : (i/(n-1) - 0.5) * (mv.kind === "spread" ? 0.9 : 0.35));
        const sp = mv.kind === "spread" ? 330 : 470;
        G.shots.push({ k:mv.kind, x:m.x, y:m.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r: mv.kind === "spread" ? 6 : 4, dmg, type, life:0.9, pierce:1, slow: mv.kind === "spread" ? 1.5 : 0, hits:new Set() });
      }
      return true;
    }
    case "orbit": case "steel": {
      const n = mv.kind === "orbit" ? 2 + T : 1 + T;
      for (let i = 0; i < n; i++) G.shots.push({ k:"orbit", owner:m, a: i / n * Math.PI * 2, R: mv.kind === "orbit" ? 58 + T*8 : 44 + T*6, spin: mv.kind === "orbit" ? 4 : 2.6,
        r: mv.kind === "orbit" ? 8 : 11, dmg, type, life: mv.kind === "orbit" ? 3 : 4.5, pierce:1e9, cdHit:new Map(), x:m.x, y:m.y, steel: mv.kind === "steel" });
      return true;
    }
    case "chain": {
      if (!tgt) return false;
      let cur = tgt, from = { x:m.x, y:m.y }; const done = new Set();
      for (let j = 0; j < 2 + T; j++) {
        if (!cur) break;
        damage(cur, dmg * (j ? 0.8 : 1), type); done.add(cur);
        G.fx.push({ k:"bolt", x1:from.x, y1:from.y, x2:cur.x, y2:cur.y, life:0.15, max:0.15 });
        from = cur; cur = nearest(cur.x, cur.y, 150, done);
      }
      return true;
    }
    case "puddle": {
      if (!tgt) return false;
      G.zones.push({ x:tgt.x, y:tgt.y, r: 36 + T*12, dmg: dmg, type, life: 2.6 + T*0.4, tick:0 });
      return true;
    }
    case "ring": {
      if (!nearest(m.x, m.y, 150 + T*30)) return false;
      G.fx.push({ k:"ring", x:m.x, y:m.y, r:0, R: 95 + T*30, c:TYPE_COL[type], life:0.4, max:0.4, dmg, type, hits:new Set() });
      return true;
    }
    case "aura": {
      if (!nearest(m.x, m.y, 85 + T*22)) return false;
      const R = 85 + T*22;
      near(m.x, m.y, R, e => { if (dist2(e, m) < R*R) { damage(e, dmg, type); knock(e, e.x - m.x, e.y - m.y, 90); } });
      G.fx.push({ k:"pulse", x:m.x, y:m.y, R, c:TYPE_COL[type], life:0.3, max:0.3 });
      return true;
    }
    case "boomer": {
      if (!tgt) return false;
      const [vx, vy] = aimAt(tgt, 420);
      G.shots.push({ k:"boomer", owner:m, x:m.x, y:m.y, vx, vy, r: 10 + T*3, dmg, type, life:2.2, pierce:1e9, back:false, travel:0, hits:new Set() });
      return true;
    }
    case "rocks": {
      if (!tgt) return false;
      const done = new Set([tgt]); let list = [tgt];
      for (let i = 1; i < T; i++) { const o = nearest(m.x + rand(-150,150), m.y + rand(-150,150), 260, done); if (o) { done.add(o); list.push(o); } }
      for (const e of list) G.fx.push({ k:"rock", x:e.x, y:e.y, r: 34 + T*6, life:0.45, max:0.45, dmg, type, hitDone:false });
      return true;
    }
    case "beam": {
      if (!tgt) return false;
      const a = Math.atan2(tgt.y - m.y, tgt.x - m.x), L = 420, w = 12 + T*6, ca = Math.cos(a), sa = Math.sin(a);
      for (const e of G.enemies) {
        if (e.dead) continue;
        const dx = e.x - m.x, dy = e.y - m.y, along = dx*ca + dy*sa, perp = Math.abs(-dx*sa + dy*ca);
        if (along > 0 && along < L && perp < w + 12) damage(e, dmg, type);
      }
      G.fx.push({ k:"beam", x:m.x, y:m.y, a, L, w, c:TYPE_COL[type], life:0.25, max:0.25 });
      return true;
    }
  }
  return false;
}

// ---------- XP, niveaux, évolution ----------
function gainXp(v) {
  for (const m of G.team) {
    m.xp += v;
    while (m.xp >= pokeNeed(m.lvl)) { m.xp -= pokeNeed(m.lvl); m.lvl++; checkEvo(m); }
  }
  const t = G.trainer; t.xp += v;
  while (t.xp >= trainerNeed(t.lvl)) { t.xp -= trainerNeed(t.lvl); t.lvl++; G.pendingLevels++; }
}
function checkEvo(m) {
  const s = D[m.sp];
  const ok = s.kids.map(k => D[k]).filter(k => m.lvl >= k.evoLvl);
  if (!ok.length) return;
  const n = pick(ok);
  const before = s.name; m.sp = n.id; m.flash = 1.2;
  if (G.team[0] === m) { const p = G.player, gain = n.hp - s.hp; p.maxHp += gain; p.hp += gain; }
  banner(`Quoi ? <em>${before}</em> évolue en <em>${n.name}</em> !`);
  checkEvo(m);
}
function levelUp(m, n) { for (let i = 0; i < n; i++) { m.xp = 0; m.lvl++; checkEvo(m); } }

// ---------- Cartes ----------
function offerPokemon() {
  const avg = Math.round(G.team.reduce((a, m) => a + m.lvl, 0) / G.team.length);
  const lvl = Math.max(5, avg - 2);
  const owned = new Set(G.team.map(m => rootOf(m.sp)));
  const pool = ROOTS.filter(s => !owned.has(s.id));
  const legOk = G.trainer.lvl >= 10 && Math.random() < 0.05;
  const root = legOk ? pick(LEGENDS.filter(s => !owned.has(rootOf(s.id)))) : weighted(pool, s => clamp(1.5 - s.bst / 450, 0.12, 1));
  return { id: evolveTo(root.id, lvl), lvl };
}
function makeCards() {
  const cards = [], used = new Set();
  const teamFull = G.team.length >= 6;
  const tries = ["poke","candy","dmg","rate","heal","speed","magnet","regen"];
  if (!teamFull && Math.random() < (G.team.length === 1 ? 0.85 : 0.45)) { cards.push({ k:"poke", ...offerPokemon() }); used.add("poke"); }
  while (cards.length < 3) {
    const k = weighted(tries, k => used.has(k) ? 0 : ({ poke:teamFull?0:0.5, candy:1.2, dmg:1, rate:1, heal: G.player.hp < G.player.maxHp*0.6 ? 0.8 : 0.25, speed:0.3, magnet:0.3, regen:0.3 })[k]);
    used.add(k);
    if (k === "poke") cards.push({ k, ...offerPokemon() });
    else if (["candy","dmg","rate"].includes(k)) cards.push({ k, m: pick(G.team) });
    else cards.push({ k });
  }
  return cards;
}
function cardHtml(c) {
  const B = document.createElement("button"); B.className = "card"; B.type = "button";
  let sprite = null, kind = "", title = "", desc = "";
  if (c.k === "poke") { const s = D[c.id]; sprite = c.id; kind = `<span class="k new">Nouveau Pokémon</span>`; title = `${s.name} <small>Nv. ${c.lvl}</small>`; desc = `${typeChips(s.types)}<span class="d">Rejoint ton équipe avec ${moveOf({ sp:c.id }).name}.</span>`; }
  else if (c.k === "candy") { sprite = c.m.sp; kind = `<span class="k">Super Bonbon</span>`; title = D[c.m.sp].name; desc = `<span class="d">+3 niveaux (Nv. ${c.m.lvl} → ${c.m.lvl + 3}).</span>`; }
  else if (c.k === "dmg") { sprite = c.m.sp; kind = `<span class="k">Attaque +</span>`; title = D[c.m.sp].name; desc = `<span class="d">${moveOf(c.m).name} fait 25 % de dégâts en plus.</span>`; }
  else if (c.k === "rate") { sprite = c.m.sp; kind = `<span class="k">Vitesse +</span>`; title = D[c.m.sp].name; desc = `<span class="d">${moveOf(c.m).name} se relance 15 % plus vite.</span>`; }
  else {
    const it = { heal:["Potion","Soigne 50 % des PV du starter et +10 PV max."], speed:["Poudre Vite","Le starter se déplace 10 % plus vite."], magnet:["Aimant","Ramasse l'XP de 40 % plus loin."], regen:["Restes","Le starter récupère des PV plus vite."] }[c.k];
    kind = `<span class="k">Objet</span>`; title = it[0]; desc = `<span class="d">${it[1]}</span>`; sprite = G.team[0].sp;
  }
  B.innerHTML = `${kind}<strong>${title}</strong>${desc}`;
  B.prepend(mini(sprite, 56));
  return B;
}
function applyCard(c) {
  const p = G.player;
  if (c.k === "poke") { addMember(c.id, c.lvl); banner(`<em>${D[c.id].name}</em> rejoint l'équipe !`); }
  if (c.k === "candy") levelUp(c.m, 3);
  if (c.k === "dmg") c.m.dmgMul *= 1.25;
  if (c.k === "rate") c.m.rateMul *= 0.85;
  if (c.k === "heal") { p.maxHp += 10; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5); }
  if (c.k === "speed") p.speed *= 1.1;
  if (c.k === "magnet") p.magnet *= 1.4;
  if (c.k === "regen") p.regen += 0.8;
  renderTeam();
}
function showLevel() {
  G.paused = true;
  const box = $("cards"); box.innerHTML = "";
  $("levelTitle").textContent = `Niveau ${G.trainer.lvl} : choisis une carte`;
  makeCards().forEach((c, i) => {
    const b = cardHtml(c);
    b.insertAdjacentHTML("beforeend", `<kbd>${i+1}</kbd>`);
    b.onclick = () => { applyCard(c); G.pendingLevels--; $("levelScreen").hidden = true; G.paused = false; };
    box.appendChild(b);
  });
  $("levelScreen").hidden = false;
  box.firstChild.focus({ preventScroll:true });
}

// ---------- Interface ----------
function renderTeam() {
  const el = $("team"); el.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const m = G.team[i];
    const d = document.createElement("div");
    if (!m) { d.className = "slot empty"; d.textContent = "—"; el.appendChild(d); continue; }
    d.className = "slot";
    d.innerHTML = `<b>${D[m.sp].name}</b><small>Nv. ${m.lvl} · ${moveOf(m).name}</small><div class="bar"><i style="width:${m.xp / pokeNeed(m.lvl) * 100}%"></i></div>`;
    d.prepend(mini(m.sp, 34));
    el.appendChild(d);
  }
}
let teamSig = "";
function updateHud() {
  const t = G.trainer;
  $("tLv").textContent = `Nv. ${t.lvl}`;
  $("tXp").style.width = `${t.xp / trainerNeed(t.lvl) * 100}%`;
  $("time").textContent = fmtTime(G.t);
  $("kills").textContent = `${G.kills} K.O.`;
  const sig = G.team.map(m => m.sp + ":" + m.lvl + ":" + Math.floor(m.xp / pokeNeed(m.lvl) * 10)).join("|");
  if (sig !== teamSig) { teamSig = sig; renderTeam(); }
}
let bannerT = 0;
function banner(html) { const b = $("banner"); b.innerHTML = html; b.hidden = false; b.style.opacity = 1; bannerT = 2.4; }
function teamCards(box) {
  box.innerHTML = "";
  for (const m of G.team) {
    const s = D[m.sp], mv = moveOf(m), nx = s.kids.map(k => D[k]);
    const B = document.createElement("div"); B.className = "card"; B.style.cursor = "default";
    B.innerHTML = `<span class="k">Nv. ${m.lvl}${m === G.team[0] ? " · Starter" : ""}</span><strong>${s.name}</strong>${typeChips(s.types)}<span class="d">${mv.name} (palier ${mv.tier}/3)${nx.length ? ` · évolue au Nv. ${Math.min(...nx.map(k => k.evoLvl))}` : ""}</span>`;
    B.prepend(mini(m.sp, 56));
    box.appendChild(B);
  }
}
function togglePause() {
  if (!G || G.over || !$("levelScreen").hidden) return;
  G.paused = !G.paused;
  $("pauseScreen").hidden = !G.paused;
  if (G.paused) teamCards($("pauseTeam"));
}
$("pauseBtn").onclick = togglePause;
$("resumeBtn").onclick = togglePause;
$("quitBtn").onclick = () => { $("pauseScreen").hidden = true; gameOver(); };
$("againBtn").onclick = () => { $("overScreen").hidden = true; showStart(); };
function gameOver() {
  G.over = true; G.paused = true;
  const best = store.get("ps-best", 0);
  if (G.t > best) store.set("ps-best", G.t);
  $("overTitle").textContent = `${D[G.team[0].sp].name} est K.O.`;
  $("overStats").innerHTML = `<div><span>Survie</span>${fmtTime(G.t)}</div><div><span>K.O.</span>${G.kills}</div><div><span>Niveau</span>${G.trainer.lvl}</div><div><span>Record</span>${fmtTime(Math.max(best, G.t))}</div>`;
  teamCards($("overTeam"));
  $("overScreen").hidden = false; $("hud").hidden = true; $("team").hidden = true;
}
function showStart() {
  const box = $("starters"); box.innerHTML = "";
  for (const id of STARTERS) {
    const b = document.createElement("button"); b.className = "pick"; b.type = "button";
    b.innerHTML = `<span>${D[id].name}</span>${typeChips(D[id].types)}`;
    b.prepend(mini(id, 64));
    b.onclick = () => newGame(id);
    box.appendChild(b);
  }
  const best = store.get("ps-best", 0);
  $("best").textContent = best ? `Record : ${fmtTime(best)} de survie.` : "";
  $("startScreen").hidden = false;
}

// ---------- Boucle ----------
// Oriente un sprite animé : rangée bas / haut / côté (la droite est le côté gauche retourné).
function face(o, dx, dy, dt) {
  const l = Math.hypot(dx, dy);
  o.moving = l > 0.15;
  if (!o.moving) return;
  if (Math.abs(dx) > Math.abs(dy) * 0.7) { o.row = 2; o.flip = dx > 0 ? -1 : 1; }
  else { o.row = dy > 0 ? 0 : 1; o.flip = 1; }
  o.at += dt;
}
function update(dt) {
  G.t += dt;
  const p = G.player, dir = inputDir();
  p.x += dir.x * p.speed * dt; p.y += dir.y * p.speed * dt;
  face(p, dir.x, dir.y, dt);
  p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  p.inv -= dt;

  // traînée suivie par l'équipe
  const last = G.trail[0];
  if (Math.hypot(p.x - last.x, p.y - last.y) > 5) { G.trail.unshift({ x:p.x, y:p.y }); G.trail.length = 60; }
  G.team.forEach((m, i) => {
    const tgt = i === 0 ? p : G.trail[Math.min(59, i * 7)];
    const ox = m.x, oy = m.y; m.x += (tgt.x - m.x) * Math.min(1, dt * (i ? 8 : 60)); m.y += (tgt.y - m.y) * Math.min(1, dt * (i ? 8 : 60));
    if (i === 0) { m.row = p.row; m.flip = p.flip; m.moving = p.moving; m.at = p.at; } else face(m, (m.x - ox) / dt / 120, (m.y - oy) / dt / 120, dt);
    m.flash = Math.max(0, m.flash - dt);
  });

  // apparitions
  const target = Math.min(320, 14 + G.t * 0.32);
  G.spawnAcc += dt * (2 + G.t / 25);
  while (G.spawnAcc > 1) { G.spawnAcc--; if (G.enemies.length < target) spawnEnemy(false); }
  if (G.t >= G.nextBoss) { G.nextBoss += 240; spawnEnemy(true); }

  buildGrid();
  // ennemis
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
    const sp = e.speed * (e.slow > 0 ? 0.55 : 1);
    e.x += (dx / l * sp + e.kx) * dt; e.y += (dy / l * sp + e.ky) * dt;
    e.kx *= 0.86; e.ky *= 0.86; e.slow -= dt; e.hit -= dt;
    face(e, dx, dy, dt * (e.slow > 0 ? 0.55 : 1));
    const rad = 14 * e.scale;
    near(e.x, e.y, rad, o => { if (o !== e) { const ox = e.x - o.x, oy = e.y - o.y, d = Math.hypot(ox, oy); if (d > 0 && d < rad) { e.x += ox / d * (rad - d) * 0.3; e.y += oy / d * (rad - d) * 0.3; } } });
    if (l < 16 + rad && p.inv <= 0) { p.hp -= e.dmg; p.inv = 0.45; if (p.hp <= 0) { gameOver(); return; } }
    if (l > 1600 && !e.boss) e.dead = true;
  }

  // attaques
  for (const m of G.team) {
    m.cd -= dt;
    if (m.cd <= 0) {
      const mv = moveOf(m), s = D[m.sp];
      if (fire(m)) m.cd = mv.cd * m.rateMul / (1 + Math.min(s.spe, 150) / 260); else m.cd = 0.15;
    }
  }

  // projectiles
  for (const s of G.shots) {
    s.life -= dt;
    if (s.k === "orbit") {
      s.a += s.spin * dt; s.x = s.owner.x + Math.cos(s.a) * s.R; s.y = s.owner.y + Math.sin(s.a) * s.R;
      near(s.x, s.y, s.r + 16, e => { const t = s.cdHit.get(e) || 0; if (G.t > t && dist2(e, s) < (s.r + 14) ** 2) { s.cdHit.set(e, G.t + 0.45); damage(e, s.dmg, s.type); knock(e, e.x - s.owner.x, e.y - s.owner.y, s.steel ? 160 : 60); } });
      continue;
    }
    if (s.homing) { const t = nearest(s.x, s.y, 260, s.hits); if (t) { const dx = t.x - s.x, dy = t.y - s.y, l = Math.hypot(dx, dy) || 1, sp = Math.hypot(s.vx, s.vy); s.vx += (dx/l*sp - s.vx) * Math.min(1, dt*5); s.vy += (dy/l*sp - s.vy) * Math.min(1, dt*5); } }
    if (s.k === "boomer") {
      s.travel += Math.hypot(s.vx, s.vy) * dt;
      if (!s.back && s.travel > 260) { s.back = true; s.hits.clear(); }
      if (s.back) { const dx = s.owner.x - s.x, dy = s.owner.y - s.y, l = Math.hypot(dx, dy) || 1; s.vx = dx/l*460; s.vy = dy/l*460; if (l < 20) s.life = 0; }
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
    near(s.x, s.y, s.r + 18, e => {
      if (s.pierce <= 0 || s.hits.has(e) || dist2(e, s) > (s.r + 13 * e.scale) ** 2) return;
      s.hits.add(e); s.pierce--;
      if (s.boom) { near(s.x, s.y, s.boom, o => { if (dist2(o, s) < s.boom ** 2) damage(o, s.dmg * (o === e ? 1 : 0.6), s.type); }); G.fx.push({ k:"pulse", x:s.x, y:s.y, R:s.boom, c:TYPE_COL.feu, life:0.25, max:0.25 }); }
      else damage(e, s.dmg, s.type, s);
      if (s.slow) e.slow = s.slow;
      knock(e, s.vx, s.vy, 50);
    });
    if (s.pierce <= 0) s.life = 0;
  }
  G.shots = G.shots.filter(s => s.life > 0);

  // zones et effets à retardement
  for (const z of G.zones) {
    z.life -= dt; z.tick -= dt;
    if (z.tick <= 0) { z.tick = 0.4; near(z.x, z.y, z.r, e => { if (dist2(e, z) < z.r * z.r) { damage(e, z.dmg, z.type); e.slow = 0.5; } }); }
  }
  G.zones = G.zones.filter(z => z.life > 0);
  for (const f of G.fx) {
    f.life -= dt;
    if (f.k === "ring") { const r0 = f.r; f.r = f.R * (1 - f.life / f.max); near(f.x, f.y, f.r + 10, e => { const d = Math.sqrt(dist2(e, f)); if (!f.hits.has(e) && d < f.r + 10 && d > r0 - 20) { f.hits.add(e); damage(e, f.dmg, f.type); knock(e, e.x - f.x, e.y - f.y, 180); } }); }
    if (f.k === "rock" && !f.hitDone && f.life < f.max * 0.3) { f.hitDone = true; near(f.x, f.y, f.r, e => { if (dist2(e, f) < f.r * f.r) damage(e, f.dmg, f.type); }); }
  }
  G.fx = G.fx.filter(f => f.life > 0);
  G.enemies = G.enemies.filter(e => !e.dead);

  // XP et baies
  for (const g of G.gems) {
    const d = Math.hypot(p.x - g.x, p.y - g.y);
    if (d < p.magnet || g.pull) { g.pull = true; const k = Math.min(1, dt * 9); g.x += (p.x - g.x) * k; g.y += (p.y - g.y) * k; }
    if (d < 18) { g.taken = true; gainXp(g.v); }
  }
  G.gems = G.gems.filter(g => !g.taken);
  if (G.gems.length > 350) { const a = G.gems.splice(0, 100); const v = a.reduce((s, g) => s + g.v, 0); G.gems.push({ x:a[0].x, y:a[0].y, v, big:true }); }
  for (const b of G.berries) if (Math.hypot(p.x - b.x, p.y - b.y) < 22) { b.taken = true; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3); banner(`Baie Oran : <em>+30 % PV</em>`); }
  G.berries = G.berries.filter(b => !b.taken);
  for (const n of G.nums) { n.life -= dt; n.y -= 30 * dt; }
  G.nums = G.nums.filter(n => n.life > 0);

  if (G.pendingLevels > 0 && !G.over) showLevel();
}

// ---------- Rendu ----------
// Sprites animés PMD SpriteCollab : ANIM[id] = [page, x, y, largeur, hauteur, décalage, durées en 1/60 s]
const animPages = ANIM_SRC.map(src => { const im = new Image(); im.src = src; return im; });
function drawSprite(id, o, x, y, scale, alpha, white) {
  const a = ANIM[id], img = animPages[a[0]], dur = a[6];
  let f = 0;
  if (o.moving) { const tot = dur.reduce((s, d) => s + d, 0); let t = Math.floor(o.at * 60) % tot; while (t >= dur[f]) { t -= dur[f]; f++; } }
  const sx = a[1] + f * a[3], sy = a[2] + o.row * a[4], w = a[3] * scale, h = a[4] * scale;
  ctx.save(); ctx.translate(x, y); ctx.scale(o.flip, 1);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(img, sx, sy, a[3], a[4], -w/2 + a[5] * scale, -h + 4, w, h);
  if (white) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.6; ctx.drawImage(img, sx, sy, a[3], a[4], -w/2 + a[5] * scale, -h + 4, w, h); }
  ctx.restore();
}
function shadow(x, y, w) { ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(x, y + 4, w, w * 0.35, 0, 0, Math.PI * 2); ctx.fill(); }
function drawGround(cx, cy) {
  const vw = W / ZOOM, vh = H / ZOOM, T = 96;
  const x0 = Math.floor((cx - vw/2) / T) - 1, y0 = Math.floor((cy - vh/2) / T) - 1;
  for (let i = x0; i < x0 + vw / T + 3; i++) for (let j = y0; j < y0 + vh / T + 3; j++) {
    const h = ((i * 73856093) ^ (j * 19349663)) >>> 0;
    ctx.fillStyle = (i + j) & 1 ? "#356b3b" : "#326537";
    ctx.fillRect(i*T, j*T, T, T);
    if (h % 5 === 0) { // touffe d'herbe haute
      ctx.fillStyle = "#29552e";
      const bx = i*T + (h % 50) + 10, by = j*T + ((h >> 8) % 50) + 20;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(bx + k*7, by + 14); ctx.lineTo(bx + k*7 + 3, by); ctx.lineTo(bx + k*7 + 6, by + 14); ctx.fill(); }
    } else if (h % 11 === 0) { ctx.fillStyle = (h >> 4) & 1 ? "#f2e9a0" : "#f6b4c6"; ctx.beginPath(); ctx.arc(i*T + (h % 70) + 10, j*T + ((h >> 6) % 70) + 10, 2.5, 0, Math.PI*2); ctx.fill(); }
  }
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (!G) { ctx.fillStyle = "#2f5a35"; ctx.fillRect(0, 0, W, H); return; }
  const p = G.player;
  ctx.setTransform(DPR*ZOOM, 0, 0, DPR*ZOOM, DPR*(W/2 - p.x*ZOOM), DPR*(H/2 - p.y*ZOOM));
  drawGround(p.x, p.y);

  for (const z of G.zones) { ctx.fillStyle = TYPE_COL[z.type] + "55"; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI*2); ctx.fill(); }
  for (const g of G.gems) { ctx.fillStyle = g.big ? "#ffd75e" : "#8fd3ff"; ctx.beginPath(); const r = g.big ? 7 : 4.5; ctx.moveTo(g.x, g.y - r); ctx.lineTo(g.x + r*0.7, g.y); ctx.lineTo(g.x, g.y + r); ctx.lineTo(g.x - r*0.7, g.y); ctx.fill(); }
  for (const b of G.berries) { ctx.fillStyle = "#3d7be0"; ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#6bbf3f"; ctx.fillRect(b.x - 1, b.y - 11, 3, 5); }

  // personnages triés par profondeur
  const list = [];
  for (const e of G.enemies) list.push([e.y, 0, e]);
  G.team.forEach((m, i) => list.push([m.y, 1, m, i]));
  list.sort((a, b) => a[0] - b[0]);
  for (const [, kind, o, i] of list) {
    if (kind === 0) {
      shadow(o.x, o.y, 12 * o.scale);
      drawSprite(o.sp, o, o.x, o.y, 1.5 * o.scale, 1, o.hit > 0);
      if (o.boss || o.hp < o.max) { const w = o.boss ? 70 : 24; ctx.fillStyle = "#0008"; ctx.fillRect(o.x - w/2, o.y + 8, w, 4); ctx.fillStyle = o.boss ? "#ff6b5e" : "#9be07a"; ctx.fillRect(o.x - w/2, o.y + 8, w * Math.max(0, o.hp / o.max), 4); }
    } else {
      shadow(o.x, o.y, 13);
      const blink = i === 0 && p.inv > 0 && Math.floor(G.t * 20) % 2;
      drawSprite(o.sp, o, o.x, o.y, i === 0 ? 1.9 : 1.6, blink ? 0.4 : 1, o.flash > 0 && Math.floor(o.flash * 10) % 2);
    }
  }
  // PV du starter
  const hpw = 46; ctx.fillStyle = "#000a"; ctx.fillRect(p.x - hpw/2, p.y + 10, hpw, 6);
  ctx.fillStyle = p.hp / p.maxHp > 0.3 ? "#7ccf6a" : "#ff6b5e"; ctx.fillRect(p.x - hpw/2 + 1, p.y + 11, (hpw - 2) * Math.max(0, p.hp / p.maxHp), 4);

  for (const s of G.shots) {
    ctx.fillStyle = TYPE_COL[s.type];
    if (s.k === "orbit") { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a * 2); ctx.fillStyle = s.steel ? "#c9cbe0" : TYPE_COL.plante; ctx.beginPath(); ctx.ellipse(0, 0, s.r, s.r * (s.steel ? 1 : 0.45), 0, 0, Math.PI*2); ctx.fill(); ctx.restore(); continue; }
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#ffffffaa"; ctx.beginPath(); ctx.arc(s.x - s.r*0.3, s.y - s.r*0.3, s.r*0.35, 0, Math.PI*2); ctx.fill();
  }
  for (const f of G.fx) {
    const a = Math.max(0, f.life / f.max);
    ctx.globalAlpha = a;
    if (f.k === "slash" || f.k === "pulse") { ctx.strokeStyle = f.c; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(f.x, f.y, (f.r || f.R) * (1.1 - a * 0.3), 0, Math.PI*2); ctx.stroke(); }
    if (f.k === "ring") { ctx.strokeStyle = f.c; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.stroke(); }
    if (f.k === "bolt") { ctx.strokeStyle = "#fff36b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); for (let k = 1; k < 5; k++) ctx.lineTo(f.x1 + (f.x2 - f.x1) * k/5 + rand(-8,8), f.y1 + (f.y2 - f.y1) * k/5 + rand(-8,8)); ctx.lineTo(f.x2, f.y2); ctx.stroke(); }
    if (f.k === "beam") { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.fillStyle = f.c; ctx.fillRect(0, -f.w, f.L, f.w*2); ctx.fillStyle = "#fff8"; ctx.fillRect(0, -f.w/3, f.L, f.w*0.66); ctx.restore(); }
    if (f.k === "rock") { const fall = Math.max(0, (f.life - f.max*0.3) / (f.max*0.7)); ctx.fillStyle = TYPE_COL.roche; ctx.beginPath(); ctx.arc(f.x, f.y - fall * 120, 10, 0, Math.PI*2); ctx.fill(); if (fall === 0) { ctx.strokeStyle = TYPE_COL.roche; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.stroke(); } }
    ctx.globalAlpha = 1;
  }
  ctx.font = "700 13px 'Pixelify Sans', monospace"; ctx.textAlign = "center";
  for (const n of G.nums) {
    ctx.globalAlpha = Math.min(1, n.life * 2);
    ctx.fillStyle = "#000"; ctx.fillText(n.v, n.x + 1, n.y + 1);
    ctx.fillStyle = n.m > 1 ? "#ffd75e" : n.m < 1 ? "#b9c2bd" : "#fff"; ctx.fillText(n.v, n.x, n.y);
  }
  ctx.globalAlpha = 1;
  // joystick
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (joy.on) { ctx.strokeStyle = "#fff6"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.sx, joy.sy, 50, 0, Math.PI*2); ctx.stroke(); const dx = joy.x - joy.sx, dy = joy.y - joy.sy, l = Math.min(50, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); ctx.fillStyle = "#fff8"; ctx.beginPath(); ctx.arc(joy.sx + Math.cos(a)*l, joy.sy + Math.sin(a)*l, 18, 0, Math.PI*2); ctx.fill(); }
}
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (G && !G.paused) { update(dt); updateHud(); }
  if (bannerT > 0) { bannerT -= dt; if (bannerT < 0.4) $("banner").style.opacity = Math.max(0, bannerT / 0.4); if (bannerT <= 0) $("banner").hidden = true; }
  render();
  requestAnimationFrame(frame);
}
addEventListener("visibilitychange", () => { if (document.hidden && G && !G.paused && !G.over) togglePause(); });
showStart();
requestAnimationFrame(frame);
