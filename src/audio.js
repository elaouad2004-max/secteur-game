// Procedural horror audio: ambient drone + wind, random creaks/whispers/music box,
// a heartbeat that speeds up with danger, and stingers / jumpscare. No audio files needed.
let ac, master, reverb, noiseB, amb = null;

function init() {
  if (ac) return true;
  try { ac = new AudioContext(); } catch { return false; }
  master = ac.createGain(); master.gain.value = 0.9;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -12;
  master.connect(comp).connect(ac.destination);
  reverb = ac.createConvolver();
  const len = ac.sampleRate * 4, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
  reverb.buffer = ir;
  const rg = ac.createGain(); rg.gain.value = 0.7; reverb.connect(rg).connect(master);
  noiseB = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = noiseB.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return true;
}
const now = () => ac.currentTime;
function out(node, wet) {
  node.connect(master);
  if (wet) { const g = ac.createGain(); g.gain.value = wet; node.connect(g).connect(reverb); }
}
function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
const curve = (() => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; c[i] = Math.tanh(x * 12); } return c; })();
function osc(type, f, dur, peak, { t = 0, a = 0.01, wet = 0.4, glide, lp, dist, detune = 0 } = {}) {
  const t0 = now() + t, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune;
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + a + dur);
  let n = o;
  if (dist) { const w = ac.createWaveShaper(); w.curve = curve; n.connect(w); n = w; }
  if (lp) { const fl = ac.createBiquadFilter(); fl.frequency.value = lp; n.connect(fl); n = fl; }
  n.connect(g); env(g, t0, a, peak, dur); out(g, wet);
  o.start(t0); o.stop(t0 + a + dur + 0.1);
}
function noise(dur, peak, { t = 0, type = 'bandpass', f = 1000, f2, q = 1, a = 0.01, wet = 0.4 } = {}) {
  const t0 = now() + t, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseB; s.loop = true;
  fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + a + dur);
  s.connect(fl).connect(g); env(g, t0, a, peak, dur); out(g, wet);
  s.start(t0); s.stop(t0 + a + dur + 0.1);
}

// ---------- random ambience events ----------
const EVENTS = [
  () => { osc('sawtooth', 70 + Math.random() * 40, 1.4, 0.035, { a: 0.3, glide: 140 + Math.random() * 60, lp: 500, wet: 0.9 }); osc('sawtooth', 95, 0.9, 0.02, { t: 0.5, a: 0.2, glide: 60, lp: 400, wet: 0.9 }); }, // door creak
  () => { for (let i = 0; i < 4; i++) noise(0.5 + Math.random() * 0.6, 0.025, { t: i * 0.35, f: 2500 + Math.random() * 2000, f2: 1500, q: 6, a: 0.15, wet: 0.9 }); }, // whispers
  () => { osc('sine', 55, 0.6, 0.25, { glide: 30, wet: 0.8 }); noise(0.3, 0.05, { type: 'lowpass', f: 300, wet: 0.8 }); }, // distant slam
  () => { const n = [1046, 1244, 1396, 932, 1046, 830]; n.forEach((f, i) => osc('triangle', f * (1 + (Math.random() - 0.5) * 0.01), 0.6, 0.025, { t: i * 0.42, wet: 1 })); }, // broken music box
  () => { osc('sawtooth', 700, 1.6, 0.012, { a: 0.4, glide: 320, lp: 1400, wet: 1 }); }, // distant scream
  () => { for (let i = 0; i < 3; i++) osc('sine', 40, 0.25, 0.12, { t: i * 0.7, glide: 25, wet: 0.6 }); }, // footsteps upstairs
  () => { noise(2.5, 0.03, { f: 200, f2: 900, q: 3, a: 1, wet: 0.7 }); }, // breath
];

function heartbeat() {
  if (!amb) return;
  const d = amb.danger;
  if (d > 0.08) {
    osc('sine', 62, 0.14, 0.25 + d * 0.5, { glide: 38, wet: 0.05 });
    osc('sine', 58, 0.16, 0.18 + d * 0.4, { t: 0.2, glide: 35, wet: 0.05 });
  }
  amb.hb = setTimeout(heartbeat, 1100 - d * 650);
}
function scheduleEvent() {
  if (!amb) return;
  EVENTS[(Math.random() * EVENTS.length) | 0]();
  amb.ev = setTimeout(scheduleEvent, 5000 + Math.random() * 9000);
}

