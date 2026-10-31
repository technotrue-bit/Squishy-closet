// Progress lives only on this device. The version number lets later updates
// carry every kid's squishies forward; old saves are upgraded on load.

import { defById } from "./catalog";
import { hatById } from "./hats";
import { PLACE_IDS, type PlaceId } from "./places";
import { catalogMood, isMood, type MoodId } from "./personality";
import { BABIES_MAX, cleanBaby, COOKIES_MAX, growLeft, moodOf, type Baby } from "./babies";
import { cleanGift, INBOX_MAX, type Gift } from "./gift";
import { isHalloween } from "./season";

export const SAVE_KEY = "squishycloset.save";
export const SAVE_VERSION = 6;
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
  /** Its personality. */
  mood: MoodId;
  /** It grew up from a baby you raised. */
  raised?: boolean;
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
  /** Cookies, for keeping baby squishies. */
  cookies: number;
  /** Babies you're raising. */
  babies: Baby[];
  /** Squishy mail from friends, waiting to be opened. */
  inbox: Gift[];
  /** Keys of gifts that came to this phone, so a link opened twice gives once. */
  giftsGot: string[];
  /** Keys of gifts made on this phone. */
  giftsSent: string[];
  /** Spooky Boxes earned on Halloween and not opened yet. */
  spookyBoxes: number;
  /** The year Halloween's own Spooky Box was given, 0 before the first. */
  spookyYear: number;
  /** Baths given. */
  baths: number;
  /** The shelf and buttons are slid down out of the way, for more room to play. */
  trayDown: boolean;
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
  cookies: 1,
  babies: [],
  inbox: [],
  giftsGot: [],
  giftsSent: [],
  spookyBoxes: 0,
  spookyYear: 0,
  baths: 0,
  trayDown: false,
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
    // Squishies from before personalities keep the one on their design.
    const mood = isMood(rec.mood) ? rec.mood : catalogMood(defById(id)!.personality);
    out.owned[id] = { got: count(rec.got), mood, ...(name ? { name } : {}), ...(hat ? { hat } : {}), ...(rec.raised === true ? { raised: true } : {}) };
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
  // Everyone starts with a cookie for their first baby.
  out.cookies = s.v === 4 || (typeof s.v === "number" && s.v > 4) ? Math.min(COOKIES_MAX, count(s.cookies)) : 1;
  const babies = Array.isArray(s.babies) ? s.babies : [];
  for (const b of babies) {
    const baby = cleanBaby(b, (id) => !!defById(id), cleanName);
    if (baby && out.babies.length < BABIES_MAX && !out.babies.some((o) => o.key === baby.key)) out.babies.push(baby);
  }
  const inbox = Array.isArray(s.inbox) ? s.inbox : [];
  for (const g of inbox) {
    const gift = cleanGift(g);
    if (gift && out.inbox.length < INBOX_MAX && !out.inbox.some((x) => x.key === gift.key)) out.inbox.push(gift);
  }
  out.giftsGot = [...new Set(strings(s.giftsGot))].slice(-300);
  out.giftsSent = [...new Set(strings(s.giftsSent))].slice(-300);
  out.spookyBoxes = Math.min(99, count(s.spookyBoxes));
  out.spookyYear = count(s.spookyYear);
  out.baths = count(s.baths);
  out.trayDown = s.trayDown === true;
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
export function collect(s: Save, id: string, now: number, mood: MoodId): { isNew: boolean; stars: number } {
  if (s.owned[id]) {
    s.stars += 5;
    return { isNew: false, stars: 5 };
  }
  s.owned[id] = { got: now, mood };
  return { isNew: true, stars: 0 };
}

/** Halloween's own Spooky Box, once a year on Halloween. True when it was just given. */
export function halloweenBox(s: Save, d: Date): boolean {
  if (!isHalloween(d) || s.spookyYear === d.getFullYear()) return false;
  s.spookyYear = d.getFullYear();
  s.spookyBoxes = Math.min(99, s.spookyBoxes + 1);
  return true;
}

/** Boxes just earned with love come as Spooky Boxes on Halloween. Returns how many did. */
export function spookyFromLove(s: Save, earned: number, d: Date): number {
  if (!isHalloween(d) || earned <= 0) return 0;
  const n = Math.min(earned, s.boxes);
  s.boxes -= n;
  s.spookyBoxes = Math.min(99, s.spookyBoxes + n);
  return n;
}

export function addCookie(s: Save, n = 1): boolean {
  if (s.cookies >= COOKIES_MAX) return false;
  s.cookies = Math.min(COOKIES_MAX, s.cookies + n);
  return true;
}

/** Keeps a baby you found, for a cookie. */
export function keepBaby(s: Save, baby: Baby): boolean {
  if (s.cookies < 1 || s.babies.length >= BABIES_MAX) return false;
  s.cookies -= 1;
  s.babies.push(baby);
  return true;
}

export interface GrownUp {
  baby: Baby;
  mood: MoodId;
  /** You already had this squishy: the one you raised joins it. */
  joined: boolean;
}

/** Babies a week old grow up into their squishy, with the personality you gave them. */
export function growUp(s: Save, now: number): GrownUp[] {
  const out: GrownUp[] = [];
  s.babies = s.babies.filter((b) => {
    if (growLeft(b, now) > 0) return true;
    const mood = moodOf(b);
    const had = s.owned[b.kind];
    if (had) {
      had.mood = mood;
      had.raised = true;
      if (b.name && !had.name) had.name = b.name;
      s.stars += 5;
    } else {
      s.owned[b.kind] = { got: now, mood, raised: true, ...(b.name ? { name: b.name } : {}) };
      if (!s.active) s.active = b.kind;
      else if (s.team.length < TEAM_MAX) s.team.push(b.kind);
    }
    out.push({ baby: b, mood, joined: !!had });
    return false;
  });
  return out;
}

export function babyName(b: Baby): string {
  return b.name || `Baby ${defById(b.kind)?.name ?? "Squishy"}`;
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
