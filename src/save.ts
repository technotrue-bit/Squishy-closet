// Progress lives only on this device. The version number lets later updates
// carry every kid's squishies forward; old saves are upgraded on load.

import { defById } from "./catalog";
import { hatById } from "./hats";
import { PLACE_IDS, type PlaceId } from "./places";

export const SAVE_KEY = "squishycloset.save";
export const SAVE_VERSION = 3;
/** Squishies out at once: the one you hold and up to three friends. */
export const TEAM_MAX = 3;
export const ZOOM_MIN = 0.85;
export const ZOOM_MAX = 1.8;
/** Love it takes to earn the next Squishy Box. */
export const LOVE_PER_BOX = 100;
export const NAME_MAX = 14;

export interface Owned {
  /** The kid's own name for it, if they changed it. */
  name?: string;
  /** When it was found (ms). */
  got: number;
  /** The hat it wears. */
  hat?: string;
}

export interface Save {
  v: number;
  sound: boolean;
  /** 0..LOVE_PER_BOX toward the next box. */
  love: number;
  /** Boxes earned and not opened yet. */
  boxes: number;
  /** From repeat squishies, to spend on clothes later. */
  stars: number;
  /** The squishy you're holding. */
  active: string | null;
  owned: Record<string, Owned>;
  /** Tutorial steps done; "done" when finished or skipped. */
  tutorial: string[] | "done";
  tried: string[];
  /** Friends out playing behind the one you hold (not counting it). */
  team: string[];
  /** Hats found. */
  hats: string[];
  /** Where you are playing. */
  place: PlaceId;
  /** Jobs the friends finished, per place. */
  jobs: Record<string, number>;
  /** 1 is the normal view; smaller is closer, bigger is farther out. */
  zoom: number;
  /** One-time tips already shown. */
  seen: string[];
}

export const freshSave = (): Save => ({
  v: SAVE_VERSION,
  sound: true,
  love: 0,
  boxes: 0,
  stars: 0,
  active: null,
  owned: {},
  tutorial: [],
  tried: [],
  team: [],
  hats: [],
  place: "table",
  jobs: {},
  zoom: 1,
  seen: [],
});

const strings = (a: unknown): string[] => (Array.isArray(a) ? a.filter((t): t is string => typeof t === "string") : []);
const count = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);

export function cleanName(name: string): string {
  return name.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, NAME_MAX);
}

export function parseSave(raw: string | null): Save {
  const base = freshSave();
  if (!raw) return base;
  let s: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return base;
    s = parsed as Record<string, unknown>;
  } catch {
    return base;
  }
  const out = freshSave();
  out.sound = typeof s.sound === "boolean" ? s.sound : true;
  out.love = typeof s.love === "number" && s.love >= 0 && s.love < LOVE_PER_BOX ? s.love : 0;
  out.tried = strings(s.tried);
  if (s.v === 1 || s.v === undefined) {
    // The test build had no collection yet: keep sound, love and what was tried.
    return out;
  }
  out.boxes = Math.min(99, count(s.boxes));
  out.stars = count(s.stars);
  const owned = typeof s.owned === "object" && s.owned !== null ? (s.owned as Record<string, unknown>) : {};
  for (const [id, o] of Object.entries(owned)) {
    if (!defById(id) || typeof o !== "object" || o === null) continue;
    const rec = o as Record<string, unknown>;
    const name = typeof rec.name === "string" ? cleanName(rec.name) : "";
    const hat = typeof rec.hat === "string" && hatById(rec.hat) ? rec.hat : "";
    out.owned[id] = { got: count(rec.got), ...(name ? { name } : {}), ...(hat ? { hat } : {}) };
  }
  out.active = typeof s.active === "string" && out.owned[s.active] ? s.active : (Object.keys(out.owned)[0] ?? null);
  out.tutorial = s.tutorial === "done" ? "done" : strings(s.tutorial);
  out.hats = [...new Set(strings(s.hats).filter((h) => hatById(h)))];
  for (const o of Object.values(out.owned)) if (o.hat && !out.hats.includes(o.hat)) delete o.hat;
  out.place = PLACE_IDS.includes(s.place as PlaceId) ? (s.place as PlaceId) : "table";
  const jobs = typeof s.jobs === "object" && s.jobs !== null ? (s.jobs as Record<string, unknown>) : {};
  for (const p of PLACE_IDS) if (count(jobs[p]) > 0) out.jobs[p] = count(jobs[p]);
  out.zoom = typeof s.zoom === "number" && s.zoom >= ZOOM_MIN && s.zoom <= ZOOM_MAX ? s.zoom : 1;
  out.seen = strings(s.seen);
  if (s.v === 2) {
    // New in this update: friends play together, so bring the newest ones out.
    out.team = Object.keys(out.owned)
      .filter((id) => id !== out.active)
      .sort((a, b) => out.owned[b].got - out.owned[a].got)
      .slice(0, TEAM_MAX);
  } else {
    out.team = [...new Set(strings(s.team))].filter((id) => out.owned[id] && id !== out.active).slice(0, TEAM_MAX);
  }
  return out;
}

export function loadSave(): Save {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return freshSave();
  }
}

export function storeSave(s: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // private mode or storage full: play on without saving
  }
}

/** Adds love; returns how many boxes were earned. */
export function addLove(s: Save, amount: number): number {
  s.love += amount;
  let earned = 0;
  while (s.love >= LOVE_PER_BOX) {
    s.love -= LOVE_PER_BOX;
    s.boxes += 1;
    earned++;
  }
  return earned;
}

/** Puts a squishy from a box into the collection. A repeat becomes Squish Stars. */
export function collect(s: Save, id: string, now: number): { isNew: boolean; stars: number } {
  if (s.owned[id]) {
    s.stars += 5;
    return { isNew: false, stars: 5 };
  }
  s.owned[id] = { got: now };
  return { isNew: true, stars: 0 };
}

/**
 * Makes `id` the one you hold. The one you held stays out as a friend if there
 * is room; `id` leaves the friends if it was one.
 */
export function holdSquishy(s: Save, id: string): void {
  if (!s.owned[id] || s.active === id) return;
  const prev = s.active;
  const at = s.team.indexOf(id);
  if (at >= 0) {
    // Swap places: the old one takes its spot with the friends.
    if (prev) s.team[at] = prev;
    else s.team.splice(at, 1);
  } else if (prev && s.team.length < TEAM_MAX) s.team.push(prev);
  s.active = id;
}

/** Brings a resting squishy out to play, sending `swapOut` in if the team is full. */
export function bringOut(s: Save, id: string, swapOut?: string): boolean {
  if (!s.owned[id] || id === s.active || s.team.includes(id)) return false;
  if (s.team.length >= TEAM_MAX) {
    const at = swapOut ? s.team.indexOf(swapOut) : -1;
    if (at < 0) return false;
    s.team[at] = id;
    return true;
  }
  s.team.push(id);
  return true;
}

/** Sends a friend in to rest in the closet. */
export function sendIn(s: Save, id: string): void {
  s.team = s.team.filter((t) => t !== id);
}

export function addHat(s: Save, id: string): boolean {
  if (!hatById(id) || s.hats.includes(id)) return false;
  s.hats.push(id);
  return true;
}

export function nameOf(s: Save, id: string): string {
  return s.owned[id]?.name || defById(id)?.name || "Squishy";
}
