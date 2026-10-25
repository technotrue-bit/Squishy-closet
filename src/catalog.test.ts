import { describe, expect, it } from "vitest";
import { CATALOG, defById } from "./catalog";
import { isOctober, openBox, weightOf } from "./boxes";

const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe("catalog", () => {
  it("has the 30 Bao and 36 Spooky squishies, numbered 1..66 with unique ids and names", () => {
    expect(CATALOG.filter((d) => d.family === "bao")).toHaveLength(30);
    expect(CATALOG.filter((d) => d.family === "spooky")).toHaveLength(36);
    expect(CATALOG.map((d) => d.no)).toEqual(CATALOG.map((_, i) => i + 1));
    expect(new Set(CATALOG.map((d) => d.id)).size).toBe(66);
    expect(new Set(CATALOG.map((d) => d.name)).size).toBe(66);
    expect(defById("bao-rosy-matte")?.name).toBe("Rosy Bao");
  });

  it("every squishy can be found and has a sane feel", () => {
    for (const d of CATALOG) {
      expect(d.foundBy.length).toBeGreaterThan(0);
      expect(d.soft).toBeGreaterThanOrEqual(0);
      expect(d.soft).toBeLessThanOrEqual(1);
      expect(d.pitch).toBeGreaterThan(0.5);
    }
  });
});

describe("boxes", () => {
  const oct = new Date(2026, 9, 25);
  const may = new Date(2026, 4, 2);

  it("prefers squishies you don't have yet", () => {
    const owned = new Set(CATALOG.filter((d) => d.id !== "spooky-boo-glow").map((d) => d.id));
    for (const r of [0, 0.3, 0.99]) {
      const res = openBox(owned, oct, () => r);
      expect(res.def.id).toBe("spooky-boo-glow");
      expect(res.isNew).toBe(true);
    }
  });

  it("gives a repeat only when you have them all", () => {
    const owned = new Set(CATALOG.map((d) => d.id));
    expect(openBox(owned, oct, () => 0.5).isNew).toBe(false);
  });

  it("starts everyone with a friendly matte squishy", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const first = openBox(new Set(), may, () => r, true).def;
      expect(first.finish).toBe("matte");
      expect(first.family).toBe("bao");
      expect(openBox(new Set(), oct, () => r, true).def.finish).toBe("matte");
    }
  });

  it("makes Spooky common in October and rare the rest of the year", () => {
    const boo = defById("spooky-boo-matte")!;
    const rosy = defById("bao-rosy-matte")!;
    expect(isOctober(oct)).toBe(true);
    expect(weightOf(boo, oct)).toBe(weightOf(rosy, oct));
    expect(weightOf(boo, may)).toBeLessThan(weightOf(rosy, may) / 5);
    // Roughly: share of Spooky picks from an empty collection.
    const share = (date: Date) => {
      let spooky = 0;
      const r = seq(Array.from({ length: 400 }, (_, i) => (i + 0.5) / 400));
      for (let i = 0; i < 400; i++) if (openBox(new Set(), date, r).def.family === "spooky") spooky++;
      return spooky / 400;
    };
    expect(share(oct)).toBeGreaterThan(0.4);
    expect(share(may)).toBeLessThan(0.15);
  });

  it("makes gold the rarest", () => {
    const gold = defById("bao-gold")!;
    const matte = defById("bao-snow-matte")!;
    expect(weightOf(gold, may)).toBeLessThan(weightOf(matte, may) / 10);
  });
});
