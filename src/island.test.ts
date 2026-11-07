import { describe, expect, it } from "vitest";
import { INTRO, introGap, islandCast, ISLAND_MAX, jumpProgress, lidAngle } from "./island";

describe("who hops about the island", () => {
  it("is nobody before you have a squishy", () => {
    expect(islandCast({}, null, [])).toEqual([]);
  });

  it("puts the one you hold and its friends first, then the newest, with their hats", () => {
    const owned = {
      a: { got: 1 },
      b: { got: 5, hat: "beanie" },
      c: { got: 3 },
      d: { got: 4 },
      e: { got: 2, hat: "witch" },
    };
    expect(islandCast(owned, "c", ["e"])).toEqual([
      { id: "c", hat: null },
      { id: "e", hat: "witch" },
      { id: "b", hat: "beanie" },
      { id: "d", hat: null },
      { id: "a", hat: null },
    ]);
  });

  it("skips ones you no longer have and stops at the most the island holds", () => {
    const owned: Record<string, { got: number }> = {};
    for (let i = 0; i < ISLAND_MAX + 5; i++) owned[`s${i}`] = { got: i };
    const cast = islandCast(owned, "gone", ["s0", "gone"]);
    expect(cast).toHaveLength(ISLAND_MAX);
    expect(cast[0].id).toBe("s0");
    expect(cast[1].id).toBe(`s${ISLAND_MAX + 4}`);
  });
});

describe("jumping out of the squishy case", () => {
  it("lets them out one at a time, in order, after the lid pops", () => {
    const n = 4;
    expect(jumpProgress(0, n, INTRO.lidAt)).toBeLessThan(0);
    const t = INTRO.firstAt + 0.1;
    expect(jumpProgress(0, n, t)).toBeGreaterThan(0);
    expect(jumpProgress(1, n, t)).toBeLessThan(0);
    // Each one starts a gap after the one before.
    expect(jumpProgress(2, n, INTRO.firstAt + 2 * introGap(n))).toBeCloseTo(0);
    expect(jumpProgress(n - 1, n, 10)).toBeGreaterThanOrEqual(1);
  });

  it("gets a full island out in a few seconds", () => {
    expect(INTRO.firstAt + (ISLAND_MAX - 1) * introGap(ISLAND_MAX) + INTRO.jump).toBeLessThan(6);
    expect(introGap(1)).toBeLessThanOrEqual(0.6);
  });

  it("keeps the lid shut before and after, and open while they jump", () => {
    expect(lidAngle(3, 0)).toBe(0);
    expect(lidAngle(3, INTRO.firstAt)).toBeLessThan(-0.8);
    expect(lidAngle(3, 20)).toBe(0);
    // With nobody to let out it stays shut.
    expect(lidAngle(0, INTRO.firstAt)).toBe(0);
  });
});
