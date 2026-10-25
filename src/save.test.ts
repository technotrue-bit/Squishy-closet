import { describe, expect, it } from "vitest";
import { addHat, addLove, bringOut, cleanName, collect, freshSave, holdSquishy, nameOf, parseSave, SAVE_VERSION, sendIn, TEAM_MAX } from "./save";

describe("save", () => {
  it("starts fresh when there is nothing saved or it is broken", () => {
    expect(parseSave(null)).toEqual(freshSave());
    expect(parseSave("{not json")).toEqual(freshSave());
    expect(parseSave("42")).toEqual(freshSave());
    expect(parseSave("[1,2]")).toEqual(freshSave());
  });

  it("upgrades a test build save, keeping sound and love", () => {
    const s = parseSave(JSON.stringify({ v: 1, look: "gold", love: 55, level: 3, sound: false, tried: ["tap", 7] }));
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.sound).toBe(false);
    expect(s.love).toBe(55);
    expect(s.tried).toEqual(["tap"]);
    expect(s.owned).toEqual({});
    expect(s.active).toBeNull();
  });

  it("keeps squishies it knows and drops ones it doesn't", () => {
    const s = parseSave(
      JSON.stringify({
        v: 2,
        owned: { "bao-rosy-matte": { got: 5, name: "Bun<b>bun" }, "not-a-squishy": { got: 1 } },
        active: "not-a-squishy",
        boxes: 2,
        stars: 10,
        tutorial: "done",
      }),
    );
    expect(Object.keys(s.owned)).toEqual(["bao-rosy-matte"]);
    expect(s.owned["bao-rosy-matte"].name).toBe("Bunbbun");
    expect(s.active).toBe("bao-rosy-matte");
    expect(s.boxes).toBe(2);
    expect(s.tutorial).toBe("done");
  });

  it("earns a box every 100 love", () => {
    const s = freshSave();
    expect(addLove(s, 60)).toBe(0);
    expect(addLove(s, 60)).toBe(1);
    expect(s.boxes).toBe(1);
    expect(s.love).toBe(20);
  });

  it("collects new squishies and turns repeats into stars", () => {
    const s = freshSave();
    expect(collect(s, "bao-rosy-matte", 1).isNew).toBe(true);
    expect(collect(s, "bao-rosy-matte", 2)).toEqual({ isNew: false, stars: 5 });
    expect(s.stars).toBe(5);
    expect(nameOf(s, "bao-rosy-matte")).toBe("Rosy Bao");
    s.owned["bao-rosy-matte"].name = "Puff";
    expect(nameOf(s, "bao-rosy-matte")).toBe("Puff");
  });

  it("cleans names", () => {
    expect(cleanName("  Mr Squish  ")).toBe("Mr Squish");
    expect(cleanName("a".repeat(40)).length).toBe(14);
  });

  it("brings the newest friends out when upgrading to this version", () => {
    const owned: Record<string, { got: number }> = {};
    ["bao-rosy-matte", "bao-snow-matte", "bao-peachy-matte", "bao-lilac-matte", "bao-cherry-matte"].forEach((id, i) => (owned[id] = { got: i }));
    const s = parseSave(JSON.stringify({ v: 2, owned, active: "bao-rosy-matte", tutorial: "done" }));
    expect(s.team.length).toBe(TEAM_MAX);
    expect(s.team).not.toContain("bao-rosy-matte");
    expect(s.team[0]).toBe("bao-cherry-matte");
    expect(s.place).toBe("table");
    expect(s.zoom).toBe(1);
  });

  it("keeps a good team, hats and place, and drops bad ones", () => {
    const s = parseSave(
      JSON.stringify({
        v: 3,
        owned: { "bao-rosy-matte": { got: 1, hat: "crown" }, "bao-snow-matte": { got: 2, hat: "nope" } },
        active: "bao-rosy-matte",
        team: ["bao-rosy-matte", "bao-snow-matte", "bao-snow-matte", "ghost"],
        hats: ["crown", "crown", "fake"],
        place: "moon",
        zoom: 9,
        jobs: { beach: 4, moon: 2 },
      }),
    );
    expect(s.team).toEqual(["bao-snow-matte"]);
    expect(s.hats).toEqual(["crown"]);
    expect(s.owned["bao-rosy-matte"].hat).toBe("crown");
    expect(s.owned["bao-snow-matte"].hat).toBeUndefined();
    expect(s.place).toBe("table");
    expect(s.zoom).toBe(1);
    expect(s.jobs).toEqual({ beach: 4 });
  });

  it("swaps who you hold with a friend, and brings friends out and in", () => {
    const s = freshSave();
    for (const id of ["bao-rosy-matte", "bao-snow-matte", "bao-peachy-matte", "bao-lilac-matte", "bao-cherry-matte"]) collect(s, id, 1);
    s.active = "bao-rosy-matte";
    expect(bringOut(s, "bao-snow-matte")).toBe(true);
    expect(bringOut(s, "bao-peachy-matte")).toBe(true);
    expect(bringOut(s, "bao-lilac-matte")).toBe(true);
    expect(bringOut(s, "bao-cherry-matte")).toBe(false);
    expect(bringOut(s, "bao-cherry-matte", "bao-peachy-matte")).toBe(true);
    expect(s.team).toEqual(["bao-snow-matte", "bao-cherry-matte", "bao-lilac-matte"]);
    holdSquishy(s, "bao-lilac-matte");
    expect(s.active).toBe("bao-lilac-matte");
    expect(s.team).toEqual(["bao-snow-matte", "bao-cherry-matte", "bao-rosy-matte"]);
    sendIn(s, "bao-snow-matte");
    expect(s.team).toEqual(["bao-cherry-matte", "bao-rosy-matte"]);
    holdSquishy(s, "bao-peachy-matte");
    expect(s.active).toBe("bao-peachy-matte");
    expect(s.team).toEqual(["bao-cherry-matte", "bao-rosy-matte", "bao-lilac-matte"]);
    expect(addHat(s, "party")).toBe(true);
    expect(addHat(s, "party")).toBe(false);
    expect(addHat(s, "nope")).toBe(false);
  });
});
