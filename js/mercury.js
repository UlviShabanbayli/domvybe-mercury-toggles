// DV56 MERCURY: liquid chrome for switches and sliders. Grown from DV46's liquid.js (one canvas, a 2D signed-distance
// metaball lifted into a height field so every pixel has a real normal), taken further:
//   · a real environment map (equirectangular studio, two of them cross-faded for the dark / silver themes), with
//     slow yaw drift so light wanders across the chrome at rest;
//   · per-region LOCAL radius for the height field, so a thin neck or thread is a round cylinder, not a creased ribbon;
//   · switch: head + lagging tail + neck → the bead stretches into a dumbbell on travel, hits the end wall, squashes,
//     wobbles; the groove behind it fills with ice light;
//   · slider: a mercury thread from the start of the groove to a heavy bead that lags the value, stretches, leaves a
//     lump behind and sends ripples along the thread and rings across the glass.
// One canvas over the panel; every control is drawn in its own scissor box; the buffer is cleared once per frame.

const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

const FS = `precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform float uMode;      // 0 switch, 1 slider
uniform vec4 uTrack;      // x0, y0, x1, y1 (device px, y down)
uniform vec3 uHead;       // x, y, r
uniform vec3 uTail;       // x, y, r
uniform vec2 uSq;         // signed stretch along x, neck radius
uniform float uGlow;      // switch: lit groove
uniform float uDim;       // disabled
uniform vec4 uRip;        // slider: energy, phase, thread radius, -
uniform float uYaw;
uniform float uExpo;
uniform float uWarm;
uniform float uLight;     // 0 graphite, 1 silver
uniform vec3 uIce;
uniform sampler2D uEnvA;
uniform sampler2D uEnvB;

float sdEll(vec2 p, vec2 ab){ vec2 q=p/ab; float k0=length(q); if(k0<1.0) return (k0-1.0)*min(ab.x,ab.y); float k1=length(q/ab); return k0*(k0-1.0)/max(k1,1e-7); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-3),0.,1.); return length(pa-ba*h); }
float smin(float a,float b,float k){ float h=max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*0.25; }

vec2 headAxes(){ float s=uSq.x; return uHead.z*vec2(1.0+s, 1.0/(1.0+s*0.85)); }
float threadR(float x){
  float dx=max(uHead.x-x,0.);
  float w=uRip.x*sin(dx/(5.5*uDpr)-uRip.y*1.7)*exp(-dx/(80.0*uDpr));
  return uRip.z*(1.0+0.42*w);
}
// shape: returns signed distance (x) and local radius for the height field (y)
vec2 shape(vec2 p){
  vec2 ax=headAxes();
  float h=sdEll(p-uHead.xy, ax);
  float Rh=min(ax.x,ax.y);
  float wh=smoothstep(Rh*1.6, Rh*0.95, length((p-uHead.xy)/vec2(max(ax.x/ax.y,1.0),1.0)));
  float t=length(p-uTail.xy)-uTail.z;
  float wt=smoothstep(uTail.z*1.6, uTail.z*0.95, length(p-uTail.xy));
  float d; float R;
  if(uMode<0.5){
    float n=sdSeg(p,uHead.xy,uTail.xy)-uSq.y;
    float k=uHead.z*0.75;
    d=smin(smin(h,t,k),n,k*0.8);
    float rn=max(uSq.y,1.0);
    R=min(Rh, sqrt(rn*rn+pow(Rh*wh,2.0)+pow(uTail.z*wt,2.0)));   // smooth: no crease where head and tail meet
  } else {
    float tr=threadR(p.x);
    float th=sdSeg(p, vec2(uTrack.x+tr, uHead.y), uHead.xy)-tr;
    float k=uHead.z*0.7;
    d=smin(smin(h,t,k), th, uHead.z*0.9);
    R=min(Rh, sqrt(tr*tr+pow(Rh*wh,2.0)+pow(uTail.z*wt,2.0)));
  }
  return vec2(d, max(R, 0.75*uDpr));
}
float height(vec2 s){ float R=s.y; float t=clamp(-s.x,0.,R); float x=R-t; return sqrt(max(R*R-x*x,0.)); }

vec3 toLin(vec3 c){ return c*c*(c*0.305306+0.682171)+c*0.012522; }
vec3 env(vec3 r){
  vec3 d=vec3(r.x,-r.y,r.z);
  float c=cos(uYaw), s=sin(uYaw);
  d.xz=mat2(c,-s,s,c)*d.xz;
  float az=atan(d.x,d.z)/6.2831853;                       // -0.5..0.5, jumps at the back
  float u=d.z<0.0 ? fract(az+1.0)+0.5 : az+0.5;          // at the back use a parametrisation that is continuous there
  vec2 uv=vec2(u, acos(clamp(d.y,-1.0,1.0))/3.1415927);
  vec3 a=toLin(texture2D(uEnvA,uv).rgb);
  vec3 b=toLin(texture2D(uEnvB,uv).rgb);
  vec3 e=mix(a,b,uLight);
  e*=mix(vec3(1.0), vec3(1.12,0.86,0.62), uWarm);
  return e*uExpo;
}

void main(){
  vec2 p=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y);
  vec2 s0=shape(p);
  float e=0.75;
  float H=height(s0);
  float Hx=height(shape(p+vec2(e,0.)));
  float Hy=height(shape(p+vec2(0.,e)));
  vec3 n=normalize(vec3(-(Hx-H), -(Hy-H), e));
  float d=s0.x;
  float cov=clamp(0.5-d,0.,1.);
  float R=uHead.z;

  // ---- the chrome ----
  vec3 r=vec3(2.0*n.z*n.x, 2.0*n.z*n.y, 2.0*n.z*n.z-1.0);
  vec3 c=env(r);
  float fres=0.7+0.3*pow(1.0-n.z,4.0);
  c*=fres*vec3(0.93,0.955,0.985);
  c*=mix(0.45,1.0,smoothstep(0.0,0.3,n.z));
  vec3 L=normalize(vec3(-0.42,-0.78,0.5));
  float sp=max(dot(r,L),0.);
  c+=(pow(sp,140.0)*4.0+pow(sp,18.0)*0.22)*uExpo*mix(vec3(1.0),vec3(1.0,0.85,0.66),uWarm);
  vec3 L2=normalize(vec3(0.62,0.35,0.7));
  c+=pow(max(dot(r,L2),0.),90.0)*0.6*uExpo*vec3(0.62,0.78,1.0);
  c=c/(1.0+c*0.22);
  float lum=dot(c,vec3(0.3,0.59,0.11));
  c=mix(c, vec3(lum)*0.55, uDim*0.75);
  c=pow(max(c,0.0), vec3(1.0/2.2));

  // ---- under and around the chrome (premultiplied) ----
  vec3 under=vec3(0.); float ua=0.;
  float cy=(uTrack.y+uTrack.w)*0.5;
  if(uMode<0.5){
    float hh=(uTrack.w-uTrack.y)*0.5;
    float tsd=sdSeg(p, vec2(uTrack.x+hh,cy), vec2(uTrack.z-hh,cy))-hh;
    float inG=smoothstep(0.5,-1.5,tsd);
    float behind=smoothstep(uHead.x+R*0.15, uHead.x-R*0.7, p.x);
    float vy=clamp((p.y-cy)/hh,-1.,1.);
    float body=0.30+0.42*smoothstep(-0.9,0.95,vy);
    float lip=0.32*exp(-pow((vy+0.62)/0.1,2.0));                 // a thin light line along the top of the groove glass
    float near=0.5*exp(-abs(p.x-uHead.x)/(R*0.9));
    float edge=smoothstep(0.0,-4.0*uDpr,tsd);
    float g=uGlow*inG*behind*(body*edge+lip+near*edge)*mix(1.0,0.4,uDim);
    vec3 ice=uIce*mix(vec3(1.0),vec3(1.15,0.86,0.62),uWarm);
    under+=ice*g*0.8; ua+=g*0.55;
  } else {
    // rings on the glass around the moving bead
    vec2 q=(p-uHead.xy)/uDpr; q.x*=0.55;
    float dist=length(q);
    float ring=uRip.x*sin(dist*0.62-uRip.y*2.4)*exp(-dist/24.0)*smoothstep(R/uDpr*0.9, R/uDpr*1.7, dist);
    under+=vec3(0.86,0.92,1.0)*max(ring,0.0)*0.22; ua+=max(ring,0.0)*0.16+max(-ring,0.0)*0.14;
  }
  // contact shadow: a little below, falling off with distance
  vec2 sh=shape(p-vec2(0.,2.6*uDpr));
  float shad=(uMode<0.5?0.62:0.5)*exp(-max(sh.x,0.)/(max(sh.y,2.0)*0.55))*step(0.,d);
  shad*=mix(1.0,0.45,uLight);
  ua=ua+shad*(1.0-ua);

  vec3 col=c*cov+under*(1.0-cov);
  float a=cov+ua*(1.0-cov);
  gl_FragColor=vec4(col,a);
}`;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;

