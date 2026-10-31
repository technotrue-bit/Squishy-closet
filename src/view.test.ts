import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { TAB_RESERVE, bottomReserve, fitCamera, groundView, trayReserve } from "./view";

const seen = (w: number, h: number) => {
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  fitCamera(camera, w, h);
  return groundView(camera);
};

describe("what the camera shows of the ground", () => {
  it("is wide on its side, with ground far either side of the basket in view", () => {
    const v = seen(844, 390);
    expect(v.wide).toBe(true);
    for (const x of [-8, 8]) for (const z of [-2.2, -4, -6]) expect(v.inset({ x, z })).toBeGreaterThan(0.08);
  });

  it("is narrow upright, and the far sides are off screen", () => {
    const v = seen(390, 844);
    expect(v.wide).toBe(false);
    expect(v.inset({ x: 0, z: -4 })).toBeGreaterThan(0.9);
    expect(v.inset({ x: 8, z: -4 })).toBeLessThan(0);
    expect(v.inset({ x: -8, z: -4 })).toBeLessThan(0);
  });

  it("finds the screen's edge at each depth, just off screen", () => {
    const v = seen(390, 844);
    for (const z of [-2, -4, -6]) {
      for (const side of [-1, 1]) {
        const x = v.edgeX(z, side);
        expect(Math.sign(x)).toBe(side);
        expect(v.inset({ x, z })).toBeLessThan(0);
        expect(v.inset({ x: x * 0.8, z })).toBeGreaterThan(0);
      }
    }
  });
});

describe("sliding the shelf away", () => {
  it("keeps the full reserve with the shelf up and only the tab's room with it down", () => {
    for (const h of [390, 844]) {
      expect(trayReserve(h, 0)).toBe(bottomReserve(h));
      expect(trayReserve(h, 1)).toBe(TAB_RESERVE);
      const mid = trayReserve(h, 0.5);
      expect(mid).toBeLessThan(bottomReserve(h));
      expect(mid).toBeGreaterThan(TAB_RESERVE);
    }
  });

  it("gives the world more of the screen when the shelf is down", () => {
    const up = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    const down = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    for (const [w, h] of [[844, 390], [390, 844]]) {
      fitCamera(up, w, h, 1, 0);
      fitCamera(down, w, h, 1, 1);
      // The basket sits lower on the screen, into the room the shelf left.
      const at = (c: THREE.PerspectiveCamera) => new THREE.Vector3(0, 0, 0).project(c).y;
      expect(at(down)).toBeLessThan(at(up));
    }
  });
});
