// Progress lives only on this device. The version number lets later updates
// carry every kid's squishies forward; old saves are upgraded on load.

import { defById } from "./catalog";

export const SAVE_KEY = "squishycloset.save";
export const SAVE_VERSION = 2;
/** Love it takes to earn the next Squishy Box. */
export const LOVE_PER_BOX = 100;
export const NAME_MAX = 14;

export interface Owned {
  /** The kid's own name for it, if they changed it. */
  name?: string;
  /** When it was found (ms). */
  got: number;
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
    out.owned[id] = { got: count(rec.got), ...(name ? { name } : {}) };
  }
  out.active = typeof s.active === "string" && out.owned[s.active] ? s.active : (Object.keys(out.owned)[0] ?? null);
  out.tutorial = s.tutorial === "done" ? "done" : strings(s.tutorial);
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

export function nameOf(s: Save, id: string): string {
  return s.owned[id]?.name || defById(id)?.name || "Squishy";
}
