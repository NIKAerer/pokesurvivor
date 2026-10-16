"use strict";
// ---------- Monde : biomes procéduraux ----------
// Deux bruits lisses (température, humidité) décident du biome de chaque case de 32 px.
// Le sol et le décor sont dessinés une fois par morceau de 512 px puis gardés en cache.
const TILE = 32, CHUNK = 512;
function hash2(i, j, s) { let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * 0.65 + vnoise(x * 2.3, y * 2.3, s + 7) * 0.35;

const BIOMES = {
  prairie: { name:"Prairie", types:["normal","vol","electrik","fee","plante"], g1:"#5a9e4b", g2:"#54964a" },
  foret:   { name:"Forêt", types:["plante","insecte","poison","normal"], g1:"#3f7a3c", g2:"#3a7238" },
  plage:   { name:"Plage", types:["eau","sol","vol","roche"], g1:"#e6d39a", g2:"#dfca8e" },
  lac:     { name:"Lac", types:["eau","glace","dragon"], g1:"#4a8fd1", g2:"#4688cb" },
  montagne:{ name:"Montagne", types:["roche","sol","combat","acier","dragon"], g1:"#9a8a72", g2:"#92836b" },
  neige:   { name:"Neige", types:["glace","eau","psy","fee"], g1:"#e9f1f6", g2:"#dfe9f0" },
  desert:  { name:"Canyon", types:["feu","sol","roche","combat"], g1:"#d79a5c", g2:"#cf9255" },
  marais:  { name:"Marais", types:["spectre","tenebres","poison","psy"], g1:"#4b5a45", g2:"#45533f" },
};
function biomeAt(x, y) {
  const t = fbm(x / 2200, y / 2200, 11), m = fbm(x / 1700, y / 1700, 23);
  if (m > 0.7) return t < 0.4 ? "marais" : "lac";
  if (m > 0.64) return "plage";
  if (t < 0.3) return "neige";
  if (t > 0.68 && m < 0.42) return "desert";
  if (m < 0.33) return "montagne";
  if (m > 0.52) return "foret";
  return "prairie";
}
// Pokémon sauvages par biome : familles dont au moins un membre a un type du biome.
const familyTypes = {};
for (const s of ALL) { const r = rootOf(s.id); (familyTypes[r] ||= new Set()); s.types.forEach(t => familyTypes[r].add(t)); }
const BIOME_POOL = {};
for (const k in BIOMES) BIOME_POOL[k] = ROOTS.filter(s => BIOMES[k].types.some(t => familyTypes[s.id].has(t)));

// Petits dessins de décor (style pixel, coordonnées entières).
function px(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x | 0, y | 0, w, h); }
function tree(c, x, y, leaf, dark) { px(c, "#6b4a2b", x - 3, y - 6, 6, 12); c.fillStyle = dark; c.beginPath(); c.arc(x, y - 14, 15, 0, 7); c.fill(); c.fillStyle = leaf; c.beginPath(); c.arc(x - 3, y - 17, 11, 0, 7); c.fill(); px(c, "#ffffff22", x - 8, y - 24, 5, 3); }
function pine(c, x, y, snow) { px(c, "#5d4027", x - 2, y - 4, 5, 8); const g = snow ? "#2f6b55" : "#2d5e3a"; for (let k = 0; k < 3; k++) { c.fillStyle = g; c.beginPath(); c.moveTo(x - 13 + k * 3, y - 4 - k * 9); c.lineTo(x, y - 20 - k * 9); c.lineTo(x + 13 - k * 3, y - 4 - k * 9); c.fill(); if (snow) { c.fillStyle = "#f4f8fb"; c.beginPath(); c.moveTo(x - 6 + k * 2, y - 13 - k * 9); c.lineTo(x, y - 20 - k * 9); c.lineTo(x + 6 - k * 2, y - 13 - k * 9); c.fill(); } } }
function rock(c, x, y, col, s) { c.fillStyle = "#0003"; c.beginPath(); c.ellipse(x, y + 2, 10 * s, 4 * s, 0, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.moveTo(x - 10 * s, y); c.lineTo(x - 6 * s, y - 9 * s); c.lineTo(x + 4 * s, y - 11 * s); c.lineTo(x + 10 * s, y - 2 * s); c.lineTo(x + 7 * s, y + 2 * s); c.closePath(); c.fill(); px(c, "#ffffff33", x - 4 * s, y - 8 * s, 5 * s, 2); }
function tuft(c, x, y, col) { c.fillStyle = col; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + k * 5, y + 8); c.lineTo(x + k * 5 + 2, y); c.lineTo(x + k * 5 + 4, y + 8); c.fill(); } }
function flower(c, x, y, col) { px(c, col, x - 2, y, 2, 2); px(c, col, x + 2, y, 2, 2); px(c, col, x, y - 2, 2, 2); px(c, col, x, y + 2, 2, 2); px(c, "#ffe066", x, y, 2, 2); }
function cactus(c, x, y) { px(c, "#3f8a4a", x - 3, y - 20, 7, 22); px(c, "#3f8a4a", x - 10, y - 13, 5, 8); px(c, "#3f8a4a", x - 10, y - 13, 9, 3); px(c, "#3f8a4a", x + 6, y - 16, 5, 7); px(c, "#3f8a4a", x + 2, y - 11, 9, 3); px(c, "#ffffff22", x - 2, y - 18, 2, 16); }
function deadTree(c, x, y) { c.strokeStyle = "#2f2a2c"; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 22); c.moveTo(x, y - 14); c.lineTo(x - 9, y - 22); c.moveTo(x, y - 18); c.lineTo(x + 8, y - 27); c.stroke(); }

