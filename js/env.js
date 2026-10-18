// DV56 MERCURY: the studio the chrome reflects. A 1024×512 equirectangular panorama painted once in Canvas2D.
// u = 0.5 is the room BEHIND the viewer (what a bead shows in its centre): a tall window wall with mullions and a desk
// edge; the ceiling carries two soft boxes and a dome light; a tall strip light on the left (the page's left glow)
// and a cool blue one on the right; the floor is the dark desk with the window's reflection. u = 0 / 1 (behind the
// bead, seen only at its rim) is darker, so every bead has a crisp silhouette.
// If a photographic panorama is supplied (assets/env/manifest.js → studio), app.js uses that instead.

export function paintStudio(theme = 'dark', W = 1024, H = 512) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const L = theme === 'light';
  const X = (u) => u * W, Y = (v) => v * H;

  // walls, ceiling, floor: a bright studio above the horizon, a dark desk below (the classic chrome read)
  let gr = g.createLinearGradient(0, 0, 0, H);
  if (L) { gr.addColorStop(0, '#f4f7fa'); gr.addColorStop(.25, '#dfe5eb'); gr.addColorStop(.47, '#b3bcc7'); gr.addColorStop(.5, '#6c737c'); gr.addColorStop(.7, '#4a5058'); gr.addColorStop(1, '#2c3036'); }
  else { gr.addColorStop(0, '#d9dfe6'); gr.addColorStop(.22, '#aeb7c2'); gr.addColorStop(.42, '#7a8593'); gr.addColorStop(.49, '#5d6876'); gr.addColorStop(.5, '#323a44'); gr.addColorStop(.7, '#1d2127'); gr.addColorStop(1, '#0e1013'); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);

  const glow = (u, v, rx, ry, col, a) => {
    g.save(); g.translate(X(u), Y(v)); g.scale(1, ry / rx);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, X(rx));
    rg.addColorStop(0, col.replace('A', a)); rg.addColorStop(1, col.replace('A', 0));
    g.fillStyle = rg; g.fillRect(-X(rx), -X(rx), X(rx) * 2, X(rx) * 2); g.restore();
  };
  const box = (u0, v0, u1, v1, fill, blur = 0, r = 6) => {
    g.save(); if (blur) g.filter = `blur(${blur}px)`;
    g.fillStyle = fill; g.beginPath(); g.roundRect(X(u0), Y(v0), X(u1 - u0), Y(v1 - v0), r); g.fill(); g.restore();
  };

  // dome light overhead
  glow(.5, 0, .6, .2, 'rgba(255,255,255,A)', L ? 1 : .85);
  // cool blue room light low right, a fainter one low left (the page's glows)
  glow(.7, .6, .2, .11, 'rgba(60,130,230,A)', L ? .45 : .7);
  glow(.3, .6, .14, .08, 'rgba(120,165,225,A)', .35);

  // the big key soft box above-left (the glint every bead carries), a second one right
  box(.28, .05, .47, .26, 'rgba(255,255,255,.75)', 16, 14);
  box(.30, .07, .45, .24, '#ffffff', 2, 8);
  box(.56, .1, .7, .24, 'rgba(255,255,255,.55)', 14, 12);
  box(.575, .115, .685, .225, '#f7fbff', 2, 6);

  // the window wall behind the viewer: wide bright panes with thin mullions, a transom, a soft skyline
  const wu0 = .34, wu1 = .66, wv0 = .3, wv1 = .488;
  box(wu0 - .015, wv0 - .02, wu1 + .015, wv1, 'rgba(225,238,255,.6)', 14, 4);
  gr = g.createLinearGradient(0, Y(wv0), 0, Y(wv1));
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(.6, '#e3edf8'); gr.addColorStop(1, '#a9bed6');
  g.fillStyle = gr; g.fillRect(X(wu0), Y(wv0), X(wu1 - wu0), Y(wv1 - wv0));
  g.fillStyle = 'rgba(92,110,132,.45)'; g.beginPath(); g.moveTo(X(wu0), Y(wv1));
  for (let i = 0; i <= 48; i++) { const u = wu0 + (wu1 - wu0) * i / 48; const h = .02 + .02 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .63)) + (i % 9 === 4 ? .018 : 0); g.lineTo(X(u), Y(wv1 - h)); }
  g.lineTo(X(wu1), Y(wv1)); g.closePath(); g.fill();
  g.fillStyle = L ? 'rgba(60,68,80,.85)' : 'rgba(40,46,56,.9)';
  for (let i = 0; i <= 3; i++) { const u = wu0 + (wu1 - wu0) * i / 3; g.fillRect(X(u) - 2, Y(wv0), 4, Y(wv1 - wv0)); }
  g.fillRect(X(wu0), Y(.37) - 1.5, X(wu1 - wu0), 3);

  // tall strip lights left (bright cool white) and right (blue)
  box(.13, .1, .21, .62, 'rgba(235,242,255,.6)', 16, 8);
  box(.155, .12, .185, .6, '#ffffff', 1.5, 4);
  box(.79, .14, .87, .58, 'rgba(110,165,245,.5)', 16, 8);
  box(.815, .16, .845, .56, '#cfe0ff', 1.5, 4);

  // horizon: the bright desk edge, then the desk with the room mirrored in it, softly
  gr = g.createLinearGradient(0, Y(.488), 0, Y(.53));
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.35, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, Y(.488), W, Y(.042));
  g.save(); g.globalAlpha = L ? .34 : .3; g.filter = 'blur(6px)'; g.translate(0, Y(1.0)); g.scale(1, -1);
  g.drawImage(c, 0, 0, W, Y(.5), 0, 0, W, Y(.42)); g.restore();

  // behind the bead (rim): darker so the silhouette is crisp
  // a flat band across the back (u 0…0.08 and 0.92…1 have the same value, so no line where the sphere's rim meets
  // the seam), easing into the room by u 0.2 / 0.8
  for (const side of [0, 1]) {
    gr = g.createLinearGradient(X(side ? .92 : .08), 0, X(side ? .8 : .2), 0);
    const k = L ? 'rgba(30,36,44,A)' : 'rgba(0,0,0,A)', a0 = L ? .38 : .5;
    gr.addColorStop(0, k.replace('A', a0)); gr.addColorStop(1, k.replace('A', 0));
    g.fillStyle = gr; g.fillRect(side ? X(.8) : X(.08), Y(.3), X(.12), Y(.7));
    g.fillStyle = k.replace('A', a0); g.fillRect(side ? X(.92) : 0, Y(.3), X(.08), Y(.7));
    // the ceiling stays bright all round; blend the band in above the walls
    const vg = g.createLinearGradient(0, Y(.18), 0, Y(.3)); vg.addColorStop(0, k.replace('A', 0)); vg.addColorStop(1, k.replace('A', a0));
    g.fillStyle = vg; g.fillRect(side ? X(.92) : 0, Y(.18), X(.08), Y(.12));
  }
  // a soft final blur so the mirror has no aliasing at bead size
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const o = out.getContext('2d', { willReadFrequently: true }); o.drawImage(c, 0, 0); o.filter = 'blur(1.2px)'; o.drawImage(c, 0, 0);
  // the poles: one even colour across the top and bottom rows (no pinch line where the sphere looks straight up/down)
  o.filter = 'none';
  for (const top of [true, false]) {
    const d = o.getImageData(0, top ? 30 : H - 31, W, 1).data; let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4, col = `${r / n | 0},${gg / n | 0},${b / n | 0}`, span = 84;
    const lg = o.createLinearGradient(0, top ? 0 : H, 0, top ? span : H - span);
    lg.addColorStop(0, `rgba(${col},1)`); lg.addColorStop(.35, `rgba(${col},.92)`); lg.addColorStop(1, `rgba(${col},0)`);
    o.fillStyle = lg; o.fillRect(0, top ? 0 : H - span, W, span);
  }
  return out;
}
