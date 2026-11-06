// When it is Halloween in Aurora's World. All of October every place dresses up for a cozy, spooky evening and
// Spooky Hollow lights up on the island. On Halloween itself (October 31) a Spooky Box comes for everyone, and every
// box earned with love that day is a Spooky Box too. A grown-up can try any day by adding ?date=2026-10-31 to the
// game's address.

import { isOctober } from "./boxes";

/** The spooky season: all of October. */
export const isSpookySeason = (d: Date): boolean => isOctober(d);

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
