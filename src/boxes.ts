// What comes out of a Squishy Box. Boxes always prefer squishies you don't have
// yet; rarer finishes come up less often; Spooky squishies are common in
// October and rare the rest of the year. Spooky Boxes (they come on Halloween)
// only ever hold Spooky squishies and the Halloween Specials, which are found
// nowhere else. These odds are the true odds.

import { CATALOG, type Finish, type SquishyDef } from "./catalog";

export const FINISH_WEIGHT: Record<Finish, number> = {
  matte: 50,
  shiny: 28,
  glitter: 14,
  glow: 12,
  gold: 3,
};

/** Spooky squishies' share outside October. */
export const SPOOKY_OFF_SEASON = 0.12;

export const isOctober = (d: Date): boolean => d.getMonth() === 9;

export function weightOf(def: SquishyDef, date: Date): number {
  const w = FINISH_WEIGHT[def.finish];
  return def.family === "spooky" && !isOctober(date) ? w * SPOOKY_OFF_SEASON : w;
}

export interface BoxResult {
  def: SquishyDef;
  isNew: boolean;
}

/**
 * Picks the squishy in a box. The very first box is always a friendly matte one
 * (a Spooky one in October, half the time).
 */
export function openBox(owned: ReadonlySet<string>, date: Date, rand: () => number, first = false): BoxResult {
  let pool = CATALOG.filter((d) => d.foundBy.some((f) => f.kind === "box"));
  if (first) pool = pool.filter((d) => d.finish === "matte" && (d.family === "bao" || isOctober(date)));
  const fresh = pool.filter((d) => !owned.has(d.id));
  const from = fresh.length ? fresh : pool;
  const def = weightedPick(from, (d) => weightOf(d, date), rand);
  return { def, isNew: !owned.has(def.id) };
}

/** Spooky Box odds: a Halloween Special is the likeliest, then the glittery and glowing Spooky ones. */
export const SPOOKY_BOX_WEIGHT = { special: 20, matte: 4, glitter: 6, glow: 6 } as const;

const spookyWeight = (d: SquishyDef): number =>
  d.family === "halloween" ? SPOOKY_BOX_WEIGHT.special : d.finish === "matte" ? SPOOKY_BOX_WEIGHT.matte : d.finish === "glitter" ? SPOOKY_BOX_WEIGHT.glitter : SPOOKY_BOX_WEIGHT.glow;

/**
 * Picks the squishy in a Spooky Box, preferring ones you don't have. The first one you open always holds a Halloween
 * Special.
 */
export function openSpookyBox(owned: ReadonlySet<string>, rand: () => number): BoxResult {
  const specials = CATALOG.filter((d) => d.foundBy.some((f) => f.kind === "spookyBox"));
  const spooky = CATALOG.filter((d) => d.family === "spooky" && d.foundBy.some((f) => f.kind === "box"));
  const pool = specials.some((d) => owned.has(d.id)) ? [...specials, ...spooky] : specials;
  const fresh = pool.filter((d) => !owned.has(d.id));
  const def = weightedPick(fresh.length ? fresh : pool, spookyWeight, rand);
  return { def, isNew: !owned.has(def.id) };
}

function weightedPick<T>(items: T[], weight: (t: T) => number, rand: () => number): T {
  let total = 0;
  for (const it of items) total += weight(it);
  let r = rand() * total;
  for (const it of items) {
    r -= weight(it);
    if (r < 0) return it;
  }
  return items[items.length - 1];
}
