"use strict";
// ---------- Sauvegarde ----------
const SAVE = Object.assign({ coins:0, tickets:10, unlocked:[1,4,7,25], shop:{}, best: store.get("ps-best", 0), starter:25 }, store.get("ps-save", {}));
const save = () => store.set("ps-save", SAVE);

// ---------- Boutique permanente (globale) ----------
const SHOP = [
  { k:"pv",      name:"PV max",            max:10, base:40,  d:l => `+${l*8} % de PV pour le starter` },
  { k:"atk",     name:"Attaque",           max:10, base:50,  d:l => `+${l*6} % de dégâts pour toute l'équipe` },
  { k:"vit",     name:"Vitesse d'attaque", max:10, base:50,  d:l => `Attaques ${l*4} % plus rapides` },
  { k:"dep",     name:"Déplacement",       max:5,  base:40,  d:l => `+${l*3} % de vitesse de marche` },
  { k:"regen",   name:"Régénération",      max:5,  base:60,  d:l => `+${(l*0.25).toFixed(2).replace(".", ",")} PV/s` },
  { k:"aimant",  name:"Aimant",            max:5,  base:30,  d:l => `+${l*12} % de portée de ramassage` },
  { k:"xp",      name:"Gain d'XP",         max:10, base:60,  d:l => `+${l*6} % d'XP` },
  { k:"piece",   name:"Pièces",            max:5,  base:80,  d:l => `+${l*10} % de pièces` },
  { k:"relance", name:"Relance de cartes", max:3,  base:150, d:l => `${l} relance${l > 1 ? "s" : ""} par partie` },
];
const shopLvl = k => SAVE.shop[k] || 0;
const shopCost = it => Math.round(it.base * Math.pow(1.6, shopLvl(it.k)));
function shopMods() {
  const l = shopLvl;
  return { hp:1 + l("pv")*0.08, dmg:1 + l("atk")*0.06, rate:1 / (1 + l("vit")*0.04), move:1 + l("dep")*0.03, regen:l("regen")*0.25,
    magnet:1 + l("aimant")*0.12, xp:1 + l("xp")*0.06, coin:1 + l("piece")*0.1, rerolls:l("relance") };
}
const TICKET_PRICE = 120;

// ---------- Gacha ----------
const famMax = {};
for (const s of ALL) { const r = rootOf(s.id); famMax[r] = Math.max(famMax[r] || 0, s.bst); }
const RARITY = [
  { k:"commun", name:"Commun", p:0.65, col:"#9db3a9", dupe:15 },
  { k:"rare", name:"Rare", p:0.25, col:"#6aa9ff", dupe:40 },
  { k:"epique", name:"Épique", p:0.09, col:"#c07cff", dupe:100 },
  { k:"legende", name:"Légendaire", p:0.01, col:"#ffd75e", dupe:300 },
];
const rarityOf = id => D[id].leg ? 3 : famMax[id] >= 520 ? 2 : famMax[id] >= 450 ? 1 : 0;
const GACHA_POOL = [[], [], [], []];
for (const s of ALL) if (!s.from) GACHA_POOL[rarityOf(s.id)].push(s.id);
function pull() {
  let r = Math.random(), t = 0;
  for (let i = 0; i < 4; i++) { r -= RARITY[i].p; if (r <= 0) { t = i; break; } t = i; }
  const id = pick(GACHA_POOL[t]);
  const isNew = !SAVE.unlocked.includes(id);
  if (isNew) SAVE.unlocked.push(id); else SAVE.coins += RARITY[t].dupe;
  return { id, t, isNew };
}

// ---------- Menus ----------
const MENU_TABS = ["play", "gacha", "shop", "types"];
function closeMenus() { $("menu").hidden = true; }
function showMenu(tab) {
  if (G) { G = null; $("hud").hidden = true; $("team").hidden = true; }
  $("menu").hidden = false;
  openTab(tab || "play");
}
function refreshWallet() {
  for (const el of document.querySelectorAll(".wallet-coins")) el.textContent = SAVE.coins;
  for (const el of document.querySelectorAll(".wallet-tickets")) el.textContent = SAVE.tickets;
  $("bestMenu").textContent = SAVE.best ? `Record : ${fmtTime(SAVE.best)}` : "Pas encore de record";
}
function openTab(tab) {
  for (const t of MENU_TABS) { $("tab-" + t).hidden = t !== tab; $("nav-" + t).setAttribute("aria-current", t === tab ? "page" : "false"); }
  refreshWallet();
  ({ play:renderPlay, gacha:renderGacha, shop:renderShop, types:renderTypes })[tab]();
}
for (const t of MENU_TABS) $("nav-" + t).onclick = () => openTab(t);

