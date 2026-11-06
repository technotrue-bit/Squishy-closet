import { describe, expect, it } from "vitest";
import { boxSolids, pushOut, route, routeLength, spread, type Pt, type Solid } from "./nav";

/** How close a way comes to a solid's middle, all along it. */
function closest(from: Pt, way: Pt[], s: Solid): number {
  let best = Infinity;
  let a = from;
  for (const b of way) {
    for (let k = 0; k <= 50; k++) {
      const t = k / 50;
      best = Math.min(best, Math.hypot(a.x + (b.x - a.x) * t - s.x, a.z + (b.z - a.z) * t - s.z));
    }
    a = b;
  }
  return best;
}

describe("getting about", () => {
  const cake: Solid = { x: 0, z: 0, r: 1 };

  it("hops straight when nothing is in the way", () => {
    expect(route({ x: -3, z: 2 }, { x: 3, z: 2 }, [cake], 0.6)).toEqual([{ x: 3, z: 2 }]);
  });

  it("goes round a thing in the way, never through it", () => {
    const from = { x: -3, z: 0 };
    const way = route(from, { x: 3, z: 0 }, [cake], 0.6);
    expect(way.length).toBeGreaterThan(1);
    expect(way[way.length - 1]).toEqual({ x: 3, z: 0 });
    expect(closest(from, way, cake)).toBeGreaterThanOrEqual(1.6 - 1e-3);
    // And not the long way round.
    expect(routeLength(from, way)).toBeLessThan(8);
  });

  it("threads between several things", () => {
    const solids = [...boxSolids(0, 0, 3.6, 1.2), { x: 3, z: 1.5, r: 0.5 }, { x: -3, z: -1.5, r: 0.5 }];
    const from = { x: -1, z: -3 };
    const way = route(from, { x: 1, z: 3 }, solids, 0.6);
    for (const s of solids) expect(closest(from, way, s)).toBeGreaterThanOrEqual(s.r + 0.6 - 1e-3);
  });

  it("can always step out of something it is standing in", () => {
    const way = route({ x: 0.5, z: 0 }, { x: 4, z: 0 }, [cake], 0.6);
    expect(way[way.length - 1]).toEqual({ x: 4, z: 0 });
  });

  it("moves a spot out of a thing", () => {
    const p = pushOut({ x: 0.3, z: 0.4 }, [cake], 0.6);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(1.6);
    // Out the way it was already leaning.
    expect(p.x).toBeGreaterThan(0);
    expect(p.z).toBeGreaterThan(0);
  });

  it("covers a long box with circles end to end", () => {
    const row = boxSolids(1, -2, 3.6, 1.2);
    expect(row.length).toBe(3);
    expect(row[0].x).toBeCloseTo(-0.2);
    expect(row[2].x).toBeCloseTo(2.2);
    const turned = boxSolids(0, 0, 3, 1, Math.PI / 2);
    expect(Math.abs(turned[0].x)).toBeLessThan(1e-9);
    expect(Math.abs(turned[0].z)).toBeCloseTo(1);
  });
});

describe("stepping away from something it's too close to", () => {
  it("goes round it, never through, when it starts a hair too close", () => {
    const shell: Solid = { x: 0, z: 0, r: 0.3 };
    const from = { x: 1.29, z: 0 };
    const way = route(from, { x: -3, z: 0 }, [shell], 1);
    expect(way.length).toBeGreaterThan(1);
    expect(way[way.length - 1]).toEqual({ x: -3, z: 0 });
    // Never any closer than it started.
    expect(closest(from, way, shell)).toBeGreaterThanOrEqual(1.29 - 2e-3);
  });

  it("can still step out from deep inside", () => {
    const way = route({ x: 0.2, z: 0 }, { x: 3, z: 0 }, [{ x: 0, z: 0, r: 1 }], 0.6);
    expect(way).toEqual([{ x: 3, z: 0 }]);
  });
});

describe("not standing inside each other", () => {
  it("eases two bodies apart until they just touch", () => {
    const a = { x: 0, z: 0, r: 0.9 };
    const b = { x: 1.2, z: 0, r: 0.9 };
    for (let i = 0; i < 100; i++) spread([a, b], 0.05);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(1.8, 3);
    // Each moved its share, the same way it already was from the other.
    expect(a.x).toBeCloseTo(-0.3, 3);
    expect(b.x).toBeCloseTo(1.5, 3);
  });

  it("moves only a little each time", () => {
    const a = { x: 0, z: 0, r: 0.9 };
    const b = { x: 0.5, z: 0, r: 0.9 };
    spread([a, b], 0.05);
    expect(a.x).toBeCloseTo(-0.05, 6);
    expect(b.x).toBeCloseTo(0.55, 6);
  });

  it("leaves a still one where it is and moves the other the whole way", () => {
    const main = { x: 0, z: 0, r: 1.2, still: true };
    const f = { x: 0, z: -1.5, r: 0.9 };
    for (let i = 0; i < 100; i++) spread([main, f], 0.05);
    expect(main.z).toBe(0);
    expect(f.z).toBeCloseTo(-2.1, 3);
  });

  it("parts two right on top of each other, and leaves ones apart alone", () => {
    const a = { x: 1, z: 1, r: 0.9 };
    const b = { x: 1, z: 1, r: 0.9 };
    const c = { x: 9, z: 9, r: 0.9 };
    const moved = spread([a, b, c], 1);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(1.8, 6);
    expect(moved.has(c)).toBe(false);
    expect(c).toEqual({ x: 9, z: 9, r: 0.9 });
  });
});
