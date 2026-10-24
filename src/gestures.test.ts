import { describe, expect, it } from "vitest";
import { Gestures, type GestureEvent } from "./gestures";

function rec() {
  const ev: GestureEvent[] = [];
  const g = new Gestures((e) => ev.push(e));
  const types = () => ev.map((e) => e.type).filter((t) => t !== "look" && t !== "pressHold" && t !== "stroke");
  return { g, ev, types };
}

describe("gestures", () => {
  it("a quick touch is a tap", () => {
    const { g, types } = rec();
    g.down(1, 100, 100, 0, true);
    g.update(80);
    g.up(1, 102, 101, 120);
    expect(types()).toEqual(["touch", "tap"]);
  });

  it("touching and holding still is a press", () => {
    const { g, types, ev } = rec();
    g.down(1, 100, 100, 0, true);
    for (let t = 0; t <= 900; t += 16) g.update(t);
    g.up(1, 100, 100, 900);
    expect(types()).toEqual(["touch", "pressStart", "pressEnd"]);
    const end = ev.find((e) => e.type === "pressEnd");
    expect(end && end.type === "pressEnd" && end.held).toBeCloseTo(0.9, 2);
  });

  it("a slow drag is petting, not a toss", () => {
    const { g, types, ev } = rec();
    g.down(1, 100, 300, 0, true);
    for (let k = 1; k <= 30; k++) g.move(1, 100 + k * 6, 300, k * 33);
    g.up(1, 280, 300, 1000);
    expect(ev.some((e) => e.type === "stroke")).toBe(true);
    expect(types()).toEqual(["touch", "dragEnd"]);
  });

  it("a fast swipe is a flick with the swipe direction", () => {
    const { g, ev } = rec();
    g.down(1, 100, 400, 0, true);
    for (let k = 1; k <= 6; k++) g.move(1, 100 + k * 30, 400 - k * 40, k * 16);
    g.up(1, 280, 160, 100);
    const f = ev.find((e) => e.type === "flick");
    expect(f).toBeTruthy();
    if (f && f.type === "flick") {
      expect(f.vx).toBeGreaterThan(0);
      expect(f.vy).toBeLessThan(0);
    }
  });

  it("rubbing back and forth is a tickle", () => {
    const { g, types } = rec();
    g.down(1, 200, 300, 0, true);
    let x = 200;
    for (let k = 1; k <= 24; k++) {
      x += k % 4 < 2 ? 25 : -25;
      g.move(1, x, 300, k * 25);
    }
    g.up(1, x, 300, 640);
    expect(types()).toContain("tickle");
  });

  it("two fingers on the squishy is a hug", () => {
    const { g, types } = rec();
    g.down(1, 150, 300, 0, true);
    g.down(2, 250, 300, 40, true);
    g.update(400);
    g.up(1, 150, 300, 800);
    g.up(2, 250, 300, 820);
    expect(types()).toEqual(["touch", "touch", "hugStart", "hugEnd"]);
  });

  it("touching the background does nothing to the squishy", () => {
    const { g, types } = rec();
    g.down(1, 10, 10, 0, false);
    g.update(500);
    g.up(1, 10, 10, 520);
    expect(types()).toEqual([]);
  });
});
