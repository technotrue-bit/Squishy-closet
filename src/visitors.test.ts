import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { pickVisitor, TIER_WEIGHT, visitorTier } from "./visitors";

const oct = new Date(2026, 9, 20);
const may = new Date(2026, 4, 20);
const byId = (id: string) => CATALOG.find((d) => d.id === id)!;

describe("squishies passing by", () => {
  it("sorts every squishy into a tier", () => {
    expect(visitorTier(byId("bao-rosy-matte"), may)).toBe("common");
    expect(visitorTier(byId("bao-rosy-shiny"), may)).toBe("uncommon");
    expect(visitorTier(byId("spooky-boo-glow"), oct)).toBe("rare");
    expect(visitorTier(byId("bao-gold"), oct)).toBe("superRare");
    // Spooky ones are a step rarer outside October.
    expect(visitorTier(byId("spooky-boo-matte"), oct)).toBe("common");
    expect(visitorTier(byId("spooky-boo-matte"), may)).toBe("uncommon");
    expect(visitorTier(byId("spooky-boo-glitter"), may)).toBe("superRare");
  });

  it("makes rare ones a matter of hours", () => {
    // About 42 passers-by an hour (one every 85 s on average).
    const perHour = 3600 / 85;
    const total = CATALOG.reduce((n, d) => n + TIER_WEIGHT[visitorTier(d, oct)], 0);
    const hoursToSee = (id: string) => 1 / ((TIER_WEIGHT[visitorTier(byId(id), oct)] / total) * perHour);
    expect(hoursToSee("bao-rosy-matte")).toBeLessThan(1);
    expect(hoursToSee("bao-rosy-shiny")).toBeGreaterThan(1.5);
    expect(hoursToSee("spooky-boo-glow")).toBeGreaterThan(6);
    expect(hoursToSee("bao-gold")).toBeGreaterThan(20);
  });

  it("picks by weight", () => {
    const pool = [byId("bao-rosy-matte"), byId("bao-gold")];
    expect(pickVisitor(pool, oct, () => 0)?.id).toBe("bao-rosy-matte");
    expect(pickVisitor(pool, oct, () => 0.999)?.id).toBe("bao-gold");
    expect(pickVisitor([], oct, () => 0.5)).toBeNull();
  });
});
