// DV56 MERCURY: settings state, input (mouse, touch, keyboard), persistence and the effects each setting has.
import { Mercury } from './mercury.js';
import { paintStudio } from './env.js';
import { unlock, warm, tock, tick } from './sound.js';

const KEY = 'dv56a.settings';
const DEFAULTS = { system: true, notifications: true, sounds: true, bluetooth: true, nightshift: false, darkmode: true, volume: 72, brightness: 54 };
const CHILDREN = ['notifications', 'sounds', 'bluetooth', 'volume'];
const PITCH = { system: 0.92, notifications: 1.04, sounds: 1.1, bluetooth: 1, nightshift: 0.96, darkmode: 0.88 };

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const live = $('#live');
const panel = $('.panel');
const canvas = $('.fx');
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- storage (versioned; older dv56 keys are wiped)
function load() {
  let s = null;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('dv56') && k !== KEY) localStorage.removeItem(k); }
    s = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (e) { s = null; }
  const out = { ...DEFAULTS };
  if (s && typeof s === 'object') for (const k of Object.keys(DEFAULTS)) if (typeof s[k] === typeof DEFAULTS[k]) out[k] = s[k];
  return out;
}
let saveT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ } }, 120); }

const settings = load();

// ---------------------------------------------------------------- reduced motion (system setting)
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');

// ---------------------------------------------------------------- the liquid chrome
const fx = new Mercury(canvas, { cap: Number(params.get('fxdpr')) || 0 });
const hasFx = !fx.failed && !params.has('nofx');
root.classList.toggle('no-fx', !hasFx);
if (!hasFx) fx.pause(true);
fx.reduced = mqReduce.matches;
root.classList.toggle('reduced', fx.reduced);
mqReduce.addEventListener?.('change', (e) => { fx.reduced = e.matches; root.classList.toggle('reduced', e.matches); fx.kick(); });

const envDark = paintStudio('dark'), envLight = paintStudio('light');
fx.setEnv(envDark, envLight);
import('../assets/env/manifest.js').then((m) => {
  const src = m.default && m.default.studio; if (!src) return;
  const img = new Image(); img.decoding = 'async'; img.src = new URL('../assets/env/' + src, import.meta.url).href;
  img.decode().then(() => fx.setEnv(img, img)).catch(() => {});
}).catch(() => {});

const switches = $$('.sw');
const rails = $$('.rail');
const keyOf = (el) => el.closest('[data-key]').dataset.key;

for (const b of switches) fx.addSwitch(keyOf(b), b.querySelector('.groove'), settings[keyOf(b)]);  // the chrome sits in the visible groove
for (const r of rails) fx.addSlider(keyOf(r), r, settings[keyOf(r)] / 100);

// ---------------------------------------------------------------- applying a setting
const metaScheme = $('meta[name="color-scheme"]'), metaTheme = $('meta[name="theme-color"]');
const glows = $$('.backdrop .glow, .backdrop .beam');

// brightness alone: the room's glows (composited layers, opacity only) and the chrome's exposure; nothing else is touched
function applyLight(instant) {
  const b = settings.brightness / 100;
  fx.setLook({ expo: 0.5 + 1.0 * b }, instant);
  const o = (0.28 + 0.72 * Math.pow(b, 0.8)).toFixed(3);
  for (const g of glows) g.style.opacity = o;
}
function applyLook(instant) {
  applyLight(instant);
  fx.setLook({ warm: settings.nightshift ? 1 : 0, light: settings.darkmode ? 0 : 1 }, instant);
  root.classList.toggle('theme-light', !settings.darkmode);
  root.classList.toggle('night', settings.nightshift);
  metaScheme.content = settings.darkmode ? 'dark' : 'light';
  metaTheme.content = settings.darkmode ? '#1b1f25' : '#dfe4e9';
}

function applyDisabled() {
  const off = !settings.system;
  for (const k of CHILDREN) {
    const host = $(`[data-key="${k}"]`);
    host.classList.toggle('is-disabled', off);
    const sw = $('.sw', host), inp = $('input', host);
    if (sw) { if (off) sw.setAttribute('aria-disabled', 'true'); else sw.removeAttribute('aria-disabled'); }
    if (inp) inp.disabled = off;
    fx.setDim(k, off);
  }
}

function paintSwitch(k) {
  const b = $(`[data-key="${k}"] .sw`);
  b.setAttribute('aria-checked', String(settings[k]));
  b.closest('.ctl').dataset.state = settings[k] ? 'ON' : 'OFF';
}

function set(k, v, { instant = false, user = false } = {}) {
  if (typeof DEFAULTS[k] === 'boolean') {
    v = !!v;
    const changed = settings[k] !== v;
    settings[k] = v; paintSwitch(k);
    fx.setSwitch(k, v, { instant });
    if (k === 'system') {
      applyDisabled();
      if (changed && user) live.textContent = v ? 'System functions on.' : 'System functions off: notifications, sounds, Bluetooth and volume are disabled.';
    }
    if (k === 'nightshift' || k === 'darkmode') applyLook(instant);
  } else {
    v = Math.round(Math.max(0, Math.min(100, Number(v))));
    settings[k] = v;
    const inp = $(`[data-key="${k}"] input`);
    if (Number(inp.value) !== v) inp.value = v;
    inp.setAttribute('aria-valuetext', `${v}%`);
    $(`[data-key="${k}"] .bubble`).textContent = `${v}%`;
    if (!hasFx) $(`[data-key="${k}"] .rail`).style.setProperty('--v', v / 100);
    fx.setSlider(k, v / 100, { instant });
    if (k === 'brightness') applyLight(instant);
  }
  if (user) save();
}

