// Squishy mail: sending a friend a twin of one of your squishies. Like moving to a new phone, nothing goes to a
// server. The gift is a short code in a link's #fragment (it rides in the same "#move=" spot, so TrueAIGaming's
// play page passes it on as it is), opened on the friend's phone by QR code, share sheet or copy and paste.
// A gift carries only which squishy it is, its personality and its hat: never its name, which a kid typed, and
// nothing about who sent it. The one who sends it keeps theirs too.

import { defById } from "./catalog";
import { hatById } from "./hats";
import { catalogMood, isMood, type MoodId } from "./personality";
import type { Save } from "./save";

/** Starts every gift code, so it is never mistaken for a move code (those start "a"). */
const GIFT = "g1";
/** A gift is tiny; anything longer is not one. */
const MAX_CODE = 400;
/** Gifts waiting in the inbox at once. */
export const INBOX_MAX = 20;
/** Gift keys remembered, so the same link opened again gives nothing twice. */
const KEYS_MAX = 300;
/** A gift you already have goes to the star jar. */
export const REPEAT_STARS = 2;

export interface Gift {
  /** Which squishy. */
  id: string;
  mood: MoodId;
  hat?: string;
  /** This gift's own key. */
  key: string;
}

export const newGiftKey = (rand: () => number = Math.random): string =>
  Array.from({ length: 10 }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(rand() * 32) % 32]).join("");

/** A gift of the squishy `id` from this save, or null if it isn't yours. */
export function makeGift(s: Save, id: string, rand: () => number = Math.random): Gift | null {
  const o = s.owned[id];
  if (!o) return null;
  return { id, mood: o.mood, ...(o.hat ? { hat: o.hat } : {}), key: newGiftKey(rand) };
}

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function encodeGift(g: Gift): string {
  return GIFT + toBase64Url(JSON.stringify({ i: g.id, m: g.mood, ...(g.hat ? { h: g.hat } : {}), k: g.key }));
}

/** Finds a gift code in a link or in pasted text. */
export function findGift(text: string): string | null {
  const m = /(?:^|#move=|\s)(g1[A-Za-z0-9_-]{8,})/.exec(text.trim());
  return m && m[1].length <= MAX_CODE ? m[1] : null;
}

/** Cleans a gift read from a code or from a save, or null when it isn't a good one. */
export function cleanGift(raw: unknown): Gift | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const def = defById(id);
  if (!def || typeof r.key !== "string" || !/^[a-z0-9]{6,20}$/.test(r.key)) return null;
  const hat = typeof r.hat === "string" && hatById(r.hat) ? r.hat : "";
  return { id, mood: isMood(r.mood) ? r.mood : catalogMood(def.personality), ...(hat ? { hat } : {}), key: r.key };
}

export function decodeGift(code: string): Gift | null {
  if (!code.startsWith(GIFT) || code.length > MAX_CODE) return null;
  try {
    const p = JSON.parse(atob(code.slice(2).replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    if (typeof p !== "object" || p === null) return null;
    return cleanGift({ id: p.i, mood: p.m, hat: p.h, key: p.k });
  } catch {
    return null;
  }
}

const remember = (list: string[], key: string) => {
  list.push(key);
  if (list.length > KEYS_MAX) list.splice(0, list.length - KEYS_MAX);
};

/** You made a gift on this phone: opening its link here later is your own gift, not a new one. */
export function sentGift(s: Save, g: Gift): void {
  if (!s.giftsSent.includes(g.key)) remember(s.giftsSent, g.key);
}

export type Received = "inbox" | "own" | "again" | "full";

/** A gift link opened on this phone: into the inbox, unless it's yours, came already, or the inbox is full. */
export function receiveGift(s: Save, g: Gift): Received {
  if (s.giftsSent.includes(g.key)) return "own";
  if (s.giftsGot.includes(g.key) || s.inbox.some((x) => x.key === g.key)) return "again";
  if (s.inbox.length >= INBOX_MAX) return "full";
  s.inbox.push(g);
  remember(s.giftsGot, g.key);
  return "inbox";
}

export interface Opened {
  gift: Gift;
  isNew: boolean;
  /** Stars, when it was one you had already. */
  stars: number;
  /** The hat it came wearing, if it's new to you. */
  newHat: string | null;
}

/** Takes the next gift out of the inbox and keeps it. */
export function openGift(s: Save, now: number): Opened | null {
  const gift = s.inbox.shift();
  if (!gift) return null;
  const newHat = gift.hat && !s.hats.includes(gift.hat) ? gift.hat : null;
  if (newHat) s.hats.push(newHat);
  if (s.owned[gift.id]) {
    s.stars += REPEAT_STARS;
    return { gift, isNew: false, stars: REPEAT_STARS, newHat };
  }
  s.owned[gift.id] = { got: now, mood: gift.mood, ...(gift.hat ? { hat: gift.hat } : {}) };
  return { gift, isNew: true, stars: 0, newHat };
}
