// Baby squishies. Now and then a baby is found fast asleep at one of the
// places. Keep it with a cookie and it comes along with you. How you play with
// it and what you teach it shapes who it becomes, and one real week after it
// was found it grows up into that squishy, with that personality. Now and then
// a baby wants something (a song, a treat, a hug); doing it with them helps them
// grow up sooner and shapes who they become. Only facts and rules live here; the
// babies you see are in nursery.ts.

import { CATALOG } from "./catalog";
import { weightOf } from "./boxes";
import { isMood, LESSONS, MOOD_IDS, type MoodId } from "./personality";

/** A baby grows up one real week after it was found. */
export const GROW_MS = 7 * 24 * 60 * 60 * 1000;
export const BABIES_MAX = 3;
export const COOKIES_MAX = 9;
/** Lessons close together tire a baby out; then it naps for a bit. */
export const LESSONS_BEFORE_NAP = 5;
export const LESSON_WINDOW_MS = 10 * 60 * 1000;
export const NAP_MS = 3 * 60 * 1000;
/** With fewer points than this (about three lessons) a baby grows up shy. */
export const SHY_BELOW = 3;
/** A new baby asks for its first thing soon after you keep it. */
export const WANT_FIRST_MS = 25 * 1000;
/** After a wish comes true, the next one comes along in 2 to 4 minutes. */
export const WANT_GAP_MS = 2 * 60 * 1000;
/** A wish nobody got to for a while turns into something else (no hard feelings). */
export const WANT_STALE_MS = 6 * 60 * 1000;
/** Each wish come true counts this much toward who it becomes (a lesson is 1). */
export const WISH_POINTS = 3;
/** Each wish come true makes it grow up this much sooner, for up to WISH_SPEEDUP_MAX wishes (5 days in all). */
export const WISH_MS = 10 * 60 * 60 * 1000;
export const WISH_SPEEDUP_MAX = 12;

export interface Baby {
  /** Its own key (two babies can be the same kind). */
  key: string;
  /** The squishy it grows up into. */
  kind: string;
  /** When it was found (ms). */
  got: number;
  name?: string;
  /** Points toward each personality from play and lessons. */
  traits: Partial<Record<MoodId, number>>;
  /** Lesson times lately, to know when it's tired. */
  lessons: number[];
  /** Napping until then (ms), or 0. */
  napUntil: number;
  /** What it wants to do right now, if anything (a lesson's personality). */
  want?: MoodId;
  /** When it started wanting that, or (with no want) when it'll want something next (ms). */
  wantAt: number;
  /** Wishes that came true. */
  wishes: number;
}

