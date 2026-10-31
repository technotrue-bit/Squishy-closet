import { describe, expect, it } from "vitest";
import { CATALOG, defById } from "./catalog";
import { openBox, openSpookyBox } from "./boxes";
import { pickBabyKind } from "./babies";
import { PLACE_IDS } from "./places";
import { FREE_PLACES, fullWhy, inFreeGame, isEarly, locksFrom, parseUnlock, placeOpen, readUnlock, SELLING_FROM, squishyOpen, UNLOCK_KEY, writeUnlock } from "./unlock";

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe("full game unlock", () => {
  it("locks nothing on the live site or in the app until selling starts", () => {
    expect(SELLING_FROM).toBeNull();
    expect(locksFrom(null, false, 123)).toBeNull();
    expect(fullWhy({}, null, null)).toBe("open");
  });

  it("locks preview builds from when they were built, and the live game from when selling starts", () => {
    expect(locksFrom(null, true, 500)).toBe(500);
    expect(locksFrom(900, true, 500)).toBe(900);
    expect(locksFrom(900, false, 500)).toBe(900);
  });

  it("keeps the whole game for anyone who found a squishy before the locks started", () => {
    const from = 1_000_000;
    expect(isEarly({ a: { got: from - 1 } }, from)).toBe(true);
    expect(isEarly({ a: { got: 0 } }, from)).toBe(true);
    expect(isEarly({ a: { got: from + 5 } }, from)).toBe(false);
    expect(isEarly({}, from)).toBe(false);
    expect(fullWhy({ a: { got: from - 1 }, b: { got: from + 1 } }, from, null)).toBe("early");
    expect(fullWhy({ b: { got: from + 1 } }, from, null)).toBeNull();
  });

  it("opens the full game with a purchase", () => {
    expect(fullWhy({}, 1, { how: "apple", at: 2 })).toBe("apple");
    expect(fullWhy({}, 1, { how: "web", at: 2 })).toBe("web");
  });

  it("remembers an unlock, and ignores anything that isn't one", () => {
    const s = memory();
    expect(readUnlock(s)).toBeNull();
    writeUnlock("apple", 42, s);
    expect(readUnlock(s)).toEqual({ how: "apple", at: 42 });
    expect(UNLOCK_KEY.startsWith("squishycloset.")).toBe(true);
    expect(parseUnlock("{bad")).toBeNull();
    expect(parseUnlock(JSON.stringify({ how: "free" }))).toBeNull();
    expect(parseUnlock(null)).toBeNull();
  });

  it("frees two places and locks the rest", () => {
    expect(FREE_PLACES).toEqual(["room", "beach"]);
    expect(placeOpen("table", false)).toBe(false);
    for (const id of FREE_PLACES) expect(placeOpen(id, false)).toBe(true);
    const locked = PLACE_IDS.filter((id) => !placeOpen(id, false));
    expect(locked).toHaveLength(PLACE_IDS.length - 2);
    for (const id of PLACE_IDS) expect(placeOpen(id, true)).toBe(true);
  });

  it("keeps the sparkly squishies for the full game, and Halloween's Specials free", () => {
    const free = CATALOG.filter(inFreeGame);
    expect(free.every((d) => d.family === "halloween" || d.finish === "matte" || d.finish === "shiny")).toBe(true);
    expect(CATALOG.filter((d) => !inFreeGame(d)).every((d) => ["glitter", "glow", "gold"].includes(d.finish))).toBe(true);
    expect(CATALOG.filter((d) => d.family === "halloween").every(inFreeGame)).toBe(true);
    expect(CATALOG.every((d) => squishyOpen(d, true))).toBe(true);
  });

  it("only finds free squishies in boxes, Spooky Boxes and naps in the free game", () => {
    const allow = (d: (typeof CATALOG)[number]) => squishyOpen(d, false);
    const date = new Date(2026, 10, 5);
    for (let i = 0; i < 300; i++) {
      const r = Math.random;
      expect(inFreeGame(openBox(new Set(), date, r, false, allow).def)).toBe(true);
      expect(inFreeGame(openSpookyBox(new Set(["halloween-lantern"]), r, allow).def)).toBe(true);
      expect(inFreeGame(defById(pickBabyKind(new Set(), [], date, r, allow))!)).toBe(true);
    }
  });

  it("gives repeats once every free squishy is found, never a locked one", () => {
    const allow = (d: (typeof CATALOG)[number]) => squishyOpen(d, false);
    const owned = new Set(CATALOG.filter(inFreeGame).map((d) => d.id));
    const r = openBox(owned, new Date(2026, 10, 5), Math.random, false, allow);
    expect(r.isNew).toBe(false);
    expect(inFreeGame(r.def)).toBe(true);
  });
});
