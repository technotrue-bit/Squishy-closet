// Collection goals: sets of squishies to finish in the Squishy Book. Each set is a family and a finish (all nine matte
// Bao, all twelve glow Spooky ones...), so every box a kid opens moves a set along. Finishing one brings a hat found
// nowhere else, plus a few stars (and a cookie for the golden one). Progress is worked out from the squishies a kid
// has, so nothing new needs keeping but which sets already gave their present. Nothing is ever taken away: a set
// finished with a squishy from a friend counts, and its present stays even if the rules change later.

import { CATALOG, type Family, type Finish, type SquishyDef } from "./catalog";
import type { Save } from "./save";
import { hatById } from "./hats";
import { COOKIES_MAX } from "./babies";

export interface SetDef {
  id: string;
  name: string;
  family: Family;
  /** Only squishies with this finish count; all of the family when left out. */
  finish?: Finish;
  /** The hat it gives, found nowhere else. */
  hat: string;
  stars: number;
  cookies?: number;
  /** A word under the set in the Book. */
  note?: string;
}

export const SETS: SetDef[] = [
  { id: "bao-basics", name: "Bao Basics", family: "bao", finish: "matte", hat: "steamer", stars: 10 },
  { id: "shiny-bao", name: "Shiny Bao", family: "bao", finish: "shiny", hat: "starClip", stars: 10 },
  { id: "glitter-bao", name: "Glitter Bao", family: "bao", finish: "glitter", hat: "tiara", stars: 15 },
  { id: "golden-trio", name: "Golden Trio", family: "bao", finish: "gold", hat: "laurel", stars: 15, cookies: 1 },
  { id: "spooky-friends", name: "Spooky Friends", family: "spooky", finish: "matte", hat: "ghostPal", stars: 10 },
  { id: "glow-spooky", name: "Glow Spooky", family: "spooky", finish: "glow", hat: "halo", stars: 15 },
  { id: "halloween-specials", name: "Halloween Specials", family: "halloween", hat: "moonBand", stars: 15, note: "Spooky Boxes come on Halloween" },
];

const BY_ID = new Map(SETS.map((s) => [s.id, s]));
export const setById = (id: string): SetDef | undefined => BY_ID.get(id);
export const isSetId = (id: unknown): id is string => typeof id === "string" && BY_ID.has(id);

/** The squishies in a set, in Book order. */
export const membersOf = (set: SetDef): SquishyDef[] =>
  CATALOG.filter((d) => d.family === set.family && (set.finish === undefined || d.finish === set.finish));

export interface SetProgress {
  set: SetDef;
  got: number;
  total: number;
  /** Its present was given. */
  done: boolean;
  /** Can every one of its squishies turn up in this phone's game? False in the free game for the sparkly sets. */
  open: boolean;
}

/**
 * How far along a set is. `inGame` says which squishies can turn up in this phone's game (unlock.ts's squishyOpen);
 * it is passed in so this file stays free of the unlock and the app's storage, which import the save themselves.
 */
export function progressOf(set: SetDef, owned: Readonly<Record<string, unknown>>, rewarded: readonly string[], inGame: (d: SquishyDef) => boolean): SetProgress {
  const members = membersOf(set);
  const got = members.filter((d) => owned[d.id]).length;
  return { set, got, total: members.length, done: rewarded.includes(set.id), open: members.every(inGame) };
}

/** Sets that are all found but haven't given their present yet. */
export const setsToReward = (s: Pick<Save, "owned" | "sets">): SetDef[] =>
  SETS.filter((set) => !s.sets.includes(set.id) && membersOf(set).every((d) => s.owned[d.id]));

export interface SetPresent {
  set: SetDef;
  /** The hat is new to this phone (it might already be here from another phone). */
  newHat: boolean;
  stars: number;
  cookies: number;
}

/** Gives a finished set's present, once. */
export function claimSet(s: Save, set: SetDef): SetPresent | null {
  if (s.sets.includes(set.id)) return null;
  s.sets.push(set.id);
  const newHat = !!hatById(set.hat) && !s.hats.includes(set.hat);
  if (newHat) s.hats.push(set.hat);
  s.stars += set.stars;
  const cookies = Math.max(0, Math.min(set.cookies ?? 0, COOKIES_MAX - s.cookies));
  s.cookies += cookies;
  return { set, newHat, stars: set.stars, cookies };
}
