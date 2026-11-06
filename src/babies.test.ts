import { describe, expect, it } from "vitest";
import {
  cleanBaby,
  fulfil,
  GROW_MS,
  growLeft,
  growWords,
  LESSONS_BEFORE_NAP,
  moodOf,
  NAP_MS,
  newBaby,
  pickBabyKind,
  play,
  stepWant,
  teach,
  WANT_FIRST_MS,
  WANT_STALE_MS,
  WISH_MS,
  WISH_SPEEDUP_MAX,
} from "./babies";
import { WISHES } from "./wishes";
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

  it("wants something soon after you keep it, and not while napping", () => {
    const b = newBaby("bao-snow-matte", 0);
    expect(stepWant(b, WANT_FIRST_MS - 1, Math.random)).toBe(null);
    b.napUntil = WANT_FIRST_MS + 10;
    expect(stepWant(b, WANT_FIRST_MS, Math.random)).toBe(null);
    expect(stepWant(b, WANT_FIRST_MS + 10, Math.random)).toBe("new");
    expect(LESSONS.some((l) => l.mood === b.want)).toBe(true);
    // A wish nobody gets to turns into a different one.
    const was = b.want;
    expect(stepWant(b, WANT_FIRST_MS + 10 + WANT_STALE_MS - 1, Math.random)).toBe(null);
    expect(stepWant(b, WANT_FIRST_MS + 10 + WANT_STALE_MS, Math.random)).toBe("changed");
    expect(b.want).not.toBe(was);
  });

  it("making a wish come true shapes who it becomes and brings growing up closer", () => {
    const b = newBaby("bao-snow-matte", 0);
    expect(fulfil(b, 1, Math.random)).toBe(null);
    b.want = "musical";
    expect(fulfil(b, 1000, () => 0)).toBe("musical");
    expect(b.want).toBeUndefined();
    expect(moodOf(b)).toBe("musical");
    expect(growLeft(b, 0)).toBe(GROW_MS - WISH_MS);
    // The next wish waits a little.
    expect(stepWant(b, 1001, Math.random)).toBe(null);
    // However many wishes, it still takes a couple of days.
    b.wishes = 50;
    expect(growLeft(b, 0)).toBe(GROW_MS - WISH_SPEEDUP_MAX * WISH_MS);
    expect(GROW_MS - WISH_SPEEDUP_MAX * WISH_MS).toBeGreaterThanOrEqual(2 * 24 * 3600000);
  });

  it("leans toward what it already loves, but asks for all sorts", () => {
    const b = newBaby("bao-snow-matte", 0);
    b.traits.sporty = 10;
    const seen = new Map<string, number>();
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      b.want = undefined;
      b.wantAt = 0;
      stepWant(b, 1, rand);
      seen.set(b.want!, (seen.get(b.want!) ?? 0) + 1);
    }
    expect(seen.size).toBe(LESSONS.length);
    const most = [...seen.entries()].sort((a, c) => c[1] - a[1])[0][0];
    expect(most).toBe("sporty");
  });

  it("has something to do for every wish", () => {
    for (const l of LESSONS) {
      const w = WISHES[l.mood];
      expect(w, l.mood).toBeTruthy();
      expect(w.things.length).toBeGreaterThan(0);
      expect(w.need).toBeGreaterThan(0);
    }
  });

  it("reads wishes from a save, and old babies get them too", () => {
    const keep = (s: string) => s;
    const old = cleanBaby({ key: "b1", kind: "bao-snow-matte", got: 5, traits: {}, lessons: [], napUntil: 0 }, () => true, keep)!;
    expect(old.wishes).toBe(0);
    expect(old.wantAt).toBe(0);
    expect(old.want).toBeUndefined();
    const now = cleanBaby({ key: "b2", kind: "bao-snow-matte", got: 5, traits: {}, want: "sporty", wantAt: 9, wishes: 2 }, () => true, keep)!;
    expect(now.want).toBe("sporty");
    expect(now.wishes).toBe(2);
    const bad = cleanBaby({ key: "b3", kind: "bao-snow-matte", got: 5, want: "grumpy", wishes: -3 }, () => true, keep)!;
    expect(bad.want).toBeUndefined();
    expect(bad.wishes).toBe(0);
  });
});
