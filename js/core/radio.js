/* ============ radio.js — la radio Pokémon de Nika ============
 * Remplace les thèmes synthétisés par les OST des jeux Pokémon (gen 1 à 4),
 * lues depuis YouTube : un jeu au hasard, un morceau au hasard, puis le suivant.
 * Pendant le jeu on n'entend que le son ; le lecteur et les réglages de la
 * radio apparaissent dans le menu Pause (Échap).
 *
 * Le lecteur est un <iframe> YouTube piloté par postMessage (enablejsapi=1),
 * sans script externe. Hors pause il est poussé hors de l'écran (pas caché :
 * un lecteur en display:none s'arrête) ; en pause il vient se poser sur la
 * case #radio-slot du menu.
 *
 *   G.Radio.want(true|false)  appelé par G.Audio.music() : jouer ou se taire
 *   G.Radio.volume(0..1)      appelé par G.Audio (volume « Musique » / tout couper)
 */
G.Radio = (() => {
  // Une « station » par jeu : playlists d'OST, et en secours une vidéo « OST complet »
  // (on y saute à un moment au hasard). Si une ne marche pas, on passe à une autre.
  const GAMES = [
    { id: 'rby',  name: 'Rouge / Bleu / Jaune',          src: [{ list: 'PL2uxd6YWj7PLbKlHSlTO7Lv4E6csDZhRc' }, { v: 'Jh3hvD9Csok' }] },
    { id: 'gsc',  name: 'Or / Argent / Cristal',         src: [{ list: 'PL2uxd6YWj7PKk4LnkWZEyqpcvnXmv8Iuf' }, { v: 'Uquvi61gm2E' }] },
    { id: 'rse',  name: 'Rubis / Saphir / Émeraude',     src: [{ list: 'PL2uxd6YWj7PIOlswxbt16G63Klr_3lsbR' }, { v: 'sEIkr0uS6Oc' }] },
    { id: 'frlg', name: 'Rouge Feu / Vert Feuille',      src: [{ list: 'PL2uxd6YWj7PIOaewo5Z39hSJMdUmo3taO' }, { v: 'MczxZGoNFng' }] },
    { id: 'dppt', name: 'Diamant / Perle / Platine',     src: [{ list: 'PL179D9EEB47465C35' }, { v: 'cO78s2g7Wag' }] },
    { id: 'hgss', name: 'HeartGold / SoulSilver',        src: [{ list: 'PL7907A37E9C7E4F7D' }, { v: '01hOXzryKb0' }] }
  ];

  const KEY = 'ps.radio';
  let opts = { on: true, off: [] };          // off : jeux retirés de la radio
  try { Object.assign(opts, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* rien */ }
  if (!Array.isArray(opts.off)) opts.off = [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(opts)); } catch (e) { /* rien */ } };

  const ORIGIN = 'https://www.youtube.com';
  let box = null, frame = null, ready = false, queue = [];
  let wanted = false, cur = null, vol = 0.55, title = '', lastGame = null;
  let jumped = false;                         // déjà sauté au hasard dans ce morceau / cette playlist
  const bad = new Set();                      // sources qui ont échoué pendant cette session
  const listeners = [];
  const changed = () => { layout(); listeners.forEach(fn => { try { fn(); } catch (e) { /* rien */ } }); };

  const games = () => GAMES.filter(g => !opts.off.includes(g.id));
  let dead = false;                           // plus rien ne marche (hors ligne, YouTube bloqué) : retour au synthé
  const active = () => opts.on && !dead && games().length > 0;
  const keyOf = s => s.v ? 'v:' + s.v : 'l:' + s.list;

  /** Prochaine source : un jeu au hasard (pas le même que juste avant), sa première source qui marche. */
  function pick() {
    let pool = games().filter(g => g.src.some(s => !bad.has(keyOf(s))));
    if (!pool.length) return null;
    if (pool.length > 1) pool = pool.filter(g => g.id !== lastGame);
    const g = pool[Math.floor(Math.random() * pool.length)];
    const s = g.src.find(x => !bad.has(keyOf(x))) || g.src[0];
    return { game: g, src: s };
  }

  // ---------------- lecteur ----------------
  function cmd(func, args = []) {
    const m = JSON.stringify({ event: 'command', func, args, id: 'ps-radio' });
    if (ready && frame && frame.contentWindow) frame.contentWindow.postMessage(m, ORIGIN);
    else queue.push(m);
  }

  addEventListener('message', e => {
    if (!frame || e.source !== frame.contentWindow) return;
    let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
    if (!d || !d.event) return;
    if (!ready && (d.event === 'onReady' || d.event === 'infoDelivery' || d.event === 'initialDelivery')) {
      ready = true; timeouts = 0;
      const q = queue; queue = [];
      q.forEach(m => frame.contentWindow.postMessage(m, ORIGIN));
      applyVol();
      cmd(wanted ? 'playVideo' : 'pauseVideo');
    }
    const info = d.info || {};
    if (info.videoData && info.videoData.title && info.videoData.title !== title) { title = info.videoData.title; changed(); }
    // Saut au hasard : dans une playlist, un morceau au hasard ; dans une longue vidéo, un moment au hasard.
    if (!jumped && cur) {
      if (cur.src.list && Array.isArray(info.playlist) && info.playlist.length > 1) {
        jumped = true; cmd('playVideoAt', [Math.floor(Math.random() * info.playlist.length)]);
      } else if (cur.src.v && info.duration > 600) {
        jumped = true; cmd('seekTo', [Math.floor(Math.random() * (info.duration - 300)), true]);
      }
    }
    const st = d.event === 'onStateChange' ? d.info : info.playerState;
    // 0 = morceau fini : on repart sur un autre jeu au hasard.
    if (st === 0 && wanted) next();
    if (d.event === 'onError') fail();
  });

  function ensureBox() {
    if (box) return;
    box = document.createElement('div');
    box.id = 'radio-box';
    document.body.appendChild(box);
    // Le menu Pause s'ouvre / se ferme : le lecteur le suit.
    const p = document.getElementById('scr-pause');
    if (p) new MutationObserver(layout).observe(p, { attributes: true, attributeFilter: ['class'] });
    addEventListener('resize', () => setTimeout(layout, 50));
  }

  let follow = 0;
  /** Pose le lecteur sur la case du menu Pause s'il est ouvert, sinon hors de l'écran. */
  function layout() {
    renderPause();
    if (!box) return;
    const slot = document.getElementById('radio-slot');
    const p = document.getElementById('scr-pause');
    const show = slot && p && !p.classList.contains('hidden') && frame;
    if (show) {
      // Suit la case à chaque image tant que la pause est ouverte (animation d'ouverture, défilement).
      box.classList.add('on');
      if (!follow) {
        const step = () => {
          const sl = document.getElementById('radio-slot');
          if (!box || !box.classList.contains('on') || !sl) { follow = 0; return; }
          const r = sl.getBoundingClientRect();
          // Case sortie de la zone visible du menu (téléphone, on fait défiler) : le lecteur s'écarte.
          const c = (sl.closest('.box') || document.body).getBoundingClientRect();
          const inside = r.top >= c.top && r.bottom <= c.bottom;
          Object.assign(box.style, { left: (inside ? r.left : -10000) + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
          follow = requestAnimationFrame(step);
        };
        follow = requestAnimationFrame(step);
      }
    } else {
      box.classList.remove('on');
      Object.assign(box.style, { left: '', top: '', width: '', height: '' });
    }
  }

  /** Cette source ne marche pas : on en essaie une autre ; si plus aucune, musiques du jeu. */
  function fail() {
    if (cur) bad.add(keyOf(cur.src));
    const left = games().some(g => g.src.some(x => !bad.has(keyOf(x))));
    if (!left) {
      dead = true; stopAll();
      G.Audio.refreshMusic();
      return;
    }
    if (wanted) setTimeout(next, 400);
  }

  let loadTimer = null, timeouts = 0;
  function play() {
    if (!active()) return;
    ensureBox();
    cur = pick();
    if (!cur) { fail(); return; }
    clearTimeout(loadTimer);
    // Pas de réponse du lecteur au bout de 10 s : hors ligne ou bloqué.
    // Deux fois de suite : on arrête d'essayer (c'est la connexion, pas la vidéo).
    loadTimer = setTimeout(() => { if (!ready && frame) { if (++timeouts >= 2) { dead = true; stopAll(); G.Audio.refreshMusic(); } else fail(); } }, 10000);
    lastGame = cur.game.id;
    title = ''; jumped = false;
    const q = 'enablejsapi=1&autoplay=1&playsinline=1&rel=0&origin=' + encodeURIComponent(location.origin);
    const s = cur.src;
    ready = false; queue = [];
    box.innerHTML = '';
    frame = document.createElement('iframe');
    frame.allow = 'autoplay; encrypted-media';
    frame.title = 'Radio Pokémon';
    frame.src = s.v ? `${ORIGIN}/embed/${s.v}?${q}` : `${ORIGIN}/embed/videoseries?list=${s.list}&${q}`;
    // Le lecteur ne parle qu'une fois qu'on l'écoute.
    frame.onload = () => { try { frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'ps-radio', channel: 'widget' }), ORIGIN); } catch (e) { /* rien */ } };
    box.appendChild(frame);
    changed();
  }

  function applyVol() {
    if (!frame) return;
    if (vol <= 0) cmd('mute'); else { cmd('unMute'); cmd('setVolume', [Math.round(vol * 100)]); }
  }
  function volume(v) { vol = v; if (ready) applyVol(); }

  /** true : une musique doit sonner (partie, menu) · false : silence. */
  function want(on) {
    wanted = !!on && active();
    if (!wanted) { if (frame) cmd('pauseVideo'); return; }
    if (!frame) play(); else cmd('playVideo');
  }

  function next() { if (active()) play(); }

  function stopAll() {
    wanted = false; cur = null; title = '';
    if (box) { box.innerHTML = ''; frame = null; ready = false; }
    changed();
  }

  // ---------------- menu Pause ----------------
  function renderPause() {
    const el = document.getElementById('pause-radio');
    if (!el) return;
    const p = document.getElementById('scr-pause');
    if (p && p.classList.contains('hidden')) return;
    const playing = opts.on && frame;
    const sig = [opts.on, dead, opts.off.join(), title, !!frame, cur && cur.game.id].join('|');
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig;
    el.innerHTML = `<div class="radio-head"><b>Radio Pokémon</b>
        <button class="btn small ${opts.on ? 'gold' : ''}" data-r="on">${opts.on ? 'Allumée' : 'Éteinte'}</button></div>`
      + (playing ? `<div class="radio-now"><div id="radio-slot"></div><div class="grow">
          <small>${esc(cur.game.name)}</small><b translate="no">${esc(title || 'Chargement…')}</b>
          <button class="btn small" data-r="next">Morceau suivant</button></div></div>` : '')
      + `<div class="chips radio-games">${GAMES.map(g => `<button class="chip ${opts.off.includes(g.id) ? '' : 'on'}" data-g="${g.id}">${esc(g.name)}</button>`).join('')}</div>`
      + (playing ? '<p class="note">Si rien ne sonne sur iPhone, touche le lecteur une fois.</p>'
         : opts.on && dead ? '<p class="note">YouTube ne répond pas (pas de connexion ?) : musiques du jeu en attendant. Rallume la radio pour réessayer.</p>' : '');
    el.querySelectorAll('[data-r=on]').forEach(b => { b.onclick = () => { setOn(!opts.on); }; });
    el.querySelectorAll('[data-r=next]').forEach(b => { b.onclick = () => { next(); }; });
    el.querySelectorAll('[data-g]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.g, i = opts.off.indexOf(id);
        if (i >= 0) opts.off.splice(i, 1);
        else if (games().length > 1) opts.off.push(id);        // au moins un jeu
        save();
        if (cur && opts.off.includes(cur.game.id)) next(); else changed();
      };
    });
    if (box) setTimeout(layout, 0);
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function setOn(v) {
    opts.on = !!v; save();
    if (opts.on) { dead = false; timeouts = 0; bad.clear(); }
    if (!opts.on) stopAll();
    G.Audio.refreshMusic();
    changed();
  }

  return {
    want, active, volume, next, GAMES,
    get title() { return title; },
    get game() { return cur && cur.game.name; },
    get on() { return opts.on; },
    set on(v) { setOn(v); },
    onChange(fn) { listeners.push(fn); }
  };
})();
