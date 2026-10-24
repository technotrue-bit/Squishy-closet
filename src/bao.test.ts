import { describe, expect, it } from "vitest";
import { BOTTOM_Y, buildFacePatch, buildGrid, deform, restDeform, volume } from "./bao";

describe("bao body", () => {
  const g = buildGrid();
  const pos = new Float32Array(g.count * 3);

  it("is a closed bun facing outward, with a flat bottom", () => {
    deform(g, restDeform(), pos);
    expect(volume(pos, g.index)).toBeGreaterThan(2);
    let minY = Infinity;
    for (let k = 0; k < g.count; k++) minY = Math.min(minY, pos[k * 3 + 1]);
    expect(minY).toBeCloseTo(BOTTOM_Y, 2);
  });

  it("keeps about the same size when squashed, and stays on the basket floor", () => {
    deform(g, restDeform(), pos);
    const rest = volume(pos, g.index);
    deform(g, { ...restDeform(), squash: 0.45 }, pos);
    const squashed = volume(pos, g.index);
    expect(Math.abs(squashed / rest - 1)).toBeLessThan(0.03);
    let minY = Infinity;
    for (let k = 0; k < g.count; k++) minY = Math.min(minY, pos[k * 3 + 1]);
    expect(minY).toBeCloseTo(BOTTOM_Y, 2);
  });

  it("dents under a finger and never makes broken points", () => {
    const d = { ...restDeform(), dents: [{ x: 0, y: 0.2, z: 0.98, depth: 0.3, radius: 0.5 }], waves: [{ x: 1, y: 0, z: 0, age: 0.1, amp: 0.06 }], leanX: 0.3 };
    deform(g, d, pos);
    for (let k = 0; k < pos.length; k++) expect(Number.isFinite(pos[k])).toBe(true);
    // The front center moved in.
    const front = 32 * 97; // ring 32, column 0
    deform(g, restDeform(), pos);
    const z0 = pos[front * 3 + 2];
    deform(g, d, pos);
    expect(pos[front * 3 + 2]).toBeLessThan(z0 - 0.15);
  });

  it("face patch points at real body vertices on the front", () => {
    const f = buildFacePatch();
    deform(g, restDeform(), pos);
    for (let k = 0; k < f.count; k++) {
      expect(f.src[k]).toBeLessThan(g.count);
      expect(pos[f.src[k] * 3 + 2]).toBeGreaterThan(0.05);
    }
  });

  it("stays inside the basket wall when squished, bulging over the rim", () => {
    const wall = { wallR: 1.1, wallTop: -0.2 };
    deform(g, { ...restDeform(), squash: 0.5, ...wall }, pos);
    let overBelow = 0;
    let overAbove = 0;
    for (let k = 0; k < g.count; k++) {
      const r = Math.hypot(pos[k * 3], pos[k * 3 + 2]);
      const y = pos[k * 3 + 1];
      if (y < wall.wallTop - 0.1) overBelow = Math.max(overBelow, r - wall.wallR);
      if (y > wall.wallTop + 0.05) overAbove = Math.max(overAbove, r - wall.wallR);
    }
    expect(overBelow).toBeLessThanOrEqual(1e-6);
    expect(overAbove).toBeGreaterThan(0.1);
  });
});
