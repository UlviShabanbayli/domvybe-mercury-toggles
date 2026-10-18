// DV56 MERCURY: the sound of a heavy chrome bead. Synthesised (WebAudio), nothing downloaded. The context is created
// on the first user gesture only, so nothing ever plays by itself.
let ctx = null, bus = null;

// Opening the audio device costs one long main-thread task (~250 ms measured on macOS Chromium). It is paid when the
// pointer first moves over the page (the context is created suspended, nothing plays), not on the first click, where it
// would stall the bead's first travel. A real gesture then only resumes it.
function create() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  bus = ctx.createDynamicsCompressor(); bus.threshold.value = -14; bus.ratio.value = 4; bus.connect(ctx.destination);
}
export function warm() { create(); }
export function unlock() {
  create();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// a "tock": the low liquid body of the bead + a short metallic ring of the end stop. strength 0..1, volume 0..1
export function tock(strength = 1, volume = 0.7, pitch = 1) {
  if (!ctx || ctx.state !== 'running' || volume <= 0) return;
  const t = ctx.currentTime, gain = Math.min(1, strength) * volume * volume * 0.5;
  if (gain < 0.004) return;
  const out = ctx.createGain(); out.gain.value = gain; out.connect(bus);
  // body: a quick downward sine (a droplet landing)
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(420 * pitch, t); o.frequency.exponentialRampToValueAtTime(150 * pitch, t + 0.09);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.16);
  // ring: two inharmonic partials, very short
  for (const [f, a, d] of [[2380, 0.16, 0.07], [3710, 0.08, 0.045]]) {
    const p = ctx.createOscillator(), pg = ctx.createGain();
    p.type = 'sine'; p.frequency.value = f * pitch;
    pg.gain.setValueAtTime(0.0001, t); pg.gain.exponentialRampToValueAtTime(a, t + 0.002); pg.gain.exponentialRampToValueAtTime(0.0001, t + d);
    p.connect(pg).connect(out); p.start(t); p.stop(t + d + 0.02);
  }
}

// a soft tick for slider detents
export function tick(volume = 0.7, pitch = 1) {
  if (!ctx || ctx.state !== 'running' || volume <= 0) return;
  const t = ctx.currentTime, gain = volume * volume * 0.12;
  if (gain < 0.003) return;
  const p = ctx.createOscillator(), pg = ctx.createGain();
  p.type = 'triangle'; p.frequency.value = 1500 * pitch;
  pg.gain.setValueAtTime(0.0001, t); pg.gain.exponentialRampToValueAtTime(gain, t + 0.002); pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  p.connect(pg).connect(bus); p.start(t); p.stop(t + 0.05);
}
