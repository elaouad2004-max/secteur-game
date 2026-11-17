// Tiny synthesized sound effects (no audio files needed).
let ac;
function tone(freq, dur, type = 'square', vol = 0.05, delay = 0) {
  try {
    ac = ac || new AudioContext();
    const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur);
  } catch { /* audio unavailable */ }
}

export const sfx = {
  key: () => { tone(988, 0.1); tone(1318, 0.15, 'square', 0.05, 0.08); },
  task: () => { tone(660, 0.1, 'triangle', 0.08); tone(880, 0.1, 'triangle', 0.08, 0.1); tone(1320, 0.2, 'triangle', 0.08, 0.2); },
  spotted: () => tone(220, 0.25, 'sawtooth', 0.05),
  caught: () => { tone(160, 0.3, 'sawtooth', 0.08); tone(90, 0.5, 'sawtooth', 0.08, 0.2); },
  weapon: () => tone(520, 0.15, 'square', 0.06),
  hit: () => tone(300, 0.12, 'square', 0.06),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, i * 0.12)),
  ending: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.05, i * 0.15)),
};
