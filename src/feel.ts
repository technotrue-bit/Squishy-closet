// How soft or firm a squishy is. One number, 0 (firm and bouncy) to 1 (super
// soft, slow to rise), sets how deep a finger sinks in, how fast it springs back
// and how much it wobbles. Every squishy in the collection will carry one.

export interface Feel {
  /** Dent depth the moment a finger lands, and after a long still press. */
  dentStart: number;
  dentMax: number;
  /** Dent depth under a sliding finger. */
  slide: number;
  /** Dent size (radians on the bun) when the dent is shallow. */
  radius: number;
  /** Dent spring while touched or after a quick release. */
  dentK: number;
  dentC: number;
  /** Dent spring after a long squish: low and damped is a slow rise. */
  riseK: number;
  riseC: number;
  /** How long the whole bun stays slowly rising after a long squish, seconds. */
  riseTime: number;
  /** Whole-bun squash under a long still press. */
  squashMax: number;
  /** Whole-bun spring: lower and less damped is wobblier. */
  bodyK: number;
  bodyC: number;
  /** Ripple size when a dent pops back. */
  wave: number;
}

const FIRM: Feel = {
  dentStart: 0.1,
  dentMax: 0.2,
  slide: 0.08,
  radius: 0.22,
  dentK: 520,
  dentC: 26,
  riseK: 170,
  riseC: 28,
  riseTime: 0.25,
  squashMax: 0.12,
  bodyK: 230,
  bodyC: 10,
  wave: 0.03,
};

const SOFT: Feel = {
  dentStart: 0.22,
  dentMax: 0.5,
  slide: 0.17,
  radius: 0.32,
  dentK: 170,
  dentC: 12,
  riseK: 16,
  riseC: 24,
  riseTime: 1.9,
  squashMax: 0.32,
  bodyK: 105,
  bodyC: 5.5,
  wave: 0.08,
};

export function feelFor(soft: number): Feel {
  const t = Math.max(0, Math.min(1, soft));
  const out = {} as Feel;
  for (const k of Object.keys(FIRM) as (keyof Feel)[]) out[k] = FIRM[k] + (SOFT[k] - FIRM[k]) * t;
  return out;
}

/** A kid-friendly word for how it feels, shown when you pick one. */
export function feelWord(soft: number): string {
  if (soft >= 0.9) return "Super soft!";
  if (soft >= 0.7) return "Soft and slow";
  if (soft >= 0.45) return "Squishy";
  if (soft >= 0.15) return "Springy";
  return "Firm";
}