const statBar = (label, v, max) => `<div class="stat"><span>${label}</span><b>${v}</b><i><u style="width:${Math.min(100, v / max * 100)}%"></u></i></div>`;
function renderPlay() {
  if (!SAVE.unlocked.includes(SAVE.starter)) SAVE.starter = SAVE.unlocked[0];
  const s = D[SAVE.starter], sh = shopMods();
  const det = $("starterDetail");
  det.innerHTML = `<div class="sd-info"><span class="k">Ton partenaire</span><h2>${s.name}</h2>${typeChips(s.types)}
    <div class="stats-bars">${statBar("PV", Math.round((70 + s.hp) * sh.hp), 260)}${statBar("Attaque", s.atk, 150)}${statBar("Vitesse", s.spe, 150)}</div>
    <p class="help">Attaque : ${MOVES[s.types[0]].names[tierOf(s) - 1]} · ${s.kids.length ? `évolue au Nv. ${Math.min(...s.kids.map(k => D[k].evoLvl))}` : "n'évolue pas"}</p></div>`;
  det.prepend(mini(s.id, 96));
  const grid = $("starterGrid"); grid.innerHTML = "";
  const list = [...SAVE.unlocked].sort((a, b) => a - b);
  $("starterCount").textContent = `${list.length} / ${ALL.filter(x => !x.from).length} débloqués`;
  for (const id of list) {
    const b = document.createElement("button"); b.type = "button"; b.className = "pick sm" + (id === SAVE.starter ? " on" : "");
    b.title = D[id].name; b.innerHTML = `<span>${D[id].name}</span>`; b.prepend(mini(id, 48));
    b.onclick = () => { SAVE.starter = id; save(); renderPlay(); };
    grid.appendChild(b);
  }
}
$("launchBtn").onclick = () => newGame(SAVE.starter);

function renderGacha() {
  $("buy1").disabled = SAVE.coins < TICKET_PRICE;
  $("pull1").disabled = SAVE.tickets < 1;
  $("pull10").disabled = SAVE.tickets < 10;
  $("odds").innerHTML = RARITY.map((r, i) => `<span style="color:${r.col}">${r.name} ${Math.round(r.p * 100)} % · ${GACHA_POOL[i].length}</span>`).join("");
}
function doPull(n) {
  if (SAVE.tickets < n) return;
  SAVE.tickets -= n;
  const res = Array.from({ length:n }, pull);
  save(); refreshWallet(); renderGacha();
  const box = $("gachaResult"); box.innerHTML = "";
  const spin = mini(pick(GACHA_POOL[0]), 96); spin.className = "spin"; box.appendChild(spin);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let k = 0;
  const iv = setInterval(() => { drawMini(spin, pick(pick(GACHA_POOL)), 96); if (++k > (reduce ? 1 : 10)) { clearInterval(iv); show(); } }, 70);
  function show() {
    box.innerHTML = "";
    for (const r of res) {
      const R = RARITY[r.t], c = document.createElement("div"); c.className = "gcard"; c.style.borderColor = R.col;
      c.innerHTML = `<span class="k" style="color:${R.col}">${R.name}</span><strong>${D[r.id].name}</strong><span class="d">${r.isNew ? "Nouveau starter !" : `Déjà obtenu : +${R.dupe} ◎`}</span>`;
      c.prepend(mini(r.id, 64)); box.appendChild(c);
    }
  }
}
$("pull1").onclick = () => doPull(1);
$("pull10").onclick = () => doPull(10);
$("buy1").onclick = () => { if (SAVE.coins >= TICKET_PRICE) { SAVE.coins -= TICKET_PRICE; SAVE.tickets++; save(); refreshWallet(); renderGacha(); } };

function renderShop() {
  const box = $("shopList"); box.innerHTML = "";
  for (const it of SHOP) {
    const l = shopLvl(it.k), maxed = l >= it.max, cost = shopCost(it);
    const row = document.createElement("div"); row.className = "shop-row";
    row.innerHTML = `<div class="sr-txt"><strong>${it.name}</strong><span class="d">${l ? it.d(l) : "Pas encore amélioré"}${maxed ? "" : ` · niveau suivant : ${it.d(l + 1)}`}</span>
      <div class="pips">${Array.from({ length:it.max }, (_, i) => `<i class="${i < l ? "on" : ""}"></i>`).join("")}</div></div>`;
    const b = document.createElement("button"); b.type = "button"; b.className = "btn sm";
    b.textContent = maxed ? "Max" : `${cost} ◎`; b.disabled = maxed || SAVE.coins < cost;
    b.onclick = () => { if (SAVE.coins >= cost && !maxed) { SAVE.coins -= cost; SAVE.shop[it.k] = l + 1; save(); refreshWallet(); renderShop(); } };
    row.appendChild(b); box.appendChild(row);
  }
}

