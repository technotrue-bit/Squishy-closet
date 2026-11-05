import { describe, expect, it } from "vitest";
import { DIRT_MAX, dirtDays, dirtLevel, dirtOf, MUD, muddyWords, spotsAt } from "./dirt";
import { collect, freshSave, parseSave, wash } from "./save";
import { CATALOG } from "./catalog";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe("mud while you're away", () => {
  it("counts the phone's own days since the last bath", () => {
    const washed = at(2026, 11, 5, 23).getTime();
    expect(dirtDays(washed, at(2026, 11, 5, 23, ))).toBe(0);
    // Just after midnight is the next day.
    expect(dirtDays(washed, new Date(2026, 10, 6, 0, 5))).toBe(1);
    expect(dirtDays(washed, at(2026, 11, 9))).toBe(4);
    // Across a month and a clock change.
    expect(dirtDays(at(2026, 10, 30).getTime(), at(2026, 11, 2))).toBe(3);
  });

  it("is never muddy from a bath in the future or with no bath time", () => {
    expect(dirtDays(at(2026, 11, 9).getTime(), at(2026, 11, 5))).toBe(0);
    expect(dirtDays(undefined, at(2026, 11, 5))).toBe(0);
    expect(dirtDays(Number.NaN, at(2026, 11, 5))).toBe(0);
  });

  it("gets muddier day by day, then stops", () => {
    expect([0, 1, 2, 3, 4, 5, 30].map(dirtLevel)).toEqual([0, 1, 2, 2, 3, 3, 3]);
    expect(DIRT_MAX).toBe(3);
  });

  it("shows more spots at each level, keeping the ones before", () => {
    expect(spotsAt(0)).toBe(0);
    expect(spotsAt(1)).toBeGreaterThan(0);
    expect(spotsAt(2)).toBeGreaterThan(spotsAt(1));
    expect(spotsAt(3)).toBe(MUD.length);
  });

  it("keeps the mud off the face on the front", () => {
    for (const m of MUD) {
      const [x, y, z] = m.dir;
      const len = Math.hypot(x, y, z);
      // Straight ahead is (0, 0, 1): every spot is well round the side, up top or behind.
      expect(z / len).toBeLessThan(0.6);
    }
  });

  it("says something kind, a little different for each level", () => {
    const words = [1, 2, 3].map((l) => muddyWords("Bao", l));
    expect(new Set(words).size).toBe(3);
    for (const w of words) expect(w).toContain("Bao");
  });

  it("a bath makes it clean again", () => {
    const s = freshSave();
    const id = CATALOG[0].id;
    collect(s, id, at(2026, 11, 1).getTime(), "bouncy");
    expect(dirtOf(s.owned[id].washed, at(2026, 11, 6))).toBe(3);
    wash(s, id, at(2026, 11, 6));
    expect(dirtOf(s.owned[id].washed, at(2026, 11, 6))).toBe(0);
    expect(dirtOf(s.owned[id].washed, at(2026, 11, 7))).toBe(1);
  });

  it("a new squishy starts clean", () => {
    const s = freshSave();
    collect(s, CATALOG[0].id, at(2026, 11, 5).getTime(), "bouncy");
    expect(dirtOf(s.owned[CATALOG[0].id].washed, at(2026, 11, 5))).toBe(0);
  });

  it("squishies from before mud came start clean, and keep their bath time after", () => {
    const id = CATALOG[0].id;
    const old = JSON.stringify({ v: 6, owned: { [id]: { got: 5, mood: "bouncy" } }, tutorial: "done" });
    const now = at(2026, 11, 5).getTime();
    const s = parseSave(old, now);
    expect(s.owned[id].washed).toBe(now);
    expect(dirtOf(s.owned[id].washed, at(2026, 11, 5))).toBe(0);
    const back = parseSave(JSON.stringify(s), now + 9e9);
    expect(back.owned[id].washed).toBe(now);
    expect(parseSave(JSON.stringify({ ...s, owned: { [id]: { got: 5, mood: "bouncy", washed: "soon" } } }), now).owned[id].washed).toBe(now);
  });
});
