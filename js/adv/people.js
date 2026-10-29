/* ============ people.js — les personnages de l'Aventure (version de Nika) ============
 * Petits dresseurs en pixel art dessinés à la main (16 × 21 pixels d'art, 2 px
 * du monde par pixel, comme les sprites des Pokémon). Trois vues : face, dos,
 * profil (la gauche est le profil retourné), et un pas sur deux pour marcher.
 * Chaque personnage = une palette : h casquette/cheveux du dessus, w logo,
 * b visière, k cheveux, s peau, e yeux, v veste, c t-shirt, g gants/mains,
 * p pantalon, o chaussures.
 */
G.People = (() => {
  const FRONT = [
    '.....hhhhhh.....',
    '...hhhhhhhhhh...',
    '...hhhwwwwhhh...',
    '..bbbbbbbbbbbb..',
    '..kssssssssssk..',
    '..kssessssessk..',
    '...ssssssssss...',
    '....ssssssss....',
    '...vvvccccvvv...',
    '..vvvvccccvvvv..',
    '.svvvvccccvvvvs.',
    '.svvvvccccvvvvs.',
    '.gvvvvccccvvvvg.',
    '..vvvvvvvvvvvv..',
    '...pppppppppp...',
    '...pppppppppp...',
    '...pppp..pppp...',
    '...pppp..pppp...',
    '...pppp..pppp...',
    '...oooo..oooo...',
    '..ooooo..ooooo..'
  ];
  const BACK = [
    '.....hhhhhh.....',
    '...hhhhhhhhhh...',
    '...hhhhhhhhhh...',
    '..hhhhhhhhhhhh..',
    '..kkkkkkkkkkkk..',
    '..kkkkkkkkkkkk..',
    '...kkkkkkkkkk...',
    '....ssssssss....',
    '...vvvvvvvvvv...',
    '..vvvvvvvvvvvv..',
    '.svvvvvvvvvvvvs.',
    '.svvvvvvvvvvvvs.',
    '.gvvvvvvvvvvvvg.',
    '..vvvvvvvvvvvv..',
    '...pppppppppp...',
    '...pppppppppp...',
    '...pppp..pppp...',
    '...pppp..pppp...',
    '...pppp..pppp...',
    '...oooo..oooo...',
    '..ooooo..ooooo..'
  ];
  const SIDE = [
    '.....hhhhhh.....',
    '....hhhhhhhhh...',
    '....hhhhhhwwh...',
    '....hhhhhhhbbbb.',
    '....kkkssssss...',
    '....kkksssesss..',
    '....kkssssssss..',
    '.....sssssss....',
    '.....vvvvvcc....',
    '....vvvvvvcc....',
    '....vvsvvvcc....',
    '....vvsvvvcc....',
    '....vvgvvvvv....',
    '....vvvvvvvv....',
    '.....pppppp.....',
    '.....pppppp.....',
    '.....ppp.ppp....',
    '.....ppp.ppp....',
    '.....ppp.ppp....',
    '.....ooo.ooo....',
    '.....oooo.oooo..'
  ];

  const SKIN = '#f2c8a0';
  const LOOKS = {
    hero:    { h: '#d8282e', w: '#ffffff', b: '#a81a20', k: '#2a2030', s: SKIN, e: '#1a1a2a', v: '#2f5fd0', c: '#1a1a22', g: '#2c8a3a', p: '#3a4a8a', o: '#d83030' },
    chen:    { h: '#b8b8c0', w: '#b8b8c0', b: '#a0a0a8', k: '#b8b8c0', s: SKIN, e: '#1a1a2a', v: '#f4f4f4', c: '#c84030', g: SKIN, p: '#8a6a4a', o: '#5a3a2a' },
    mom:     { h: '#7a4a2a', w: '#7a4a2a', b: '#6a3a1a', k: '#7a4a2a', s: SKIN, e: '#1a1a2a', v: '#e05a8a', c: '#f6d0e0', g: SKIN, p: '#3a6ad0', o: '#f4f4f4' },
    rival:   { h: '#a06a3a', w: '#a06a3a', b: '#a06a3a', k: '#a06a3a', s: SKIN, e: '#1a1a2a', v: '#6a3a8a', c: '#1a1a22', g: SKIN, p: '#2a2a3a', o: '#6a4a2a' },
    joy:     { h: '#ff8ab8', w: '#ffffff', b: '#ff8ab8', k: '#ff8ab8', s: SKIN, e: '#2a4ab0', v: '#ffffff', c: '#ffb8d0', g: SKIN, p: '#ffffff', o: '#ffb8d0' },
    scout:   { h: '#e0b030', w: '#e0b030', b: '#c09020', k: '#4a2a1a', s: SKIN, e: '#1a1a2a', v: '#4a8a3a', c: '#f4e8c0', g: SKIN, p: '#c8a060', o: '#4a3a2a' },
    samurai: { h: '#9a9aa8', w: '#e0c040', b: '#7a7a88', k: '#2a2030', s: SKIN, e: '#1a1a2a', v: '#6a6a7a', c: '#2a3a6a', g: '#6a6a7a', p: '#2a3a6a', o: '#3a2a2a' },
    brock:   { h: '#3a2a1a', w: '#3a2a1a', b: '#3a2a1a', k: '#3a2a1a', s: '#c8905a', e: '#3a2a1a', v: '#3a6a3a', c: '#c87a3a', g: '#c8905a', p: '#6a5a3a', o: '#3a2a1a' },
    clerk:   { h: '#3a5ac8', w: '#ffffff', b: '#2a4ab0', k: '#4a3a2a', s: SKIN, e: '#1a1a2a', v: '#3a5ac8', c: '#ffffff', g: SKIN, p: '#3a3a4a', o: '#2a2a2a' },
    villager:{ h: '#6a4a8a', w: '#6a4a8a', b: '#6a4a8a', k: '#6a4a8a', s: SKIN, e: '#1a1a2a', v: '#e0a040', c: '#f4f4f4', g: SKIN, p: '#4a6a4a', o: '#3a2a2a' }
  };

  const cache = new Map();
  /** Une image (canvas) par personnage, vue et pas. */
  function frame(look, view, step) {
    const key = look + view + step;
    if (cache.has(key)) return cache.get(key);
    const pal = LOOKS[look] || LOOKS.villager;
    const rows = view === 'up' ? BACK : view === 'down' ? FRONT : SIDE;
    const c = document.createElement('canvas');
    c.width = 16; c.height = 22;
    const x = c.getContext('2d');
    rows.forEach((row, y) => {
      for (let i = 0; i < 16; i++) {
        const ch = row[i];
        if (ch === '.') continue;
        // Jambes : un pied se lève pendant le pas.
        let dy = 0;
        if (y >= 16 && step) dy = (i < 8) === (step === 1) ? -1 : 0;
        x.fillStyle = pal[ch] || '#ff00ff';
        x.fillRect(i, y + dy + 1, 1, 1);
      }
    });
    cache.set(key, c);
    return c;
  }

  /** Dessine un personnage, pieds en (x, y) (pixels du monde). dir : 'up' | 'down' | 'left' | 'right'. */
  function draw(ctx, look, x, y, dir = 'down', walkT = 0, moving = false) {
    const step = moving ? (Math.floor(walkT * 8) % 4 === 1 ? 1 : Math.floor(walkT * 8) % 4 === 3 ? 2 : 0) : 0;
    const view = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'side';
    const img = frame(look, view, step);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(x, y, 11, 4, 0, 0, 6.2832); ctx.fill();
    ctx.imageSmoothingEnabled = false;
    const bob = moving && step ? -1 : 0;
    if (dir === 'left') { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(img, -16, y - 44 + bob, 32, 44); }
    else ctx.drawImage(img, x - 16, y - 44 + bob, 32, 44);
    ctx.restore();
  }

  return { LOOKS, draw, frame };
})();