export function newBaby(kind: string, now: number): Baby {
  return { key: `b${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, kind, got: now, traits: {}, lessons: [], napUntil: 0, wantAt: now + WANT_FIRST_MS, wishes: 0 };
}

/** Which squishy a sleeping baby is: one you don't have or aren't raising yet. */
export function pickBabyKind(owned: ReadonlySet<string>, raising: readonly string[], date: Date, rand: () => number): string {
  const all = CATALOG.filter((d) => d.foundBy.some((f) => f.kind === "box"));
  const fresh = all.filter((d) => !owned.has(d.id) && !raising.includes(d.id));
  const pool = fresh.length ? fresh : all.filter((d) => !raising.includes(d.id));
  const from = pool.length ? pool : all;
  let total = 0;
  for (const d of from) total += weightOf(d, date);
  let r = rand() * total;
  for (const d of from) {
    r -= weightOf(d, date);
    if (r < 0) return d.id;
  }
  return from[from.length - 1].id;
}

/** How long until it grows up, ms (0 when it's ready). Wishes come true bring the day closer. */
export const growLeft = (b: Baby, now: number): number =>
  Math.max(0, b.got + GROW_MS - Math.min(b.wishes, WISH_SPEEDUP_MAX) * WISH_MS - now);

/** How grown up it is, 0 when found to 1 when it's ready. */
export const growth = (b: Baby, now: number): number => 1 - growLeft(b, now) / GROW_MS;

/** "6 days", "1 day", "5 hours", "a few minutes". */
export function growWords(ms: number): string {
  const h = ms / 3600000;
  if (h > 23) {
    const d = Math.max(1, Math.round(h / 24));
    return d === 1 ? "1 day" : `${d} days`;
  }
  if (h >= 1) {
    const n = Math.ceil(h);
    return n === 1 ? "1 hour" : `${n} hours`;
  }
  return "a few minutes";
}

export const isNapping = (b: Baby, now: number): boolean => b.napUntil > now;

const addTrait = (b: Baby, m: MoodId, n: number) => (b.traits[m] = Math.round(((b.traits[m] ?? 0) + n) * 100) / 100);

/**
 * A lesson. Returns "learned", or "tired" when it has had enough for now and
 * dozes off (that lesson still counts), or "napping" if it was already asleep.
 */
export function teach(b: Baby, mood: MoodId, now: number): "learned" | "tired" | "napping" {
  if (isNapping(b, now)) return "napping";
  addTrait(b, mood, 1);
  b.lessons = b.lessons.filter((t) => now - t < LESSON_WINDOW_MS);
  b.lessons.push(now);
  if (b.lessons.length >= LESSONS_BEFORE_NAP) {
    b.lessons = [];
    b.napUntil = now + NAP_MS;
    return "tired";
  }
  return "learned";
}

/** Playing with it (a tap). Waking it from a nap makes it a little grumpy. */
export function play(b: Baby, now: number): "played" | "woke" {
  if (isNapping(b, now)) {
    b.napUntil = 0;
    addTrait(b, "grumpy", 1);
    return "woke";
  }
  addTrait(b, "bouncy", 0.1);
  return "played";
}

/** The things a baby can want: one for each lesson. */
const WANTABLE: MoodId[] = LESSONS.map((l) => l.mood);

/** Something new to want: often what it already loves, but never the same thing twice running. */
export function pickWant(b: Baby, rand: () => number): MoodId {
  const from = WANTABLE.filter((m) => m !== b.want);
  const weight = (m: MoodId) => 1 + Math.min(3, (b.traits[m] ?? 0) * 0.4);
  let total = 0;
  for (const m of from) total += weight(m);
  let r = rand() * total;
  for (const m of from) {
    r -= weight(m);
    if (r < 0) return m;
  }
  return from[from.length - 1];
}

/**
 * Time passing: a baby that's awake starts wanting something when it's time ("new"), and
 * a wish left too long turns into a different one ("changed"). Otherwise null.
 */
export function stepWant(b: Baby, now: number, rand: () => number): "new" | "changed" | null {
  if (isNapping(b, now)) return null;
  if (!b.want) {
    if (now < b.wantAt) return null;
    b.want = pickWant(b, rand);
    b.wantAt = now;
    return "new";
  }
  if (now - b.wantAt < WANT_STALE_MS) return null;
  b.want = pickWant(b, rand);
  b.wantAt = now;
  return "changed";
}

/**
 * You did the thing it wanted: it counts a lot toward who it becomes and brings
 * growing up closer. Returns what it wanted, or null if it wasn't wanting anything.
 */
export function fulfil(b: Baby, now: number, rand: () => number): MoodId | null {
  const m = b.want;
  if (!m) return null;
  addTrait(b, m, WISH_POINTS);
  b.wishes += 1;
  b.want = undefined;
  b.wantAt = now + WANT_GAP_MS * (1 + rand());
  return m;
}

/** All its points from play and lessons. */
export const points = (b: Baby): number => MOOD_IDS.reduce((n, m) => n + (b.traits[m] ?? 0), 0);

/** Who it is becoming: the trait with the most points (shy if it learned little). */
export function moodOf(b: Baby): MoodId {
  if (points(b) < SHY_BELOW) return "shy";
  let best: MoodId = "shy";
  let most = 0;
  for (const m of MOOD_IDS) {
    const v = b.traits[m] ?? 0;
    if (v > most) {
      most = v;
      best = m;
    }
  }
  return best;
}

/** Reads a baby from a save, or null if it isn't one. */
export function cleanBaby(raw: unknown, known: (id: string) => boolean, cleanName: (s: string) => string): Baby | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.key !== "string" || !r.key || r.key.length > 40) return null;
  if (typeof r.kind !== "string" || !known(r.kind)) return null;
  const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0);
  const traits: Partial<Record<MoodId, number>> = {};
  if (typeof r.traits === "object" && r.traits !== null) {
    for (const [k, v] of Object.entries(r.traits as Record<string, unknown>)) if (isMood(k) && num(v) > 0) traits[k] = Math.min(999, num(v));
  }
  const name = typeof r.name === "string" ? cleanName(r.name) : "";
  return {
    key: r.key,
    kind: r.kind,
    got: num(r.got),
    ...(name ? { name } : {}),
    traits,
    lessons: Array.isArray(r.lessons) ? r.lessons.filter((t): t is number => num(t) > 0).slice(-LESSONS_BEFORE_NAP) : [],
    napUntil: num(r.napUntil),
    ...(isMood(r.want) && WANTABLE.includes(r.want) ? { want: r.want } : {}),
    // Babies from before wishes start wanting things soon.
    wantAt: typeof r.wantAt === "number" ? num(r.wantAt) : 0,
    wishes: Math.min(999, Math.floor(num(r.wishes))),
  };
}