export const sfx = {
  start() {
    if (!init() || amb) return;
    ac.resume();
    const t0 = now();
    const lp = ac.createBiquadFilter(); lp.frequency.value = 160;
    const dg = ac.createGain(); dg.gain.value = 0.05;
    const oscs = [41.2, 43.7, 61.7].map((f) => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t0); return o; });
    lp.connect(dg); out(dg, 0.3);
    // wind
    const w = ac.createBufferSource(); w.buffer = noiseB; w.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 450; wf.Q.value = 0.8;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 280; lfo.connect(lg).connect(wf.frequency); lfo.start(t0);
    const wg = ac.createGain(); wg.gain.value = 0.03; w.connect(wf).connect(wg); out(wg, 0.4); w.start(t0);
    // high eerie tone with tremolo
    const hi = ac.createOscillator(), hg = ac.createGain(), tr = ac.createOscillator(), tg = ac.createGain();
    hi.type = 'sine'; hi.frequency.value = 1864; hg.gain.value = 0.003; tr.frequency.value = 0.3; tg.gain.value = 0.003;
    tr.connect(tg).connect(hg.gain); hi.connect(hg); out(hg, 0.9); hi.start(t0); tr.start(t0);
    amb = { lp, dg, danger: 0, nodes: [...oscs, w, lfo, hi, tr] };
    heartbeat(); amb.ev = setTimeout(scheduleEvent, 3000);
  },
  /** 0..1 — opens the drone filter and speeds up the heartbeat */
  setDanger(d) {
    if (!amb) return;
    amb.danger = d;
    amb.lp.frequency.setTargetAtTime(160 + d * 1100, now(), 0.3);
    amb.dg.gain.setTargetAtTime(0.05 + d * 0.05, now(), 0.3);
  },
  key: () => init() && (osc('triangle', 1568, 0.9, 0.05, { wet: 0.9 }), osc('triangle', 2093, 0.9, 0.04, { t: 0.08, wet: 0.9 }), osc('triangle', 2637, 1.2, 0.03, { t: 0.16, wet: 1 })),
  task: () => init() && (osc('sine', 880, 2.2, 0.08, { wet: 1 }), osc('sine', 1318, 2.2, 0.05, { t: 0.05, wet: 1 }), osc('sine', 110, 2.5, 0.12, { a: 0.1, wet: 0.8 }), noise(1.2, 0.03, { f: 3000, f2: 6000, q: 2, a: 0.3, wet: 1 })),
  spotted: () => init() && ([220, 233, 247, 262, 277].forEach((f) => osc('sawtooth', f, 0.9, 0.03, { a: 0.005, lp: 3000, wet: 0.7 })), osc('square', 1200, 0.5, 0.02, { glide: 1700, wet: 0.6 })),
  caught: () => {
    if (!init()) return;
    noise(1.1, 0.6, { type: 'highpass', f: 1500, a: 0.004, wet: 0.5 });
    osc('sawtooth', 900, 1.2, 0.35, { a: 0.004, glide: 70, dist: true, wet: 0.5 });
    osc('sawtooth', 1350, 0.9, 0.2, { a: 0.004, glide: 110, dist: true, wet: 0.5, detune: 30 });
    osc('sine', 70, 1.4, 0.9, { a: 0.004, glide: 22, wet: 0.3 });
    [311, 330, 349, 370].forEach((f) => osc('sawtooth', f, 1.5, 0.05, { t: 0.05, lp: 2500, wet: 0.9 }));
  },
  weapon: () => init() && noise(0.4, 0.25, { f: 300, f2: 3500, q: 2, wet: 0.4 }),
  hit: () => init() && (osc('square', 220, 0.25, 0.1, { glide: 50, wet: 0.3 }), noise(0.2, 0.15, { type: 'lowpass', f: 800 })),
  win: () => init() && [220, 262, 330, 440].forEach((f, i) => osc('sine', f, 2.5, 0.06, { t: i * 0.15, a: 0.3, wet: 1 })),
  ending: () => init() && (noise(3.5, 0.35, { type: 'lowpass', f: 160, a: 0.3, wet: 0.8 }), [196, 247, 294, 392].forEach((f) => osc('sine', f, 4, 0.06, { t: 1.8, a: 1, wet: 1 }))),
  levelStart: () => init() && (osc('sine', 55, 2.5, 0.3, { glide: 30, wet: 0.9 }), noise(2, 0.06, { type: 'lowpass', f: 250, a: 0.4, wet: 0.9 })),
};
