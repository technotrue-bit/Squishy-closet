import { describe, expect, it } from "vitest";
import { islandCast, ISLAND_MAX } from "./island";

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
