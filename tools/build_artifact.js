/* build_artifact.js — fabrique la page du lien Claude (version de Nika).
 *   python3 tools/pack_sprites.py build      (planches de sprites, une fois)
 *   node tools/build_artifact.js build
 *
 * Écrit build/pokesurvivor-nika.html : le contenu de dev.html sans <html>/<head>/<body>
 * (le lien Claude les ajoute), avec le CSS, les polices et tous les scripts
 * copiés dedans. Les planches build/sprites/*.png sont publiées à côté.
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'build'));
const dev = fs.readFileSync(path.join(ROOT, 'dev.html'), 'utf8');

const head = dev.slice(dev.indexOf('<head>') + 6, dev.indexOf('</head>'));
let body = dev.slice(dev.indexOf('<body>') + 6, dev.indexOf('</body>'));

// CSS avec les polices en data: URI.
const css = [...head.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)">/g)].map(m => {
  let c = fs.readFileSync(path.join(ROOT, m[1]), 'utf8');
  return c.replace(/url\('\.\.\/(assets\/fonts\/[^']+\.ttf)'\)/g, (_, f) =>
    `url(data:font/ttf;base64,${fs.readFileSync(path.join(ROOT, f)).toString('base64')})`);
}).join('\n');

// Tous les scripts, dans l'ordre, plus la carte des planches après sprites-meta.js.
const BEGIN = '<!-- scripts:begin -->', END = '<!-- scripts:end -->';
const i = body.indexOf(BEGIN), j = body.indexOf(END) + END.length;
const files = [...body.slice(i, j).matchAll(/<script[^>]*src="(js\/[^"]+\.js)"/g)].map(m => m[1]);
let js = '';
for (const f of files) {
  js += `/* ${f} */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n;\n';
  if (f === 'js/data/sprites-meta.js') js += fs.readFileSync(path.join(OUT, 'sprite-atlas.js'), 'utf8') + '\n;\n';
}
js = js.replace(/<\/script/gi, '<\\/script');
body = body.slice(0, i) + `<script>\n${js}</script>` + body.slice(j);

const title = (head.match(/<title>[^<]*<\/title>/) || [''])[0];
const page = `${title}
<meta name="theme-color" content="#0b1020">
<style>
${css}
</style>
${body}`;
fs.writeFileSync(path.join(OUT, 'pokesurvivor-nika.html'), page);
console.log('page :', (page.length / 1e6).toFixed(2), 'Mo ·', files.length, 'scripts');
