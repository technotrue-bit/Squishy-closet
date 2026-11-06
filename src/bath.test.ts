import { describe, expect, it } from "vitest";
import { cleanness, rub, tubInside, washes, TUB_FLOOR, TUB_RIM, WATER_TOP, type Spot } from "./bath";

const spots = (): Spot[] => [
  { x: 0, y: 0, z: 0.8, left: 1 },
  { x: 0.7, y: 0.3, z: 0.3, left: 1 },
];

describe("bath time", () => {
  it("rubs mud off most right under the finger, none far away", () => {
    const s = spots();
    const off = rub(s, { x: 0, y: 0, z: 0.8 }, 0.5);
    expect(off).toBeCloseTo(0.5);
    expect(s[0].left).toBeCloseTo(0.5);
    expect(s[1].left).toBe(1);
    rub(s, { x: 0.1, y: 0, z: 0.8 }, 0.5);
    expect(s[0].left).toBeGreaterThan(0);
    expect(s[0].left).toBeLessThan(0.5);
  });

  it("never takes more mud than is there", () => {
    const s = spots();
    for (let i = 0; i < 10; i++) rub(s, { x: 0, y: 0, z: 0.8 }, 1);
    expect(s[0].left).toBe(0);
  });

  it("is all clean once every spot is (nearly) gone", () => {
    const s = spots();
    expect(cleanness(s)).toBe(0);
    s[0].left = 0;
    expect(cleanness(s)).toBeCloseTo(0.5);
    s[1].left = 0.02;
    expect(cleanness(s)).toBe(1);
    expect(cleanness([])).toBe(1);
  });

  it("washes foam right under the shower, and less to the side", () => {
    expect(washes(0, 0)).toBe(1);
    expect(washes(0.3, 0)).toBeGreaterThan(0);
    expect(washes(0.3, 0)).toBeLessThan(1);
    expect(washes(2, 0)).toBe(0);
  });

  it("fills to over the squishy's bottom, below the rim", () => {
    expect(WATER_TOP).toBeGreaterThan(TUB_FLOOR + 0.2);
    expect(WATER_TOP).toBeLessThan(TUB_RIM);
    expect(tubInside(TUB_FLOOR)).toBeLessThan(tubInside(WATER_TOP));
    expect(tubInside(TUB_RIM + 1)).toBe(tubInside(TUB_RIM));
  });
});
