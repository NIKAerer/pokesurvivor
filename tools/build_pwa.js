/* build_pwa.js — fabrique l'appli iPhone (PWA) de Nika, publiée sur GitHub Pages.
 *   python3 tools/pack_sprites.py build      (planches de sprites)
 *   node tools/build_artifact.js build       (page du lien Claude)
 *   node tools/build_pwa.js                  (-> build/pwa/)
 *
 * Reprend build/pokesurvivor-nika.html et l'habille en vraie page :
 * <head> avec manifeste, icônes iOS et plein écran, plus un service worker
 * (sw.js) qui garde le jeu et les sprites en cache pour jouer hors ligne.
 * Le nom du cache change à chaque version : l'appli se met à jour seule.
 * .github/workflows/pages.yml lance tout ça à chaque push sur main.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const OUT = path.join(BUILD, 'pwa');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'sprites'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });

const files = [];
const copy = (from, to) => { fs.copyFileSync(from, path.join(OUT, to)); files.push(to); };

for (const f of fs.readdirSync(path.join(BUILD, 'sprites')).sort()) copy(path.join(BUILD, 'sprites', f), 'sprites/' + f);
for (const f of ['icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) copy(path.join(ROOT, 'assets/icons', f), 'icons/' + f);
copy(path.join(ROOT, 'favicon.ico'), 'favicon.ico');

const manifest = {
  name: 'PokéSurvivor de Nika',
  short_name: 'PokéSurvivor',
  lang: 'fr',
  start_url: './',
  scope: './',
  display: 'fullscreen',
  orientation: 'landscape',
  background_color: '#0b1020',
  theme_color: '#0b1020',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
files.push('manifest.webmanifest');

const game = fs.readFileSync(path.join(BUILD, 'pokesurvivor-nika.html'), 'utf8');
const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="PokéSurvivor">
<style>html,body{margin:0;background:#0b1020;overscroll-behavior:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}</style>
${game}
<script>
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  // Nouvelle version installée pendant que l'appli tourne : on recharge dès qu'on est au menu.
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) return;
    const t = setInterval(() => { if (window.G && G.Game && G.Game.state === 'ui') { clearInterval(t); location.reload(); } }, 2000);
  });
  // Au retour dans l'appli, on regarde s'il y a une nouvelle version.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
  });
}
// Garde la sauvegarde même si iOS manque de place.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
</script>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), page);
files.push('index.html');

const hash = crypto.createHash('sha1');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(OUT, f)));
const version = hash.digest('hex').slice(0, 12);
const precache = ['./', ...files.filter(f => f !== 'index.html')];

fs.writeFileSync(path.join(OUT, 'sw.js'), `/* sw.js — généré par tools/build_pwa.js, ne pas modifier. */
const CACHE = 'pokesurvivor-${version}';
const FILES = ${JSON.stringify(precache)};

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // La page : réseau d'abord (nouvelle version dès qu'il y a du réseau), cache sinon.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put('./', copy));
      return r;
    }).catch(() => caches.match('./')));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
`);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const size = files.reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log('pwa :', (size / 1e6).toFixed(1), 'Mo ·', files.length, 'fichiers · version', version);
