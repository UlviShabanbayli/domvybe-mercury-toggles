# Mercury toggle switches — UI component

**[Live demo](https://domvybe.com/components/mercury-toggles/)** · [Step-by-step tutorial](https://domvybe.com/library/mercury-toggles/) · [Download the ZIP](https://github.com/UlviShabanbayli/domvybe-mercury-toggles/releases/latest/download/mercury-toggles-source.zip)

Settings switches made of liquid chrome: each bead stretches, rolls into the end and snaps, and the sliders are mercury threads that ripple as you drag them.

Open `index.html` through any local static server (for example `python3 -m http.server`) and try it with a mouse,
a finger or the keyboard. Plain HTML, CSS and JavaScript; no build step, no libraries.

- `index.html` — the settings page: the toggle switches and the sliders, each a real input
- `css` — mercury.css: the page, the switches and sliders, the CSS chrome without WebGL, the phone layout, reduced motion
- `js` — app.js (the settings, keys), mercury.js (the WebGL liquid chrome: beads, threads, ripples), env.js (the studio it reflects, painted in Canvas2D), sound.js (the clicks, made in code)
- `assets` — env/manifest.js: the studio lights the chrome reflects

Mercury UI and Aura Design are made up. Everything is made in code: the liquid chrome (beads, threads, reflections) is
real-time WebGL, the studio it reflects is painted in Canvas2D, and the clicks are synthesised; no AI pictures. Every
switch and slider is a real input, so forms and keyboards work as usual. The page reads Google Fonts (Inter, Montserrat).

It respects `prefers-reduced-motion`. Made by Ulvi (Code with Ulvi) · domvybe.com

## Licence

MIT — see [LICENSE](LICENSE). Use it in your own projects, commercial ones included.
