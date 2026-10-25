import { describe, expect, it } from "vitest";
import { growWords, LESSONS_BEFORE_NAP, moodOf, NAP_MS, newBaby, pickBabyKind, play, teach } from "./babies";
import { LESSONS, MOODS } from "./personality";

describe("babies", () => {
  it("grows into what it's taught, or shy if it learned little", () => {
    const b = newBaby("bao-snow-matte", 0);
    expect(moodOf(b)).toBe("shy");
    teach(b, "silly", 1);
    teach(b, "silly", 2);
    teach(b, "brave", 3);
    expect(moodOf(b)).toBe("silly");
  });

  it("gets tired after a run of lessons and naps; waking it makes it grumpy", () => {
    const b = newBaby("bao-snow-matte", 0);
    for (let i = 1; i < LESSONS_BEFORE_NAP; i++) expect(teach(b, "calm", i)).toBe("learned");
    expect(teach(b, "calm", 10)).toBe("tired");
    expect(teach(b, "calm", 11)).toBe("napping");
    expect(play(b, 12)).toBe("woke");
    expect(b.traits.grumpy).toBe(1);
    expect(teach(b, "calm", 13)).toBe("learned");
    const c = newBaby("bao-snow-matte", 0);
    c.napUntil = 5;
    expect(play(c, NAP_MS)).toBe("played");
  });

  it("picks a kind you don't have yet", () => {
    const kind = pickBabyKind(new Set(["bao-rosy-matte"]), ["bao-snow-matte"], new Date(2026, 3, 1), () => 0);
    expect(kind).not.toBe("bao-rosy-matte");
    expect(kind).not.toBe("bao-snow-matte");
  });

  it("says how long until it grows up", () => {
    expect(growWords(7 * 24 * 3600000)).toBe("7 days");
    expect(growWords(49 * 3600000)).toBe("2 days");
    expect(growWords(23.5 * 3600000)).toBe("1 day");
    expect(growWords(3 * 3600000)).toBe("3 hours");
    expect(growWords(60000)).toBe("a few minutes");
  });

  it("has a lesson for every personality but shy and grumpy", () => {
    expect(LESSONS.length).toBe(MOODS.length - 2);
    expect(new Set(LESSONS.map((l) => l.icon)).size).toBe(LESSONS.length);
  });
});
