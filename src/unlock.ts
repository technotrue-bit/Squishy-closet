// The free game and the full game, behind one check: hasFull(). Free: two places and the matte and shiny squishies
// (plus Halloween's Spooky Box, a once-a-year gift). The full game, one purchase, opens every place and the sparkly
// squishies (glitter, glow and gold) in boxes and baby naps. Squishies, hats and babies a kid already has are never
// taken away, whatever the game says about the full game.
//
// Nothing is locked on the live site or in the app until selling starts: set SELLING_FROM to that moment (see
// PAYMENTS.md). Everyone who found a squishy before then keeps the whole game, as an early friend. Preview builds
// (Vercel previews and `npm run dev`) lock from the moment they were built, so the locks and the unlock screen can be
// tried there, with a test unlock that only exists in those builds.

import type { SquishyDef } from "./catalog";
import type { PlaceId } from "./places";
import { PREFIX } from "./mirror";

declare const __TEST_BUILD__: boolean | undefined;
declare const __BUILT_AT__: number | undefined;

/** True only in Vercel preview builds and the dev server. Never in a production or app build. */
export const TEST_BUILD = typeof __TEST_BUILD__ === "boolean" && __TEST_BUILD__;
const BUILT_AT = typeof __BUILT_AT__ === "number" ? __BUILT_AT__ : 0;

/**
 * When the full game goes on sale on the live site and in the app (ms since 1970), or null while it isn't. Set it to
 * the day a real payment is hooked up and shipped, never earlier: anyone who found a squishy before it is an early
 * friend and keeps the whole game.
 */
export const SELLING_FROM: number | null = null;

/** The places anyone can play in. The first is where a new player in the free game starts. */
export const FREE_PLACES: readonly PlaceId[] = ["room", "beach"];

export const UNLOCK_KEY = `${PREFIX}unlock`;

/** How this phone got the full game: bought in the app, bought on the site, or a test unlock in a preview build. */
export type UnlockHow = "apple" | "web" | "test";
export interface UnlockRecord {
  how: UnlockHow;
  /** When (ms). */
  at: number;
}

/** The moment the locks start, for this build, or null when nothing is locked. */
export function locksFrom(selling: number | null = SELLING_FROM, test = TEST_BUILD, builtAt = BUILT_AT): number | null {
  if (selling !== null) return selling;
  return test ? builtAt : null;
}

/** Found a squishy before the locks started: keeps the whole game. */
export function isEarly(owned: Record<string, { got: number }>, from: number | null = locksFrom()): boolean {
  if (from === null) return false;
  return Object.values(owned).some((o) => o.got < from);
}

export function parseUnlock(raw: string | null): UnlockRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<UnlockRecord>;
    if (r.how !== "apple" && r.how !== "web" && r.how !== "test") return null;
    // A test unlock only counts in a preview build, so one can never carry over into the real game.
    if (r.how === "test" && !TEST_BUILD) return null;
    return { how: r.how, at: typeof r.at === "number" ? r.at : 0 };
  } catch {
    return null;
  }
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const store = (): Store | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function readUnlock(s: Store | null = store()): UnlockRecord | null {
  try {
    return parseUnlock(s?.getItem(UNLOCK_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeUnlock(how: UnlockHow, now: number, s: Store | null = store()): void {
  try {
    s?.setItem(UNLOCK_KEY, JSON.stringify({ how, at: now } satisfies UnlockRecord));
  } catch {
    // Storage full or private mode: the unlock lasts until the page closes, and Restore brings it back.
  }
  session = { how, at: now };
}

/** Puts a preview build back to the free game. Does nothing anywhere else. */
export function clearTestUnlock(s: Store | null = store()): void {
  if (!TEST_BUILD) return;
  try {
    s?.removeItem(UNLOCK_KEY);
  } catch {
    // nothing to clear
  }
  session = null;
}

/** An unlock made while storage refused to keep it. */
let session: UnlockRecord | null = null;

/** Why this phone has the full game, or null when it has the free game. */
export type FullWhy = "open" | "early" | UnlockHow;

export function fullWhy(owned: Record<string, { got: number }>, from: number | null = locksFrom(), rec: UnlockRecord | null = readUnlock() ?? session): FullWhy | null {
  if (from === null) return "open";
  if (rec) return rec.how;
  if (isEarly(owned, from)) return "early";
  return null;
}

/** The one check: does this phone have the full game? */
export function hasFull(owned: Record<string, { got: number }>): boolean {
  return fullWhy(owned) !== null;
}

/** Is there anything locked at all in this build? */
export const locksOn = (): boolean => locksFrom() !== null;

export function placeOpen(id: PlaceId, full: boolean): boolean {
  return full || FREE_PLACES.includes(id);
}

/** In the free game: matte and shiny squishies, and the Halloween Specials (they only come in Spooky Boxes). */
export function inFreeGame(def: SquishyDef): boolean {
  return def.family === "halloween" || def.finish === "matte" || def.finish === "shiny";
}

/** Can this squishy turn up in a box or a nap? Ones you already have always can (as a repeat). */
export function squishyOpen(def: SquishyDef, full: boolean): boolean {
  return full || inFreeGame(def);
}
