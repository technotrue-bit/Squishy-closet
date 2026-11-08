import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { HATS, hatById } from "./hats";
import { COOKIES_MAX } from "./babies";
import { freshSave, parseSave, type Save } from "./save";
import { combineSaves } from "./move";
import { squishyOpen } from "./unlock";
import { claimSet, membersOf, progressOf, setById, SETS, setsToReward } from "./sets";

const own = (s: Save, ids: string[]) => ids.forEach((id, i) => (s.owned[id] = { got: 1_760_000_000_000 + i, mood: "bouncy" }));
const ids = (setId: string) => membersOf(setById(setId)!).map((d) => d.id);

describe("collection goals", () => {
  it("has the sets from the plan, each the right size", () => {
    const sizes = Object.fromEntries(SETS.map((x) => [x.id, membersOf(x).length]));
    expect(sizes).toEqual({
      "bao-basics": 9,
      "shiny-bao": 9,
      "glitter-bao": 9,
      "golden-trio": 3,
      "spooky-friends": 12,
      "glow-spooky": 12,
      "halloween-specials": 6,
    });
  });

  it("gives each set its own hat, found nowhere else", () => {
    const hats = SETS.map((x) => x.hat);
    expect(new Set(hats).size).toBe(hats.length);
    for (const h of hats) expect(hatById(h)?.from).toBe("set");
    expect(HATS.filter((h) => h.from === "set").length).toBe(SETS.length);
  });

  it("only counts squishies that are in the game", () => {
    for (const x of SETS) for (const d of membersOf(x)) expect(CATALOG).toContain(d);
  });

  it("shows how far along each set is", () => {
    const s = freshSave();
    own(s, ids("bao-basics").slice(0, 4));
    const p = progressOf(setById("bao-basics")!, s.owned, s.sets, (d) => squishyOpen(d, false));
    expect(p).toMatchObject({ got: 4, total: 9, done: false, open: true });
  });

  it("marks the sparkly sets as full game only in the free game", () => {
    const s = freshSave();
    const free = SETS.filter((x) => progressOf(x, s.owned, s.sets, (d) => squishyOpen(d, false)).open).map((x) => x.id);
    expect(free).toEqual(["bao-basics", "shiny-bao", "spooky-friends", "halloween-specials"]);
    for (const x of SETS) expect(progressOf(x, s.owned, s.sets, (d) => squishyOpen(d, true)).open).toBe(true);
  });

  it("gives a finished set's present once", () => {
    const s = freshSave();
    s.stars = 2;
    own(s, ids("bao-basics").slice(0, 8));
    expect(setsToReward(s)).toEqual([]);
    own(s, ids("bao-basics"));
    expect(setsToReward(s).map((x) => x.id)).toEqual(["bao-basics"]);
    const got = claimSet(s, setById("bao-basics")!);
    expect(got).toMatchObject({ newHat: true, stars: 10, cookies: 0 });
    expect(s.hats).toContain("steamer");
    expect(s.stars).toBe(12);
    expect(setsToReward(s)).toEqual([]);
    expect(claimSet(s, setById("bao-basics")!)).toBeNull();
    expect(s.stars).toBe(12);
  });

  it("gives a cookie for the Golden Trio, but never past the cookie jar's top", () => {
    const s = freshSave();
    s.cookies = 0;
    expect(claimSet(s, setById("golden-trio")!)?.cookies).toBe(1);
    expect(s.cookies).toBe(1);
    const full = freshSave();
    full.cookies = COOKIES_MAX;
    expect(claimSet(full, setById("golden-trio")!)?.cookies).toBe(0);
    expect(full.cookies).toBe(COOKIES_MAX);
  });

  it("still gives the stars when the hat already came from another phone", () => {
    const s = freshSave();
    s.hats = ["ghostPal"];
    expect(claimSet(s, setById("spooky-friends")!)).toMatchObject({ newHat: false, stars: 10 });
    expect(s.hats).toEqual(["ghostPal"]);
  });

  it("imports nothing that imports the save back (a loop like that stops the game from starting)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./sets.ts", import.meta.url), "utf8");
    const runtime = [...src.matchAll(/^import (?!type )[^;]*from "\.\/(\w+)"/gm)].map((m) => m[1]);
    expect(runtime.filter((m) => ["unlock", "mirror", "native", "move", "save"].includes(m))).toEqual([]);
  });

  it("keeps finished sets in the save and drops ones it doesn't know", () => {
    const s = parseSave(JSON.stringify({ ...freshSave(), sets: ["bao-basics", "nope", 3, "bao-basics"] }));
    expect(s.sets).toEqual(["bao-basics"]);
    expect(parseSave(JSON.stringify({ v: 6, owned: {} })).sets).toEqual([]);
  });

  it("brings finished sets along when moving phones, so presents aren't given twice", () => {
    const a = freshSave();
    a.sets = ["bao-basics"];
    const b = freshSave();
    b.sets = ["spooky-friends"];
    expect(combineSaves(a, b).save.sets.sort()).toEqual(["bao-basics", "spooky-friends"]);
  });
});