function drawChunk(cx, cy) {
  const cv = document.createElement("canvas"); cv.width = cv.height = CHUNK;
  const c = cv.getContext("2d"), ox = cx * CHUNK, oy = cy * CHUNK, n = CHUNK / TILE;
  const bio = [];
  for (let i = 0; i < n; i++) { bio[i] = []; for (let j = 0; j < n; j++) bio[i][j] = biomeAt(ox + i * TILE + 16, oy + j * TILE + 16); }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const B = BIOMES[bio[i][j]], gi = cx * n + i, gj = cy * n + j;
    px(c, (gi + gj) & 1 ? B.g1 : B.g2, i * TILE, j * TILE, TILE, TILE);
    // bord d'eau ou de sable plus clair contre les autres biomes
    const k = bio[i][j];
    if (k === "lac") { const r = hash2(gi, gj, 3); if (r < 0.3) px(c, "#ffffff40", i * TILE + r * 60, j * TILE + 10 + r * 30, 8, 2); if (r > 0.94) { c.fillStyle = "#4f9c4a"; c.beginPath(); c.arc(i * TILE + 16, j * TILE + 16, 6, 0.3, 6); c.fill(); } }
    if (k !== "lac") for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ni = i + di, nj = j + dj; const nb = ni >= 0 && nj >= 0 && ni < n && nj < n ? bio[ni][nj] : biomeAt(ox + ni * TILE + 16, oy + nj * TILE + 16); if (nb === "lac") px(c, "#efe2b0", i * TILE + (di > 0 ? TILE - 5 : 0), j * TILE + (dj > 0 ? TILE - 5 : 0), di ? 5 : TILE, dj ? 5 : TILE); }
  }
  // décor, trié de haut en bas pour que les objets se chevauchent bien
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = bio[i][j], gi = cx * n + i, gj = cy * n + j, r = hash2(gi, gj, 99), r2 = hash2(gi, gj, 5);
    const x = i * TILE + 6 + r2 * 20, y = j * TILE + 10 + r * 18;
    if (k === "prairie") { if (r < 0.03) tree(c, x, y, "#5fae4d", "#3f8a3a"); else if (r < 0.16) tuft(c, x, y, "#477f3a"); else if (r < 0.24) flower(c, x, y, r2 < 0.5 ? "#f6b4c6" : "#fff7e0"); }
    if (k === "foret") { if (r < 0.2) tree(c, x, y, "#4c9a45", "#2f6a31"); else if (r < 0.3) tuft(c, x, y, "#2f5f2c"); else if (r < 0.33) { px(c, "#e8e2d0", x, y - 3, 2, 4); c.fillStyle = "#d1453b"; c.beginPath(); c.arc(x + 1, y - 4, 4, Math.PI, 0); c.fill(); } }
    if (k === "plage") { if (r < 0.05) { c.fillStyle = "#f5eee0"; c.beginPath(); c.arc(x, y, 3, Math.PI, 0); c.fill(); } else if (r < 0.07) rock(c, x, y, "#b9ab90", 0.7); }
    if (k === "montagne") { if (r < 0.1) rock(c, x, y, "#7d7262", 1 + r2 * 0.6); else if (r < 0.18) px(c, "#00000022", x, y, 10 + r2 * 10, 2); }
    if (k === "neige") { if (r < 0.08) pine(c, x, y, true); else if (r < 0.13) rock(c, x, y, "#b7c9d6", 0.8); else if (r < 0.25) px(c, "#ffffff", x, y, 2, 2); }
    if (k === "desert") { if (r < 0.04) cactus(c, x, y); else if (r < 0.1) rock(c, x, y, "#a8683d", 0.9); else if (r < 0.16) px(c, "#00000018", x, y, 12, 2); }
    if (k === "marais") { if (r < 0.06) deadTree(c, x, y); else if (r < 0.14) { c.fillStyle = "#3b4a5a88"; c.beginPath(); c.ellipse(x, y, 12, 5, 0, 0, 7); c.fill(); } else if (r < 0.2) tuft(c, x, y, "#33402f"); else if (r < 0.22) px(c, "#b7f0a8aa", x, y, 2, 2); }
  }
  return cv;
}
const chunkCache = new Map();
function getChunk(cx, cy) {
  const key = cx + "," + cy;
  let ch = chunkCache.get(key);
  if (!ch) { ch = drawChunk(cx, cy); chunkCache.set(key, ch); if (chunkCache.size > 60) chunkCache.delete(chunkCache.keys().next().value); }
  return ch;
}
function drawWorld(camX, camY) {
  const vw = W / ZOOM, vh = H / ZOOM;
  const x0 = Math.floor((camX - vw / 2) / CHUNK), x1 = Math.floor((camX + vw / 2) / CHUNK);
  const y0 = Math.floor((camY - vh / 2) / CHUNK), y1 = Math.floor((camY + vh / 2) / CHUNK);
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) ctx.drawImage(getChunk(i, j), i * CHUNK, j * CHUNK);
}
// Point de départ : la prairie la plus proche de l'origine.
function startPoint() {
  for (let r = 0; r < 6000; r += 128) for (let a = 0; a < 6.28; a += 0.5) { const x = Math.cos(a) * r, y = Math.sin(a) * r; if (biomeAt(x, y) === "prairie") return { x, y }; }
  return { x:0, y:0 };
}