export class Mercury {
  constructor(canvas, { cap = 0 } = {}) {
    this.canvas = canvas; this.cap = cap;
    this.switches = new Map(); this.sliders = new Map();
    this.look = { yaw: 0, expo: 1, warm: 0, light: 0 };
    this.goal = { expo: 1, warm: 0, light: 0 };
    this.reduced = false; this.frozen = false; this.paused = false;
    this.onImpact = null; this.onFrame = null;
    this.t0 = performance.now(); this.lastDraw = 0; this.draws = 0; this.dirty = true;
    this._tick = this._tick.bind(this);
    this.env = { dark: null, light: null };   // set by setEnv(); kept so a restored context gets its maps back
    this.failed = false;
    try { this._init(); } catch (e) { this.failed = true; }
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.gl = null; });
    canvas.addEventListener('webglcontextrestored', () => { try { this._init(); this.measure(); this.draw(); } catch (e) { this.failed = true; } });
  }

  _init() {
    const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'default' });
    if (!gl) throw new Error('no webgl');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['uRes', 'uDpr', 'uMode', 'uTrack', 'uHead', 'uTail', 'uSq', 'uGlow', 'uDim', 'uRip', 'uYaw', 'uExpo', 'uWarm', 'uLight', 'uIce', 'uEnvA', 'uEnvB'])
      this.u[n] = gl.getUniformLocation(pr, n);
    this.tex = [0, 1].map((i) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([120, 125, 135, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    });
    gl.uniform1i(this.u.uEnvA, 0); gl.uniform1i(this.u.uEnvB, 1);
    gl.enable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0);
    this.gl = gl; this._stat = '';
    if (this.env.dark) this.setEnv(this.env.dark, this.env.light);
  }

  setEnv(dark, light) {
    this.env = { dark, light: light || dark };
    const gl = this.gl; if (!gl) return;
    [this.env.dark, this.env.light].forEach((src, i) => {
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    });
    this.kick();
  }

  // ------------------------------------------------------------------ controls
  addSwitch(id, el, on) {
    this.switches.set(id, { id, el, on, hx: 0, hv: 0, tx: 0, tv: 0, s: 0, sv: 0, glow: on ? 1 : 0, dim: 0, dimT: 0,
      drag: null, rect: null, placed: false });
  }
  addSlider(id, el, v) {
    this.sliders.set(id, { id, el, v, x: 0, xv: 0, tx: 0, tv: 0, s: 0, sv: 0, e: 0, ph: 0, dim: 0, dimT: 0, rect: null, placed: false });
  }

  // read every rect at once (one layout), relative to the canvas
  measure() {
    const cr = this.canvas.getBoundingClientRect();
    this.cssW = cr.width; this.cssH = cr.height;
    const area = cr.width * cr.height;
    const cap = this.cap || (area < 650000 ? 3 : 2);
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    const W = Math.round(cr.width * dpr), H = Math.round(cr.height * dpr);
    if (W !== this.canvas.width || H !== this.canvas.height) { this.canvas.width = W; this.canvas.height = H; this._stat = ''; }
    this.dpr = dpr;
    for (const S of this.switches.values()) {
      const r = S.el.getBoundingClientRect();
      S.rect = { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height };
      S.r = r.height / 2 - 0.5; S.cy = S.rect.y + r.height / 2;
      S.x0 = S.rect.x + r.height / 2; S.x1 = S.rect.x + r.width - r.height / 2;
      if (!S.placed) { S.hx = S.tx = S.on ? S.x1 : S.x0; S.hv = S.tv = S.s = S.sv = 0; S.glow = S.on ? 1 : 0; S.placed = true; }
      else { const f = S.on ? 1 : 0; if (!S.drag && Math.abs(S.hv) < 1) { S.hx = S.tx = mix(S.x0, S.x1, f); } }
    }
    for (const L of this.sliders.values()) {
      const r = L.el.getBoundingClientRect();
      L.rect = { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height };
      L.br = Math.min(13, r.height * .3); L.thr = 3.1; L.cy = L.rect.y + r.height / 2;
      L.x0 = L.rect.x + 14; L.x1 = L.rect.x + r.width - 14;
      const px = mix(L.x0, L.x1, L.v);
      if (!L.placed || Math.abs(L.xv) < 1) { L.x = L.tx = px; if (!L.placed) { L.xv = L.tv = L.s = L.sv = L.e = 0; } L.placed = true; }
    }
    this.kick();
  }

  setSwitch(id, on, { instant = false } = {}) {
    const S = this.switches.get(id); if (!S) return;
    S.on = on; S.drag = null;
    if (instant || this.reduced) { S.hx = S.tx = on ? S.x1 : S.x0; S.hv = S.tv = 0; S.s = S.sv = 0; S.glow = on ? 1 : 0; }
    else { S.hv += (on ? 1 : -1) * 60; } // a small push: mercury breaks from rest heavily
    this.kick();
  }
  dragSwitch(id, x) { const S = this.switches.get(id); if (!S) return; S.drag = clamp(x, S.x0, S.x1); this.kick(); }
  // where a released drag should land: position plus the flick
  releaseSwitch(id) {
    const S = this.switches.get(id); if (!S) return null;
    const f = (S.hx - S.x0) / (S.x1 - S.x0), proj = f + S.hv * 0.12 / (S.x1 - S.x0);
    S.drag = null; this.kick();
    return proj > 0.5;
  }
  setSlider(id, v, { instant = false } = {}) {
    const L = this.sliders.get(id); if (!L) return;
    L.v = clamp(v, 0, 1);
    if (instant || this.reduced) { L.x = L.tx = mix(L.x0, L.x1, L.v); L.xv = L.tv = 0; L.s = L.sv = 0; L.e = 0; }
    this.kick();
  }
  setDim(id, dim) {
    const C = this.switches.get(id) || this.sliders.get(id); if (!C) return;
    C.dimT = dim ? 1 : 0; if (this.reduced) C.dim = C.dimT; this.kick();
  }
  setLook(goal, instant = false) { Object.assign(this.goal, goal); if (instant || this.reduced) Object.assign(this.look, this.goal); this.kick(); }
  sliderX(id) { const L = this.sliders.get(id); return L ? L.x : 0; }
  hold(on = true) { this.frozen = on; this.kick(); }

  // every change kicks: the next frame is drawn even when the physics is already at rest (reduced motion jumps)
  kick() { this.dirty = true; if (!this.running && !this.paused) { this.running = true; this.last = performance.now(); requestAnimationFrame(this._tick); } }
  pause(p) { this.paused = p; if (!p) this.kick(); }

  // ------------------------------------------------------------------ physics
  _stepSwitch(S, h) {
    const target = S.drag != null ? S.drag : (S.on ? S.x1 : S.x0);
    const k = S.drag != null ? 520 : 230, c = 2 * Math.sqrt(k) * (S.drag != null ? 0.9 : 0.5);
    S.hv += (k * (target - S.hx) - c * S.hv) * h; S.hx += S.hv * h;
    // the end walls: the bead stops dead, squashes and the impact is heard
    const lo = S.x0 - 1.2, hi = S.x1 + 1.2;
    if (S.hx > hi || S.hx < lo) {
      const v = Math.abs(S.hv);
      S.hx = clamp(S.hx, lo, hi);
      if (v > 25) { S.sv -= Math.min(v, 900) * 0.0062; if (this.onImpact && performance.now() - (S.lastImpact || 0) > 120) { S.lastImpact = performance.now(); this.onImpact(S.id, v); } }
      S.hv = -S.hv * 0.12;
    }
    const kT = 62, cT = 2 * Math.sqrt(kT) * 0.92;
    S.tv += (kT * (S.hx - S.tx) - cT * S.tv) * h; S.tx += S.tv * h;
    S.tx = clamp(S.tx, S.x0 - 1, S.x1 + 1);
    const sT = clamp(Math.abs(S.hv) / 1700, 0, 0.2);
    S.sv += (360 * (sT - S.s) - 8.5 * S.sv) * h; S.s += S.sv * h;
    S.s = clamp(S.s, -0.32, 0.4);
    S.glow += ((S.on ? 1 : 0) - S.glow) * Math.min(1, h * 6);
    S.dim += (S.dimT - S.dim) * Math.min(1, h * 7);
  }
  _restSwitch(S) {
    const target = S.on ? S.x1 : S.x0;
    return S.drag == null && Math.abs(target - S.hx) < 0.05 && Math.abs(S.hx - S.tx) < 0.05 && Math.abs(S.hv) + Math.abs(S.tv) < 0.4 &&
      Math.abs(S.s) < 0.002 && Math.abs(S.sv) < 0.02 && Math.abs(S.glow - (S.on ? 1 : 0)) < 0.003 && Math.abs(S.dim - S.dimT) < 0.003;
  }
  _stepSlider(L, h) {
    const target = mix(L.x0, L.x1, L.v);
    const k = 190, c = 2 * Math.sqrt(k) * 0.72;
    L.xv += (k * (target - L.x) - c * L.xv) * h; L.x += L.xv * h;
    L.x = clamp(L.x, L.x0 - 2, L.x1 + 2);
    const kT = 70, cT = 2 * Math.sqrt(kT) * 0.9;
    L.tv += (kT * (L.x - L.tx) - cT * L.tv) * h; L.tx += L.tv * h;
    const lim = L.br * 1.7; if (Math.abs(L.tx - L.x) > lim) L.tx = L.x + Math.sign(L.tx - L.x) * lim; // the lump stays attached
    const sT = clamp(Math.abs(L.xv) / 1500, 0, 0.32);
    L.sv += (340 * (sT - L.s) - 9 * L.sv) * h; L.s += L.sv * h;
    L.e = Math.max(L.e * Math.exp(-h * 1.9), clamp(Math.abs(L.xv) / 520, 0, 1));
    L.ph += h * 7.5;
    L.dim += (L.dimT - L.dim) * Math.min(1, h * 7);
  }
  _restSlider(L) {
    return Math.abs(mix(L.x0, L.x1, L.v) - L.x) < 0.05 && Math.abs(L.x - L.tx) < 0.05 && Math.abs(L.xv) + Math.abs(L.tv) < 0.4 &&
      Math.abs(L.s) < 0.002 && Math.abs(L.sv) < 0.02 && L.e < 0.004 && Math.abs(L.dim - L.dimT) < 0.003;
  }

  _tick(now) {
    if (!this.running) return;
    if (this.paused) { this.running = false; return; }
    const dt = clamp((now - this.last) / 1000, 0, 1 / 30); this.last = now;
    let busy = false;
    if (!this.frozen) {
      const sub = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / sub;
      for (let i = 0; i < sub; i++) {
        for (const S of this.switches.values()) if (S.placed) this._stepSwitch(S, h);
        for (const L of this.sliders.values()) if (L.placed) this._stepSlider(L, h);
      }
      for (const S of this.switches.values()) if (!S.placed) continue; else if (!this._restSwitch(S)) busy = true; else { S.hx = S.tx = S.on ? S.x1 : S.x0; S.hv = S.tv = 0; S.s = S.sv = 0; }
      for (const L of this.sliders.values()) if (!L.placed) continue; else if (!this._restSlider(L)) busy = true; else { L.x = L.tx = mix(L.x0, L.x1, L.v); L.xv = L.tv = 0; L.s = L.sv = 0; L.e = 0; }
      const lk = this.look, g = this.goal, a = Math.min(1, dt * 4.2);
      for (const key of ['expo', 'warm', 'light']) {
        if (Math.abs(lk[key] - g[key]) > 0.002) { lk[key] += (g[key] - lk[key]) * a; busy = true; } else lk[key] = g[key];
      }
    } else busy = true;
    // idle: light wanders slowly across the chrome (two incommensurate swells)
    const t = (now - this.t0) / 1000;
    if (!this.reduced) this.look.yaw = 0.2 * Math.sin(t * 0.26) + 0.07 * Math.sin(t * 0.61 + 1.3);
    // moving → every frame; idle drift → about 30 fps (slow light, nobody sees the step); reduced motion → sleep
    if (busy || this.dirty || now - this.lastDraw > 31) { this.dirty = false; this.draw(); this.lastDraw = now; if (this.onFrame) this.onFrame(busy); }
    if (!busy && this.reduced) { this.running = false; return; }
    requestAnimationFrame(this._tick);
  }

  get busy() {
    for (const S of this.switches.values()) if (!S.placed) continue; else if (!this._restSwitch(S)) return true;
    for (const L of this.sliders.values()) if (!L.placed) continue; else if (!this._restSlider(L)) return true;
    return false;
  }

  state() {
    const sw = {}, sl = {};
    for (const S of this.switches.values()) sw[S.id] = { on: S.on, x: S.hx, tail: S.tx, gap: Math.abs(S.hx - S.tx), stretch: S.s, x0: S.x0, x1: S.x1, r: S.r, glow: S.glow, dragging: S.drag != null };
    for (const L of this.sliders.values()) sl[L.id] = { v: L.v, x: L.x, target: mix(L.x0, L.x1, L.v), energy: L.e, stretch: L.s, x0: L.x0, x1: L.x1 };
    return { sw, sl, look: { ...this.look }, running: !!this.running, failed: this.failed, dpr: this.dpr, draws: this.draws };
  }

  // ------------------------------------------------------------------ draw
  draw() {
    const gl = this.gl; if (!gl || !this.canvas.width) return;
    this.draws++;
    const d = this.dpr, W = this.canvas.width, Hh = this.canvas.height, u = this.u, lk = this.look;
    gl.scissor(0, 0, W, Hh); gl.clear(gl.COLOR_BUFFER_BIT);
    const stat = `${W}|${Hh}|${d}`;
    if (stat !== this._stat) { this._stat = stat; gl.viewport(0, 0, W, Hh); gl.uniform2f(u.uRes, W, Hh); gl.uniform1f(u.uDpr, d); }
    gl.uniform1f(u.uYaw, lk.yaw); gl.uniform1f(u.uExpo, lk.expo); gl.uniform1f(u.uWarm, lk.warm); gl.uniform1f(u.uLight, lk.light);
    gl.uniform3f(u.uIce, mix(0.62, 0.5, lk.light), mix(0.8, 0.64, lk.light), mix(0.95, 0.8, lk.light));
    const box = (x0, y0, x1, y1) => {
      const sx = clamp(Math.floor(x0 * d), 0, W), sy = clamp(Math.floor((this.cssH - y1) * d), 0, Hh);
      const sw = clamp(Math.ceil((x1 - x0) * d), 0, W - sx), sh = clamp(Math.ceil((y1 - y0) * d), 0, Hh - sy);
      gl.scissor(sx, sy, sw, sh);
    };
    gl.uniform1f(u.uMode, 0);
    for (const S of this.switches.values()) {
      if (!S.rect) continue;
      const R = S.rect, r = S.r, gap = Math.abs(S.hx - S.tx);
      const f = clamp(gap / (r * 0.6), 0, 1), fs = f * f * (3 - 2 * f);
      const rt = r * (0.8 - 0.22 * clamp(gap / (r * 2), 0, 1)) * fs;
      const neck = r * 0.36 * (1 - gap / (r * 2.6)) * fs - (1 - fs) * r;
      box(R.x - 10, R.y - 10, R.x + R.w + 10, R.y + R.h + 12);
      gl.uniform4f(u.uTrack, R.x * d, R.y * d, (R.x + R.w) * d, (R.y + R.h) * d);
      gl.uniform3f(u.uHead, S.hx * d, S.cy * d, r * d);
      gl.uniform3f(u.uTail, S.tx * d, S.cy * d, Math.max(rt, 0.01) * d);
      gl.uniform2f(u.uSq, S.s, neck * d);
      gl.uniform1f(u.uGlow, S.glow); gl.uniform1f(u.uDim, S.dim);
      gl.uniform4f(u.uRip, 0, 0, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.uniform1f(u.uMode, 1);
    for (const L of this.sliders.values()) {
      if (!L.rect) continue;
      const R = L.rect, r = L.br, gap = Math.abs(L.x - L.tx);
      const f = clamp(gap / (r * 0.6), 0, 1), fs = f * f * (3 - 2 * f);
      const rt = r * (0.62 - 0.25 * clamp(gap / (r * 3), 0, 1)) * fs;
      box(R.x - 4, L.cy - 32, R.x + R.w + 4, L.cy + 32);
      gl.uniform4f(u.uTrack, (R.x + 1) * d, (L.cy - 4) * d, (R.x + R.w) * d, (L.cy + 4) * d);
      gl.uniform3f(u.uHead, L.x * d, L.cy * d, r * d);
      gl.uniform3f(u.uTail, L.tx * d, L.cy * d, Math.max(rt, 0.01) * d);
      gl.uniform2f(u.uSq, L.s, 0);
      gl.uniform1f(u.uGlow, 0); gl.uniform1f(u.uDim, L.dim);
      gl.uniform4f(u.uRip, L.e, L.ph, L.thr * d, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }
}
