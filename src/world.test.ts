import { describe, expect, it } from "vitest";
import { boxHat, HATS, hatById, spookyHat } from "./hats";
import { hatsEarned, PLACES, placeById } from "./places";

describe("hats and places", () => {
  it("has unique hats, and every place hat is a real place hat", () => {
    expect(new Set(HATS.map((h) => h.id)).size).toBe(HATS.length);
    for (const p of PLACES) {
      expect(p.jobs.length).toBeGreaterThanOrEqual(3);
      for (const h of p.hats) expect(hatById(h.hat)?.from).toBe("place");
    }
    const placeHats = PLACES.flatMap((p) => p.hats.map((h) => h.hat));
    expect(new Set(placeHats).size).toBe(HATS.filter((h) => h.from === "place").length);
  });

  it("gives place hats as jobs are done", () => {
    const beach = placeById("beach");
    expect(hatsEarned(beach, 1, [])).toEqual([]);
    expect(hatsEarned(beach, 2, [])).toEqual(["sunHat"]);
    expect(hatsEarned(beach, 9, ["sunHat"])).toEqual(["flowerCrown", "propeller"]);
  });

  it("box hats are sometimes, never ones you have, and spooky mostly in October", () => {
    expect(boxHat([], false, () => 0.9)).toBeNull();
    const all = HATS.filter((h) => h.from === "box").map((h) => h.id);
    expect(boxHat(all, true, () => 0)).toBeNull();
    let seq = [0, 0.99];
    const got = boxHat([], true, () => seq.shift() ?? 0);
    expect(got).toBe("pumpkin");
  });

  it("box hats never include the Spooky Box and bath hats", () => {
    for (let i = 0; i < 50; i++) {
      const got = boxHat([], true, () => (i % 2 ? 0 : (i + 0.5) / 50));
      if (got) expect(hatById(got)?.from).toBe("box");
    }
  });

  it("Spooky Boxes bring a spooky hat you don't have, until you have them all", () => {
    const spooky = HATS.filter((h) => h.spooky).map((h) => h.id);
    expect(spooky).toEqual(["witch", "pumpkin", "batBow", "candyCorn"]);
    expect(spookyHat([], () => 0.99)).toBe("candyCorn");
    expect(spookyHat(["witch", "pumpkin", "batBow"], () => 0)).toBe("candyCorn");
    expect(spookyHat(spooky, () => 0)).toBeNull();
  });
});

describe("hat models", () => {
  it("has a 3D model for every hat", async () => {
    const { HAT_MODEL_IDS } = await import("./hatModels");
    expect([...HAT_MODEL_IDS].sort()).toEqual(HATS.map((h) => h.id).sort());
  });
});
