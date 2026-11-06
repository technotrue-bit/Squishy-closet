// When it is Halloween in Aurora's World, and when it is cozy autumn. The places follow the real seasons, and a
// holiday takes over while it lasts: fall begins at the equinox (September 22) in cozy autumn, all of October every
// place dresses up for a cozy, spooky evening and Spooky Hollow lights up on the island, then cozy autumn comes back
// until winter begins (December 21). On Halloween itself (October 31) a Spooky Box comes for everyone, and every
// box earned with love that day is a Spooky Box too. A grown-up can try any day by adding ?date=2026-10-31 to the
// game's address.

import { isOctober } from "./boxes";

/** The spooky season: all of October. */
export const isSpookySeason = (d: Date): boolean => isOctober(d);

/**
 * Fall, the real season: from the fall equinox (September 22) until winter begins (December 21). Halloween dresses
 * the places up for all of October, in the middle of it; cozy autumn is the rest of fall, into the holidays.
 */
export function isAutumnSeason(d: Date): boolean {
  const m = d.getMonth();
  const day = d.getDate();
  return (m === 8 && day >= 22) || m === 9 || m === 10 || (m === 11 && day < 21);
}

/**
 * How the places dress up today: the season, unless a holiday takes over. Spooky for Halloween (all October), cozy
 * autumn the rest of fall, or just as they are.
 */
export type Dress = "halloween" | "autumn" | null;
export const dressFor = (d: Date): Dress => (isSpookySeason(d) ? "halloween" : isAutumnSeason(d) ? "autumn" : null);

/** Halloween itself, October 31, by the phone's own clock. */
export const isHalloween = (d: Date): boolean => d.getMonth() === 9 && d.getDate() === 31;

/** Sleeps until Halloween in October (1 on October 30); 0 on Halloween and the rest of the year. */
export function sleepsToHalloween(d: Date): number {
  if (!isOctober(d) || d.getDate() >= 31) return 0;
  return 31 - d.getDate();
}

/** The day asked for by ?date=YYYY-MM-DD in an address, at the time of day `now` has, or null. */
export function dateFromQuery(search: string, now: Date): Date | null {
  const m = /[?&]date=(\d{4})-(\d{2})-(\d{2})(?:&|$)/.exec(search);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const out = new Date(y, mo, d, now.getHours(), now.getMinutes(), now.getSeconds());
  // Not a real day (like the 31st of a short month): ignore it.
  return out.getFullYear() === y && out.getMonth() === mo && out.getDate() === d ? out : null;
}

/** Today, or the day the address asks for. */
export function today(): Date {
  const now = new Date();
  try {
    return dateFromQuery(location.search, now) ?? now;
  } catch {
    return now;
  }
}
