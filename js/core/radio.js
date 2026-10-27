/* ============ radio.js — la radio YouTube de Nika ============
 * Dans Options > Son, on colle des liens YouTube (vidéos ou playlists).
 * Si la radio est activée, ils remplacent les thèmes synthétisés : un morceau
 * après l'autre, dans un ordre aléatoire. Les liens sont gardés dans le
 * navigateur (localStorage).
 *
 * Le lecteur est un <iframe> YouTube piloté par postMessage (enablejsapi=1),
 * sans charger de script externe. Il reste visible en petit dans un coin
 * (YouTube le demande, et sur iPhone il faut parfois le toucher pour lancer
 * le son) ; on peut le réduire.
 *
 *   G.Radio.add(texte) · remove(i) · next() · links · active()
 *   G.Radio.want(true|false)  appelé par G.Audio.music() : jouer ou se taire
 *   G.Radio.volume(0..1)      appelé par G.Audio (volume « Musique » / tout couper)
 */
G.Radio = (() => {
  const KEY = 'ps.radio';
  let opts = { on: true, shuffle: true, mini: innerHeight < 500, links: [] };
  try { Object.assign(opts, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* rien */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(opts)); } catch (e) { /* rien */ } };

  const ORIGIN = 'https://www.youtube.com';
  let box = null, frame = null, ready = false, queue = [];
  let wanted = false, playing = null, lastKey = null, bag = [], vol = 0.55;
  let title = '';
  const listeners = [];
  const changed = () => listeners.forEach(fn => { try { fn(); } catch (e) { /* rien */ } });

  /** Lit un lien YouTube : { v: id vidéo } ou { list: id playlist } (ou null). */
  function parse(s) {
    s = String(s).trim();
    if (/^[\w-]{11}$/.test(s)) return { v: s };
    let u;
    try { u = new URL(/^https?:/.test(s) ? s : 'https://' + s); } catch (e) { return null; }
    if (!/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(u.hostname)) return null;
    const list = u.searchParams.get('list');
    let v = u.searchParams.get('v');
    if (!v && u.hostname.endsWith('youtu.be')) v = u.pathname.slice(1);
    if (!v) { const m = u.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/); if (m) v = m[1]; }
    if (v && /^[\w-]{11}$/.test(v)) return list && !u.searchParams.get('index') && /playlist/.test(u.pathname) ? { list } : { v };
    if (list) return { list };
    return null;
  }
  const keyOf = l => l.v ? 'v:' + l.v : 'l:' + l.list;

  /** Ajoute un ou plusieurs liens (séparés par des espaces ou des retours à la ligne). */
  function add(text) {
    let n = 0;
    for (const s of String(text).split(/[\s,]+/)) {
      const l = s && parse(s);
      if (!l || opts.links.some(x => keyOf(x) === keyOf(l))) continue;
      opts.links.push(l); n++;
    }
    if (n) { save(); bag = []; G.Audio.refreshMusic(); changed(); }
    return n;
  }

  function remove(i) {
    const l = opts.links[i];
    if (!l) return;
    opts.links.splice(i, 1);
    save(); bag = [];
    if (playing && keyOf(playing) === keyOf(l)) { playing = null; if (wanted && active()) play(); }
    G.Audio.refreshMusic();
    changed();
  }

  const active = () => opts.on && opts.links.length > 0;

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
    if (d.event === 'onReady' || (!ready && d.event === 'infoDelivery')) {
      ready = true;
      const q = queue; queue = [];
      q.forEach(m => frame.contentWindow.postMessage(m, ORIGIN));
      applyVol();
      if (playing && playing.list && opts.shuffle) { cmd('setShuffle', [true]); cmd('playVideoAt', [0]); }
      if (wanted) cmd('playVideo'); else cmd('pauseVideo');
    }
    const info = d.info || {};
    const st = d.event === 'onStateChange' ? d.info : info.playerState;
    if (info.videoData && info.videoData.title && info.videoData.title !== title) { title = info.videoData.title; changed(); }
    // 0 = fini : vidéo seule -> morceau suivant ; une playlist avance toute seule (on boucle à la fin).
    if (st === 0 && wanted) { if (playing && playing.list) cmd('playVideoAt', [0]); else next(); }
    if (d.event === 'onError' && wanted && opts.links.length > 1) setTimeout(next, 500);
  });

  function ensureBox() {
    if (box) return;
    box = document.createElement('div');
    box.id = 'radio-box';
    box.innerHTML = `<div class="radio-bar"><span id="radio-title" translate="no"></span><button class="radio-mini" title="Réduire"></button></div><div class="radio-frame"></div>`;
    document.body.appendChild(box);
    box.querySelector('.radio-mini').onclick = () => { opts.mini = !opts.mini; save(); layout(); };
    layout();
  }
  function layout() {
    if (!box) return;
    box.classList.toggle('mini', !!opts.mini);
    box.classList.toggle('hidden', !wanted);
    box.querySelector('.radio-mini').textContent = opts.mini ? '+' : '–';
    box.querySelector('#radio-title').textContent = opts.mini ? '' : title;
  }

  /** Prochain lien : « sac » mélangé, pour tout entendre avant de répéter. */
  function pick() {
    if (!bag.length) {
      bag = opts.links.slice();
      if (opts.shuffle) {
        for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
        if (bag.length > 1 && keyOf(bag[0]) === lastKey) bag.push(bag.shift());
      }
    }
    return bag.shift();
  }

  function play() {
    if (!opts.links.length) return;
    ensureBox();
    const l = pick();
    playing = l; lastKey = keyOf(l); title = '';
    const q = 'enablejsapi=1&autoplay=1&playsinline=1&rel=0&origin=' + encodeURIComponent(location.origin);
    const src = l.v ? `${ORIGIN}/embed/${l.v}?${q}` : `${ORIGIN}/embed/videoseries?list=${encodeURIComponent(l.list)}&${q}`;
    ready = false; queue = [];
    const holder = box.querySelector('.radio-frame');
    holder.innerHTML = '';
    frame = document.createElement('iframe');
    frame.allow = 'autoplay; encrypted-media';
    frame.title = 'Radio';
    frame.src = src;
    // Le lecteur ne parle qu'une fois qu'on l'écoute.
    frame.onload = () => { try { frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'ps-radio', channel: 'widget' }), ORIGIN); } catch (e) { /* rien */ } };
    holder.appendChild(frame);
    layout();
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
    if (!wanted) {
      if (frame) cmd('pauseVideo');
      layout();
      return;
    }
    if (!playing || !frame) play();
    else { cmd('playVideo'); layout(); }
  }

  function next() { if (!active()) return; play(); }

  function stopAll() {
    wanted = false; playing = null;
    if (box) { box.remove(); box = null; frame = null; ready = false; }
  }

  return {
    add, remove, next, want, active, volume, parse,
    get links() { return opts.links; },
    get title() { return title; },
    get on() { return opts.on; },
    set on(v) { opts.on = !!v; save(); bag = []; if (!opts.on) stopAll(); G.Audio.refreshMusic(); changed(); },
    get shuffle() { return opts.shuffle; },
    set shuffle(v) { opts.shuffle = !!v; save(); bag = []; changed(); },
    onChange(fn) { listeners.push(fn); }
  };
})();
