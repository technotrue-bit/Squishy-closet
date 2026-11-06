import { describe, expect, it } from "vitest";
import { isPoster, posterSave } from "./poster";
import { defById } from "./catalog";
import { hatById } from "./hats";
import { parseSave } from "./save";

describe("the poster", () => {
  it("is asked for with ?poster", () => {
    expect(isPoster("?poster")).toBe(true);
    expect(isPoster("?date=2026-11-06&poster=1")).toBe(true);
    expect(isPoster("")).toBe(false);
    expect(isPoster("?posters")).toBe(false);
  });

  it("dresses real squishies in real hats for every season, and survives a save check", () => {
    for (const dress of ["halloween", "autumn", null] as const) {
      const s = posterSave(dress, Date.UTC(2026, 10, 6));
      expect(Object.keys(s.owned)).toHaveLength(4);
      for (const [id, o] of Object.entries(s.owned)) {
        expect(defById(id), id).toBeDefined();
        expect(hatById(o.hat!), o.hat).toBeDefined();
      }
      expect(s.team).toHaveLength(3);
      expect(s.tutorial).toBe("done");
      // Nothing in it is something a real save would throw away.
      const back = parseSave(JSON.stringify(s));
      expect(back.active).toBe(s.active);
      expect(Object.values(back.owned).map((o) => o.hat)).toEqual(Object.values(s.owned).map((o) => o.hat));
    }
    expect(posterSave("autumn", 0).owned["bao-rosy-matte"].hat).toBe("beanie");
    expect(posterSave("halloween", 0).owned["bao-rosy-matte"].hat).toBe("witch");
  });
});