// ---------- Table des types ----------
const TYPES = Object.keys(TYPE_COL);
let typeSel = "feu";
function renderTypes() {
  const bar = $("typePick"); bar.innerHTML = "";
  for (const t of TYPES) {
    const b = document.createElement("button"); b.type = "button"; b.className = "type tbtn" + (t === typeSel ? " on" : "");
    b.style.background = TYPE_COL[t]; b.textContent = TYPE_FR[t];
    b.onclick = () => { typeSel = t; renderTypes(); };
    bar.appendChild(b);
  }
  const groups = [[4, "×4 · Très super efficace"], [2, "×2 · Super efficace"], [1, "×1 · Normal"], [0.5, "×½ · Pas très efficace"], [0.25, "×¼ · Presque sans effet"]];
  const by = new Map(groups.map(g => [g[0], []]));
  for (const s of ALL) { let m = eff(typeSel, s.types); if (m < 0.25) m = 0.25; if (m > 4) m = 4; by.get(m === 0.125 ? 0.25 : m)?.push(s); }
  const strong = TYPES.filter(t => (CHART[typeSel][t] ?? 1) > 1), weak = TYPES.filter(t => (CHART[typeSel][t] ?? 1) < 1);
  const chipsOr = l => l.length ? typeChips(l).replace('class="types"', 'class="types inline"') : "aucun type";
  $("typeSummary").innerHTML = `<p>Une attaque <b style="color:${TYPE_COL[typeSel]}">${TYPE_FR[typeSel]}</b> est super efficace contre ${chipsOr(strong)} et peu efficace contre ${chipsOr(weak)}.</p>`;
  const box = $("typeGroups"); box.innerHTML = "";
  for (const [m, label] of groups) {
    const list = by.get(m); if (!list.length) continue;
    const sec = document.createElement("section"); sec.className = "tgroup";
    sec.innerHTML = `<h3 class="${m > 1 ? "good" : m < 1 ? "bad" : ""}">${label} <small>${list.length} Pokémon</small></h3>`;
    const g = document.createElement("div"); g.className = "dex";
    for (const s of list) { const cv = mini(s.id, 36); cv.title = `${s.name} (${s.types.map(t => TYPE_FR[t]).join("/")})`; g.appendChild(cv); }
    sec.appendChild(g); box.appendChild(sec);
  }
}

// ---------- Pause : stats, objets et couverture de types ----------
function renderRunStats() {
  const p = G.player;
  const items = Object.entries(G.items).filter(([, v]) => v).map(([k, v]) => `${ITEMS[k].name}${ITEMS[k].max > 1 ? ` Nv. ${v}` : ""}`);
  $("runStats").innerHTML = `<div><span>PV</span>${Math.ceil(p.hp)} / ${p.maxHp}</div><div><span>Dégâts</span>×${G.mods.dmg.toFixed(2)}</div><div><span>Vitesse d'attaque</span>×${(1 / G.mods.rate).toFixed(2)}</div><div><span>Régén.</span>${p.regen.toFixed(1)} PV/s</div><div><span>Marche</span>${Math.round(p.speed)}</div><div><span>Pièces</span>${G.coins}</div>`;
  $("runItems").textContent = items.length ? `Objets : ${items.join(", ")}` : "Aucun objet pour l'instant.";
  const cover = new Set();
  const rows = G.team.map(m => { const t = moveOf(m).type, st = TYPES.filter(x => (CHART[t][x] ?? 1) > 1); st.forEach(x => cover.add(x)); return `<div class="cov"><b>${D[m.sp].name}</b>${typeChips([t])}<span class="d">super efficace contre</span>${typeChips(st)}</div>`; });
  const missing = TYPES.filter(t => !cover.has(t));
  $("pauseTypes").innerHTML = rows.join("") + `<p class="help">Types que ton équipe ne frappe pas en super efficace : ${missing.map(t => TYPE_FR[t]).join(", ") || "aucun, bravo !"}</p>`;
}
$("rerollBtn").onclick = () => { if (G.rerolls > 0) { G.rerolls--; showLevel(); } };

showMenu("play");
requestAnimationFrame(frame);