for (const k of Object.keys(DEFAULTS)) set(k, settings[k], { instant: true });
applyDisabled();
applyLook(true);

// ---------------------------------------------------------------- sound
const warmOnce = () => { removeEventListener('pointermove', warmOnce); removeEventListener('keydown', warmOnce); setTimeout(warm, 0); };
addEventListener('pointermove', warmOnce, { passive: true }); addEventListener('keydown', warmOnce);
const soundOn = () => settings.sounds && settings.system;
fx.onImpact = (id, v) => { if (soundOn()) tock(Math.min(1, v / 650), settings.volume / 100, PITCH[id] || 1); };

// ---------------------------------------------------------------- switches: click, drag, keyboard
let drag = null, swallowClick = false;
for (const b of switches) {
  const k = keyOf(b);
  b.addEventListener('pointerdown', (e) => {
    unlock();
    if (b.getAttribute('aria-disabled') === 'true' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const cr = canvas.getBoundingClientRect();
    drag = { k, b, id: e.pointerId, x0: e.clientX, y0: e.clientY, left: cr.left, moved: false };
  });
  b.addEventListener('pointermove', (e) => {
    if (!drag || drag.b !== b || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved) {
      if (Math.abs(dx) < 5) { if (Math.abs(dy) > 8) drag = null; return; }
      drag.moved = true; try { b.setPointerCapture(e.pointerId); } catch (_) { /* gone */ }
      b.classList.add('is-dragging');
    }
    if (hasFx) fx.dragSwitch(k, e.clientX - drag.left);
  });
  const end = (e, cancel) => {
    if (!drag || drag.b !== b || e.pointerId !== drag.id) return;
    const d = drag; drag = null; b.classList.remove('is-dragging');
    if (!d.moved) return;
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 0);
    if (cancel || !hasFx) { set(k, settings[k]); return; }
    const on = fx.releaseSwitch(k);
    set(k, on, { user: true });
  };
  b.addEventListener('pointerup', (e) => end(e, false));
  b.addEventListener('pointercancel', (e) => end(e, true));
  b.addEventListener('lostpointercapture', (e) => { if (drag && drag.b === b && drag.moved) end(e, false); });
  b.addEventListener('click', (e) => {
    if (swallowClick) { e.preventDefault(); return; }
    unlock();
    if (b.getAttribute('aria-disabled') === 'true') return;
    set(k, !settings[k], { user: true });
  });
  b.addEventListener('keydown', (e) => {
    if (b.getAttribute('aria-disabled') === 'true') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); unlock();
      const on = e.key === 'ArrowRight';
      if (settings[k] !== on) set(k, on, { user: true });
    }
  });
}
// a click on the row title toggles too (label for=), but not on a disabled switch
for (const l of $$('.row .ttl')) l.addEventListener('click', (e) => { const b = $('#' + l.htmlFor); if (b && b.getAttribute('aria-disabled') === 'true') e.preventDefault(); });

// ---------------------------------------------------------------- sliders: native range input, chrome drawn on top
const active = new Set();
for (const r of rails) {
  const k = keyOf(r), inp = $('input', r);
  let hover = false, focus = false, press = false, lastDetent = Math.round(settings[k] / 5);
  const upd = () => { const on = (hover || focus || press) && !inp.disabled; r.classList.toggle('is-active', on); if (on) active.add(r); else active.delete(r); placeBubble(r); fx.kick(); };
  r.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = true; upd(); } });
  r.addEventListener('pointerleave', () => { hover = false; upd(); });
  inp.addEventListener('focus', () => { focus = inp.matches(':focus-visible'); upd(); });
  inp.addEventListener('blur', () => { focus = false; upd(); });
  inp.addEventListener('keydown', () => { if (!focus) { focus = true; upd(); } });
  inp.addEventListener('pointerdown', () => { unlock(); press = true; upd();
    addEventListener('pointerup', () => { press = false; upd(); }, { once: true }); });
  inp.addEventListener('input', () => {
    set(k, inp.value, { user: true });
    if (!hasFx) placeBubble(r);   // no renderer frames to follow in the CSS fallback
    const det = Math.round(settings[k] / 5);
    if (det !== lastDetent) { lastDetent = det; if (soundOn()) tick(settings.volume / 100, k === 'volume' ? 1.1 : 0.9); }
  });
}
function placeBubble(r) {
  const k = keyOf(r), b = $('.bubble', r);
  const L = fx.sliders.get(k);
  const x = hasFx ? fx.sliderX(k) - L.rect.x : 12 + (r.clientWidth - 24) * (settings[k] / 100);   // fallback: the 24 px native thumb's centre
  const d = devicePixelRatio || 1; b.style.transform = `translateX(${Math.round(x * d) / d}px)`;  // whole device pixels: the label stays sharp
}
fx.onFrame = () => { for (const r of active) placeBubble(r); };

// ---------------------------------------------------------------- layout, visibility
const measure = () => { fx.measure(); for (const r of rails) placeBubble(r); };
new ResizeObserver(measure).observe(panel);
addEventListener('resize', measure);
const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { measure(); fx.draw(); });
let onScreen = true;
new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; fx.pause(!hasFx || !onScreen || document.hidden); }).observe(panel);
document.addEventListener('visibilitychange', () => fx.pause(!hasFx || document.hidden || !onScreen));

// ---------------------------------------------------------------- test hook
window.__mercury = {
  ready: ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))),
  fx, settings, set: (k, v, o) => set(k, v, o), hasFx,
  state: () => ({ settings: { ...settings }, fx: fx.state() }),
};
