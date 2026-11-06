// Daily care. Each day your squishy would love a snack, a bath, a nap and some play. Doing one fills the heart a
// little; doing all four in a day brings a small present. Nothing ever goes wrong when you don't: there is no
// hunger that grows, nobody gets sick or sad, and nothing nags. A new day simply brings four fresh things to do.
// The day is the phone's own day (so ?date=YYYY-MM-DD lets a grown-up try another one). Only facts and rules
// live here; main.ts plays it and ui.ts draws it.

import type { Save } from "./save";
import { COOKIES_MAX } from "./babies";
import type { Wish } from "./wishes";
import { wishFor } from "./wishes";
import type { MoodId } from "./personality";

export type CareId = "feed" | "bath" | "nap" | "play";
export const CARE_IDS: readonly CareId[] = ["feed", "bath", "nap", "play"];

/** Love each care gives the first time today (the bath gives its own). */
export const CARE_LOVE = 20;
/** Love for doing one again later the same day, just for fun. */
export const CARE_AGAIN_LOVE = 4;
/** The present for doing all four in a day. */
export const PRESENT_COOKIES = 1;
export const PRESENT_STARS = 3;

export interface Care {
  /** The day the done list is for (YYYY-MM-DD, the phone's own day), "" before the first. */
  day: string;
  /** What was done that day. */
  done: CareId[];
  /** Days everything was done, ever (not in a row: missing a day takes nothing away). */
  days: number;
}

export const freshCare = (): Care => ({ day: "", done: [], days: 0 });

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const isCare = (x: unknown): x is CareId => typeof x === "string" && (CARE_IDS as readonly string[]).includes(x);

export function cleanCare(raw: unknown): Care {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return freshCare();
  const r = raw as Record<string, unknown>;
  const day = typeof r.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? r.day : "";
  const done = day && Array.isArray(r.done) ? [...new Set(r.done.filter(isCare))] : [];
  const days = typeof r.days === "number" && Number.isFinite(r.days) && r.days >= 0 ? Math.floor(r.days) : 0;
  return { day, done, days };
}

/** What has been done today. */
export const doneToday = (c: Care, d: Date): CareId[] => (c.day === dayKey(d) ? c.done : []);

/** How many of the four are left today. */
export const leftToday = (c: Care, d: Date): number => CARE_IDS.length - doneToday(c, d).length;

export interface Cared {
  /** First time today (it counts); false when it was done already and this was just for fun. */
  first: boolean;
  /** Love it gives. */
  love: number;
  /** That was the last of the four: the present was given. */
  present: boolean;
}

/**
 * One of the four, done. Counts it for today and gives the present when it was the last one. The bath's own
 * love comes from the bath, so here it gives none.
 */
export function doCare(s: Save, id: CareId, d: Date): Cared {
  const key = dayKey(d);
  if (s.care.day !== key) s.care = { day: key, done: [], days: s.care.days };
  if (s.care.done.includes(id)) return { first: false, love: id === "bath" ? 0 : CARE_AGAIN_LOVE, present: false };
  s.care.done.push(id);
  const present = s.care.done.length === CARE_IDS.length;
  if (present) {
    s.care.days += 1;
    s.cookies = Math.min(COOKIES_MAX, s.cookies + PRESENT_COOKIES);
    s.stars += PRESENT_STARS;
  }
  return { first: true, love: id === "bath" ? 0 : CARE_LOVE, present };
}

/** Two phones' care put together when moving: the most days, and today's list from whichever is newer. */
export function combineCare(a: Care, b: Care): Care {
  const newer = b.day > a.day ? b : a;
  const done = a.day === b.day ? [...new Set([...a.done, ...b.done])] : [...newer.done];
  return { day: newer.day, done, days: Math.max(a.days, b.days) };
}

// ---- the little games -------------------------------------------------

export const FEED: Wish = {
  ask: "{n} is a little hungry!",
  title: "Snack time for {n}!",
  how: "Drag each snack to {n}",
  play: "feed",
  things: ["🍓", "🍎", "🍪"],
  need: 3,
  yay: "Yum yum! All full!",
};

export const NAP: Wish = {
  ask: "{n} is getting sleepy",
  title: "Nap time for {n}",
  how: "Press and hold {n} to rock it to sleep",
  play: "hold",
  things: ["🌙", "⭐", "💤"],
  need: 3,
  yay: "Zzz... what a cozy nap!",
};

const BALL: Wish = {
  ask: "{n} wants to play!",
  title: "Play with {n}!",
  how: "Tap the ball!",
  play: "pop",
  things: ["⚽", "🏀", "🎾"],
  need: 5,
  yay: "That was so fun!",
};

/** Play is the squishy's own favorite game, when it's a playing kind of game, or a ball game. */
export function playFor(m: MoodId): Wish {
  const w = wishFor(m);
  return w.play === "pop" || w.play === "bounce" ? w : BALL;
}

/** The game for a care, or null for the bath (which has its own). */
export function careGame(id: CareId, m: MoodId): Wish | null {
  if (id === "feed") return FEED;
  if (id === "nap") return NAP;
  if (id === "play") return playFor(m);
  return null;
}

export const CARE_INFO: Record<CareId, { icon: string; name: string }> = {
  feed: { icon: "🍓", name: "Snack" },
  bath: { icon: "🛁", name: "Bath" },
  nap: { icon: "🌙", name: "Nap" },
  play: { icon: "⚽", name: "Play" },
};
