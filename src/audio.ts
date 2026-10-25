// Every sound is made in the browser: rubbery squeaks, boings, purrs, giggles,
// little thuds and sparkly chimes. No recordings, no voices.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let noiseBuf: AudioBuffer | null = null;

export function setSound(on: boolean): void {
  enabled = on;
  if (master) master.gain.value = on ? 0.8 : 0;
}

/** Call from a touch handler: phone browsers only start audio after a touch. */
export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.8 : 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function ready(): AudioContext | null {
  if (!ctx || !master || !enabled || ctx.state !== "running") return null;
  return ctx;
}

function env(g: GainNode, t: number, peak: number, attack: number, hold: number, release: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

/** A rubbery toy squeak. pitch 1 is a medium squishy; bigger is higher. */
export function squeak(pitch = 1, length = 0.16, loud = 0.35): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const f0 = 620 * pitch;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(f0 * 0.82, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.35, t + length * 0.45);
  o.frequency.exponentialRampToValueAtTime(f0 * 1.05, t + length);
  const vib = c.createOscillator();
  vib.frequency.value = 38;
  const vg = c.createGain();
  vg.gain.value = f0 * 0.06;
  vib.connect(vg).connect(o.frequency);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = f0 * 2.2;
  bp.Q.value = 1.6;
  const g = c.createGain();
  env(g, t, loud, 0.012, length * 0.5, length * 0.6);
  o.connect(bp).connect(g).connect(master);
  const o2 = c.createOscillator();
  o2.type = "sine";
  o2.frequency.setValueAtTime(f0 * 1.6, t);
  o2.frequency.exponentialRampToValueAtTime(f0 * 2.1, t + length * 0.5);
  const g2 = c.createGain();
  env(g2, t, loud * 0.35, 0.01, length * 0.3, length * 0.5);
  o2.connect(g2).connect(master);
  for (const n of [o, vib, o2]) {
    n.start(t);
    n.stop(t + length * 1.4);
  }
}

/** The slow sigh of a squishy puffing back up. */
export function sigh(pitch = 1): void {
  const c = ready();
  if (!c || !master || !noiseBuf) return;
  const t = c.currentTime;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const lp = c.createBiquadFilter();
  lp.type = "bandpass";
  lp.frequency.setValueAtTime(500 * pitch, t);
  lp.frequency.exponentialRampToValueAtTime(1400 * pitch, t + 0.7);
  lp.Q.value = 3;
  const g = c.createGain();
  env(g, t, 0.12, 0.08, 0.3, 0.45);
  s.connect(lp).connect(g).connect(master);
  s.start(t);
  s.stop(t + 1);
}

export function boing(pitch = 1): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(180 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(520 * pitch, t + 0.08);
  o.frequency.exponentialRampToValueAtTime(260 * pitch, t + 0.3);
  const lfo = c.createOscillator();
  lfo.frequency.value = 22;
  const lg = c.createGain();
  lg.gain.value = 40 * pitch;
  lfo.connect(lg).connect(o.frequency);
  const g = c.createGain();
  env(g, t, 0.32, 0.01, 0.05, 0.3);
  o.connect(g).connect(master);
  for (const n of [o, lfo]) {
    n.start(t);
    n.stop(t + 0.42);
  }
}

export function thud(strength = 1): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
  const g = c.createGain();
  env(g, t, Math.min(0.5, 0.15 + strength * 0.2), 0.005, 0.02, 0.2);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.3);
}

/** A soft, rumbly purr while being petted. */
export function purr(seconds = 0.6): void {
  const c = ready();
  if (!c || !master || !noiseBuf) return;
  const t = c.currentTime;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320;
  const am = c.createGain();
  am.gain.value = 0;
  const lfo = c.createOscillator();
  lfo.frequency.value = 24;
  const lfoG = c.createGain();
  lfoG.gain.value = 0.5;
  lfo.connect(lfoG).connect(am.gain);
  const g = c.createGain();
  env(g, t, 0.28, 0.08, seconds * 0.6, seconds * 0.4);
  s.connect(lp).connect(am).connect(g).connect(master);
  s.start(t);
  lfo.start(t);
  s.stop(t + seconds + 0.1);
  lfo.stop(t + seconds + 0.1);
}

export function giggle(pitch = 1): void {
  const c = ready();
  if (!c) return;
  const notes = [1.0, 1.12, 0.98, 1.18, 1.05, 1.25];
  notes.forEach((n, i) => setTimeout(() => squeak(pitch * 1.25 * n, 0.08, 0.22), i * 85));
}

/** A little tune of soft squeaks, for musical squishies. */
export function hum(pitch = 1): void {
  const c = ready();
  if (!c) return;
  const notes = [1.0, 1.12, 1.26, 1.12, 1.33];
  notes.forEach((n, i) => setTimeout(() => squeak(pitch * n, 0.16, 0.16), i * 190));
}

export function whoosh(): void {
  const c = ready();
  if (!c || !master || !noiseBuf) return;
  const t = c.currentTime;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(2200, t + 0.25);
  const g = c.createGain();
  env(g, t, 0.18, 0.04, 0.08, 0.2);
  s.connect(bp).connect(g).connect(master);
  s.start(t);
  s.stop(t + 0.4);
}

export function yawn(pitch = 1): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(520 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(720 * pitch, t + 0.3);
  o.frequency.exponentialRampToValueAtTime(300 * pitch, t + 1.0);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1400;
  const g = c.createGain();
  env(g, t, 0.16, 0.1, 0.5, 0.4);
  o.connect(lp).connect(g).connect(master);
  o.start(t);
  o.stop(t + 1.1);
}

/** Sparkly rising chime for happy moments (level up, new things). */
export function chime(big = false): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [783.99, 1046.5];
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const o2 = c.createOscillator();
    o2.type = "sine";
    o2.frequency.value = f * 2.01;
    const g = c.createGain();
    const st = t + i * (big ? 0.09 : 0.07);
    env(g, st, 0.16, 0.005, 0.03, big ? 0.7 : 0.4);
    const g2 = c.createGain();
    g2.gain.value = 0.25;
    o.connect(g).connect(master!);
    o2.connect(g2).connect(g);
    o.start(st);
    o2.start(st);
    o.stop(st + 1);
    o2.stop(st + 1);
  });
}

export function pop(): void {
  const c = ready();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(240, t + 0.07);
  const g = c.createGain();
  env(g, t, 0.3, 0.003, 0.01, 0.08);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.12);
}

export function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // not on this phone
  }
}
