import { describe, expect, it } from "vitest";
import { FrameMeter, modelTestCount, slotFor } from "./modelTest";

describe("model test", () => {
  it("is off unless the address asks for it", () => {
    expect(modelTestCount("")).toBeNull();
    expect(modelTestCount("?place=beach")).toBeNull();
    expect(modelTestCount("?modeltest")).toBe(1);
    expect(modelTestCount("?modeltest=30")).toBe(30);
    expect(modelTestCount("?modeltest=0")).toBe(0);
    expect(modelTestCount("?modeltest=999")).toBe(1);
  });

  it("calls 60fps with no hitch smooth, and a dropped frame or a slow rate not", () => {
    const m = new FrameMeter();
    for (let i = 0; i < 60; i++) m.add(16.7);
    expect(m.ready).toBe(true);
    expect(m.fps).toBeCloseTo(59.9, 0);
    expect(m.verdict()).toBe("smooth");
    m.add(50);
    expect(m.verdict()).toBe("ok");
    m.reset();
    for (let i = 0; i < 60; i++) m.add(33.3);
    expect(m.verdict()).toBe("slow");
  });

  it("ignores pauses, like switching apps", () => {
    const m = new FrameMeter();
    for (let i = 0; i < 40; i++) m.add(16.7);
    m.add(2000);
    expect(m.slowestMs).toBeCloseTo(16.7);
  });

  it("stands every copy on its own spot, clear of the bun at the middle", () => {
    const spots = Array.from({ length: 30 }, (_, i) => slotFor(i));
    for (const s of spots) expect(Math.hypot(s.x, s.z)).toBeGreaterThan(0.8);
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++)
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThan(0.4);
  });
});
